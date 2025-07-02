import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Video } from 'lucide-react';
import { useInterviewStore } from '../store/interviewStore';
import { Button } from './ui/Button';

export function InterviewHistory() {
  const navigate = useNavigate();
  const { pastInterviews } = useInterviewStore();

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Interview History</h2>

        <div className="space-y-4">
          {pastInterviews.map((interview) => (
            <div
              key={interview.id}
              className="bg-gray-800 rounded-lg shadow-lg overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-blue-900 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-blue-300" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-lg font-medium">{interview.role} Interview</h4>
                      <p className="text-sm text-gray-400">
                        {new Date(interview.date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {interview.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    
                    <Button
                      onClick={() => navigate(`/interview-report/${interview.id}`)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      View Report
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}