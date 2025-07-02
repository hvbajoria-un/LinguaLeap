import { useState } from 'react';

export interface TranscriptMessage {
  speaker: string;
  message: string;
  time: string;
}

export function useTaskTranscript(initialTranscript: TranscriptMessage[] = []) {
  const [transcript, setTranscript] = useState<TranscriptMessage[]>(initialTranscript);

  const addMessage = (speaker: string, message: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTranscript((prev) => [...prev, { speaker, message, time }]);
  };

  const clearTranscript = () => setTranscript([]);

  return {
    transcript,
    addMessage,
    clearTranscript,
    setTranscript, // for loading from store if needed
  };
} 