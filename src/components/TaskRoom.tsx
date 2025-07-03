import React, { useEffect, useRef, useState } from 'react';
import { FaClosedCaptioning } from 'react-icons/fa';
import { Button } from './ui/Button';
import { useTaskMedia } from './hooks/useTaskMedia';
import { useTaskTranscript, TranscriptMessage } from './hooks/useTaskTranscript';
import { useMultiTaskInterviewStore } from '../store/interviewStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Player } from '../player';
import { Recorder } from '../recorder';
import { LowLevelRTClient, SessionUpdateMessage, Voice } from 'rt-client';
import { Camera, CameraOff, PhoneOff } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useInterviewStore } from '../store/interviewStore';
import { useInterviewMetaStore } from '../store/interviewStore';

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

let currentOutputFormat = 'g711-ulaw';
let startTimeStamp: Date;
let recordingActive: boolean = false;
let buffer: Uint8Array = new Uint8Array();

export const TaskRoom: React.FC<TaskRoomProps> = ({
  taskNumber,
  totalTasks,
  taskTitle,
  aiImage,
  aiName,
  userImage,
  userName,
  transcript: initialTranscript = [],
}) => {
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
  let {
    selectedRole, skills, otherRole, idealRating
  } = location.state || {};
  const interviewMeta = useInterviewMetaStore();
  if (!selectedRole || !skills) {
    selectedRole = interviewMeta.selectedRole;
    skills = interviewMeta.skills;
    otherRole = interviewMeta.otherRole;
    idealRating = interviewMeta.idealRating;
  }
  const [isStarting, setIsStarting] = useState(false);
  const audioPlayer = useRef<Player | null>(null);
  const audioRecorder = useRef<Recorder | null>(null);
  // Store the last received report for this task
  const lastTaskReportRef = useRef<any>(null);
  const { setFinalReport, getFinalReport } = useMultiTaskInterviewStore();
  const { addPastInterview } = useInterviewStore();
  const [isGeneratingFinalReport, setIsGeneratingFinalReport] = useState(false);
  const [finalReportReady, setFinalReportReady] = useState(!!getFinalReport());
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);

  // Reset all state when taskNumber or location changes (new task)
  useEffect(() => {
    setIsTaskStarted(false);
    setIsTaskEnded(false);
    setTranscript([]);
    setShowTranscript(false);
    setCurrentSpeaker(null);
    setConnectionError(null);
    setDetailedError(null);
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
      if (audioPlayer.current) audioPlayer.current.clear();
      if (realtimeStreaming.current) try { realtimeStreaming.current.close(); } catch {}
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
    if (audioPlayer.current) audioPlayer.current.clear();
    audioRecorder.current = new Recorder(processAudioRecordingBuffer);
    audioPlayer.current = new Player();
    await audioPlayer.current.init(24000);
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
        temperature: 0.6,
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
            addMessage('interviewer', transcript);
            lastTaskReportRef.current = transcript;
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

  // Ripple animation classes
  const rippleClass =
    'relative before:content-["" ] before:absolute before:inset-0 before:rounded-2xl before:border-4 before:border-blue-500 before:animate-pulse before:pointer-events-none';

  // Shared system instruction for Gemini report generation (strict JSON format)
  const systemInstruction = `Evaluate the interview performance of a candidate for the ${selectedRole === 'Others' ? otherRole : selectedRole} role at the company, using the provided skills requirements, interview transcript, and custom questions specified. Assess the candidate's skills strictly and provide minimal scores where responses are vague or insufficient.\n\n### Evaluation Process:\n1. Review the Provided Inputs: Analyze the required skills, and problem statements to identify the evaluation criteria.\n2. Assess the Candidate's Skills: Evaluate each skill mentioned in ${skills.join(', ')} based on their interview responses. Assign a numeric rating (1-10) and a justification for the score, being particularly strict if answers lack depth or specificity.\n3. Extract Custom Questions: Extract short, clear answers to any custom questions from the interaction, ensuring they are concise and relevant.\n4. Provide Strengths and Weaknesses: Derive strengths and weaknesses from the candidate's performance in relation to the requirements of the role.\n5. Overall Feedback: Make a recommendation on whether the candidate is suitable for the role, backed by detailed reasoning.\n\n### Scoring Metrics:\n- 1-3: Poor performance or major gaps in knowledge.\n- 4-6: Average performance with room for improvement.\n- 7-9: Good performance with strong understanding.\n- 10: Exceptional performance, exceeding expectations.\n\n### Output Format\nThe final evaluation report should be output in the following structured JSON format:\n\n{\n  "role": "[Role Name]",\n  "company": "[Company Name]",\n  "job_description": "[Brief job description or key responsibilities]",\n  "skills_evaluation": {\n    "[Skill_name]": {\n      "rating": "[Numeric rating, e.g., 3/10]",\n      "explanation": "[Detailed reasoning for the score, referring to specific answers or interactions]"\n    }\n  },\n  "candidate_feedback": {\n    "strengths": [\n      "[Identified strength from the interaction or responses]"\n    ],\n    "weaknesses": [\n      "[Identified weakness or gap in knowledge/skills]"\n    ],\n    "overall_feedback": "[Summarized feedback on candidate's performance, suitability for the role, and any key areas for growth.]"\n  },\n  "customQuestions": {\n    "Question": "[The given question]",\n    "Answer": "[Extracted answer to Question]"\n  }\n}\n\n### Notes:\n- Provide strong, evidence-based reasoning for all skill scores. Avoid vague or generic responses.\n- Ensure the answers to custom questions are clearly extracted and formatted.\n- Be very strict in your evaluation and reflective of insufficient answers in scoring or feedback.\n- In the skill_evaluation make sure that the inner nested JSON has the skill name as key.`;

  // Helper to generate a per-task report using Gemini 2.0 Flash (non-blocking, with polling)
  const generateTaskReportNonBlocking = (taskNum: number, transcriptData: any) => {
    let isCancelled = false;
    // Use the full transcript as-is for Gemini
    let taskSkills = skills;
    let taskRole = selectedRole === 'Others' ? otherRole : selectedRole;
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
      taskSkills = ['Pronunciation', 'Fluency', 'Attention', 'Focus'];
      taskRole = 'Reading';
    } else if (taskNum === 5) {
      taskSkills = ['Working Memory', 'Syntactic Awareness', 'Grammar', 'Logical Sequencing', 'Listening Comprehension'];
      taskRole = 'Sentence Builds';
    } else if (taskNum === 6) {
      taskSkills = ['Listening Comprehension', 'Information Retention', 'Logical Reasoning', 'Focus and Task Adherence', 'Recall'];
      taskRole = 'Conversations';
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
      temperature: 0.35,
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
      temperature: 0.35,
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
    setIsTaskEnded(true);
    addTaskTranscript(taskNumber, transcript);
    // Store the last received report for this task (if any)
    if (lastTaskReportRef.current) {
      addTaskReport(taskNumber, lastTaskReportRef.current);
    }
    // Fire off Gemini report generation in the background (non-blocking)
    generateTaskReportNonBlocking(taskNumber, transcript);
    stopMediaStream();
    if (audioRecorder.current) audioRecorder.current.stop();
    if (audioPlayer.current) audioPlayer.current.clear();
    if (realtimeStreaming.current) try { realtimeStreaming.current.close(); } catch {}
    setCompletedTasks((prev) => [...prev, taskNumber]);
    if (taskNumber < totalTasks) {
      navigate(`/interview-room/task/${taskNumber + 1}`);
    } else {
      setIsGeneratingFinalReport(true);
      await generateFinalReport();
      setIsGeneratingFinalReport(false);
      setFinalReportReady(true);
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
    setIsStarting(true);
    setConnectionError(null);
    setDetailedError(null);
    try {
      // Camera/mic already started on mount
      startTimeStamp = new Date();
      setIsTaskStarted(true);
      // Setup AI session
      const endpoint = "https://hvcodequarry.openai.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-4o-mini-realtime-preview";
      const key = "COLmcASBDO6PfjeTrq4TvCYR8iltbERSI5d8KeIAeQAHKr4BxuK7JQQJ99BCACHYHv6XJ3w3AAABACOGBci3";
      const deploymentOrModel = "gpt-4o-mini-realtime-preview";
      realtimeStreaming.current = new LowLevelRTClient(new URL(endpoint), { key }, { deployment: deploymentOrModel });
      // Use robust config and prompt
      let defaultPrompt;
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
    * Crucially, if the user asks a question that is not directly about understanding how to perform the "Repeat" task (e.g., asking about assessment duration, personal questions, or attempting to change the language), do NOT engage with it. Instead, politely but firmly redirect to the task or proceed to the first question. For instance, if they ask an irrelevant question, you can say, "Let's focus on the 'Repeat' task now. Are you ready to begin?"
    * If they ask a relevant question (e.g., "Do I need to speak immediately?"), provide a concise answer based on your initial instructions.
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

Confidence Score: 5/5

---`;
        taskSkills = ['Pronunciation', 'Fluency', 'Attention', 'Focus'];
        taskRole = 'Reading';
      // --- Task 2: Sentence Builds ---
      } else if (taskNumber === 2) {
        defaultPrompt = `You are Harshavardhan, an AI guide responsible for administering the "Sentence Builds" assessment module. Your role is to present jumbled sentence fragments to the user and prompt them to reassemble them into a grammatically correct sentence. Your interaction should be clear, concise, and focused solely on the task progression.

Core Principles for Interaction:

1.  Persona: Maintain a professional and neutral demeanor. Clearly guide the user through the steps of the assessment without deviation.
2.  Task Introduction and Question Handling:
    * Begin by clearly introducing the module as "Part B: Sentence Builds."
    * Explain the task: "In this task, I will say a series of word groups in a jumbled order. Your task is to listen carefully and then speak the complete, grammatically correct sentence formed by rearranging those word groups. Please speak clearly into your microphone after you hear all the groups."
    * After the introduction, explicitly ask if the user has any questions *related to this specific task*.
    * Crucially, if the user asks a question that is not directly about understanding how to perform the "Sentence Builds" task (e.g., asking about assessment duration, personal questions, or attempting to change the language, or asking to restart), do NOT engage with it. Instead, politely but firmly redirect to the task or proceed to the first question. For instance, if they ask an irrelevant question or ask to restart, you can say, "Let's focus on the 'Sentence Builds' task now. We will proceed with the first sentence."
    * If they ask a relevant question (e.g., "How many groups will there be?"), provide a concise answer based on your initial instructions (e.g., "There will be a few word groups for each sentence.").
    * Once questions are addressed or redirected, transition directly to the first sentence.
3.  Sequential Question Delivery (Fixed Difficulty Progression - 4 Questions): You will present exactly four sentence-build questions, each corresponding to a specific difficulty level. The progression is fixed and will not restart or change based on the user's response. You will not provide feedback on their accuracy during the task.

    * Question 1: Easy Level
        * Dynamically generate a simple, short sentence (e.g., 5-7 words).
        * Deconstruct it into 3 simple, clear chunks.
        * Randomize and present the chunks.

    * Question 2: Medium Level
        * Dynamically generate a moderately longer sentence (e.g., 8-12 words), possibly with a simple dependent clause or prepositional phrase.
        * Deconstruct it into 3-4 logical chunks.
        * Randomize and present the chunks.

    * Question 3: Expert Level
        * Dynamically generate a more complex sentence (e.g., 12-18 words), potentially with multiple clauses, more nuanced vocabulary, or requiring careful articulation to reassemble.
        * Deconstruct it into 4 distinct, logical chunks.
        * Randomize and present the chunks.

    * Question 4: Master Level
        * Dynamically generate a long, highly complex sentence (e.g., 18+ words), potentially incorporating idiomatic expressions, challenging phonetics, or several interconnected ideas that require significant cognitive effort to resequence.
        * Deconstruct it into 4 distinct, often longer, logical chunks.
        * Randomize and present the chunks.

4.  Presentation Flow for Each Question:
    * Before playing the chunks, verbally indicate that you are about to present the word groups for the sentence (e.g., "Here is the first set of word groups.").
    * Play the randomized audio chunks sequentially, with a brief, clear pause between each (e.g., 0.5 - 1 second). Do NOT display the text of the chunks.
    * After playing all the chunks for a given sentence, prompt the user to speak (e.g., "Please speak the complete sentence now.").
    * Wait for the user's verbal response before proceeding to the next question.

5.  Strict Adherence to Sequence and No Repetition: Present one set of jumbled chunks at a time. Do not move to the next question until you have either detected a response or a reasonable pause indicating they are ready. Do not repeat questions or individual chunks if requested. Firmly but politely state that the assessment must proceed.

6.  No Language Changes: Do not entertain requests to change the language of the assessment.

7.  Task Completion and Conclusion: After presenting the fourth (Master level) sentence and receiving a response, clearly signal the completion of "Part B: Sentence Builds."
    * Conclude by thanking the candidate.
    * Provide the instruction: "That concludes Part B. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
    * Do not engage in any further conversation or respond to additional questions.

---`;
        taskSkills = ['Working Memory', 'Syntactic Awareness', 'Grammar', 'Logical Sequencing', 'Listening Comprehension'];
        taskRole = 'Sentence Builds';
      } else if (taskNumber === 3) {
        defaultPrompt = `You are Harshavardhan, an AI guide responsible for administering the "Conversations" assessment module. Your role is to present audio conversations followed by a question, and then prompt the user for a short, spoken answer. Your interaction must be clear, precise, and strictly adhere to the assessment flow.

---

### Core Principles for Interaction:

1.  Persona: Maintain a professional, clear, and focused demeanor. Your tone should be neutral, guiding the user efficiently through each step.

2.  Module Introduction and Question Handling:
    * Begin by clearly stating the module title: "(C) Conversations".
    * State the instruction: "You will hear a conversation between two people, followed by a question. Give a short, simple answer to the question."
    * Present an example: Verbally describe or play (if technically feasible) a sample conversation and question, then state the expected answer.
        * *Example verbalization:* "For example, you might hear: [Audio of: Woman: 'I'm going to the store.' Man: 'Okay, I'll meet you there later.' Question: 'Where is the woman going?'] The expected answer would be: 'To the store.'"
    * After the example, explicitly ask if the user has any questions related to this specific task.
    * Crucially, if the user asks a question that is not directly about understanding how to perform the "Conversations" task (e.g., asking about assessment duration, personal questions, attempting to change the language, or asking to restart), do NOT engage with it. Instead, politely but firmly redirect to the task or proceed to the first question. For instance, if they ask an irrelevant question or ask to restart, you can say, "Let's focus on the 'Conversations' task now. We will proceed with the first question."
    * If they ask a relevant question (e.g., "Will the question be spoken or written?"), provide a concise answer based on your initial instructions (e.g., "The question will be spoken after the conversation.").
    * Once questions are addressed or redirected, transition directly to the first conversation.

3.  Task Screen Presentation (Per Question):
    * For each question, prior to playing the audio, state: "Please listen." (Do not literally display a headphone icon, but this phrase serves that purpose).
    * Play a short audio conversation between two distinct speakers. Ensure the conversation is natural-sounding and directly leads to a clear, factual question about its content.
    * Immediately after the conversation, play the question about the conversation.
    * Crucially, the question must require a short, simple answer (typically 3-7 words).
        * *Example Conversation/Question pair:*
            * Audio: (Woman) "I feel a bit under the weather." (Man) "Oh no, you should rest. What will you do if you feel worse?"
            * Question Audio: "What will the man do if he feels worse?"
            * Expected Simple Answer: "He will come home early."

4.  Prompting User Response:
    * After playing the conversation and question, clearly state: "Answer the question." (Do not literally display a speech bubble icon, but this phrase serves that purpose).
    * Wait for the user's spoken answer.

5.  Strict Flow and No Repetition/Deviation:
    * Automatically transition to the next conversation/question set after the user's response.
    * Do NOT restart, repeat conversations, or answer user questions about the content of the conversation. Your role is strictly to present the audio and capture the response.
    * Present a total of 4-5 such conversation/question pairs, ensuring variety in topics and speakers.
    * Do not entertain any requests for language change or irrelevant queries. If the user attempts to engage in conversation outside the task, politely redirect by saying, "Let's focus on the 'Conversations' task. Please listen for the next question."

6.  Task Completion:
    * After the final conversation/question set and user response, clearly signal the completion of "Module C: Conversations."
    * Conclude by thanking the candidate.
    * Provide the instruction: "That concludes Module C. Thank you for completing this task. Please click on the 'Submit Task' button now to move forward to the next part of the assessment."
    * Do not engage in any further conversation.

---`;
        taskSkills = ['Listening Comprehension', 'Information Retention', 'Logical Reasoning', 'Focus and Task Adherence', 'Recall'];
        taskRole = 'Conversation';
      } else {
        defaultPrompt = `Conduct an interactive interview for a ${selectedRole === 'Others' ? otherRole : selectedRole} role. Assess the candidate's skills (${skills.join(', ')}) through realistic questions. Do not give the response of the previous response in more than one short line and also without giving any feedback. Wait for the candidate to answer before proceeding to the next question. Be concise, friendly, and professional.`;
      }
      // Fire off config, audio, and message in parallel (no await chain)
      realtimeStreaming.current.send(createConfigMessage(defaultPrompt)).catch((err) => {
        setConnectionError('Failed to send config to AI session.');
        setDetailedError(err?.message || String(err));
        console.error('[TaskRoom] Config send error:', err);
      });
      resetAudio(true).catch((err) => {
        setConnectionError('Failed to start audio.');
        setDetailedError(err?.message || String(err));
        console.error('[TaskRoom] Audio start error:', err);
      });
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

  // Loader UI for final report generation after last task
  if (isGeneratingFinalReport && taskNumber === totalTasks) {
    return (
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
  }

  return (
    <div className="h-screen bg-[#0a1627] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-[#101c33] border-b border-[#1a2942] flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="https://d8it4huxumps7.cloudfront.net/uploads/images/unstop/svg/unstop-logo-white.svg" alt="Unstop Logo" className="h-8" />
          <span className="font-semibold text-lg truncate max-w-xs">Medical Representative</span>
        </div>
        <div className="flex items-center gap-2">
          {[...Array(totalTasks)].map((_, i) => (
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
          <span className="bg-[#1a2942] px-4 py-2 rounded-lg font-mono text-lg">699 : 59 : 21</span>
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
            {/* Video/Images */}
            <div className={`flex-1 flex items-center justify-center gap-12 p-8 ${showTranscript ? 'w-2/3' : 'w-full'} h-full`}>
              <div className="flex flex-col items-center">
                <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[420px] h-[320px] flex items-center justify-center border-4 ${currentSpeaker === 'interviewer' ? rippleClass : 'border-blue-700'}`}>
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
                <div className={`rounded-2xl overflow-hidden bg-[#16243a] w-[420px] h-[320px] flex items-center justify-center border-4 ${currentSpeaker === 'candidate' ? rippleClass : 'border-[#22345a]'}`}>
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
            {/* Transcript Panel */}
            {showTranscript && (
              <div className="w-1/3 h-full bg-[#101c33] border-l border-[#1a2942] flex flex-col">
                <div className="px-6 py-4 border-b border-[#1a2942] text-lg font-semibold flex-shrink-0">Transcript</div>
                <div ref={transcriptPanelRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                  {transcript.map((msg, idx) => {
                    const isAI = msg.speaker === 'interviewer';
                    const avatar = isAI ? (
                      <img src={aiImage} alt={aiName} className="w-8 h-8 rounded-full object-cover border-2 border-blue-500 bg-gray-800" />
                    ) : (
                      userImage ? <img src={userImage} alt={userName} className="w-8 h-8 rounded-full object-cover border-2 border-blue-300 bg-gray-800" />
                      : <div className="w-8 h-8 rounded-full bg-blue-300 flex items-center justify-center text-blue-900 font-bold">U</div>
                    );
                    return (
                      <div key={idx} className={`flex ${isAI ? 'justify-start' : 'justify-end'} w-full`}>
                        {isAI && <div className="mr-3 flex-shrink-0">{avatar}</div>}
                        <div className={`max-w-[75%] flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
                          <div className={`rounded-2xl px-4 py-2 shadow-md ${isAI ? 'bg-blue-900 text-white' : 'bg-[#22345a] text-blue-100'} whitespace-pre-line break-words text-base`}>
                            {msg.message}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-blue-300">
                            <span>{isAI ? aiName : userName || 'You'}</span>
                            {msg.time && <span className="opacity-70">· {msg.time}</span>}
                          </div>
                        </div>
                        {!isAI && <div className="ml-3 flex-shrink-0">{avatar}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 py-6 bg-[#101c33] border-t border-[#1a2942] flex-shrink-0">
        {!isTaskStarted ? (
          <Button className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3 rounded-lg font-semibold" onClick={startInterview} disabled={isStarting}>
            {isStarting ? 'Starting...' : 'Start Interview'}
          </Button>
        ) : (
          <Button className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3 rounded-lg font-semibold" onClick={endTask} disabled={isTaskEnded}>End Task</Button>
        )}
        <button
          className={`ml-2 p-3 rounded-lg ${showTranscript ? 'bg-blue-800 text-white' : 'bg-[#16243a] text-blue-200'} hover:bg-blue-700 transition-all`}
          onClick={handleTranscriptToggle}
          aria-label="Toggle Transcript"
        >
          <FaClosedCaptioning size={28} />
        </button>
      </div>
    </div>
  );
}; 