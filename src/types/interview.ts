export type jobDescription = '';
export type Role = 'SDE' | 'Marketing Manager' | 'Speech Assessment' | 'Marketing Manager (Long Form)' | 'Marketing Manager (Demo)' | 'Others';
export type other = string;

export interface Interview {
  id: string;
  role: Role;
  skills: string[];
  date: Date;
  duration: number;
  videoUrl?: string;
  transcript: TranscriptMessage[];
  status: 'completed' | 'ongoing';
  feedback: string;
  idealRating: number[];
  candidateRating: number[];
}

export interface TranscriptMessage {
  id: string;
  speaker: 'interviewer' | 'candidate';
  message: string;
  timestamp: Date;
}

export interface InterviewReport {
  id: string;
  interviewId: string;
  feedback: string;
  score: number;
  recommendations: string[];
}
