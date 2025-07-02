import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Clock, Activity, Video } from 'lucide-react';
import { useInterviewStore, useMultiTaskInterviewStore } from '../store/interviewStore';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import markdown from '@wcj/markdown-to-html';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function parseGeminiJsonReport(report: string) {
  try {
    const parsed = JSON.parse(report);
    if (Array.isArray(parsed) && parsed[0]?.data?.skills_evaluation) {
      return parsed[0];
    }
  } catch {}
  return null;
}

export function InterviewReport() {
  const { id } = useParams();
  const { pastInterviews } = useInterviewStore();
  const interview = pastInterviews.find((i) => i.id === id);
  const chartRef = useRef<Chart | null>(null);
  const { getAllReports, getFinalReport } = useMultiTaskInterviewStore();
  const allTaskReports = getAllReports();
  const finalReport = getFinalReport();
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(!finalReport);

  useEffect(() => {
    if (finalReport) setIsLoading(false);
    else setIsLoading(true);
  }, [finalReport]);

  // Try to parse the new JSON format from Gemini
  const geminiJson = finalReport ? parseGeminiJsonReport(finalReport) : null;

  if (!interview) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold">Interview Report Not Found</h2>
        </div>
      </div>
    );
  }

  // Loader for final report
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
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

  // Show multi-task reports if available, even if interview is not found
  if ((!interview) && (finalReport || (allTaskReports && allTaskReports.length > 0))) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          {finalReport && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-8 w-8" />
                <h1 className="text-3xl font-bold">Final Interview Report</h1>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 min-h-[300px] mb-8">
                <div dangerouslySetInnerHTML={{ __html: markdown(finalReport) }} />
              </div>
            </>
          )}
          {allTaskReports && allTaskReports.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 mt-8">Task-wise Reports</h2>
              <div className="mb-6 flex gap-2">
                {allTaskReports.map((r, idx) => (
                  <button
                    key={r.taskNumber}
                    className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === idx ? 'bg-blue-800 border-blue-400 text-white' : 'bg-gray-800 border-transparent text-blue-200'}`}
                    onClick={() => setActiveTab(idx)}
                  >
                    Task {r.taskNumber}
                  </button>
                ))}
              </div>
              <div className="bg-gray-800 rounded-lg p-6 min-h-[300px]">
                {typeof allTaskReports[activeTab].report === 'string' ? (
                  <div dangerouslySetInnerHTML={{ __html: markdown(allTaskReports[activeTab].report) }} />
                ) : (
                  <pre className="text-sm text-blue-100">{JSON.stringify(allTaskReports[activeTab].report, null, 2)}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Read the HTML content from the report
  // const htmlContent = interview.feedback;
  // htmlContent = htmlContent.replace(/<h2>/g, '<br><h2><strong>').replace(/<\/h2>/g, '</strong></h2>').replace(/<h3>/g, '<br><h3><strong>').replace(/<\/h3>/g, '</strong></h3>');

  // Load the HTML content using cheerio
  // const $ = cheerio.load(htmlContent);

  // Initialize an object to store skill ratings
  const skillRatings: { [key: string]: number } = {};

  // Run a loop to traverse interview.skills and interview.candidateRating and store in the skillRatings object
  interview.skills.forEach((skill, index) => {
    skillRatings[skill] = interview.candidateRating[index];
  });

  // $('h3').each((index: any, element: any) => {
  //   console.log(interview);
  //   const skillName = $(element).text();
  //   const ratingElement = $(element).next('ul').find('li').first();
  //   const ratingText = ratingElement.text();
  //   const ratingMatch = ratingText.match(/Rating:\s*(\d+\/\d+)/);

  //   if (ratingMatch) {
  //     skillRatings[skillName] = ratingMatch[1];
  //   }
  // });



  useEffect(() => {
    console.log(interview);
    const canvas = document.getElementById('myChart') as HTMLCanvasElement;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    
      if (ctx) {
        if (chartRef.current) {
          chartRef.current.destroy();
        }
        chartRef.current = new Chart(ctx, {
          type: 'radar',
          data: {
            labels: interview.skills,
            datasets: [{
              label: 'Current Ratings',
              data: interview.candidateRating,
              fill: true,
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgb(54, 162, 235)',
              pointBackgroundColor: 'rgb(54, 162, 235)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(54, 162, 235)'
            },
            {
              label: 'Ideal Ratings',
              data: interview.idealRating,
              fill: true,
              backgroundColor: 'rgba(255, 200, 0,0.3)',
              borderColor: 'rgba(255, 222, 189, 1)',
              pointBackgroundColor: 'rgba(255, 178, 189, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(255, 222, 189, 0.9)'
            }],
          },
          options: {
            plugins:{
              legend: {
                display:true,
              },
            },
            scales: {
              r: {
                angleLines: {
                  display: true,
                  color: 'rgba(256,256,256,0.3)', // Set grid line color to white
                },
                suggestedMin: 0,
                suggestedMax: 10,
                ticks:{
                  color: '#f6f8fa',
                  backdropColor: '#00000000', 
                },
                grid: {
                  color: 'rgba(256,256,256,0.3)', // Set grid line color to white
                },
                pointLabels: {
                  color: '#f6f8fa', // Set point labels (skills) to white
                  font: {
                    size: 14, // Set font size to 16px
                  },
                }
              },
            },
            elements: {
              line: {
                borderWidth: 3
              },
            },
          },
        }
        
      );
      }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };  
  }, [skillRatings]);

  // If there are multi-task reports, show the tabbed UI
  if (allTaskReports && allTaskReports.length > 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Interview Reports</h1>
          </div>
          <div className="mb-6 flex gap-2">
            {allTaskReports.map((r, idx) => (
              <button
                key={r.taskNumber}
                className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === idx ? 'bg-blue-800 border-blue-400 text-white' : 'bg-gray-800 border-transparent text-blue-200'}`}
                onClick={() => setActiveTab(idx)}
              >
                Task {r.taskNumber}
              </button>
            ))}
          </div>
          <div className="bg-gray-800 rounded-lg p-6 min-h-[300px]">
            {/* Render the report as HTML/Markdown if string, or JSON if object */}
            {typeof allTaskReports[activeTab].report === 'string' ? (
              <div dangerouslySetInnerHTML={{ __html: markdown(allTaskReports[activeTab].report) }} />
            ) : (
              <pre className="text-sm text-blue-100">{JSON.stringify(allTaskReports[activeTab].report, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- NEW JSON FORMAT RENDERING ---
  if (geminiJson) {
    const { data } = geminiJson;
    const skills = Object.keys(data.skills_evaluation || {});
    const skillScores = skills.map(skill => {
      const rating = data.skills_evaluation[skill].rating;
      if (typeof rating === 'string' && rating.includes('/')) {
        return parseInt(rating.split('/')[0], 10);
      }
      return data.skills_evaluation[skill].obtained || 0;
    });
    const skillTotals = skills.map(skill => {
      const rating = data.skills_evaluation[skill].rating;
      if (typeof rating === 'string' && rating.includes('/')) {
        return parseInt(rating.split('/')[1], 10);
      }
      return data.skills_evaluation[skill].total || 10;
    });
    const idealScores = skillTotals;
    const candidateScores = skillScores;
    const totalObtained = skillScores.reduce((a, b) => a + b, 0);
    const totalPossible = skillTotals.reduce((a, b) => a + b, 0);
    const avgScore = (totalObtained / totalPossible) * 30;
    const avgLabel = avgScore >= 24 ? 'EXCELLENT' : avgScore >= 18 ? 'GOOD' : avgScore >= 12 ? 'AVERAGE' : 'POOR';
    // Radar chart rendering
    useEffect(() => {
      const canvas = document.getElementById('myChart') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (chartRef.current) chartRef.current.destroy();
        chartRef.current = new Chart(ctx, {
          type: 'radar',
          data: {
            labels: skills,
            datasets: [
              {
                label: 'Candidate Score',
                data: candidateScores,
                fill: true,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgb(54, 162, 235)',
                pointBackgroundColor: 'rgb(54, 162, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(54, 162, 235)'
              },
              {
                label: 'Ideal Score',
                data: idealScores,
                fill: true,
                backgroundColor: 'rgba(255, 200, 0,0.3)',
                borderColor: 'rgba(255, 222, 189, 1)',
                pointBackgroundColor: 'rgba(255, 178, 189, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(255, 222, 189, 0.9)'
              }
            ],
          },
          options: {
            plugins: { legend: { display: true } },
            scales: {
              r: {
                angleLines: { display: true, color: 'rgba(256,256,256,0.3)' },
                suggestedMin: 0,
                suggestedMax: 10,
                ticks: { color: '#f6f8fa', backdropColor: '#00000000' },
                grid: { color: 'rgba(256,256,256,0.3)' },
                pointLabels: { color: '#f6f8fa', font: { size: 14 } }
              },
            },
            elements: { line: { borderWidth: 3 } },
          },
        });
      }
      return () => { if (chartRef.current) chartRef.current.destroy(); };
    }, [finalReport]);
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-bold">AI Interview</span>
            <button className="ml-auto px-4 py-2 rounded bg-gray-800 text-white border border-gray-700">Attempt Settings</button>
            <button className="px-4 py-2 rounded bg-gray-800 text-white border border-gray-700">Report</button>
          </div>
          {/* Global Score */}
          <div className="flex gap-8 mb-8">
            <div className="flex flex-col items-center justify-center bg-white/5 rounded-xl p-6 min-w-[220px]">
              <div className="relative flex items-center justify-center mb-2">
                <svg width="80" height="80">
                  <circle cx="40" cy="40" r="36" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                  <circle cx="40" cy="40" r="36" stroke="#facc15" strokeWidth="8" fill="none" strokeDasharray={2 * Math.PI * 36} strokeDashoffset={2 * Math.PI * 36 * (1 - totalObtained / totalPossible)} />
                </svg>
                <span className="absolute text-2xl font-bold text-yellow-400">{avgScore.toFixed(1)}</span>
              </div>
              <div className="text-yellow-400 font-bold text-lg">{avgLabel}</div>
              <div className="text-gray-300 text-sm mt-1">Candidate lacks depth, requires further development and training.</div>
            </div>
            <div className="flex-1 flex flex-col gap-2 justify-center">
              <div className="flex gap-8">
                <div className="flex flex-col items-center">
                  <span className="text-gray-400">Total Task</span>
                  <span className="font-bold text-lg">{skills.length}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-gray-400">Task Attempted</span>
                  <span className="font-bold text-lg">{skills.length}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-gray-400">Time Taken</span>
                  <span className="font-bold text-lg">--</span>
                </div>
              </div>
            </div>
          </div>
          {/* Skills Performance */}
          <div className="mb-8">
            <div className="font-bold text-lg mb-2">Skills Performance</div>
            <div className="flex flex-col gap-2">
              {skills.map((skill, idx) => (
                <div key={skill} className="flex items-center gap-4">
                  <span className="w-48">{idx + 1}. {skill}</span>
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-2 bg-yellow-400" style={{ width: `${(candidateScores[idx] / idealScores[idx]) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Task Wise Performance Tabs */}
          <div className="mb-8">
            <div className="font-bold text-lg mb-2">Task Wise Performance</div>
            <div className="flex gap-2 mb-4">
              {skills.map((skill, idx) => (
                <button key={skill} className={`px-4 py-2 rounded-full font-semibold border ${activeTab === idx ? 'bg-blue-800 border-blue-400 text-white' : 'bg-gray-800 border-transparent text-blue-200'}`} onClick={() => setActiveTab(idx)}>{skill}</button>
              ))}
            </div>
            <div className="bg-gray-800 rounded-lg p-6 min-h-[200px]">
              <div className="flex items-center gap-4 mb-2">
                <div className="font-bold text-xl">{skills[activeTab]} Task</div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-2xl font-bold text-orange-400">{candidateScores[activeTab]}</span>
                  <span className="text-gray-400">/ {idealScores[activeTab]}</span>
                </div>
              </div>
              <div className="mb-4 text-gray-200">{data.skills_evaluation[skills[activeTab]].explanation}</div>
              {/* Candidate Response Section - show only for this skill if available */}
              {data.transcript && Array.isArray(data.transcript) && data.transcript.length > 0 && (
                <div className="mb-4">
                  <div className="font-semibold text-blue-300 mb-1">Candidate Response</div>
                  <div className="bg-gray-900 rounded p-3 text-blue-100 text-base">
                    {data.transcript
                      .filter((msg: any) => msg.speaker === 'candidate' && msg.message && msg.message.trim() && msg.skill === skills[activeTab])
                      .map((msg: any, idx: number) => (
                        <div key={idx} className="mb-2">
                          <span>{msg.message}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="flex gap-8">
                <div className="flex-1 bg-green-900/20 rounded-lg p-4">
                  <div className="font-bold text-green-300 mb-2">Key strengths</div>
                  <ul className="list-disc ml-6 text-green-200">
                    {data.candidate_feedback.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="flex-1 bg-red-900/20 rounded-lg p-4">
                  <div className="font-bold text-red-300 mb-2">Area of Improvement</div>
                  <ul className="list-disc ml-6 text-red-200">
                    {data.candidate_feedback.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          {/* Skill Summary Radar Chart */}
          <div className="mb-8">
            <div className="font-bold text-lg mb-2">Skill Summary</div>
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-2"></span> Ideal Score
                <span className="inline-block w-3 h-3 rounded-full bg-blue-400 ml-6 mr-2"></span> Candidate Score
              </div>
              <canvas id="myChart" />
            </div>
          </div>
          {/* Overall Feedback */}
          <div className="mb-8">
            <div className="font-bold text-lg mb-2">Overall Feedback</div>
            <div className="bg-gray-800 rounded-lg p-6 text-gray-200">{data.candidate_feedback.overall_feedback}</div>
          </div>
          {/* Skills Wise Overview */}
          <div className="mb-8">
            <div className="font-bold text-lg mb-2">Skills Wise Overview</div>
            <div className="bg-gray-800 rounded-lg p-6">
              {skills.map((skill, idx) => (
                <div key={skill} className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">{idx + 1}. {skill}</span>
                    <span className="ml-auto text-orange-400 font-bold">{candidateScores[idx]}/{idealScores[idx]}</span>
                  </div>
                  <div className="text-gray-200 mb-2">{data.skills_evaluation[skill].explanation}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Custom Questions */}
          {data.customQuestions && Object.keys(data.customQuestions).length > 0 && (
            <div className="mb-8">
              <div className="font-bold text-lg mb-2">Custom Questions</div>
              <div className="bg-gray-800 rounded-lg p-6">
                {Object.entries(data.customQuestions).map(([qKey, qVal]: [string, any], i: number) => (
                  <div key={i} className="mb-4">
                    <div className="font-semibold text-blue-200 mb-1">{qKey.replace(/([A-Z])/g, ' $1').trim()}:</div>
                    <div className="text-gray-200">{qVal}</div>
                  </div>
                ))}
                <div className="text-xs text-gray-400 mt-4">*This report is AI-generated; please ensure to review and verify all information before making any decisions.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- If not valid JSON, show a user-friendly error ---
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-8 mt-16 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-red-400">Report Format Error</h2>
        <p className="text-gray-200">Sorry, the interview report could not be displayed because the data is not in the expected format. Please contact support or try again later.</p>
      </div>
    </div>
  );
}