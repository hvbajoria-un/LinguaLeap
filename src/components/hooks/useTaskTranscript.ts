import { useState } from 'react';

export interface TranscriptMessage {
  speaker: string;
  message: string;
  time: string; // formatted time string for display
  timestamp: string; // ISO string for real time
}

export function useTaskTranscript(initialTranscript: TranscriptMessage[] = []) {
  const [transcript, setTranscript] = useState<TranscriptMessage[]>(initialTranscript);

  const addMessage = (speaker: string, message: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = now.toISOString();
    setTranscript((prev) => [...prev, { speaker, message, time, timestamp }]);
  };

  const clearTranscript = () => setTranscript([]);

  return {
    transcript,
    addMessage,
    clearTranscript,
    setTranscript, // for loading from store if needed
  };
} 