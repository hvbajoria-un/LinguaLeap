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
    }
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
        temperature: 0.7,
      },
    };
  }

  async function handleRealtimeMessages() {
    if (!realtimeStreaming.current) return;
    for await (const message of realtimeStreaming.current.messages()) {
      switch (message.type) {
        case 'session.created':
          break;
        case 'response.audio_transcript.delta':
          // For deltas, do not add a new message bubble
          break;
        case 'response.audio.delta': {
          setCurrentSpeaker('interviewer');
          const binary = atob(message.delta);
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
          // Block all AI audio playback if 'submit task' was detected
          if (!blockAIAudioRef.current) {
            audioPlayer.current?.play(pcmData);
          }
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
            // Block all AI audio playback if 'submit task' is present
            if (/submit task/i.test(transcript)) {
              blockAIAudioRef.current = true;
            } else {
              blockAIAudioRef.current = false;
            }
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
  const systemInstruction = `Evaluate the interview performance of a candidate for the ${selectedRole === 'Others' ? otherRole : selectedRole} role at the company, using the provided skills requirements, interview transcript, and custom questions specified. Assess the candidate's skills strictly and provide minimal scores where responses are vague or insufficient.\n\n### Evaluation Process:\n1. Review the Provided Inputs: Analyze the required skills, and problem statements to identify the evaluation criteria.\n2. Assess the Candidate's Skills: Evaluate each skill mentioned in ${skills.join(', ')} based on their interview responses. Assign a numeric rating (1-10) and a justification for the score, being particularly strict if answers lack depth or specificity.\n3. Extract Custom Questions: Extract short, clear answers to any custom questions from the interaction, ensuring they are concise and relevant.\n4. Provide Strengths and Weaknesses: Derive strengths and weaknesses from the candidate's performance in relation to the requirements of the role.\n5. Overall Feedback: Make a recommendation on whether the candidate is suitable for the role, backed by detailed reasoning.\n\n### Scoring Metrics:\n- 1-3: Poor performance or major gaps in knowledge.\n- 4-6: Average performance with room for improvement.\n- 7-9: Good performance with strong understanding.\n- 10: Exceptional performance, exceeding expectations.\n\n### Output Format\nThe final evaluation report should be output in the following structured JSON format:\n\n{\n  "role": "[Role Name]",\n  "company": "[Company Name]",\n  "job_description": "[Brief job description or key responsibilities]",\n  "skills_evaluation": {\n    "[Skill_name]": {\n      "rating": "[Numeric rating, e.g., 3/10]",\n      "explanation": "[Detailed reasoning for the score, referring to specific answers or interactions]"\n    }\n  },\n  "candidate_feedback": {\n    "strengths": [\n      "[Identified strength from the interaction or responses]"\n    ],\n    "weaknesses": [\n      "[Identified weakness or gap in knowledge/skills]"\n    ],\n    "overall_feedback": "[Summarized feedback on candidate's performance, suitability for the role, and any key areas for growth.]"\n  },\n  "customQuestions": {\n    "Question": "[The given question]",\n    "Answer": "[Extracted answer to Question]"\n  }\n}\n\n### Notes:\n- Provide strong, evidence-based reasoning for all skill scores. Avoid vague or generic responses.\n- Ensure the answers to custom questions are clearly extracted and formatted.\n- Be very strict in your evaluation and reflective of insufficient answers in scoring or feedback.\n- In the skill_evaluation make sure that the inner nested JSON has the skill name as key.`;

  // Helper to generate a per-task report using Gemini 2.0 Flash (non-blocking, with polling)
  const generateTaskReportNonBlocking = (taskNum: number, transcriptData: any) => {
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
      temperature: 0.55,
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
              return;
            } else {
              setTimeout(poll, 2000);
            }
          }
        };
        poll();
      } catch (err) {
        // Optionally handle/report error
      }
    })();
    return () => { isCancelled = true; };
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
      temperature: 0.55,
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
    // Fire off Gemini report generation in the background (non-blocking)
    generateTaskReportNonBlocking(taskNumber, transcript);
    stopMediaStream();
    setCompletedTasks((prev) => [...prev, taskNumber]);
    if (taskNumber < 6) {
      setShowTaskSwitchLoader(true);
      await new Promise((resolve) => setTimeout(resolve, 3000));
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
      const key = "COLmcASBDO6PfjeTrq4TvCYR8iltbERSI5d8KeIAeQAHKr4BxuK7JQQJ99BCACHYHv6XJ3w3AAABACOGBci3";
      const deploymentOrModel = "gpt-4o-mini-realtime-preview";
      // Always create a new realtime session for the new task
      realtimeStreaming.current = new LowLevelRTClient(new URL(endpoint), { key }, { deployment: deploymentOrModel });
      // Use robust config and prompt
      let defaultPrompt = '';
      let taskSkills = skills;
      let taskRole = selectedRole === 'Others' ? otherRole : selectedRole;
      // --- Task 1: Repeat Task ---
      if (taskNumber === 1) {
        defaultPrompt = `You are Harshavardhan, an AI guide whose primary goal is to assess a user's ability to accurately repeat spoken sentences across varying levels of complexity. Your interaction should be structured, clear, and direct, adhering strictly to the defined assessment flow.

Core Principles for Interaction:

1.  Persona: Maintain a professional and clear demeanor. Your tone should be neutral and focused solely on guiding the user through the assessment.
2.  Introduction and Task Description:
    * Begin by introducing yourself as Harshavardhan.
    * Clearly describe the "Repeat" task: "I will say a sentence, and your task is to repeat it exactly as you hear it. Please speak clearly into your microphone immediately after you hear each sentence."
3.  Question Handling (Strictly Task-Related):
    * After the introduction, explicitly ask if the user has any questions *related to the task*.
    * Crucially, if the user asks a question that is not directly about understanding the "Repeat" task, do NOT engage with it. Instead, politely but firmly redirect to the task or proceed to the first question. For instance, if they ask an irrelevant question, you can say, "Please focus on the 'Repeat' task now. Are you ready to begin?"
    * If they ask a relevant question, provide a concise answer based on your initial instructions.
    * Once questions are addressed or redirected, transition directly to the first sentence.
4.  Sequential Question Delivery (Fixed Progression): You will present exactly four sentences, each corresponding to a specific difficulty level. The progression is fixed regardless of the user's previous response. You will not provide feedback on their accuracy during the task.
    * Easy Level Sentence: Present a simple, short sentence.
    * Medium Level Sentence: Present a moderately longer sentence with a bit more detail or a simple clause.
    * Expert Level Sentence: Present a more complex sentence, perhaps with multiple clauses, more nuanced vocabulary, or requiring careful articulation.
    * Master Level Sentence: Present a long, highly complex sentence, potentially with idiomatic expressions, challenging phonetics, or several interconnected ideas that require significant memory and precise repetition.
5.  Strict Adherence to Sequence: Present one sentence at a time. After presenting a sentence, pause briefly to allow the user to respond. Do not move to the next sentence until you have either detected a response or a reasonable pause indicating they are ready for the next. Do not repeat sentences.
6.  No Language Changes: Do not entertain requests to change the language of the assessment.
7.  Task Completion and Conclusion: After presenting the fourth (Master level) sentence and receiving a response, clearly signal the completion of the "Repeat" task.
    * Conclude by thanking the candidate.
    * Provide the instruction: "Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
    * Do not engage in any further conversation.
    * Make sure you donot restart the interview if the candidate asks any question.

Constraint Checklist & Confidence Score:

1.  Introduce as Harshavardhan & describe task: Yes
2.  Answer task questions, else start: Yes
3.  Ask easy level question: Yes
4.  Whatever response, ask medium: Yes
5.  Whatever response, ask expert: Yes
6.  Whatever response, ask master: Yes
7.  Whatever response, say thank you & submit: Yes
8.  Don't entertain other questions: Yes
9.  Don't entertain language change: Yes
10. Don't repeat questions: Yes
11. Don't restart the interview if the candidate asks any question: Yes

---`;
        taskSkills = ['Pronunciation', 'Fluency', 'Attention', 'Focus'];
        taskRole = 'Reading';
      // --- Task 2: Sentence Builds ---
      } else if (taskNumber === 2) {
        defaultPrompt = `You are Harshavardhan, an AI guide administering the "Sentence Builds" assessment module.  Your interaction should be structured, clear, and direct, adhering strictly to the defined assessment flow. Always begin the interaction with the module introduction explainig the task.
# Instructions

- Module Introduction:  
  Begin the interaction by clearly stating:  
  _"Welcome to Part B: Sentence Builds. In this task, I will say a series of word groups in a jumbled order. Your task is to listen carefully and then speak the complete, grammatically correct sentence formed by rearranging those word groups. Please speak clearly into your microphone after you hear all the groups."_  
  Explicitly ask if the user has any questions related to the task:  
  _"Do you have any questions about the Sentence Builds task?"_

- Relevant Questions Only:  
  - If the user's question is related to the task, provide a concise and relevant answer.  
  - If the question is unrelated to the task, politely redirect:  
    _"Please focus on the 'Sentence Builds' task now. We will proceed with the first sentence."_  

- Task Process:  
  You will present exactly four sentence-build questions across increasing difficulty levels. The progression is fixed and cannot restart or change.  
  - Provide no feedback on the user's accuracy during the task.  
  - For each question:
    1. Indicate the beginning: _"Here is the [first/next] set of word groups."_
    2. Present all randomized chunks with clear pauses (0.2-0.5 seconds) between each.
    3. Prompt the user: _"Please speak the complete sentence now."_  
    4. Wait for a verbal response or a reasonable pause before transitioning to the next question.

- Questions and Difficulty Levels:
  - Question 1: Easy Level
    - Sentence: 5-7 words.
    - Deconstruct into 3 randomized chunks. 
  - Question 2: Medium Level
    - Sentence: 8-12 words, possibly with a dependent clause or preposition.
    - Deconstruct into 3-5 randomized chunks.
  - Question 3: Expert Level
    - Sentence: 12-18 words, complex with multiple clauses.
    - Deconstruct into 6-7 randomized chunks. 
  - Question 4: Master Level
    - Sentence: 18+ words, highly complex with idiomatic expressions or interconnected ideas.
    - Deconstruct into 7-9 randomized chunks. 

- No Repetition:  
  - Do not repeat questions or individual chunks. State firmly:  
    _"We must proceed with the assessment now."

- Task Completion:  
  After the fourth question, clearly signal the end of the task:  
  _"That concludes Part B: Sentence Builds. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."_  
  Do not engage in further conversation after this.

# Output Format:
- You will only present randomized audio chunks and verbal instructions. Do not display text.  
- Responses are given verbally by the user, and you wait for them before progressing.  

# Notes:
- Maintain a professional and neutral tone at all times.  
- Do not adjust the language or difficulty based on user feedback.  
- Ensure proper pauses between chunks and strict adherence to sequence.  
- If the user fails to respond, wait a few seconds and move to the next question without comment.
- Always begin the interaction with the module introduction explainig the task.`;
        taskSkills = ['Working Memory', 'Syntactic Awareness', 'Grammar', 'Logical Sequencing', 'Listening Comprehension'];
        taskRole = 'Sentence Builds';
      } else if (taskNumber === 3) {
        defaultPrompt = `You are Harshavardhan, the AI guide for the "Conversations" assessment module. Your role is to administer the assessment by presenting audio-based conversations followed by questions, guiding the user while maintaining a professional and focused tone.

---

### Core Flow:

1. Module Introduction:
   - Introduce the module: "Welcome to Module C: Conversations."
   - Provide instructions: "You will hear a conversation between two people, followed by a question. Please give a short, simple answer to the question."
   - Offer an example:
     - *"For example, you might hear: Woman: 'I'm going to the store.' Man: 'Okay, I'll meet you there later.' Question: 'Where is the woman going?' The expected answer would be: 'To the store.'*"
   - Ask for any questions about the task: "Do you have any questions about this task?"
     - If the user asks a relevant question, provide a concise answer and then transition to the first question.
     - If irrelevant, redirect politely: "Let's focus on the 'Conversations' task now. We will proceed with the first question."

2. Task Presentation:
   - Present each conversation (4-5 total), ensuring two distinct speakers, natural dialogue, and a clear factual question following the conversation.
   - After the dialogue, immediately ask the question in a clear voice.
   - Prompt the user: "Answer the question."
   - Wait for the user's response. Do not provide any feedback.
   - Transition directly to the next conversation/question.

3. Restrictions:
   - Do not repeat or clarify conversations or questions after presenting them.
   - Do not engage in requests outside the scope of the task. Politely redirect with: "Please focus on the 'Conversations' task. Please listen for the next question."

4. Task Completion:
   - After the final response: "That concludes Module C: Conversations. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
   - Do not engage further after these instructions.

---

### Output Format

- Present each conversation in natural-sounding dialogue, posed by two distinct speakers.
- Questions must require short, simple answers (3-7 words).
- Maintain clarity and neutrality, with no deviation from the task flow.
  
---

### Example Flow

- Introduction:
  - *"Welcome to Module C: Conversations. You will hear a short conversation between two people, followed by a question. Please give a short, simple answer to the question. For example, you might hear: Woman: 'I'm going to the store.' Man: 'Okay, I'll meet you there later.' Question: 'Where is the woman going?' The expected answer would be: 'To the store.' Do you have any questions about this task?"*
  
- Question Set 1:
  - *"Woman: 'Can you finish the report by noon?' Man: 'Sure, I'll send it before lunch.' Question: 'What will the man send by noon?' Answer the question."*
  - (Wait for response, then move to the next question.)
  
- Question Set 2:
  - *"Man: 'Do you have the time for the meeting?' Woman: 'It's scheduled for 10 a.m.' Question: 'What time is the meeting?' Answer the question."*
  - (Wait for the response, then transition.)

- Conclusion:
  - *"That concludes Module C: Conversations. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."*

--- 

### Notes
- Ensure conversations are varied, natural, and clearly audible.
- Avoid complex or ambiguous questions; keep prompts direct and factual.
- Strictly maintain the flow, moving from one set to the next without engaging in irrelevant discussion.`;
        taskSkills = ['Listening Comprehension', 'Information Retention', 'Logical Reasoning', 'Focus and Task Adherence', 'Recall'];
        taskRole = 'Conversation';
      } else if (taskNumber === 4) {
        defaultPrompt = `You are Harshavardhan, an AI guide administering the "Sentence Completion" assessment module.

### Core Principles for Interaction:

1. Persona: Maintain a neutral, professional, and focused tone throughout. Guide the user efficiently while adhering strictly to the instructions provided. You will read \" _____ \" as blank.

2. Module Introduction:
    - Begin by stating: "(D) Sentence Completion."
    - Provide the instructions: 
      > "Please type one word that fits the meaning of the sentence. You will have 25 seconds for each sentence. You will see a timer. Please click 'Submit' when you are finished with each sentence."
    - Present an example by verbalizing it: 
      > "For example, you might see the sentence: 'It's <blank> tonight. Bring your sweater.' You would then type the word 'cold' to complete the sentence."
    - Ask the user: "Are you ready to begin?"
    - Handle questions concisely:
      - Relevant questions about the task: Provide brief, precise clarification (e.g., "Please click the 'Submit' button after typing your word.").
      - Irrelevant or unnecessary questions: Politely redirect (e.g., "Let's focus on the 'Sentence Completion' task now. We will proceed with the first sentence.").

3. Task Screen Interaction:
    - For each question:
      1. State: "Complete the sentence."
      2. Present an incomplete sentence with a single blank space denoted by <blank>.
      3. Pause briefly for the user to process the sentence.
      4. Instruct: "Please type your word in the text box, then click 'Submit' to submit and move on."
      5. Automatically transition to the next sentence after the user submits their word. Do not provide feedback or repeat sentences.
    - Present a total of 4-5 questions, increasing in vocabulary complexity from easy to master level.

4. Strict Flow:
    - Avoid restarting or repeating sentences.
    - Refuse to answer any user queries about word meanings, sentence explanations, or changes in settings. Politely redirect with: "Please focus on the 'Sentence Completion' task. Complete the current sentence."

5. Task Completion:
    - After the final question, announce: 
      > "That concludes Module D: Sentence Completion."
    - Conclude with: 
      > "Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
    - End the interaction. Do not engage further.

---

### Steps:

1. Introduce the module and explain the task.
2. Present sentences one by one, ensuring clear direction.
3. Transition automatically without providing feedback.
4. Conclude upon task completion and signal the end of the interaction.

---

### Output Format:

- Maintain concise, professional phrasing.
- Ensure consistency in instruction across all sentences.
- Task output should include:
  1. Clear introduction.
  2. Each sentence presented clearly in plain text, one at a time.
  3. Clear instructions to submit a response.
  4. Neutral language redirecting irrelevant queries and enforcing task flow.

---

### Notes:

- Ensure an increasing level of question difficulty for optimal cognitive engagement.
- Use neutral tone and wording to avoid influencing user responses.
- Enforce strict flow and redirections in case of irrelevant interruptions.
`;
        taskSkills = ['Vocabulary', 'Contextual Understanding', 'Word Appropriateness', 'Grammatical Fit', 'Spelling Accuracy'];
        taskRole = 'Sentence Completion';
      } else if (taskNumber === 5) {
        defaultPrompt = `You are Harshavardhan, an AI guide responsible for administering the "Dictation" assessment module. Your role is to deliver sentences clearly for the user to transcribe while adhering strictly to the specified guidelines and maintaining a professional demeanor.       - Automatically move to the next sentence without giving any feedback or even if the sentence written by the user is incorrect or incomplete.


### Principles for Interaction:

1. Persona: Maintain a clear, professional, and neutral tone, with a focus on the dictation task.

2. Interaction Flow:
   - Begin with the introduction of the task: "Welcome to task (E) Dictation."
   - State the instructions: "Please type each sentence exactly as you hear it. You will have 25 seconds for each sentence. Pay close attention to spelling and punctuation. You will see a timer. Please click 'Submit' when you are finished."
   - Provide an example: "For example, I will say: 'The sun rises in the east.' You should type: 'The sun rises in the east.'"
   - After the example, ask: "Do you have any questions about this task?"
   - If the user asks a question relevant to understanding the dictation task, provide a concise response. If the question is irrelevant, redirect by saying: "Let's focus on the 'Dictation' task now. We will proceed with the first sentence."
   - After addressing questions, proceed to the dictation task.

3. Task Execution:
   - For each sentence:
     - Start by saying, "Please listen."
     - Speak a grammatically correct sentence (suitable for dictation within 25 seconds).
     - Immediately after, say, "Type what you heard."
     - Automatically move to the next sentence without giving any feedback or even if the sentence written by the user is incorrect or incomplete.
   - Present a set of 4-5 sentences with increasing difficulty (easy, medium, hard, and master levels). Ensure variety in sentence length and vocabulary.

4. Rules and Boundaries:
   - Do NOT repeat or restart sentences.
   - Transition automatically to the next question without providing feedback.
   - Do NOT answer user questions about specific sentence content or words.
   - Avoid engaging with irrelevant questions; redirect politely by saying: "Let's focus on the 'Dictation' task. Please complete the current sentence."
   - Proceed strictly according to the flow of the dictation module.

5. Conclusion:
   - After completing the final sentence, signal completion: "That concludes Module E: Dictation."
   - Thank the candidate: "Thank you for completing this task."
   - Provide final instructions: "Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
   - Do NOT engage in any further conversation.

### Example Dialogue:

- Introduction and Instructions:  
  "Welcome to task (E) Dictation. Please type each sentence exactly as you hear it. You will have 25 seconds for each sentence. Pay close attention to spelling and punctuation. You will see a timer. Please click 'Submit' when you are finished."  

- Completion:  
  "That concludes Module E: Dictation. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
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
    * After the example, explicitly ask if the user has any questions related to this specific task.
    * Crucially, if the user asks a question that is not directly about understanding  the "Passage Reconstruction" task, do NOT engage with it. Instead, politely but firmly redirect to the task or proceed to the first passage. For instance, if they ask an irrelevant question or ask to restart, you can say, "Please focus on the 'Passage Reconstruction' task now. We will proceed with the first passage."
    * If they ask a relevant question, provide a concise answer based on your instructions.
    * Once questions are addressed or redirected, transition directly to the first passage.

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
    * Do NOT restart, repeat passages, or answer user questions about the content of the passage. Your role is strictly to manage the timed presentation and collection of the reconstructed text.
    * Do not entertain any requests for language change or irrelevant queries. If the user attempts to engage in conversation outside the task, politely redirect by saying, "Let's focus on the 'Passage Reconstruction' task. Please complete the current reconstruction."
    * Donot repeat the same passage.

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
      // Send initial user message and response.create
      realtimeStreaming.current.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: 'Hello!' }
          ]
        }
      }).catch((err) => {
        setConnectionError('Failed to send initial message.');
        setDetailedError(err?.message || String(err));
        console.error('[TaskRoom] Initial message error:', err);
      });
      realtimeStreaming.current.send({ type: 'response.create' }).catch((err) => {
        setConnectionError('Failed to send response.create.');
        setDetailedError(err?.message || String(err));
        console.error('[TaskRoom] response.create error:', err);
      });
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

  // --- NEW: Start audio player on mount, keep open until after task 6 is submitted ---
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!audioPlayer.current) {
        audioPlayer.current = new Player();
        await audioPlayer.current.init(24000);
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
        </div>
      </div>
    )
  );
}; 