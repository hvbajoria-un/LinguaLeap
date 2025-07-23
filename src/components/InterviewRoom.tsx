import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraOff, PhoneOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from './ui/Button';
import { useInterviewStore } from '../store/interviewStore';
import { Player } from "../player.ts";
import { Recorder } from "../recorder.ts";
import { LowLevelRTClient, SessionUpdateMessage, Voice } from "rt-client";
import { useLocation } from 'react-router-dom';
import markdown from '@wcj/markdown-to-html';
import { TranscriptMessage } from '../types/interview';

let realtimeStreaming: LowLevelRTClient;
let feedbackready: boolean = false;
let url: string = "";
let currentOutputFormat = "pcm16";

export function InterviewRoom() {
  useEffect(() => {
    const loadWorklet = async () => {
      try {
        const audioContext = new (window.AudioContext || window.AudioContext)();
        await audioContext.audioWorklet.addModule('path/to/your/worklet.js');
        // Additional code to use the worklet
      } catch (error) {
        console.error('Error loading worklet module:', error);
      }
    };

    loadWorklet();
  }, []);

// funcion to save html as a html file in the same directory
function saveHtml(html: string, fileName: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();

  setTimeout(() => {
  feedbackready = false;
  // Get the feedback JSON
  // const { id } = useParams(); (id is the interview id of the candidate)
  const id = "buhrbub898"
  const { pastInterviews } = useInterviewStore();
  const interviewreport = pastInterviews.find((i) => i.id === id);
  console.log(interviewreport);
}, 60000);

}

async function convertHtmlToPdf(htmlContent: string) {
  stopTime = Date.now();
    console.log('Stop Time:', stopTime);
    differenceTime = stopTime - startTime!;
    const ratings = [];
    const regex = /<li><strong>Rating:<\/strong> (\d+)\/10<\/li>/g;
    let match;

    while ((match = regex.exec(htmlContent)) !== null) {
      ratings.push(parseInt(match[1], 10));
    }
    addPastInterview({
      id: uuidv4(),
      role: selectedRole === 'Others' ? otherRole : selectedRole,
      skills: skills,
      date: new Date(),
      duration: differenceTime,
      videoUrl: url,
      status: 'completed',
      transcript: transcription,
      feedback: htmlContent,
      idealRating: idealRating,
      candidateRating: ratings,
    });
    setTimeout(() => {
      realtimeStreaming.close();
    }, 50000);
    saveHtml(htmlContent, "feedback.html");
}

  let ReceivedTextContainer: HTMLDivElement | undefined = undefined;

let audioRecorder: Recorder;
let audioPlayer: Player;
let feedback: string;
const location = useLocation();
const { selectedRole, skills, otherRole, idealRating} = location.state || { selectedRole: '', skills: [], otherRole: '', idealRating: [] };
let startTime: number;
let startTimeStamp: Date;
let stopTime: number;
let differenceTime: number;
const createTranscriptMessage = (
  speaker: 'interviewer' | 'candidate',
  message: string,
  timestamp: Date
): TranscriptMessage => ({
  id: Math.random().toString(36).substr(2, 9),
  speaker,
  message,
  timestamp,
});
let transcription: TranscriptMessage[] = [];

async function start_realtime(endpoint: string, apiKey: string, deploymentOrModel: string) {
  console.log("Ideal Ratings ",idealRating);
  console.log("Selected Role: ", selectedRole);
  console.log("Skills: ", skills);
  console.log("Other Role: ", otherRole);
  if (isAzureOpenAI()) {
    realtimeStreaming = new LowLevelRTClient(new URL(endpoint), { key: apiKey }, { deployment: deploymentOrModel });
  } else {
    realtimeStreaming = new LowLevelRTClient({ key: apiKey }, { model: deploymentOrModel });
  }

  try {
    if (selectedRole=='Marketing Manager'){
      await realtimeStreaming.send(createConfigMessage(`Conduct an interview as Shambhavi for a Marketing Manager role at Unstop, assessing the following skills: ` + skills + ` through interactive and realistic questions. Make the responses of yours short and concise but also easy to understand. Donot give the response of the previous response in more than one short line and also without giving any feedback.

# Steps

1. **Introduction:**
   - Begin by introducing yourself as Shambhavi who is a female so speak in a female voice and clarify that you will be evaluating the candidate's fit for the Marketing Manager role.

2. **Experience and Background:**
   - Ask about the candidate's educational background and qualifications.
   - Inquire about any past experiences related to sales, highlighting significant achievements or challenges.

3. **Skills:**
   - Pose three objective multiple-choice questions to assess knowledge and logical thinking. Make sure you ask 3 questions one by one after receiving the answer and explaination of why he/she chose that answer of the previous question. 
     - Provide four options for each question.
     - Compulsory request the candidate to explain their chosen answer and don't move forward unless answered properly. 
     - Donot tell the correct answer of the question nor give explaination yourself but ask the candidate to explain why he/she chose that answer.
   - Present subjective, scenario-based questions to evaluate practical skills.

4. **Problem-Solving and Decision-Making:**
   - Present scenarios to assess the candidate's problem-solving abilities.
   - Ask about times when they faced challenging sales situations and how they resolved them.

5. **Role-Play:**
   - Engage in a role-play conversation as a hesitant and angry client named Harshavardhan, depicting frustration due to previous marketing plans and strategies used for their campaign which did not give a good result. Assess the candidate's ability to build rapport, emphasize value, address concerns, and attempt to close the deal.
   - Follow up with atleast 3-4 questions acting like Shambhavi and as if you are conversing with the candidate to evaluate empathy, negotiation skills, and professionalism. 
   - Donot forget to close the deal. and make it conversational not asking any question after Shambhavi's conversation.

6. **Behavioral Assessment:**
   - Use behavioral questions to evaluate the candidate's work ethic, resilience, and adaptability.

7. **Leadership and Team Management:**
   - Discuss any experience the candidate has in leadership or team management, if applicable.

8. **Cultural Fit and Company Values:**
   - Ask questions to understand the candidate's alignment with Unstop's culture and values.
   - Explore the candidate's understanding of Unstop's business model and the challenges it faces.

9. **Closing:**
   - Invite the candidate to ask any questions they may have about the role or company.
   - Explain the next steps in the hiring process and provide any additional information needed.

# Output Format

Questions are posed in the context of an interactive interview, requiring conversational responses from the candidate. Include direct questions, brief scenario descriptions, and prompts for candidate explanations where needed. Don't give explanations yourself.`));
      
      // skills.push('SEO & SEM');
      // skills.push('Market Research');
      // skills.push('People Skills');
      // skills.push('Partner Management');
      // skills.push('Communication');
      // skills.push('Problem-Solving');
     }
    else
      await realtimeStreaming.send(createConfigMessage(`Conduct an interactive interview for a ` + otherRole + ` role. Assess the candidate's skills ` + skills + ` through realistic questions and do not adapt your language based on the candidate's preferences.Do not give the response of the previous response in more than one short line and also without giving any feedback.
      Provide concise questions and ensure the focus is strictly on understanding the candidate's rationale. Wait for the candidate to answer before proceeding to the next question. You are Harshavardhan, and is only fluent in English (India) and only speaks in that language.
      
      # Steps
      1. **Introduction:**
        - Begin by introducing yourself as Harshavardhan who is a male so speak in a male voice and clarify that you will be evaluating the candidate's fit for the ` + otherRole + ` role.

      2. **Experience and Background:**
        - Ask about the candidate's educational background and qualifications along with the candidate's name and current position.
        - Inquire about any past experiences related to ` +  otherRole + ` , highlighting significant achievements or challenges.

      3. **Skills:**
         - Pose three objective multiple-choice questions to assess knowledge and logical thinking. Make sure you ask 3 questions one by one after receiving the answer and explanation of why he/she chose that answer of the previous question. 
         - Provide four options for each question.
         - Compulsory request the candidate to explain their chosen answer and don't move forward unless answered properly. 
         - Do not tell the correct answer of the question nor give explanation yourself but ask the candidate to explain why he/she chose that answer.
        - Compulsory request to the candidate to explain their chosen answer and don't move forward unless answered properly. 
        - If a candidate is silent for 30 seconds, ask the candidate to give the answer for the respective question.
        - Ask the questions one by one and wait for the candidate to give the answer for the first question and then ask the second question. 
        - Present subjective, scenario-based questions to evaluate practical skills covering the skills:  ` + skills + `using practical methods and also real-life scenarios. 
        - Dive deep into the concepts and the solution to understand the knowledge of the candidate and assess the candidate's skills. 
        - Explain the steps you would take to diagnose the issues.
      
      4. **Role-Play:**
        - Create a role play scenario where there is an actual situation being replicated which will be faced by the candidate during their daily responsibilities as a ` + otherRole + `. If another person would be involved then act like an angry person named Shambhavi who is not happy with the previous tasks done. 
        - Engage in a role-play conversation based upon the above role play scenario. Assess the candidate's ability to build rapport, emphasize value, address concerns, and attempt to close the deal.
        - Follow up with at least 6-7 questions acting like Shambhavi and as if you are conversing with the candidate to evaluate empathy, negotiation skills, and professionalism while diving deep into the conversation with specific details.
        - Do not forget to resolve the issue and make it conversational by not asking any question after Shambhavi's conversation.

      5. **Behavioral Assessment:**
        - Use behavioral questions to evaluate the candidate's work ethic, resilience, and adaptability.

      6. **Cultural Fit and Company Values:**
        - Ask questions to understand the candidate's alignment with the company's culture and values.
        - Make sure you donot divert from company values and culture.
        - Explore the candidate's understanding of the business model and the challenges the company faces.

      7. **Closing:**
        - Invite the candidate to ask any questions they may have about the role or company.
        - Explain the next steps in the hiring process and provide any additional information needed.

      # Output Format
      Questions are posed in the context of an interactive interview, requiring conversational responses from the candidate. Include direct questions, brief scenario descriptions, and prompts for candidate explanations where needed. Don't give explanations yourself. Make sure that all the questions are related to one another and dive deep into them to understand the concepts and clarity of the candidate in real-world scenarios.`));
  } catch (error) {
    console.log(error);
    makeNewTextBlock("[Connection error]: Unable to send initial config message. Please check your endpoint and authentication details.");
    return;
  }
  await Promise.all([resetAudio(true), handleRealtimeMessages()]);
}

function createConfigMessage(instruction: string) : SessionUpdateMessage {

  let configMessage : SessionUpdateMessage = {
    type: "session.update",
    session: {
      "voice": "echo",
      "instructions": instruction,
      "input_audio_format": "pcm16",
      "output_audio_format": "pcm16",
      "input_audio_transcription": {
        "model": "gpt-4o-mini-transcribe",
        "prompt": "We are in a situation where there is an interview being conducted for a candidate for the role of " + selectedRole + ". You interact only in English and Indian languages like Hindi, Gujrati, Marathi, Tamil, Malyalam.",
      },
      "turn_detection": {
        "threshold": 0.9,
        "prefix_padding_ms": 500,
        "silence_duration_ms": 1400,
        "type": "server_vad",
        "interrupt_response": true,
      },
      input_audio_noise_reduction: {
        type: "near_field"
      },
      include: [ 
          "item.input_audio_transcription.logprobs",
        ],
    }
  };

  // const systemMessage = 
  const temperature = getTemperature();
  const voice = getVoice();

  // if (systemMessage) {
  //   configMessage.session.instructions = systemMessage;
  // }
  if (!isNaN(temperature)) {
    configMessage.session.temperature = temperature;
  }
  if (voice) {
    configMessage.session.voice = voice;
  }

  return configMessage;
}

async function handleRealtimeMessages() {
  ReceivedTextContainer = document.querySelector<HTMLDivElement>(
    "#received-text-container",
  )!;
  for await (const message of realtimeStreaming.messages()) {
    let consoleLog = "" + message.type;

    switch (message.type) {
      case "session.created":
        makeNewTextBlock();
        break;
      case "response.audio_transcript.delta":
        appendToTextBlock(message.delta);
        break;
      case "response.audio.delta":
        // G.711 μ-law decoding lookup table
        const MULAW_DECODE_TABLE = new Int16Array([
          -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
          -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
          -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
          -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
          -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
          -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
          -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
          -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
          -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
          -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
          -876, -844, -812, -780, -748, -716, -684, -652,
          -620, -588, -556, -524, -492, -460, -428, -396,
          -372, -356, -340, -324, -308, -292, -276, -260,
          -244, -228, -212, -196, -180, -164, -148, -132,
          -120, -112, -104, -96, -88, -80, -72, -64,
          -56, -48, -40, -32, -24, -16, -8, 0,
          32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
          23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
          15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
          11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
          7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
          5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
          3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
          2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
          1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
          1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
          876, 844, 812, 780, 748, 716, 684, 652,
          620, 588, 556, 524, 492, 460, 428, 396,
          372, 356, 340, 324, 308, 292, 276, 260,
          244, 228, 212, 196, 180, 164, 148, 132,
          120, 112, 104, 96, 88, 80, 72, 64,
          56, 48, 40, 32, 24, 16, 8, 0
        ]);

        /**
         * Decodes G.711 μ-law encoded bytes to PCM16 Int16Array
         * @param {Uint8Array} mulawBytes - The μ-law encoded audio data
         * @returns {Int16Array} - Decoded PCM16 audio data
         */
        function decodeMulaw(mulawBytes: Uint8Array) {
          const pcmData = new Int16Array(mulawBytes.length);
          
          for (let i = 0; i < mulawBytes.length; i++) {
            // Each μ-law byte maps directly to a PCM16 value via lookup table
            pcmData[i] = MULAW_DECODE_TABLE[mulawBytes[i]];
          }
          
          return pcmData;
        }

        // Your audio processing code - corrected version for updated Player
        // This processes the base64-encoded G.711 μ-law audio data from message.delta

        const binary = atob(message.delta); // Decode base64 to binary string
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)); // Convert to Uint8Array

        if (!feedbackready) {
          if (currentOutputFormat === "pcm16") {
            // Decode G.711 μ-law bytes to PCM16 for audio playback
            const pcmData = decodeMulaw(bytes);
            
            // Send with G.711 flag to indicate upsampling is needed
            audioPlayer.play({ 
              samples: pcmData, 
              isG711: true 
            });
            
            // Optional: Log some debug info
            console.log(`Decoded ${bytes.length} μ-law bytes to ${pcmData.length} PCM16 samples`);
            console.log('Sample range:', Math.min(...pcmData), 'to', Math.max(...pcmData));
            
          } else if (currentOutputFormat === "pcm16") {
            // For pcm16, convert bytes to Int16Array (no upsampling needed)
            const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
            audioPlayer.play(pcmData); // Use Int16Array directly for PCM16
          }
        }
        break;

      case "input_audio_buffer.speech_started":
        if(!feedbackready){
          let textElements = ReceivedTextContainer.children;
          latestInputSpeechBlock = textElements[textElements.length - 1];
          makeNewTextBlock();
          audioPlayer.clear();
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        var Content=message.transcript;
        Content = JSON.parse(Content);
        Content = (Content as any).text;
        latestInputSpeechBlock.classList.add("user-prompts");
        latestInputSpeechBlock.innerHTML += " <b>User:</b><br>" + Content + "<br> <b>Interviewer:</b> ";
        const currentTimestamp = new Date();
        const hoursDifference = Math.floor((currentTimestamp.getTime() - startTimeStamp.getTime()) / (1000 * 60 * 60));
        const minutesDifference = Math.floor((currentTimestamp.getTime() - startTimeStamp.getTime()) / (1000 * 60)) % 60;
        const secondsDifference = Math.floor((currentTimestamp.getTime() - startTimeStamp.getTime()) / 1000) % 60;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to today's date at 00:00:00

        const timestamp = new Date(today.getTime() + hoursDifference * 60 * 60 * 1000 + minutesDifference * 60 * 1000 + secondsDifference * 1000);
        if(!feedbackready)
        transcription.push(createTranscriptMessage('candidate', Content, timestamp));
        break;
      case "response.done":
        ReceivedTextContainer.appendChild(document.createElement("hr"));
        makeNewTextBlock();
        break;
      default:
        consoleLog = JSON.stringify(message, null, 2);
        break
    }
    if (consoleLog) { 
        if (consoleLog.includes("response.output_item.done")) {
          const response = JSON.parse(consoleLog);
          const transcript = response.item.content[0].transcript;
          feedback = transcript;
          if (feedbackready){
            const html = markdown(feedback);
            convertHtmlToPdf(html.toString());
            // feedbackready = false;
          }
          const currentTimestamp = new Date();
          const hoursDifference = Math.floor((currentTimestamp.getTime() - startTimeStamp.getTime()) / (1000 * 60 * 60));
          const minutesDifference = Math.floor((currentTimestamp.getTime() - startTimeStamp.getTime()) / (1000 * 60)) % 60;
          const secondsDifference = Math.floor((currentTimestamp.getTime() - startTimeStamp.getTime()) / 1000) % 60;
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Set to today's date at 00:00:00

          const timestamp = new Date(today.getTime() + hoursDifference * 60 * 60 * 1000 + minutesDifference * 60 * 1000 + secondsDifference * 1000);
          if(!feedbackready)
          transcription.push(createTranscriptMessage('interviewer', transcript, timestamp));
        }
        console.log(consoleLog);
    }
  }
  resetAudio(false);
}

