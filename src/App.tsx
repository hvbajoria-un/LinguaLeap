import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { InterviewSetup } from './components/InterviewSetup';
import { InterviewRoom } from './components/InterviewRoom';
import { InterviewHistory } from './components/InterviewHistory';
import { InterviewReport } from './components/InterviewReport';
import { TaskRoom } from './components/TaskRoom';

const placeholderUserImage = 'https://randomuser.me/api/portraits/men/32.jpg';
const placeholderAIImage = 'https://d8it4huxumps7.cloudfront.net/uploads/images/68667d78cd1f2_image.png';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <InterviewSetup />
            </Layout>
          }
        />
        <Route path="/interview-room" element={<InterviewRoom />} />
        <Route
          path="/interview-history"
          element={
            <Layout>
              <InterviewHistory />
            </Layout>
          }
        />
        <Route
          path="/interview-report"
          element={
            <Layout>
              <InterviewReport />
            </Layout>
          }
        />
        <Route
          path="/interview-report/:id"
          element={
            <Layout>
              <InterviewReport />
            </Layout>
          }
        />
        {/* Task Rooms */}
        <Route path="/interview-room/task/1" element={<TaskRoom taskNumber={1} totalTasks={6} taskTitle="Repeat Task" aiImage={placeholderAIImage} aiName="Unstop Bot" userImage={placeholderUserImage} userName="Harshavardhan Bajoria" />} />
        <Route path="/interview-room/task/2" element={<TaskRoom taskNumber={2} totalTasks={6} taskTitle="Sentence Builds" aiImage={placeholderAIImage} aiName="Unstop Bot" userImage={placeholderUserImage} userName="Harshavardhan Bajoria" />} />
        <Route path="/interview-room/task/3" element={<TaskRoom taskNumber={3} totalTasks={6} taskTitle="Conversations" aiImage={placeholderAIImage} aiName="Unstop Bot" userImage={placeholderUserImage} userName="Harshavardhan Bajoria" />} />
        <Route path="/interview-room/task/4" element={<TaskRoom taskNumber={4} totalTasks={6} taskTitle="Sentence Completion" aiImage={placeholderAIImage} aiName="Unstop Bot" userImage={placeholderUserImage} userName="Harshavardhan Bajoria" />} />
        <Route path="/interview-room/task/5" element={<TaskRoom taskNumber={5} totalTasks={6} taskTitle="Dictation" aiImage={placeholderAIImage} aiName="Unstop Bot" userImage={placeholderUserImage} userName="Harshavardhan Bajoria" />} />
        <Route path="/interview-room/task/6" element={<TaskRoom taskNumber={6} totalTasks={6} taskTitle="Passage Reconstruction" aiImage={placeholderAIImage} aiName="Unstop Bot" userImage={placeholderUserImage} userName="Harshavardhan Bajoria" />} />
      </Routes>
    </Router>
  );
}