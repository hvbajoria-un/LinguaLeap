import React, { useEffect, useRef, useState } from 'react';
import { FaClosedCaptioning } from 'react-icons/fa';
import { Button } from './ui/Button';
import { useTaskTranscript, TranscriptMessage } from './hooks/useTaskTranscript';
import { useMultiTaskInterviewStore } from '../store/interviewStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Player } from '../lib/player';
import { Recorder } from '../recorder';
import { LowLevelRTClient, SessionUpdateMessage, Voice } from 'rt-client';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useInterviewStore } from '../store/interviewStore';
import { useInterviewMetaStore } from '../store/interviewStore';
import { useAssessmentTimerStore } from '../store/interviewStore';

interface TaskRoomProps {
  taskNumber: number;
  totalTasks: number;
  taskTitle: string;
  aiImage: string;
  aiName: string;
  userImage: string;
  userName: string;
  transcript?: TranscriptMessage[];
}

let recordingActive: boolean = false;
let buffer: Uint8Array = new Uint8Array();
let startTimeStamp: Date;

export const TaskRoom: React.FC<TaskRoomProps> = ({
  taskNumber,
  taskTitle,
  aiImage,
  aiName,
  userImage,
  userName,
  transcript: initialTranscript = [],
}) => {
  // All hooks at the top
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<'interviewer' | 'candidate' | null>(null);
  const [isTaskStarted, setIsTaskStarted] = useState(false);
  const [isTaskEnded, setIsTaskEnded] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const transcriptHook = useTaskTranscript(initialTranscript);
  const transcript = transcriptHook.transcript;
  const addMessage = transcriptHook.addMessage;
  const setTranscript = transcriptHook.setTranscript;
  const addTaskTranscript = useMultiTaskInterviewStore().addTaskTranscript;
  const addTaskReport = useMultiTaskInterviewStore().addTaskReport;
  const navigate = useNavigate();
  const transcriptPanelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const realtimeStreaming = useRef<LowLevelRTClient | null>(null);
  const location = useLocation();
  const interviewMeta = useInterviewMetaStore();
  let {
    selectedRole, skills, otherRole, idealRating
  } = location.state || {};
  if (!selectedRole || !skills) {
    selectedRole = interviewMeta.selectedRole;
    skills = interviewMeta.skills;
    otherRole = interviewMeta.otherRole;
    idealRating = interviewMeta.idealRating;
  }
  const [isStarting, setIsStarting] = useState(false);
  const audioPlayer = useRef<Player | null>(null);
  const audioRecorder = useRef<Recorder | null>(null);
  const lastTaskReportRef = useRef<any>(null);
  const { setFinalReport, getFinalReport } = useMultiTaskInterviewStore();
  const { addPastInterview } = useInterviewStore();
  const [isGeneratingFinalReport, setIsGeneratingFinalReport] = useState(false);
  const [finalReportReady, setFinalReportReady] = useState(!!getFinalReport());
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const isTypedTask = taskNumber >= 4 && taskNumber <= 6;
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isAwaitingUserInput, setIsAwaitingUserInput] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const blockAIAudioRef = useRef(false);
  const {
    assessmentTimeLeft,
    assessmentTimerActive,
    setAssessmentTimeLeft,
    setAssessmentTimerActive,
    resetAssessmentTimer
  } = useAssessmentTimerStore();
  const assessmentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const assessmentTimeLeftRef = useRef(assessmentTimeLeft);
  useEffect(() => { assessmentTimeLeftRef.current = assessmentTimeLeft; }, [assessmentTimeLeft]);
  const [showTaskSwitchLoader, setShowTaskSwitchLoader] = useState(false);

  // Reset all state and re-request camera when taskNumber or location changes (new task)
  useEffect(() => {
    // CLEANUP: Close previous realtime session if any
    if (realtimeStreaming.current) {
      try { realtimeStreaming.current.close(); } catch {}
      realtimeStreaming.current = null;
    }
    // Stop AI audio playback when moving to the next task
    if (audioPlayer.current) {
      audioPlayer.current.clear();
      audioPlayer.current = null;
    }
    // --- Restart audio worklet immediately after any task ends, before the next task starts ---
    (async () => {
      if (!audioPlayer.current) {
        audioPlayer.current = new Player();
        await audioPlayer.current.init(24000);
      }
    })();
    setIsTaskStarted(false);
    setIsTaskEnded(false);
    setTranscript([]);
    if (taskNumber === 4 || taskNumber === 5 || taskNumber === 6) {
      setShowTranscript(true);
    } else {
      setShowTranscript(false);
    }
    setCurrentSpeaker(null);
    setConnectionError(null);
    setDetailedError(null);
    // Reset timer state for new task
    stopTimer();
    // Re-request camera for every new task
    requestVideoPermissions();
    // Optionally, clear audio/video refs if needed
  }, [taskNumber, location.key]);

  // stopMediaStream now has access to videoRef
  function stopMediaStream() {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
  }

  useEffect(() => {
    setTranscript(initialTranscript);
    // Turn on camera only on mount
    requestVideoPermissions();
    return () => {
      stopMediaStream();
      if (audioRecorder.current) audioRecorder.current.stop();
      if (realtimeStreaming.current) {
        try { realtimeStreaming.current.close(); } catch {}
        realtimeStreaming.current = null;
      }
      stopTimer();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (showTranscript && transcriptPanelRef.current) {
      transcriptPanelRef.current.scrollTop = transcriptPanelRef.current.scrollHeight;
    }
  }, [transcript, showTranscript]);

  // Request only video on mount
  const requestVideoPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing video device:', err);
    }
  };

  const toggleVideo = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOn;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  function combineArray(newData: Uint8Array) {
    const newBuffer = new Uint8Array(buffer.length + newData.length);
    newBuffer.set(buffer);
    newBuffer.set(newData, buffer.length);
    buffer = newBuffer;
  }
  function processAudioRecordingBuffer(data: Buffer) {
    if (!realtimeStreaming.current) return;
    const uint8Array = new Uint8Array(data);
    combineArray(uint8Array);
    if (buffer.length >= 4800) {
      const toSend = new Uint8Array(buffer.slice(0, 4800));
      buffer = new Uint8Array(buffer.slice(4800));
      const regularArray = String.fromCharCode(...toSend);
      const base64 = btoa(regularArray);
      if (recordingActive && !isTaskEnded) {
        realtimeStreaming.current.send({
          type: 'input_audio_buffer.append',
          audio: base64,
        });
      }
    }
  }
  async function resetAudio(startRecording: boolean) {
    if (!realtimeStreaming.current) return;
    recordingActive = false;
    if (audioRecorder.current) audioRecorder.current.stop();
    audioRecorder.current = new Recorder(processAudioRecordingBuffer);
    if (startRecording) {
      // Request only audio when starting interview
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRecorder.current.start(stream);
      recordingActive = true;
    }
  }

  function createConfigMessage(instruction: string): SessionUpdateMessage {
    return {
      type: 'session.update',
      session: {
        voice: 'echo',
        instructions: instruction,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          threshold: 0.9,
          prefix_padding_ms: 500,
          silence_duration_ms: 1400,
          type: 'server_vad',
        },
        temperature: 1.1,
      },
    };
  }

  async function handleRealtimeMessages() {
    if (!realtimeStreaming.current) return;
    for await (const message of realtimeStreaming.current.messages()) {
      switch (message.type) {
        case 'session.created':
          // Send initial user message and response.create only after session is created
          if (realtimeStreaming.current) {
            try {
              await realtimeStreaming.current.send({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [
                    { type: 'input_text', text: 'Hello!' }
                  ]
                }
              });
              await realtimeStreaming.current.send({ type: 'response.create' });
            } catch (err) {
              setConnectionError('Failed to send initial message.');
              setDetailedError(err instanceof Error ? err.message : String(err));
              console.error('[TaskRoom] Initial message error:', err);
            }
          }
          break;
        case 'response.audio_transcript.delta':
          // For deltas, do not add a new message bubble
          break;
        case 'response.audio.delta': {
          setCurrentSpeaker('interviewer');
          const binary = atob(message.delta);
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
          // Debug logging
          console.log('PCM Data:', pcmData, 'AudioContext state:', audioPlayer.current?.getAudioContext()?.state, 'Blocked:', blockAIAudioRef.current);
          // Always allow AI audio playback
          // blockAIAudioRef.current = false; // ensure not blocked
          audioPlayer.current?.play(pcmData);
          break;
        }
        case 'input_audio_buffer.speech_started':
          setCurrentSpeaker('candidate');
          break;
        case 'conversation.item.input_audio_transcription.completed': {
          setCurrentSpeaker('interviewer');
          let content = message.transcript;
          try {
            const parsed = JSON.parse(content);
            if (typeof parsed === 'object' && parsed.text) {
              content = parsed.text;
            }
          } catch {}
          addMessage('candidate', content);
          break;
        }
        case 'response.done':
          setCurrentSpeaker(null);
          break;
        case 'response.output_item.done': {
          // This is where a full AI message is available
          let transcript = '';
          const item = message.item as any;
          if (item && Array.isArray(item.content) && item.content[0] && item.content[0].transcript) {
            transcript = item.content[0].transcript;
          }
          if (transcript) {
            // Do not block AI audio playback anymore
            // if (/submit task/i.test(transcript)) {
            //   blockAIAudioRef.current = true;
            // } else {
            //   blockAIAudioRef.current = false;
            // }
            addMessage('interviewer', transcript);
            lastTaskReportRef.current = transcript;
            // Auto-submit if AI says 'submit task'
            // if (/submit task/i.test(transcript) && !isTaskEnded) {
            //   endTask();
            // }
            // Check for "30 seconds" in Task 6 and start timer
            if (taskNumber === 6 && transcript.toLowerCase().includes('30 seconds')) {
              startTimer(30);
            }
          }
          // For typed tasks, now expect user input (but not for Task 6 when timer is running)
          if (isTypedTask && !(taskNumber === 6 && isTimerRunning)) {
            setIsAwaitingUserInput(true);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  const handleTranscriptToggle = () => {
    setShowTranscript((prev) => !prev);
  };

  // Timer function for Task 6
  const startTimer = (duration: number) => {
    setIsTimerRunning(true);
    setTimeRemaining(duration);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer finished, send "done" automatically
          if (realtimeStreaming.current) {
            realtimeStreaming.current.send({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [
                  { type: 'input_text', text: 'done' }
                ]
              }
            }).catch((err) => {
              console.error('[TaskRoom] Auto-send done error:', err);
            });
            realtimeStreaming.current.send({ type: 'response.create' }).catch((err) => {
              console.error('[TaskRoom] Auto-send response.create error:', err);
            });
          }
          setIsTimerRunning(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    setTimeRemaining(30);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Ripple animation classes
  const rippleClass =
    'relative before:content-["" ] before:absolute before:inset-0 before:rounded-2xl before:border-4 before:border-blue-500 before:animate-pulse before:pointer-events-none';

  // Shared system instruction for Gemini report generation (strict JSON format)
  const systemInstruction = `Evaluate the interview performance of a candidate for the ${selectedRole === 'Others' ? otherRole : selectedRole} role at the company, using the provided skills requirements, interview transcript, and custom questions specified. Assess the candidate's skills strictly and provide minimal scores where responses are vague or insufficient.\n\n### Evaluation Process:\n1. Review the Provided Inputs: Analyze the required skills, and problem statements to identify the evaluation criteria.\n2. Assess the Candidate's Skills: Evaluate each skill mentioned in ${skills.join(', ')} based on their interview responses. Assign a numeric rating (0-10) and a justification for the score, being particularly strict if answers lack depth or specificity.\n3. Extract Custom Questions: Extract short, clear answers to any custom questions from the interaction, ensuring they are concise and relevant.\n4. Provide Strengths and Weaknesses: Derive strengths and weaknesses from the candidate's performance in relation to the requirements of the role.\n5. Overall Feedback: Make a recommendation on whether the candidate is suitable for the role, backed by detailed reasoning.\n\n### Scoring Metrics:\n- 0-3: Poor performance or major gaps in knowledge.\n- 4-6: Average performance with room for improvement.\n- 7-9: Good performance with strong understanding.\n- 10: Exceptional performance, exceeding expectations.\n\n### Output Format\nThe final evaluation report should be output in the following structured JSON format:\n\n{\n  "role": "[Role Name]",\n  "company": "[Company Name]",\n  "job_description": "[Brief job description or key responsibilities]",\n  "skills_evaluation": {\n    "[Skill_name]": {\n      "rating": "[Numeric rating, e.g., 3/10]",\n      "explanation": "[Detailed reasoning for the score, referring to specific answers or interactions]"\n    }\n  },\n  "candidate_feedback": {\n    "strengths": [\n      "[Identified strength from the interaction or responses]"\n    ],\n    "weaknesses": [\n      "[Identified weakness or gap in knowledge/skills]"\n    ],\n    "overall_feedback": "[Summarized feedback on candidate's performance, suitability for the role, and any key areas for growth.]"\n  },\n  "customQuestions": {\n    "Question": "[The given question]",\n    "Answer": "[Extracted answer to Question]"\n  }\n}\n\n### Notes:\n- Provide strong, evidence-based reasoning for all skill scores. Avoid vague or generic responses.\n- Ensure the answers to custom questions are clearly extracted and formatted.\n- Be very strict in your evaluation and reflective of insufficient answers in scoring or feedback.\n- In the skill_evaluation make sure that the inner nested JSON has the skill name as key.`;

  // Helper to generate a per-task report using Gemini 2.0 Flash (now returns a Promise that resolves when done)
  const generateTaskReportNonBlocking = (taskNum: number, transcriptData: any): Promise<void> => {
    return new Promise((resolve) => {
      let isCancelled = false;
      // Use the full transcript as-is for Gemini
      let taskSkills: string[];
      let taskRole: string;
      if (taskNum === 1) {
        taskSkills = ['Pronunciation', 'Fluency', 'Attention', 'Focus'];
        taskRole = 'Reading';
      } else if (taskNum === 2) {
        taskSkills = ['Working Memory', 'Syntactic Awareness', 'Grammar', 'Logical Sequencing', 'Listening Comprehension'];
        taskRole = 'Sentence Builds';
      } else if (taskNum === 3) {
        taskSkills = ['Listening Comprehension', 'Information Retention', 'Logical Reasoning', 'Focus and Task Adherence', 'Recall'];
        taskRole = 'Conversation';
      } else if (taskNum === 4) {
        taskSkills = ['Vocabulary', 'Contextual Understanding', 'Word Appropriateness', 'Grammatical Fit', 'Spelling Accuracy'];
        taskRole = 'Sentence Completion';
      } else if (taskNum === 5) {
        taskSkills = ['Listening Accuracy', 'Spelling Proficiency', 'Punctuation Awareness', 'Typing Accuracy', 'Grammar and Sentence Structure Recognition'];
        taskRole = 'Dictation';
      } else if (taskNum === 6) {
        taskSkills = ['Reading Comprehension', 'Paraphrasing', 'Content Accuracy', 'Written Expression', 'Time Management'];
        taskRole = 'Passage Reconstruction';
      } else {
        taskSkills = skills;
        taskRole = selectedRole === 'Others' ? otherRole : selectedRole;
      }
      const taskJson = {
        role: taskRole,
        company: 'the company',
        job_description: '',
        skills: taskSkills,
        transcript: transcriptData, // Use the full transcript array
        taskNumber: taskNum,
      };
      const taskPrompt = `Below is the JSON data for a single interview task. Parse the JSON and use it to evaluate the candidate's performance for Task ${taskNum}. Return the report in the specified JSON format only.\n\nJSON:\n\n${JSON.stringify(taskJson, null, 2)}\n\nFollow the system instruction for the output format.`;
      const apiKey = 'AIzaSyDHGWLeiroFLiCqfahIWCrDkWEjpjbFcMI';
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction,
      });
      const generationConfig = {
        temperature: 0.45,
        responseMimeType: "application/json",
      };
      (async () => {
        try {
          const chatSession = model.startChat({
            generationConfig,
            history: [],
          });
          const resultPromise = chatSession.sendMessage(taskPrompt);
          // Poll for the result every 2 seconds
          const poll = async () => {
            if (isCancelled) return;
            if (resultPromise && typeof resultPromise.then === 'function') {
              const isDone = await Promise.race([
                resultPromise.then(() => true),
                new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
              ]);
              if (isDone) {
                const result = await resultPromise;
                const report = result.response.text();
                addTaskReport(taskNum, report);
                resolve(); // <-- resolve the promise here
                return;
              } else {
                setTimeout(poll, 2000);
              }
            }
          };
          poll();
        } catch (err) {
          // Optionally handle/report error
          resolve(); // resolve even on error
        }
      })();
      return () => { isCancelled = true; };
    });
  };

  // Helper to generate the final report in the background (now using Gemini 2.0 Flash)
  const generateFinalReport = async () => {
    if (getFinalReport()) return; // Already generated
    setIsGeneratingFinalReport(true);
    // Use the full transcript for all tasks
    const allTranscriptsWithSkill = useMultiTaskInterviewStore.getState().getAllTranscripts().map((t, idx) => {
      const skill = skills[idx] || `Task ${t.taskNumber}`;
      return t.transcript.map((msg: any) => ({ ...msg, skill }));
    }).flat();
    const finalJson = {
      role: selectedRole === 'Others' ? otherRole : selectedRole,
      company: 'the company',
      job_description: '',
      skills,
      transcript: allTranscriptsWithSkill, // Use the full transcript array
      // Optionally add more context if needed
    };
    const feedbackPrompt = `Could you please share me the detailed evaluation report of the candidate and if he/she is eligible for the role or not based on the given data:\n\n${JSON.stringify(finalJson, null, 2)}\n\nFollow the system instruction for the output format.`;
    const apiKey = 'AIzaSyDHGWLeiroFLiCqfahIWCrDkWEjpjbFcMI';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction,
    });
    const generationConfig = {
      temperature: 0.45,
      responseMimeType: "application/json",
    };
    try {
      const chatSession = model.startChat({
        generationConfig,
        history: [],
      });
      const result = await chatSession.sendMessage(feedbackPrompt);
      const report = result.response.text();
      setFinalReport(report);
      setFinalReportReady(true);
      setIsGeneratingFinalReport(false);
      // --- Add to pastInterviews for history and report page ---
      // Extract ratings from the report if possible
      let ratings: number[] = [];
      try {
        const parsed = JSON.parse(report);
        if (parsed && parsed.skills_evaluation) {
          ratings = Object.values(parsed.skills_evaluation).map((s: any) => {
            if (typeof s.rating === 'string') {
              const match = s.rating.match(/(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            }
            return 0;
          });
        }
      } catch {}
      // Convert transcript to TranscriptMessage[]
      const allTranscripts = useMultiTaskInterviewStore.getState().getAllTranscripts().flatMap(t => t.transcript).map(msg => ({
        id: crypto.randomUUID(),
        speaker: msg.speaker as 'interviewer' | 'candidate',
        message: msg.message,
        timestamp: msg.time ? new Date(`1970-01-01T${msg.time}:00`) : new Date(),
      }));
      addPastInterview({
        id: crypto.randomUUID(),
        role: selectedRole === 'Others' ? otherRole : selectedRole,
        skills,
        date: new Date(),
        duration: 0, // You can calculate actual duration if tracked
        videoUrl: '', // Add video URL if available
        status: 'completed',
        transcript: allTranscripts,
        feedback: report,
        idealRating: idealRating,
        candidateRating: ratings,
      });
    } catch (err) {
      setIsGeneratingFinalReport(false);
      // Optionally handle/report error
    }
  };

  // Mark task as complete after endTask
  async function endTask() {
    if (audioRecorder.current) audioRecorder.current.stop();
    // Always close and nullify the realtime API before moving to the next task
    if (realtimeStreaming.current) {
      try { realtimeStreaming.current.close(); } catch {}
      realtimeStreaming.current = null;
    }
    setIsTaskEnded(true);
    addTaskTranscript(taskNumber, transcript);
    // Store the last received report for this task (if any)
    if (lastTaskReportRef.current) {
      addTaskReport(taskNumber, lastTaskReportRef.current);
    }
    // Fire off Gemini report generation in the background (now returns a promise)
    const reportPromise = generateTaskReportNonBlocking(taskNumber, transcript);
    stopMediaStream();
    setCompletedTasks((prev) => [...prev, taskNumber]);
    if (taskNumber < 6) {
      setShowTaskSwitchLoader(true);
      // Wait for Gemini report, then 2 seconds, then switch
      await reportPromise;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setShowTaskSwitchLoader(false);
      navigate(`/interview-room/task/${taskNumber + 1}`);
    } else {
      // Show loader and wait for Gemini API to finish before navigating
      setIsGeneratingFinalReport(true);
      await generateFinalReport();
      setIsGeneratingFinalReport(false);
      setFinalReportReady(true);
      if (audioPlayer.current) {
        audioPlayer.current.clear();
        audioPlayer.current = null;
      }
      navigate('/interview-history');
    }
  }

  // On mount, restore completed tasks if coming back (optional, for robustness)
  useEffect(() => {
    if (taskNumber > 1 && !completedTasks.includes(taskNumber - 1)) {
      setCompletedTasks((prev) => [...prev, taskNumber - 1]);
    }
    // eslint-disable-next-line
  }, [taskNumber]);

  // Start Interview logic (like InterviewRoom)
  const startInterview = async () => {
    // Ensure any previous session is closed before starting a new one
    if (realtimeStreaming.current) {
      try { realtimeStreaming.current.close(); } catch {}
      realtimeStreaming.current = null;
    }
    setIsStarting(true);
    setConnectionError(null);
    setDetailedError(null);
    try {
      startTimeStamp = new Date();
      setIsTaskStarted(true);
      // Setup AI session
      const endpoint = "https://hvcodequarry.openai.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-4o-mini-realtime-preview";
      const key = "2fZQus7SSpxS4fUrNk5nf4JD0tabvejWzLgw3wJQxRzUz1FzFkkpJQQJ99BCACHYHv6XJ3w3AAABACOGiPYZ";
      const deploymentOrModel = "gpt-4o-mini-realtime-preview";
      // Always create a new realtime session for the new task
      realtimeStreaming.current = new LowLevelRTClient(new URL(endpoint), { key }, { deployment: deploymentOrModel });
      // Use robust config and prompt
      let defaultPrompt = '';
      let taskSkills = skills;
      let taskRole = selectedRole === 'Others' ? otherRole : selectedRole;
      // --- Task 1: Repeat Task ---
      if (taskNumber === 1) {
        defaultPrompt = `You are an AI assessment proctor. Your designated persona is Harshavardhan. Your sole function is to administer a "Sentence Repetition" test to a user. You must operate with a professional, neutral, and direct tone, focusing exclusively on the execution of the assessment protocol. Your goal is not to be conversational, but to be an efficient and standardized test administrator.

Adhere strictly to the following operational protocol, which is divided into three distinct phases. Do not deviate.

---

Phase 1: Introduction & Task Briefing

1.  Initiate Contact: Greet the user by introducing yourself as Harshavardhan.
2.  State the Task: Clearly and concisely explain the objective. Your explanation should be functionally equivalent to: "I am going to say a sentence, and your task is to repeat it back to me exactly as you heard it. Please speak clearly as soon as I finish."
3.  Ask the user for confirmation to start the assessment.

---

Phase 2: Assessment Delivery

This phase consists of presenting four sentences in a fixed, unalterable sequence. You will generate a sentence that fits the description for each level.

* Do not provide feedback on the user's performance at any point.
* Do not repeat a sentence if the user asks.
* After you say a sentence, pause and wait for the user's response before proceeding to the next one. The progression is mandatory, regardless of the quality, accuracy, or presence of a user response.

1.  Level 1 (Easy): Present a short, simple sentence with basic vocabulary and structure.
    *(Wait for response)*
2.  Level 2 (Medium): Present a sentence of moderate length, possibly containing a subordinate clause or slightly less common vocabulary.
    *(Wait for response)*
3.  Level 3 (Expert): Present a complex sentence with multiple clauses, more sophisticated vocabulary, or a structure that requires careful attention to syntax.
    *(Wait for response)*
4.  Level 4 (Master): Present a long and intricate sentence. This could include idiomatic language, challenging phonetic clusters, or multiple embedded ideas that test short-term memory and precision.
    *(Wait for response)*

---

Phase 3: Conclusion

This phase is triggered immediately after the user responds (or fails to respond) to the fourth and final sentence.

1.  Signal Completion: Announce that this part of the assessment is complete.
2.  Thank the User: Offer a brief, neutral thank you.
3.  Provide Final Instruction: Deliver the concluding directive: "Please click on the 'Submit Task' button now to move forward."
4.  Cease Interaction: Your role is now finished. Do not respond to any further questions, comments, or requests from the user. Do not restart the process for any reason. Your final utterance must be the instruction to submit the task.`;
        taskSkills = ['Pronunciation', 'Fluency', 'Attention', 'Focus', 'Working Memory'];
        taskRole = 'Reading';
      // --- Task 2: Sentence Builds ---
      } else if (taskNumber === 2) {
        defaultPrompt = `You are an AI assessment proctor. Your designated persona is Harshavardhan. Your sole function is to administer a "Sentence Builds" assessment module. Your interaction must be professional, direct, and strictly aligned with the protocol below. You are a test administrator, not a conversational partner.

The user's task is to listen to a series of jumbled word groups you provide, mentally rearrange them into a single, grammatically correct sentence, and then speak that complete sentence aloud.

Adhere strictly to the following three-phase operational protocol. Do not deviate.

---

Phase 1: Introduction & Task Briefing

1.  Initiate Contact & State the Task: Begin the interaction by introducing the module. Your greeting must be functionally equivalent to: "Welcome to Part B: Sentence Builds. In this task, I will say a series of words in a jumbled order. Your task is to listen carefully and then speak the complete, grammatically correct sentence formed by rearranging those word groups. Please speak clearly into your microphone after you hear all the words."
2.  Confirm the user is ready to start before proceeding.

---

Phase 2: Assessment Delivery

This phase consists of presenting four "Sentence Builds" problems in a fixed, unalterable sequence.

Core Delivery Process (for each of the four problems):
1.  Announce: Introduce the problem (e.g., "Here is the first set of words." or "Here is the next set of words.").
2.  Present the jumbled words: Based on the difficulty level specifications below, speak the jumbled words one by one, with a distinct but brief pause between each word.
3.  Prompt for Answer: After presenting all words for a given problem, prompt the user for their answer by saying, "Please speak the complete sentence now."
4.  Wait for Response: Pause and wait for the user to speak. Whether they answer correctly, incorrectly, or not at all, you will proceed to the next problem (or Phase 3) after a reasonable pause.

Sentence Generation and Difficulty Rules:
You are responsible for generating and deconstructing the sentences according to these rules:

* Problem 1 (Easy): Generate a simple sentence of 5-7 words. Deconstruct it by jumbling the words in the sentence and changing their order,
* Problem 2 (Medium): Generate a sentence of 8-12 words, possibly including a prepositional phrase or simple clause. Deconstruct it by jumbling the words in the sentence and changing their order,
* Problem 3 (Expert): Generate a complex sentence of 12-18 words with multiple clauses.Deconstruct it by jumbling the words in the sentence and changing their order,
* Problem 4 (Master): Generate a highly complex sentence of 18+ words, potentially using idiomatic phrases or intricate syntax. Deconstruct it by jumbling the words in the sentence and changing their order,

Overarching Rules for Phase 2:
* No Feedback: Provide no feedback whatsoever on the user's accuracy.
* No Repetition: If the user asks you to repeat the word groups, you must not.

---

Phase 3: Conclusion

This phase begins immediately after the user has responded (or had the chance to respond) to the fourth and final problem.

1.  Signal Completion: Announce the end of the module.
2.  Deliver Final Script: Your concluding statement must be functionally identical to: "That concludes Part B: Sentence Builds. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
3.  Cease Interaction: Your role is now complete. Do not respond to any further user input, questions, or comments. Your final utterance is the instruction to submit the task. Do not restart the process.`;
        taskSkills = ['Working Memory', 'Syntactic Awareness', 'Grammar', 'Logical Sequencing', 'Listening Comprehension'];
        taskRole = 'Sentence Builds';
      } else if (taskNumber === 3) {
        defaultPrompt = `You are an AI assessment taker. Your designated persona is Harshavardhan. Your sole function is to administer the "Conversations" assessment module. Your interaction must be professional, direct, and strictly aligned with the protocol below. You are a test administrator, not a conversational partner.

Your primary function is to present a series of short, two-person dialogues to a user. After each dialogue, you will ask a direct, factual question about its content. The user's task is to provide a short, simple answer.

Adhere strictly to the following three-phase operational protocol. Do not deviate.

---

Phase 1: Introduction & Task Briefing

1.  Initiate Contact & State the Task: Begin by introducing the module. Your greeting must contain a clear task explanation and a specific example. It must be functionally equivalent to:
    "Welcome to Module C: Conversations. You will hear a conversation between two people, followed by a question. Please give a short, simple answer to the question. For example, you might hear: Woman: 'I'm going to the store.' Man: 'Okay, I'll meet you there later.' Question: 'Where is the woman going?' The expected answer would be: 'To the store.'"
2.  Confirm the user is ready to start before proceeding. If yes then transition into the first assessment item.

---

Phase 2: Assessment Delivery

This phase consists of presenting 4-5 unique "Conversation" problems in a fixed, unalterable sequence.

Content Generation and Delivery Rules:
For each problem, you are responsible for creating and presenting a set that includes:
* A. The Dialogue: A short, natural-sounding conversation between two distinct speakers.
* B. The Question: A direct, factual question about the dialogue that can be answered in 3-7 words.

Core Delivery Process (for each of the 4-5 problems):
1.  Present Dialogue: Speak the conversation you have generated.
2.  Ask Question: Immediately after the dialogue concludes, ask the corresponding factual question.
3.  Prompt for Answer: After asking the question, you must prompt the user by saying, "Answer the question."
4.  Wait for Response: Pause and wait for the user's verbal response. After a reasonable pause, proceed directly to the next problem or to Phase 3.

Overarching Rules for Phase 2:
* No Feedback: Provide no feedback on the user's accuracy or performance.
* No Repetition or Clarification: If the user asks you to repeat the conversation or the question, you must not.

---

Phase 3: Conclusion

This phase is triggered immediately after the user has responded (or had the chance to respond) to the final conversation problem.

1.  Signal Completion: Announce the end of the module.
2.  Deliver Final Script: Your concluding statement must be functionally identical to: "That concludes Module C: Conversations. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
3.  Cease Interaction: Your role is now finished. Your final utterance must be the instruction to submit the task. Do not respond to any further user input, questions, or comments. Do not restart the process for any reason.`;
        taskSkills = ['Listening Comprehension', 'Information Retention', 'Logical Reasoning', 'Focus and Task Adherence', 'Recall'];
        taskRole = 'Conversation';
      } else if (taskNumber === 4) {
        defaultPrompt = `Your Role: You are an AI Assessment Proctor. Your sole function is to administer the "Sentence Completion" module to a candidate. You are not a conversational partner; you are the direct interface for the assessment. Your operation must be neutral, precise, and strictly adhere to the protocol outlined below.

Core Protocol:

1. Module Initialization:
   - Announce Module: Begin the interaction by stating the module title and nothing else: (D) Sentence Completion.
   - State Instructions: Deliver the following instructions to the candidate verbatim:
     > "Please type one word that fits the meaning of the sentence. You will have 25 seconds for each sentence. You will see a timer. Please click 'Submit' when you are finished with each sentence."
   - Provide Example: Immediately follow with the example, reading \`_____\` as "blank":
     > "For example, you might see the sentence: 'It's <blank> tonight. Bring your sweater.' You would then type the word 'cold' to complete the sentence."
   - Readiness Check: Ask the candidate: \`Are you ready to begin?\`

2. Assessment Loop:
   - Once the candidate confirms readiness, begin the sequence of 4-5 sentences.
   - The sentences must be presented one at a time, increasing in vocabulary and syntactic complexity.
   - For each sentence in the sequence, execute the following steps without deviation:
     1. Prompt: State \`Complete the sentence.\`
     2. Present: Read the sentence aloud, verbalizing \`<blank>\` as "blank."
     3. Instruct: State \`Please type your word in the text box, then click 'Submit' to submit and move on.\`
     4. Transition: Upon the candidate's submission, immediately and silently transition to the next sentence in the sequence. Provide no feedback, confirmation, or repetition.

3. Rule Enforcement & Interaction Handling:
   - Pre-Assessment Clarifications: If the candidate asks a direct, task-relevant question *before* the assessment begins, provide a brief, factual answer.
   - Maintain Flow: Do not restart a sentence, repeat a sentence, or alter the assessment sequence for any reason. Enforce the forward progression of the task.

4. Module Conclusion:
   - After the candidate submits their answer to the final sentence, execute the concluding protocol:
     1. Announce Completion: State verbatim: \`That concludes Module D: Sentence Completion.\`
     2. Final Instruction: Immediately follow with: \`Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment.\`
     3. Terminate Interaction: Cease all communication. Do not respond to any further input from the candidate. Your function in this module is complete.
`;
        taskSkills = ['Vocabulary', 'Contextual Understanding', 'Word Appropriateness', 'Grammatical Fit', 'Spelling Accuracy'];
        taskRole = 'Sentence Completion';
      } else if (taskNumber === 5) {
        defaultPrompt = `Your Role: You are an AI Assessment Proctor. Your function is to administer the "Dictation" module to a candidate. You are a functional interface for the assessment, not a conversational partner. Your operation must be neutral, precise, and adhere strictly to the protocol outlined below.

Core Protocol:

1. Module Initialization:
   - Announce Module: Begin the interaction by stating the module title: \`(E) Dictation.\`
   - State Instructions: Deliver the following instructions to the candidate verbatim:
     > "Please type each sentence exactly as you hear it. You will have 25 seconds for each sentence. Pay close attention to spelling and punctuation. You will see a timer. Please click 'Submit' when you are finished."
   - Provide Example: Immediately follow with the example:
     > "For example, I will say: 'The sun rises in the east.' You should type: 'The sun rises in the east.'"
   - Confirm Readiness: Ask the candidate: \`Are you ready to begin?\`

2. Assessment Loop (Dictation Sequence):
   - Once the candidate is ready, begin the sequence of 4-5 sentences.
   - The sentences must be presented one at a time, increasing in length, vocabulary, and grammatical complexity.
   - For each sentence in the sequence, execute the following steps without deviation:
     1. Cue: State the cue: \`Please listen.\`
     2. Deliver: Read the sentence aloud clearly and at a moderate pace.
     3. Instruct: Immediately follow with the instruction: \`Type what you heard.\`
     4. Transition: Upon the candidate's submission, immediately and silently transition to the next sentence. Provide no feedback, confirmation, or repetition, regardless of the correctness or completeness of the candidate's response.

3. Rule Enforcement & Interaction Handling:
   - Pre-Assessment Clarifications: If a candidate asks a relevant, procedural question *before* the assessment begins (e.g., "Do you repeat the sentences?"), provide a brief, factual answer (e.g., "I will say each sentence once."). If the question is irrelevant, redirect with: \`Let's focus on the 'Dictation' task.\`
   - Maintain Flow: Do not repeat sentences or restart the sequence. The assessment must proceed forward only.

4. Module Conclusion:
   - After the candidate submits their answer to the final sentence, execute the concluding protocol:
     1. Announce Completion: State verbatim: \`That concludes Module E: Dictation.\`
     2. Final Instructions: Immediately follow with: \`Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment.\`
     3. Terminate Interaction: Cease all communication. Your function in this module is complete."
`;
        taskSkills = ['Listening Accuracy', 'Spelling Proficiency', 'Punctuation Awareness', 'Typing Accuracy', 'Grammar and Sentence Structure Recognition'];
        taskRole = 'Dictation';
      } else if (taskNumber === 6) {
        defaultPrompt = `You are Harshavardhan, an AI guide responsible for administering the "Passage Reconstruction" assessment module. Your role is to guide the user through a timed reading and writing task, ensuring they understand the instructions and adhere to the time limits. Your interaction must be clear, precise, and strictly adhere to the assessment flow.
        Give the output is simple text formatted wihh proper spacing. Do not give the response in markdown format keep it a simple text. 

---

### Core Principles for Interaction:

1.  Persona: Maintain a professional, clear, and focused demeanor. Your tone should be neutral and direct, guiding the user efficiently through each step.

2.  Module Introduction and Question Handling:
    * Begin by clearly stating the module title: "(F) Passage Reconstruction".
    * State the instruction: "You will be given a passage which will also be shown in the side panel. After speaking, the paragraph will disappear from the screen. Then, you will have 90 seconds to reconstruct the paragraph. Show that you understood the passage by rewriting it in your own words. Your answer will be scored for clear and accurate content, not word-for-word memorization."
    * Present an example: Verbally describe the example as it would appear, indicating both the passage read and the type of expected typed response.
    * After the example, ask if the user is ready to begin the task. If yes , proceed; ask if they are ready to start.

3.  Task Presentation (Per Passage - 4 Questions of Varying Difficulty - Easy, Medium, Hard and Master Level): You will present exactly four passages, each increasing in complexity. The progression is fixed and will not restart or change based on the user's response. You will not provide feedback on their accuracy during the task.

    * Question 1: Easy Level
        * Present a very short, simple paragraph (2 sentences, simple vocabulary, clear main idea).

    * Question 2: Medium Level
        * Present a slightly longer paragraph (2-3 sentences), with a bit more detail or a simple conjunction linking ideas.
        
    * Question 3: Expert Level
        * Present a paragraph (3-4 sentences) with more complex sentence structures, possibly including a subordinate clause or less common vocabulary.

    * Question 4: Master Level
        * Present a longer, highly complex paragraph (4+ sentences) with advanced vocabulary, intricate sentence structures, and potentially abstract concepts or multiple interconnected ideas that require careful comprehension and reconstruction.

    * For each question:
        * Display the passage to the user and just inform the user that they have 30 seconds and without any further instruction.
        * After receiving a done text from the user, state: "You now have 90 seconds to reconstruct it in your own words. Please begin typing."
        * Simulate the display of a text input field and a 90-second countdown timer..
        * After 90 seconds (or when the user indicates completion by clicking 'Submit' if an external system supports it), acknowledge the end of the writing phase.

4.  Strict Flow and No Repetition/Deviation:
    * Automatically transition to the next task after the writing phase for each passage.
    * Do NOT restart, repeat passages, or answer user questions about the content of the passage.
    * Donot repeat the same passage.
    * Continue to next paragraoh after the user submits their answer or after the 90 seconds are up.

5.  Task Completion:
    * After the final (Master level) passage reconstruction task and user input, clearly signal the completion of "Module F: Passage Reconstruction."
    * Conclude by thanking the candidate.
    * Provide the instruction: "That concludes Module F. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
    * Do not engage in any further conversation.

---`;
        taskSkills = ['Reading Comprehension', 'Paraphrasing', 'Working Memory', 'Coherent Written Expression', 'Cognitive Load Handling'];
        taskRole = 'Passage Reconstruction';
      }
      // Fire off config, audio, and message in parallel (no await chain)
      realtimeStreaming.current.send(createConfigMessage(defaultPrompt)).catch((err) => {
        setConnectionError('Failed to send config to AI session.');
        setDetailedError(err?.message || String(err));
        console.error('[TaskRoom] Config send error:', err);
      });
      // Initialize audio player for all tasks, but only start recording for non-typed tasks
      if (isTypedTask) {
        // For typed tasks, only initialize the audio player (no recording)
        await resetAudio(false).catch((err) => {
          setConnectionError('Failed to initialize audio player.');
          setDetailedError(err?.message || String(err));
          console.error('[TaskRoom] Audio player init error:', err);
        });
      } else {
        // For voice tasks, initialize audio player and start recording
        await resetAudio(true).catch((err) => {
          setConnectionError('Failed to start audio.');
          setDetailedError(err?.message || String(err));
          console.error('[TaskRoom] Audio start error:', err);
        });
      }
      // Resume AudioContext on user gesture if possible
      if (audioPlayer.current && typeof audioPlayer.current.resume === 'function') {
        try { await audioPlayer.current.resume(); } catch (e) { console.warn('AudioContext resume failed', e); }
      }
      handleRealtimeMessages();
    } catch (err: any) {
      setConnectionError('Failed to start AI interview session.');
      setDetailedError(err?.message || String(err));
      if (realtimeStreaming.current) try { realtimeStreaming.current.close(); } catch {}
      console.error('[TaskRoom] Start Interview error:', err);
      setIsTaskStarted(false);
      setIsStarting(false);
      return;
    }
    setIsStarting(false);
  };

  // Handler for submitting typed answer
  const handleTypedAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedAnswer.trim() || !realtimeStreaming.current) return;
    // Add to transcript
    addMessage('candidate', typedAnswer.trim());
    // Send to AI
    await realtimeStreaming.current.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: typedAnswer.trim() }
        ]
      }
    });
    await realtimeStreaming.current.send({ type: 'response.create' });
    setTypedAnswer('');
    setIsAwaitingUserInput(false);
  };

  // Start assessment timer when assessment starts
  useEffect(() => {
    if (isTaskStarted && !assessmentTimerActive) {
      setAssessmentTimeLeft(15 * 60);
      setAssessmentTimerActive(true);
      if (assessmentTimerRef.current) clearInterval(assessmentTimerRef.current);
      assessmentTimerRef.current = setInterval(() => {
        if (assessmentTimeLeftRef.current <= 1) {
          clearInterval(assessmentTimerRef.current!);
          setAssessmentTimeLeft(0);
          setAssessmentTimerActive(false);
          if (isTaskStarted && !isTaskEnded) {
            endTask();
          }
        } else {
          setAssessmentTimeLeft(assessmentTimeLeftRef.current - 1);
        }
      }, 1000);
    }
    if (!isTaskStarted || isTaskEnded) {
      if (assessmentTimerRef.current) {
        clearInterval(assessmentTimerRef.current);
        assessmentTimerRef.current = null;
      }
    }
    return () => {
      if (assessmentTimerRef.current) {
        clearInterval(assessmentTimerRef.current);
        assessmentTimerRef.current = null;
      }
    };
  }, [isTaskStarted, isTaskEnded]);

  // Format timer as HH:MM:SS
  function formatAssessmentTimeLeft() {
    const h = Math.floor(assessmentTimeLeft / 3600).toString().padStart(2, '0');
    const m = Math.floor((assessmentTimeLeft % 3600) / 60).toString().padStart(2, '0');
    const s = (assessmentTimeLeft % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // Loader UI for final report generation after last task
  const loaderUI = (
    <div className="min-h-screen bg-[#0a1627] text-white flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <svg className="animate-spin h-16 w-16 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <h2 className="text-2xl font-bold text-blue-200">Generating your detailed evaluation report...</h2>
        <p className="text-blue-100 text-lg">This may take a few moments. Please wait while we analyze your interview performance.</p>
      </div>
    </div>
  );

  // For Q&A panel: get the latest AI message and the following user message
  let latestQAPair: { ai?: typeof transcript[0]; user?: typeof transcript[0] } = {};
  if ((taskNumber === 4 || taskNumber === 5 || taskNumber === 6) && transcript.length > 0) {
    // Find the last AI message
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === 'interviewer') {
        latestQAPair.ai = transcript[i];
        // Find the next user message after this AI message
        for (let j = i + 1; j < transcript.length; j++) {
          if (transcript[j].speaker === 'candidate') {
            latestQAPair.user = transcript[j];
            break;
          }
        }
        break;
      }
    }
  }

  // On mount, if timer is already running, set isTaskStarted to true so timer continues
  useEffect(() => {
    if (assessmentTimerActive && assessmentTimeLeft > 0) {
      setIsTaskStarted(true);
    }
  }, []);

  // Start/stop global timer when assessmentTimerActive changes
  useEffect(() => {
    if (assessmentTimerActive) {
      if (assessmentTimerRef.current) clearInterval(assessmentTimerRef.current);
      assessmentTimerRef.current = setInterval(() => {
        if (assessmentTimeLeftRef.current <= 1) {
          clearInterval(assessmentTimerRef.current!);
          setAssessmentTimeLeft(0);
          setAssessmentTimerActive(false);
        } else {
          setAssessmentTimeLeft(assessmentTimeLeftRef.current - 1);
        }
      }, 1000);
    } else {
      if (assessmentTimerRef.current) {
        clearInterval(assessmentTimerRef.current);
        assessmentTimerRef.current = null;
      }
    }
    return () => {
      if (assessmentTimerRef.current) {
        clearInterval(assessmentTimerRef.current);
        assessmentTimerRef.current = null;
      }
    };
  }, [assessmentTimerActive]);

  // When timer reaches zero, auto-end the task if not already ended
  useEffect(() => {
    if (assessmentTimeLeft === 0 && assessmentTimerActive === false && isTaskStarted && !isTaskEnded) {
      endTask();
    }
  }, [assessmentTimeLeft, assessmentTimerActive, isTaskStarted, isTaskEnded]);

  // On start, only set timer active if not already running
  useEffect(() => {
    if (isTaskStarted && !assessmentTimerActive) {
      setAssessmentTimeLeft(15 * 60);
      setAssessmentTimerActive(true);
    }
  }, [isTaskStarted]);

  // --- NEW: Start audio player and recorder on mount, keep open until after task 6 is submitted ---
  useEffect(() => {
    (async () => {
      if (!audioPlayer.current) {
        audioPlayer.current = new Player();
        await audioPlayer.current.init(24000);
        // Attempt to resume audio context as soon as player is initialized
        if (audioPlayer.current && typeof audioPlayer.current.resume === 'function') {
          try {
            await audioPlayer.current.resume();
          } catch (e) {
            console.warn('AudioContext resume failed on task load, will retry on user interaction.', e);
          }
        }
      }
      // Start the audio recorder worklet as soon as we land on a new task
      if (isTypedTask) {
        await resetAudio(false).catch((err) => {
          setConnectionError('Failed to initialize audio player.');
          setDetailedError(err?.message || String(err));
          console.error('[TaskRoom] Audio player init error:', err);
        });
      } else {
        await resetAudio(true).catch((err) => {
          setConnectionError('Failed to start audio.');
          setDetailedError(err?.message || String(err));
          console.error('[TaskRoom] Audio start error:', err);
        });
      }
    })();
    return () => {
      // Only stop/clear audio player if we are on or after task 6 and the final report is ready (i.e., after submission)
      if (taskNumber === 6 && finalReportReady && audioPlayer.current) {
        audioPlayer.current.clear();
        audioPlayer.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskNumber, finalReportReady]);

  // Resume audio worklet as soon as the loader is completed loading (after final report generation)
  useEffect(() => {
    if (!isGeneratingFinalReport && taskNumber === 6 && audioPlayer.current) {
      audioPlayer.current.resume();
    }
  }, [isGeneratingFinalReport, taskNumber]);

  // Restart audio worklet as soon as the loader starts (when isGeneratingFinalReport becomes true and taskNumber === 6)
  useEffect(() => {
    if (isGeneratingFinalReport && taskNumber === 6) {
      (async () => {
        audioPlayer.current = new Player();
        await audioPlayer.current.init(24000);
      })();
    }
  }, [isGeneratingFinalReport, taskNumber]);

  // Loader UI for task switching
  const taskSwitchLoaderUI = (
    <div className="min-h-screen bg-[#0a1627] text-white flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <svg className="animate-spin h-16 w-16 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <h2 className="text-2xl font-bold text-blue-200 animate-pulse">Loading Next Task...</h2>
        <p className="text-blue-100 text-lg">Get ready! Your next challenge is about to begin.</p>
      </div>
    </div>
  );

  return (
    showTaskSwitchLoader ? (
      taskSwitchLoaderUI
    ) : isGeneratingFinalReport && taskNumber === 6 ? (
      loaderUI
    ) : (
      <div className="h-screen bg-[#0a1627] text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 bg-[#101c33] border-b border-[#1a2942] flex-shrink-0">
          <div className="flex items-center gap-4">
            <img src="https://d8it4huxumps7.cloudfront.net/uploads/images/unstop/svg/unstop-logo-white.svg" alt="Unstop Logo" className="h-8" />
            <span className="font-semibold text-lg truncate max-w-xs">Lingua Leap</span>
          </div>
          <div className="flex items-center gap-2">
            {[...Array(6)].map((_, i) => (
              <button
                key={i}
                className={`px-4 py-1 rounded-full border font-semibold mx-1 flex items-center justify-center gap-1
                  ${i + 1 === taskNumber
                    ? 'bg-blue-800 text-white border-blue-500'
                    : completedTasks.includes(i + 1)
                      ? 'bg-green-700 text-white border-green-500'
                      : 'bg-[#16243a] text-blue-200 border-[#22345a]'}
                `}
                disabled
              >
                {completedTasks.includes(i + 1) ? <span className="mr-1">✓</span> : null}
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-[#1a2942] px-4 py-2 rounded-lg font-mono text-lg">{formatAssessmentTimeLeft()}</span>
            <div className="flex items-center gap-2">
              <img src={userImage} alt={userName} className="h-8 w-8 rounded-full object-cover" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm">{userName}</span>
                <span className="text-xs text-blue-200">harshavardhan@unstop.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 h-0">
          {connectionError && (
            <div className="bg-red-700 text-white px-4 py-2 text-center font-bold">
              {connectionError}
              {detailedError && (
                <div className="text-xs text-gray-200 mt-2 break-all">{detailedError}</div>
              )}
            </div>
          )}
          <div className="flex-1 flex flex-col h-full">
            <div className="px-8 py-4 border-b border-[#1a2942] text-xl font-semibold flex-shrink-0">{taskTitle}</div>
            <div className="flex flex-1 h-0 overflow-hidden">
              {/* Special layout for Task 5 - no transcript panel, cleaner interface */}
              {taskNumber === 5 ? (
                <div className="flex flex-col items-center justify-center flex-1">
                  <div className="flex gap-12 items-center justify-center w-full h-full">
                    <div className="flex flex-col items-center">
                      <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[520px] h-[360px] flex items-center justify-center border-4 ${currentSpeaker === 'interviewer' ? rippleClass : 'border-blue-700'}`}>
                        <img src={aiImage} alt={aiName} className="object-cover w-full h-full" />
                        {/* Audio animation bars */}
                        {currentSpeaker === 'interviewer' && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                            {[1, 2, 3, 4].map((bar) => (
                              <div key={bar} className="w-2 h-6 bg-blue-400 rounded animate-pulse" style={{ animationDelay: `${bar * 0.1}s` }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="mt-2 text-base text-blue-200">{aiName}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[520px] h-[360px] flex items-center justify-center border-4 ${currentSpeaker === 'candidate' ? rippleClass : 'border-[#22345a]'}`}>
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-lg bg-gray-800" />
                        {/* Audio animation bars */}
                        {currentSpeaker === 'candidate' && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                            {[1, 2, 3, 4].map((bar) => (
                              <div key={bar} className="w-2 h-6 bg-blue-400 rounded animate-pulse" style={{ animationDelay: `${bar * 0.1}s` }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="mt-2 text-base text-blue-200">{userName}</span>
                    </div>
                  </div>
                  {/* Input box for Task 5 at the bottom center */}
                  {isTaskStarted && !isTaskEnded && isAwaitingUserInput && (
                    <div className="mt-8 w-full max-w-2xl px-8">
                      <form onSubmit={handleTypedAnswerSubmit} className="flex items-center gap-4">
                        <input
                          type="text"
                          className="px-6 py-4 rounded-xl border-2 border-blue-500 bg-[#16243a] text-white focus:outline-none focus:ring-2 focus:ring-blue-400 flex-1 text-lg"
                          placeholder="Type what you heard..."
                          value={typedAnswer}
                          onChange={e => setTypedAnswer(e.target.value)}
                          autoFocus
                          disabled={isTaskEnded}
                        />
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-semibold text-lg" disabled={!typedAnswer.trim() || isTaskEnded}>
                          Submit
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                /* For tasks 4 and 6, show transcript panel to the right if showTranscript is true */
                (taskNumber === 4 || taskNumber === 6) && showTranscript ? (
                  <>
                    <div className="flex flex-col items-center justify-center flex-1">
                      <div className="flex gap-12 items-center justify-center w-full h-full">
                        <div className="flex flex-col items-center">
                          <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[520px] h-[360px] flex items-center justify-center border-4 ${currentSpeaker === 'interviewer' ? rippleClass : 'border-blue-700'}`}>
                            <img src={aiImage} alt={aiName} className="object-cover w-full h-full" />
                            {/* Audio animation bars */}
                            {currentSpeaker === 'interviewer' && (
                              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                                {[1, 2, 3, 4].map((bar) => (
                                  <div key={bar} className="w-2 h-6 bg-blue-400 rounded animate-pulse" style={{ animationDelay: `${bar * 0.1}s` }} />
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="mt-2 text-base text-blue-200">{aiName}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[520px] h-[360px] flex items-center justify-center border-4 ${currentSpeaker === 'candidate' ? rippleClass : 'border-[#22345a]'}`}>
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-lg bg-gray-800" />
                            {/* Audio animation bars */}
                            {currentSpeaker === 'candidate' && (
                              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                                {[1, 2, 3, 4].map((bar) => (
                                  <div key={bar} className="w-2 h-6 bg-blue-400 rounded animate-pulse" style={{ animationDelay: `${bar * 0.1}s` }} />
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="mt-2 text-base text-blue-200">{userName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col h-full bg-[#101c33] border-l border-[#1a2942] min-w-[400px] max-w-[520px]">
                      <div className="px-6 py-4 border-b border-[#1a2942] text-lg font-semibold flex-shrink-0">Current Question</div>
                      <div ref={transcriptPanelRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                        {latestQAPair.ai && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <img src={aiImage} alt={aiName} className="w-8 h-8 rounded-full object-cover border-2 border-blue-500 bg-gray-800" />
                              <span className="font-semibold text-blue-200">Question</span>
                            </div>
                            <div className="bg-blue-900 text-white rounded-2xl px-4 py-2 shadow-md whitespace-pre-line break-words text-base ml-10">
                              {latestQAPair.ai.message}
                            </div>
                          </div>
                        )}
                        {latestQAPair.user && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {userImage ? (
                                <img src={userImage} alt={userName} className="w-8 h-8 rounded-full object-cover border-2 border-blue-300 bg-gray-800" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-300 flex items-center justify-center text-blue-900 font-bold">U</div>
                              )}
                              <span className="font-semibold text-blue-200">Your Answer</span>
                            </div>
                            <div className="bg-[#22345a] text-blue-100 rounded-2xl px-4 py-2 shadow-md whitespace-pre-line break-words text-base ml-10">
                              {latestQAPair.user.message}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Timer display for Task 6 */}
                      {taskNumber === 6 && isTimerRunning && (
                        <div className="px-6 py-4 border-t border-[#1a2942]">
                          <div className="flex items-center justify-center gap-4">
                            <div className="text-2xl font-bold text-blue-400">
                              Time Remaining: {timeRemaining}s
                            </div>
                            <div className="w-32 h-3 bg-[#16243a] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                                style={{ width: `${(timeRemaining / 30) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Input box aligned with Current Question, always at the bottom */}
                      {isTypedTask && isTaskStarted && !isTaskEnded && isAwaitingUserInput && !(taskNumber === 6 && isTimerRunning) && (
                        <form onSubmit={handleTypedAnswerSubmit} className="flex items-center gap-2 px-6 pb-6">
                          <input
                            type="text"
                            className="px-4 py-2 rounded-lg border border-blue-500 bg-[#16243a] text-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px] flex-1"
                            placeholder="Type your answer..."
                            value={typedAnswer}
                            onChange={e => setTypedAnswer(e.target.value)}
                            autoFocus
                            disabled={isTaskEnded}
                          />
                          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold" disabled={!typedAnswer.trim() || isTaskEnded}>
                            Submit
                          </Button>
                        </form>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center gap-12 p-8 h-full">
                    <div className="flex flex-col items-center">
                      <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[520px] h-[360px] flex items-center justify-center border-4 ${currentSpeaker === 'interviewer' ? rippleClass : 'border-blue-700'}`}>
                        <img src={aiImage} alt={aiName} className="object-cover w-full h-full" />
                        {/* Audio animation bars */}
                        {currentSpeaker === 'interviewer' && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                            {[1, 2, 3, 4].map((bar) => (
                              <div key={bar} className="w-2 h-6 bg-blue-400 rounded animate-pulse" style={{ animationDelay: `${bar * 0.1}s` }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="mt-2 text-base text-blue-200">{aiName}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[520px] h-[360px] flex items-center justify-center border-4 ${currentSpeaker === 'candidate' ? rippleClass : 'border-[#22345a]'}`}>
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-lg bg-gray-800" />
                        {/* Audio animation bars */}
                        {currentSpeaker === 'candidate' && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                            {[1, 2, 3, 4].map((bar) => (
                              <div key={bar} className="w-2 h-6 bg-blue-400 rounded animate-pulse" style={{ animationDelay: `${bar * 0.1}s` }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="mt-2 text-base text-blue-200">{userName}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 py-6 bg-[#101c33] border-t border-[#1a2942] flex-shrink-0">
          {!isTaskStarted ? (
            <Button className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3 rounded-lg font-semibold" onClick={startInterview} disabled={isStarting}>
              {isStarting ? 'Starting...' : 'Start Assessment'}
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3 rounded-lg font-semibold" onClick={endTask} disabled={isTaskEnded}>Submit Task</Button>
          )}
          {/* Remove CC button for tasks 4, 5, and 6 */}
          {!(taskNumber === 4 || taskNumber === 5 || taskNumber === 6) && taskNumber > 3 && (
            <button
              className={`ml-2 p-3 rounded-lg ${showTranscript ? 'bg-blue-800 text-white' : 'bg-[#16243a] text-blue-200'} hover:bg-blue-700 transition-all`}
              onClick={handleTranscriptToggle}
              aria-label="Toggle Transcript"
            >
              <FaClosedCaptioning size={28} />
            </button>
          )}
          {/* Hide input at bottom for tasks 4, 5, and 6, as it's now inside Task Log */}
          {!(taskNumber === 4 || taskNumber === 5 || taskNumber === 6) && isTypedTask && isTaskStarted && !isTaskEnded && isAwaitingUserInput && (
            <form onSubmit={handleTypedAnswerSubmit} className="flex items-center gap-2 ml-6">
              <input
                type="text"
                className="px-4 py-2 rounded-lg border border-blue-500 bg-[#16243a] text-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[300px]"
                placeholder="Type your answer..."
                value={typedAnswer}
                onChange={e => setTypedAnswer(e.target.value)}
                autoFocus
                disabled={isTaskEnded}
              />
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold" disabled={!typedAnswer.trim() || isTaskEnded}>
                Submit
              </Button>
            </form>
          )}
          {/* Resume Audio Button removed */}
        </div>
      </div>
    )
  );
}; 