/**
 * Basic audio handling
 */

let recordingActive: boolean = false;
let buffer: Uint8Array = new Uint8Array();

function combineArray(newData: Uint8Array) {
  const newBuffer = new Uint8Array(buffer.length + newData.length);
  newBuffer.set(buffer);
  newBuffer.set(newData, buffer.length);
  buffer = newBuffer;
}

function processAudioRecordingBuffer(data: Buffer) {
  const uint8Array = new Uint8Array(data);
  combineArray(uint8Array);
  if (buffer.length >= 4800) {
    const toSend = new Uint8Array(buffer.slice(0, 4800));
    buffer = new Uint8Array(buffer.slice(4800));
    const regularArray = String.fromCharCode(...toSend);
    const base64 = btoa(regularArray);
    if (recordingActive && !feedbackready) {
      realtimeStreaming.send({
        type: "input_audio_buffer.append",
        audio: base64,
      });
    }
  }

}

async function resetAudio(startRecording: boolean) {
  recordingActive = false;
  if (audioRecorder) {
    audioRecorder.stop();
  }
  if (audioPlayer) {
    audioPlayer.clear();
  }
  audioRecorder = new Recorder(processAudioRecordingBuffer);
  audioPlayer = new Player();
  audioPlayer.init(24000);
  if (startRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioRecorder.start(stream);
    recordingActive = true;
  }
}

