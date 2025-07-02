import { create } from 'zustand';
import { Interview } from '../types/interview';
import { sampleInterviews } from '../data/sampleInterviews';
// import fs from 'fs';
// import path from 'path';

// const filePath = '../data/sampleInterviews'

interface InterviewState {
  currentInterview: Interview | null;
  pastInterviews: Interview[];
  setCurrentInterview: (interview: Interview | null) => void;
  addPastInterview: (interview: Interview) => void;
}

interface TaskTranscript {
  taskNumber: number;
  transcript: { speaker: string; message: string; time: string }[];
}

interface TaskReport {
  taskNumber: number;
  report: any; // You can type this more strictly if you have a report type
}

interface MultiTaskInterviewStore {
  taskTranscripts: TaskTranscript[];
  addTaskTranscript: (taskNumber: number, transcript: { speaker: string; message: string; time: string }[]) => void;
  getAllTranscripts: () => TaskTranscript[];
  clearTranscripts: () => void;
  taskReports: TaskReport[];
  addTaskReport: (taskNumber: number, report: any) => void;
  getAllReports: () => TaskReport[];
  clearReports: () => void;
  finalReport: string | null;
  setFinalReport: (report: string) => void;
  getFinalReport: () => string | null;
}

// fs.writeFileSync(filePath, JSON.stringify(sampleInterviews, null, 2), 'utf-8');

export const useInterviewStore = create<InterviewState>((set) => ({
  currentInterview: null,
  pastInterviews: sampleInterviews, // Initialize with sample data
  setCurrentInterview: (interview) => set({ currentInterview: interview }),
  addPastInterview: (interview) => {
      //sampleInterviews.push(interview);
      set((state) => ({
        pastInterviews: [...state.pastInterviews, interview],
      }));
  },
}));

export const useMultiTaskInterviewStore = create<MultiTaskInterviewStore>((set, get) => ({
  taskTranscripts: [],
  addTaskTranscript: (taskNumber, transcript) =>
    set((state) => {
      // Replace if already exists
      const filtered = state.taskTranscripts.filter(t => t.taskNumber !== taskNumber);
      return { taskTranscripts: [...filtered, { taskNumber, transcript }] };
    }),
  getAllTranscripts: () => get().taskTranscripts,
  clearTranscripts: () => set({ taskTranscripts: [] }),
  taskReports: [],
  addTaskReport: (taskNumber, report) =>
    set((state) => {
      const filtered = state.taskReports.filter(r => r.taskNumber !== taskNumber);
      return { taskReports: [...filtered, { taskNumber, report }] };
    }),
  getAllReports: () => get().taskReports,
  clearReports: () => set({ taskReports: [] }),
  finalReport: null,
  setFinalReport: (report) => set({ finalReport: report }),
  getFinalReport: () => get().finalReport,
}));