/**
 * UI and controls
 */

let latestInputSpeechBlock: Element;

function isAzureOpenAI(): boolean {
  return true;
}

// function getSystemMessage(): string {
//   return  "";
// }

function getTemperature(): number {
  return 0.6;
}

function getVoice(): Voice {
  return "echo" as Voice;
}

function makeNewTextBlock(text: string = "") {
  let newElement = document.createElement("p");
  newElement.textContent = text;
  ReceivedTextContainer?.appendChild(newElement);
}

function appendToTextBlock(text: string) {
  let textElements = ReceivedTextContainer?.children;
  if (!textElements || textElements.length === 0) {
    makeNewTextBlock();
    textElements = ReceivedTextContainer?.children;
  }
  if (textElements && textElements.length > 0) {
    textElements[textElements.length - 1].textContent += text;
  }
}

  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isVideoOn, setIsVideoOn] = useState(true);
  // const [isAudioOn, setIsAudioOn] = useState(true);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const { addPastInterview } = useInterviewStore();

  useEffect(() => {
    requestMediaPermissions();
    return () => {
      stopMediaStream();
    };
  }, []);

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setupMediaRecorder(stream);
    } catch (err) {
      console.error('Error accessing media devices:', err);
    }
  };

  const setupMediaRecorder = (stream: MediaStream) => {
    startTime = Date.now();
    console.log('Start Time:', startTime);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8,opus',
    });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      url = URL.createObjectURL(blob);
      
    };
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

  // const toggleAudio = () => {
  //   if (videoRef.current?.srcObject) {
  //     const stream = videoRef.current.srcObject as MediaStream;
  //     stream.getAudioTracks().forEach((track) => {
  //       track.enabled = !isAudioOn;
  //     });
  //     setIsAudioOn(!isAudioOn);
  //   }
  // };
  const stopMediaStream = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
  };

  const startInterview = async () => {
    startTimeStamp = new Date();
    setIsInterviewStarted(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      mediaRecorderRef.current.start();
    }
    const endpoint = "https://hvcodequarry.openai.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-4o-mini-realtime-preview"
    const key = "2fZQus7SSpxS4fUrNk5nf4JD0tabvejWzLgw3wJQxRzUz1FzFkkpJQQJ99BCACHYHv6XJ3w3AAABACOGiPYZ";
    const deploymentOrModel = "gpt-4o-mini-realtime-preview";

    if (isAzureOpenAI() && !endpoint && !deploymentOrModel) {
      alert("Endpoint and Deployment are required for Azure OpenAI");
      return;
    }

    if (!isAzureOpenAI() && !deploymentOrModel) {
      alert("Model is required for OpenAI");
      return;
    }

    if (!key) {
      alert("API Key is required");
      return;
    }

    try {
      start_realtime(endpoint, key, deploymentOrModel);
    } catch (error) {
      console.log(error);
    }
    realtimeStreaming.send(
      {
        "type":"conversation.item.create",
        "item":{
           "type":"message",
           "role":"user",
           "content":[
              {
                 "type":"input_text",
                 "text":"Hello!"
              }
           ]
        }
     });
     realtimeStreaming.send({
      type: "response.create",
    });
  };

  const endInterview = async() => {
    feedbackready = true;
    let feedbackPrompt = `Evaluate the candidate's following skills: ` + skills + ` based on the provided criteria and generate a detailed report on their performance also giving feedback if they should be hired for the ` + selectedRole === 'Others' ? otherRole : selectedRole + ` role. 

# Steps

1. **Gather Information:** Review the candidate's resume, cover letter, interview notes, and any test results to understand their capabilities in each skill area.
2. **Assess Skills:** Rate each skill on a scale of 1 to 10, providing supporting observations and evidence for the rating given.
3. **Provide Feedback:** Offer detailed feedback for each skill, including strengths, areas for improvement, and any relevant examples.
4. **Conclusion:** Summarize whether the candidate is fit for the role based on their skills and provide overall feedback.

# Output Format

- Use Markdown formatting to present your analysis.
- Rate each skill out of 10.
- Provide a summary of the candidate's fit for the role.
- Give Gap between the Skill Name and make the skill name bold.

# Examples

**Candidate Skills Evaluation Report**

**Candidate Name:** [Candidate Name]  
**Position:** [Position Title]  

## Skills Assessment

### Negotiation
- **Rating:** [8/10]
- **Comments:** The candidate demonstrated strong negotiation skills during the interview, showcasing the ability to find mutually beneficial solutions. [Provide additional evidence or examples if available.]

### Customer Handling
- **Rating:** [7/10]
- **Comments:** Effective in managing customer inquiries and complaints. They provided examples of successfully resolving challenging situations. [Add any relevant details from their experience or interview.]

### Business Development
- **Rating:** [9/10]
- **Comments:** The candidate has a proven track record of identifying and pursuing new business opportunities. [Mention any specific achievements or metrics if provided.]

### Communication
- **Rating:** [6/10]
- **Comments:** While generally clear, there is room for improvement in adapting communication style to different audiences. [Elaborate with any specific observations or feedback.]

### Problem-solving Capabilities
- **Rating:** [7/10]
- **Comments:** Demonstrated competent problem-solving skills with logical and structured thinking. [Add examples or scenarios where this was evident.]

## Overall Feedback
The candidate possesses a strong potential for the role, particularly in business development and negotiation. While their communication skills could be refined, their ability to handle customers effectively makes them a good fit for the team.

---

# Notes

- Ensure each skill assessment is backed by specific evidence or examples where possible.
- Maintain objectivity and clarity throughout the report.
- Highlight any discrepancies or gaps between the candidate's skills and the role requirements, if any.`;

await realtimeStreaming.send(createConfigMessage(feedbackPrompt));

console.log('Feedback config has been sent');
  resetAudio(false);
  realtimeStreaming.send(
    {
      "type":"conversation.item.create",
      "item":{
         "type":"message",
         "role":"user",
         "content":[
            {
               "type":"input_text",
               "text":"Could you please share me the detailed evaluation report of the candidate and if he/she is eligible for the role or not. Also analysis on each and every question. Only give the report when there is enough interaction with the candidate."
            }
         ]
      }
   });
   if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
    mediaRecorderRef.current.stop();
  }
  stopMediaStream();
  await setTimeout(() => {
    realtimeStreaming.send({
      type: "response.create",
    });
  }, 700);
  navigate('/interview-history');
  };

  return (<React.Fragment>

<div className="h-screen bg-gray-900 text-white">
      <div className="header">
        <img className="un_logo" src="https://d8it4huxumps7.cloudfront.net/uploads/images/unstop/svg/unstop-logo-white.svg"
          width="80" />
      </div>
      <div className="wrapper flex">
        <div className="flex flex-col p-4 gap-4 h-full w-full w-[calc(100%-610px)]">
          <div className="wrapper_inner flex">
            <div className={`box ${isInterviewStarted ? 'ripple' : ''}`}>
                <img src="https://d8it4huxumps7.cloudfront.net/uploads/images/67640f4238913_harshavardhan_bajoria.jpg"
                  alt="AI Interviewer"
                  className="circle-img"
                />
              
                <div  className={`bars ${isInterviewStarted ? '' : 'd-none'}`}>
                  <div className="bar animate"></div>
                  <div className="bar animate"></div>
                  <div className="bar animate"></div>
                  <div className="bar animate"></div>
                  <div className="bar animate"></div>
                  <div className="bar animate"></div>
                </div>
              
              
            </div>
            <div className="box relative ">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-lg bg-gray-800"
              />
              <div className="absolute bottom-4  space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleVideo}
                  className="bg-gray-800/50 hover:bg-gray-700/50"
                >
                  {isVideoOn ? (
                    <Camera className="h-5 w-5" />
                  ) : (
                    <CameraOff className="h-5 w-5" />
                  )}
                </Button>
                {/* <Button
              variant="outline"
              size="sm"
              onClick={toggleAudio}
              className="bg-gray-800/50 hover:bg-gray-700/50"
            >
              {isAudioOn ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button> */}
              </div>
            </div>
            <div className="btn_wrapper">
              {!isInterviewStarted ? (
                <Button onClick={startInterview} id="start-recording" className="bg-blue-600 hover:bg-blue-700">
                  Start Interview
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={endInterview}
                  id="stop-recording"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  End Interview
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="chat-panel">
          <div className="panel_head">
            <h3>Transcript</h3>
          </div>
          
          <div className="panel-body" id="received-text-container">
          {isInterviewStarted ? (
                <p>Interviewer:</p>
              ) : (
                ''
              )}
          </div>
        </div>
      </div>
    </div>
  </React.Fragment>
  );
}