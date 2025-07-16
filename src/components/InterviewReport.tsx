import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Clock, Activity, Video, Trophy, Lightbulb, TrendingUp, AlertTriangle, ArrowRightCircle } from 'lucide-react';
import { useInterviewStore, useMultiTaskInterviewStore } from '../store/interviewStore';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import markdown from '@wcj/markdown-to-html';
import { Interview } from '../types/interview';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { TranscriptMessage } from './hooks/useTaskTranscript';
import { InterviewPDFExport } from './InterviewPDFExport';
import ReactDOM from 'react-dom';

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

function isInterview(obj: any): obj is Interview {
  return obj && typeof obj.duration === 'number';
}

export function InterviewReport() {
  // All hooks and state at the top
  const { id } = useParams();
  const { pastInterviews } = useInterviewStore() as { pastInterviews: Interview[] };
  const interview: Interview | undefined = pastInterviews.find((i: Interview) => i.id === id);
  const chartRef = useRef<Chart | null>(null);
  const { getAllReports, getFinalReport } = useMultiTaskInterviewStore();
  const allTaskReports = getAllReports();
  const finalReport = getFinalReport();
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(!finalReport);
  const pdfExportRef = useRef<HTMLDivElement>(null);

  // Derived variables
  const normalized = normalizeFullReport({ interview, finalReport });

  // Helper to get base64 image of a chart
  function getChartBase64(canvasId: string): string {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      return canvas.toDataURL('image/png');
    }
    return '';
  }

  // --- PDF Download Handler ---
  async function handleDownloadPDF() {
    // 1. Prepare all data for InterviewPDFExport
    const logoUrl = '/logo.svg'; // Update with your logo path
    // Use available fields or fallback
    const candidateName = (interview && ('name' in interview) && (interview as any).name) || (interview && ('candidateName' in interview) && (interview as any).candidateName) || 'Candidate';
    const candidateEmail = (interview && ('email' in interview) && (interview as any).email) || (interview && ('candidateEmail' in interview) && (interview as any).candidateEmail) || 'candidate@email.com';
    const role = normalized?.role || interview?.role || 'Role';
    const summary = normalized?.overallFeedback || '';
    const score = (() => {
      if (!normalized) return 0;
      const total = normalized.candidateScores.reduce((a: number, b: number) => a + b, 0);
      return normalized.candidateScores.length > 0 ? total / normalized.candidateScores.length : 0;
    })();
    const scoreLabel = (() => {
      if (score < 2) return 'Extremely Poor';
      if (score < 4) return 'Poor';
      if (score < 6) return 'Average';
      if (score < 8) return 'Good';
      if (score < 9) return 'Very Good';
      return 'Excellent';
    })();
    const skills = (normalized?.skills || []).map((name: string, i: number) => ({
      name,
      candidate: normalized?.candidateScores[i] || 0,
      ideal: normalized?.idealScores[i] || 10,
    }));
    // Wait for chart to render
    await new Promise(res => setTimeout(res, 300));
    const radarChartUrl = getChartBase64('myChart');
    const strengths = normalized?.strengths || [];
    const weaknesses = normalized?.weaknesses || [];
    // Prepare tasks
    const tasks = (allTaskReports || [])
      .map((r, idx) => {
        const task = normalizeSingleTaskReport(r.report);
        if (!task) return undefined;
        const radarId = `myChart-task-${idx}`;
        // Try to get radar chart for each task if rendered
        const radarChartUrl = getChartBase64(radarId);
        return {
          name: task.role || `Task ${r.taskNumber}`,
          score: (() => {
            const total = task.candidateScores.reduce((a: number, b: number) => a + b, 0);
            return task.candidateScores.length > 0 ? total / task.candidateScores.length : 0;
          })(),
          summary: task.overallFeedback || '',
          strengths: task.strengths || [],
          weaknesses: task.weaknesses || [],
          radarChartUrl,
          skills: (task.skills || []).map((name: string, i: number) => ({
            name,
            candidate: task.candidateScores[i] || 0,
            ideal: task.idealScores[i] || 10,
            explanation: task.explanations[i] || '',
          })),
          feedback: task.overallFeedback || '',
          transcript: task.transcript || [],
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
    // Use all transcripts for full transcript page
    const transcript = interview?.transcript || normalized?.transcript || [];
    // 2. Render InterviewPDFExport off-screen
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    document.body.appendChild(container);
    import('react-dom').then(ReactDOM => {
      ReactDOM.render(
        <InterviewPDFExport
          logoUrl={logoUrl}
          candidateName={candidateName}
          candidateEmail={candidateEmail}
          role={role}
          summary={summary}
          score={score}
          scoreLabel={scoreLabel}
          skills={skills}
          radarChartUrl={radarChartUrl}
          strengths={strengths}
          weaknesses={weaknesses}
          tasks={tasks}
          transcript={transcript}
        />,
        container,
        async () => {
          // Wait for DOM to render
          await new Promise(res => setTimeout(res, 500));
          // 3. Use html2canvas to capture each page
          const pages = Array.from(container.children[0].children);
          const pdf = new jsPDF({ unit: 'px', format: 'a4' });
          const padding = 0;
          let addPage = false;
          for (let i = 0; i < pages.length; i++) {
            // eslint-disable-next-line no-await-in-loop
            const canvas = await html2canvas(pages[i] as HTMLElement, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pageWidth = pdf.internal.pageSize.getWidth() - 2 * padding;
            const pageHeight = pdf.internal.pageSize.getHeight() - 2 * padding;
            let imgWidth = canvas.width;
            let imgHeight = canvas.height;
            const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight, 1);
            imgWidth *= ratio;
            imgHeight *= ratio;
            if (addPage) pdf.addPage();
            pdf.addImage(imgData, 'PNG', padding, padding, imgWidth, imgHeight);
            addPage = true;
          }
          pdf.save('Interview_Report.pdf');
          // Clean up
          ReactDOM.unmountComponentAtNode(container);
          container.remove();
        }
      );
    });
  }

  // All other helper functions (normalizeFullReport, normalizeSingleTaskReport, formatDuration, etc.)
  // --- UNIFIED REPORT RENDERING FOR ALL FORMATS ---
  // Helper to normalize any report (Gemini JSON, legacy markdown, or object)
  function normalizeFullReport({ interview, finalReport }: { interview: any, finalReport: any }) {
    let data = null;
    try {
      const parsed = typeof finalReport === 'string' ? JSON.parse(finalReport) : finalReport;
      if (parsed && (parsed.data?.skills_evaluation || parsed.skills_evaluation)) {
        data = parsed.data || parsed;
      }
    } catch {}
    if (data) {
      // Gemini JSON format
      const skills = Object.keys(data.skills_evaluation || {});
      const candidateScores = skills.map(skill => {
        const rating = data.skills_evaluation[skill].rating;
        if (typeof rating === 'string' && rating.includes('/')) {
          return parseInt(rating.split('/')[0], 10);
        }
        return data.skills_evaluation[skill].obtained || 0;
      });
      const idealScores = skills.map(skill => {
        const rating = data.skills_evaluation[skill].rating;
        if (typeof rating === 'string' && rating.includes('/')) {
          return parseInt(rating.split('/')[1], 10);
        }
        return data.skills_evaluation[skill].total || 10;
      });
      // Custom questions: support both object and Q/A pair
      let customQuestions: Record<string, string> = {};
      if (data.customQuestions) {
        if (typeof data.customQuestions === 'object' && !Array.isArray(data.customQuestions)) {
          // If it's a single Q/A pair
          if ('Question' in data.customQuestions && 'Answer' in data.customQuestions) {
            customQuestions[data.customQuestions.Question] = data.customQuestions.Answer;
          } else {
            customQuestions = data.customQuestions;
          }
        }
      }
      return {
        role: data.role || '',
        company: data.company || '',
        job_description: data.job_description || '',
        skills,
        candidateScores,
        idealScores,
        explanations: skills.map(skill => data.skills_evaluation[skill].explanation),
        skillRatings: skills.map(skill => data.skills_evaluation[skill].rating),
        strengths: data.candidate_feedback?.strengths || [],
        weaknesses: data.candidate_feedback?.weaknesses || [],
        overallFeedback: data.candidate_feedback?.overall_feedback || '',
        transcript: data.transcript || [],
        customQuestions,
      };
    }
    // Legacy/markdown/object format
    // Try to extract from interview object (used in sampleInterviews)
    if (interview && interview.skills && interview.candidateRating && interview.idealRating) {
      return {
        skills: interview.skills,
        candidateScores: interview.candidateRating,
        idealScores: interview.idealRating,
        explanations: [],
        strengths: [],
        weaknesses: [],
        overallFeedback: interview.feedback || '',
        transcript: interview.transcript || [],
        customQuestions: {},
      };
    }
    // Try to parse markdown for skills/ratings/comments
    if (typeof finalReport === 'string') {
      const skillRegex = /\*\*([\w\s]+)\*\*:?\s*-?\s*\*\*?Rating:?\*\*?\s*:?\s*([\d]+)\/?([\d]+)?/gi;
      const skills: string[] = [];
      const candidateScores: number[] = [];
      const idealScores: number[] = [];
      let match;
      while ((match = skillRegex.exec(finalReport)) !== null) {
        skills.push(match[1].trim());
        candidateScores.push(Number(match[2]));
        idealScores.push(match[3] ? Number(match[3]) : 10);
      }
      // Try to extract overall feedback
      let overallFeedback = '';
      const feedbackMatch = finalReport.match(/Overall Feedback[\s\S]*?([\w\W]+?)(?:\n\n|$)/i);
      if (feedbackMatch) overallFeedback = feedbackMatch[1].trim();
      return {
        skills,
        candidateScores,
        idealScores,
        explanations: [],
        strengths: [],
        weaknesses: [],
        overallFeedback,
        transcript: [],
        customQuestions: {},
      };
    }
    // Fallback
    return null;
  }

  // --- UNIFIED REPORT RENDERING FOR SINGLE TASK (for task-wise tab) ---
  function normalizeSingleTaskReport(report: any) {
    // Try to parse as Gemini JSON
    let data = null;
    try {
      const parsed = typeof report === 'string' ? JSON.parse(report) : report;
      if (parsed && (parsed.data?.skills_evaluation || parsed.skills_evaluation)) {
        data = parsed.data || parsed;
      }
    } catch {}
    if (data) {
      // Gemini JSON format (single skill)
      const skills = Object.keys(data.skills_evaluation || {});
      const candidateScores = skills.map(skill => {
        const rating = data.skills_evaluation[skill].rating;
        if (typeof rating === 'string' && rating.includes('/')) {
          return parseInt(rating.split('/')[0], 10);
        }
        return data.skills_evaluation[skill].obtained || 0;
      });
      const idealScores = skills.map(skill => {
        const rating = data.skills_evaluation[skill].rating;
        if (typeof rating === 'string' && rating.includes('/')) {
          return parseInt(rating.split('/')[1], 10);
        }
        return data.skills_evaluation[skill].total || 10;
      });
      let customQuestions: Record<string, string> = {};
      if (data.customQuestions) {
        if (typeof data.customQuestions === 'object' && !Array.isArray(data.customQuestions)) {
          if ('Question' in data.customQuestions && 'Answer' in data.customQuestions) {
            customQuestions[data.customQuestions.Question] = data.customQuestions.Answer;
          } else {
            customQuestions = data.customQuestions;
          }
        }
      }
      return {
        role: data.role || '',
        company: data.company || '',
        job_description: data.job_description || '',
        skills,
        candidateScores,
        idealScores,
        explanations: skills.map(skill => data.skills_evaluation[skill].explanation),
        skillRatings: skills.map(skill => data.skills_evaluation[skill].rating),
        strengths: data.candidate_feedback?.strengths || [],
        weaknesses: data.candidate_feedback?.weaknesses || [],
        overallFeedback: data.candidate_feedback?.overall_feedback || '',
        transcript: data.transcript || [],
        customQuestions,
      };
    }
    // Legacy/markdown/object format
    if (report && report.skills && report.candidateRating && report.idealRating) {
      return {
        skills: report.skills,
        candidateScores: report.candidateRating,
        idealScores: report.idealRating,
        explanations: [],
        strengths: [],
        weaknesses: [],
        overallFeedback: report.feedback || '',
        transcript: report.transcript || [],
        customQuestions: {},
      };
    }
    // Try to parse markdown for skills/ratings/comments
    if (typeof report === 'string') {
      const skillRegex = /\*\*([\w\s]+)\*\*:?-?\s*\*\*?Rating:?\*\*?\s*:?\s*([\d]+)\/?([\d]+)?/gi;
      const skills: string[] = [];
      const candidateScores: number[] = [];
      const idealScores: number[] = [];
      let match;
      while ((match = skillRegex.exec(report)) !== null) {
        skills.push(match[1].trim());
        candidateScores.push(Number(match[2]));
        idealScores.push(match[3] ? Number(match[3]) : 10);
      }
      let overallFeedback = '';
      const feedbackMatch = report.match(/Overall Feedback[\s\S]*?([\w\W]+?)(?:\n\n|$)/i);
      if (feedbackMatch) overallFeedback = feedbackMatch[1].trim();
      return {
        skills,
        candidateScores,
        idealScores,
        explanations: [],
        strengths: [],
        weaknesses: [],
        overallFeedback,
        transcript: [],
        customQuestions: {},
      };
    }
    // Fallback
    return null;
  }

  // --- MAIN RENDER ---
  // Show multi-task reports if available, even if interview is not found
  if ((!interview) && (finalReport || (allTaskReports && allTaskReports.length > 0))) {
    // Only show the first 5 tasks
    const filteredTaskReports = allTaskReports.slice(0, 5);
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          {finalReport && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-8 w-8" />
                <h1 className="text-3xl font-bold">Final Interview Report</h1>
                {/* {isInterview(interview) ? (
                  <span className="ml-6 text-gray-400 text-base font-medium">Time Taken: {formatDuration((interview as Interview).duration)}</span>
                ) : null} */}
              </div>
              <div className="bg-gray-800 rounded-lg p-6 min-h-[300px] mb-8">
                <div dangerouslySetInnerHTML={{ __html: String(markdown(finalReport)) }} />
              </div>
            </>
          )}
          {filteredTaskReports && filteredTaskReports.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 mt-8">Task-wise Reports</h2>
              <div className="mb-6 flex gap-2">
                {filteredTaskReports.map((r, idx) => {
                  // Show the task-specific role if valid, else fallback to default task name for the number
                  let taskName = '';
                  let report = r.report;
                  const defaultTaskNames = {
                    1: 'Reading',
                    2: 'Sentence Builds',
                    3: 'Conversation',
                    4: 'Sentence Completion',
                    5: 'Dictation',
                    6: 'Passage Reconstruction'
                  } as const;
                  if (report) {
                    try {
                      const parsed = typeof report === 'string' ? JSON.parse(report) : report;
                      const data = parsed.data || parsed;
                      const validTaskRoles = Object.values(defaultTaskNames);
                      if (
                        data.role &&
                        typeof data.role === 'string' &&
                        validTaskRoles.includes(data.role.trim())
                      ) {
                        taskName = data.role.trim();
                      } else {
                        taskName = defaultTaskNames[r.taskNumber as keyof typeof defaultTaskNames] || `Task ${r.taskNumber}`;
                      }
                    } catch {
                      taskName = defaultTaskNames[r.taskNumber as keyof typeof defaultTaskNames] || `Task ${r.taskNumber}`;
                    }
                  } else {
                    taskName = defaultTaskNames[r.taskNumber as keyof typeof defaultTaskNames] || `Task ${r.taskNumber}`;
                  }
                  return (
                    <button
                      key={r.taskNumber}
                      className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === idx ? 'bg-blue-800 border-blue-400 text-white' : 'bg-gray-800 border-transparent text-blue-200'}`}
                      onClick={() => setActiveTab(idx)}
                    >
                      {taskName}
                    </button>
                  );
                })}
              </div>
              <div className="bg-gray-800 rounded-lg p-6 min-h-[300px]">
                {typeof filteredTaskReports[activeTab].report === 'string' ? (
                  <div dangerouslySetInnerHTML={{ __html: String(markdown(filteredTaskReports[activeTab].report)) }} />
                ) : (
                  <pre className="text-sm text-blue-100">{JSON.stringify(filteredTaskReports[activeTab].report, null, 2)}</pre>
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
  if (interview && interview.skills && interview.candidateRating) {
    interview.skills.forEach((skill: string, index: number) => {
      skillRatings[skill] = interview.candidateRating[index];
    });
  }

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
    if (!interview || !interview.skills || !interview.candidateRating || !interview.idealRating) return;
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
  }, [interview]);

  // If there are multi-task reports, show the tabbed UI
  if (allTaskReports && allTaskReports.length > 0) {
    // --- Render the selected task report using unified UI ---
    const selectedTaskReport = allTaskReports[activeTab]?.report;
    const selectedTaskNumber = allTaskReports[activeTab]?.taskNumber;
    const allTranscripts = useMultiTaskInterviewStore().getAllTranscripts();
    const tabNormalized = (() => {
      const norm = normalizeSingleTaskReport(selectedTaskReport);
      if (!norm) return null;
      // If transcript is missing or empty, fetch from store
      if (!norm.transcript || norm.transcript.length === 0) {
        const found = allTranscripts.find(t => t.taskNumber === selectedTaskNumber);
        if (found && found.transcript && found.transcript.length > 0) {
          return { ...norm, transcript: found.transcript };
        }
      }
      return norm;
    })();
    if (tabNormalized) {
      const { role, company, job_description, skills, candidateScores, idealScores, explanations, skillRatings, strengths, weaknesses, overallFeedback, transcript, customQuestions } = tabNormalized;
      const totalObtained = candidateScores.reduce((a: number, b: number) => a + b, 0);
      const avgScore = candidateScores.length > 0 ? totalObtained / candidateScores.length : 0;
      let avgLabel = '';
      if (avgScore < 2) avgLabel = 'Extremely Poor';
      else if (avgScore < 4) avgLabel = 'Poor';
      else if (avgScore < 6) avgLabel = 'Average';
      else if (avgScore < 8) avgLabel = 'Good';
      else if (avgScore < 9) avgLabel = 'Very Good';
      else avgLabel = 'Excellent';
      // 10 different statements based on integer part of avgScore
      const scoreStatements = [
        'Candidate shows no understanding and needs complete retraining.', // 0
        'Candidate demonstrates extremely limited knowledge and requires significant improvement.', // 1
        'Candidate lacks depth, requires further development and training.', // 2
        'Candidate is below expectations and needs more practice.', // 3
        'Candidate is approaching average but still needs improvement.', // 4
        'Candidate is average, with room for growth.', // 5
        'Candidate is above average and shows promise.', // 6
        'Candidate is good and meets most expectations.', // 7
        'Candidate is very good and nearly excels.', // 8
        'Candidate is excellent and demonstrates strong mastery.', // 9
        'Candidate is outstanding and has perfect mastery.' // 10
      ];
      const statementIdx = Math.min(Math.floor(avgScore), 10);
      const scoreStatement = scoreStatements[statementIdx];
      // Radar chart rendering for task
      useEffect(() => {
        const canvas = document.getElementById('myChart-task') as HTMLCanvasElement;
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
      }, [selectedTaskReport]);
      return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Detailed Report</h1>
              {/* Per-task time taken */}
              <span className="ml-6 text-gray-400 text-base font-medium">
                Time Taken: {(() => {
                  if (transcript && transcript.length >= 2) {
                    // Find first and last valid timestamps
                    const first = transcript.find((m: TranscriptMessage) => m.timestamp);
                    const last = [...transcript].reverse().find((m: TranscriptMessage) => m.timestamp);
                    if (first && last) {
                      const start = Date.parse(first.timestamp);
                      const end = Date.parse(last.timestamp);
                      if (!isNaN(start) && !isNaN(end) && end > start) {
                        return formatDuration(end - start);
                      }
                    }
                  }
                  return 'N/A';
                })()}
              </span>
              <button
                className="ml-auto px-4 py-2 rounded bg-blue-700 text-white border border-blue-400 font-semibold hover:bg-blue-800 transition"
                onClick={handleDownloadPDF}
              >
                Download PDF
              </button>
            </div>
            <div className="mb-6 flex gap-2">
              {allTaskReports.map((r, idx) => {
                // Show the task-specific role if valid, else fallback to default task name for the number
                let taskName = '';
                let report = r.report;
                const defaultTaskNames = {
                  1: 'Reading',
                  2: 'Sentence Builds',
                  3: 'Conversation',
                  4: 'Sentence Completion',
                  5: 'Dictation',
                  6: 'Passage Reconstruction'
                } as const;
                if (report) {
                  try {
                    const parsed = typeof report === 'string' ? JSON.parse(report) : report;
                    const data = parsed.data || parsed;
                    const validTaskRoles = Object.values(defaultTaskNames);
                    if (
                      data.role &&
                      typeof data.role === 'string' &&
                      validTaskRoles.includes(data.role.trim())
                    ) {
                      taskName = data.role.trim();
                    } else {
                      taskName = defaultTaskNames[r.taskNumber as keyof typeof defaultTaskNames] || `Task ${r.taskNumber}`;
                    }
                  } catch {
                    taskName = defaultTaskNames[r.taskNumber as keyof typeof defaultTaskNames] || `Task ${r.taskNumber}`;
                  }
                } else {
                  taskName = defaultTaskNames[r.taskNumber as keyof typeof defaultTaskNames] || `Task ${r.taskNumber}`;
                }
                return (
                  <button
                    key={r.taskNumber}
                    className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === idx ? 'bg-blue-800 border-blue-400 text-white' : 'bg-gray-800 border-transparent text-blue-200'}`}
                    onClick={() => setActiveTab(idx)}
                  >
                    {taskName}
                  </button>
                );
              })}
            </div>
            <div className="report-tab-content">
              {/* Unified report UI for task */}
              {/* Global Score */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="text-yellow-400 w-6 h-6" />
                  <span className="font-bold text-xl">Overall Performance</span>
                </div>
                <div className="text-gray-400 mb-4">
                  This section summarizes your overall performance in the interview.
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <svg width="80" height="80">
                      <circle cx="40" cy="40" r="36" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                      <circle cx="40" cy="40" r="36" stroke="#facc15" strokeWidth="8" fill="none" strokeDasharray={2 * Math.PI * 36} strokeDashoffset={2 * Math.PI * 36 * (1 - avgScore / 10)} />
                    </svg>
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-yellow-400">{avgScore.toFixed(1)}</span>
                  </div>
                  <div>
                    <div className="badge bg-blue-700 text-white px-3 py-1 rounded text-lg font-semibold mb-1">{avgLabel}</div>
                    <div className="text-gray-300 mt-2 text-base">{scoreStatement}</div>
                  </div>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="mb-8 flex gap-8">
                <div className="flex-1 bg-green-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="text-green-300 w-4 h-4" />
                    <span className="font-bold text-green-300">Key strengths</span>
                  </div>
                  {strengths && strengths.length > 0 ? (
                    <ul className="list-disc ml-6 text-green-200">
                      {strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  ) : <div className="text-green-200">-</div>}
                </div>
                <div className="flex-1 bg-red-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-red-300 w-4 h-4" />
                    <span className="font-bold text-red-300">Area of Improvement</span>
                  </div>
                  {weaknesses && weaknesses.length > 0 ? (
                    <ul className="list-disc ml-6 text-red-200">
                      {weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  ) : <div className="text-red-200">-</div>}
                </div>
              </div>
              
              {/* Skills Performance */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="text-blue-400 w-5 h-5" />
                  <span className="font-bold text-lg">Skills Performance</span>
                </div>
                <div className="text-gray-400 mb-2 text-sm">See how you performed in each skill area.</div>
                <div className="flex flex-col gap-2">
                  {skills && skills.length > 0 ? skills.map((skill: string, idx: number) => (
                    <div key={skill} className="flex items-center gap-4">
                      <span className="w-48">{idx + 1}. {skill}</span>
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-2 bg-yellow-400" style={{ width: `${(candidateScores[idx] / idealScores[idx]) * 100}%` }}></div>
                      </div>
                    </div>
                  )) : <div className="text-gray-400">No skills available for this task.</div>}
                </div>
              </div>
              {/* Skill Summary Radar Chart */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="text-green-400 w-5 h-5" />
                  <span className="font-bold text-lg">Skill Summary</span>
                </div>
                <div className="text-gray-400 mb-2 text-sm">Visual summary of your skill ratings compared to the ideal.</div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-2"></span> Ideal Score
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-400 ml-6 mr-2"></span> Candidate Score
                  </div>
                  <canvas id="myChart-task" />
                </div>
              </div>
              {/* Skills Wise Overview */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="text-yellow-300 w-5 h-5" />
                  <span className="font-bold text-lg">Skills Wise Overview</span>
                </div>
                <div className="text-gray-400 mb-2 text-sm">Detailed breakdown and explanation for each skill.</div>
                <div className="bg-gray-800 rounded-lg p-6">
                  {skills.map((skill: string, idx: number) => (
                    <div key={skill} className="mb-6 border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{idx + 1}. {skill}</span>
                        <span className="ml-auto text-orange-400 font-bold">{candidateScores[idx]}/{idealScores[idx]}</span>
                      </div>
                      <div className="text-gray-200 mb-2">{explanations[idx] || ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            
              {/* Overall Feedback */}
              <div className="mb-8">
                <div className="font-bold text-lg mb-2">Overall Feedback</div>
                <div className="bg-gray-800 rounded-lg p-6 text-gray-200">{overallFeedback}</div>
              </div>
              {/* Transcript Section (replaces Custom Questions) */}
              {transcript && transcript.length > 0 && (
                <div className="mb-8">
                  <div className="font-bold text-lg mb-2">Task Transcript</div>
                  <div className="bg-gray-800 rounded-lg p-6">
                    {transcript.map((msg: any, i: number) => (
                      <div key={i} className="mb-2">
                        <span className="font-semibold text-blue-200">{msg.speaker === 'interviewer' ? 'Unstop Bot' : 'You'}:</span> <span className="text-gray-200">{msg.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    // fallback for invalid report
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 mt-16 shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Report Format Error</h2>
          <p className="text-gray-200">Sorry, the interview report could not be displayed because the data is not in the expected format. Please contact support or try again later.</p>
        </div>
      </div>
    );
  }

  // --- UNIFIED REPORT RENDERING FOR ALL FORMATS ---
  // If not valid JSON, show a user-friendly error ---
  if (normalized) {
    const { role, company, job_description, skills, candidateScores, idealScores, explanations, skillRatings, strengths, weaknesses, overallFeedback, transcript, customQuestions } = normalized;
    const totalObtained = candidateScores.reduce((a: number, b: number) => a + b, 0);
    const avgScore = candidateScores.length > 0 ? totalObtained / candidateScores.length : 0;
    let avgLabel = '';
    if (avgScore < 2) avgLabel = 'Extremely Poor';
    else if (avgScore < 4) avgLabel = 'Poor';
    else if (avgScore < 6) avgLabel = 'Average';
    else if (avgScore < 8) avgLabel = 'Good';
    else if (avgScore < 9) avgLabel = 'Very Good';
    else avgLabel = 'Excellent';
    // 10 different statements based on integer part of avgScore
    const scoreStatements = [
      'Candidate shows no understanding and needs complete retraining.', // 0
      'Candidate demonstrates extremely limited knowledge and requires significant improvement.', // 1
      'Candidate lacks depth, requires further development and training.', // 2
      'Candidate is below expectations and needs more practice.', // 3
      'Candidate is approaching average but still needs improvement.', // 4
      'Candidate is average, with room for growth.', // 5
      'Candidate is above average and shows promise.', // 6
      'Candidate is good and meets most expectations.', // 7
      'Candidate is very good and nearly excels.', // 8
      'Candidate is excellent and demonstrates strong mastery.', // 9
      'Candidate is outstanding and has perfect mastery.' // 10
    ];
    const statementIdx = Math.min(Math.floor(avgScore), 10);
    const scoreStatement = scoreStatements[statementIdx];
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
            elements: {
              line: {
                borderWidth: 3
              },
            },
          },
        });
      }
      return () => { if (chartRef.current) chartRef.current.destroy(); };
    }, [finalReport]);
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Detailed Report</h1>
            {/* Per-task time taken */}
            <span className="ml-6 text-gray-400 text-base font-medium">
              Time Taken: {(() => {
                if (transcript && transcript.length >= 2) {
                  // Find first and last valid timestamps
                  const first = transcript.find((m: TranscriptMessage) => m.timestamp);
                  const last = [...transcript].reverse().find((m: TranscriptMessage) => m.timestamp);
                  if (first && last) {
                    const start = Date.parse(first.timestamp);
                    const end = Date.parse(last.timestamp);
                    if (!isNaN(start) && !isNaN(end) && end > start) {
                      return formatDuration(end - start);
                    }
                  }
                }
                return 'N/A';
              })()}
            </span>
            <button
              className="ml-auto px-4 py-2 rounded bg-blue-700 text-white border border-blue-400 font-semibold hover:bg-blue-800 transition"
              onClick={handleDownloadPDF}
            >
              Download PDF
            </button>
          </div>
          <div className="report-tab-content">
            {/* Role, Company, Job Description */}
            {(role || company || job_description) && (
              <div className="mb-8 bg-gray-800 rounded-lg p-6 flex flex-col gap-2">
                {role && <div><span className="font-bold text-blue-300">Role:</span> <span className="text-white">{role}</span></div>}
                {company && <div><span className="font-bold text-blue-300">Company:</span> <span className="text-white">{company}</span></div>}
                {job_description && <div><span className="font-bold text-blue-300">Job Description:</span> <span className="text-white">{job_description}</span></div>}
              </div>
            )}
            {/* Global Score */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-yellow-400 w-6 h-6" />
                <span className="font-bold text-xl">Overall Performance</span>
              </div>
              <div className="text-gray-400 mb-4">
                This section summarizes your overall performance in the interview.
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <svg width="80" height="80">
                    <circle cx="40" cy="40" r="36" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                    <circle cx="40" cy="40" r="36" stroke="#facc15" strokeWidth="8" fill="none" strokeDasharray={2 * Math.PI * 36} strokeDashoffset={2 * Math.PI * 36 * (1 - avgScore / 10)} />
                  </svg>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-yellow-400">{avgScore.toFixed(1)}</span>
                </div>
                <div>
                  <div className="badge bg-blue-700 text-white px-3 py-1 rounded text-lg font-semibold mb-1">{avgLabel}</div>
                  <div className="text-gray-300 mt-2 text-base">{scoreStatement}</div>
                </div>
              </div>
            </div>
            {/* Skills Performance */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="text-blue-400 w-5 h-5" />
                <span className="font-bold text-lg">Skills Performance</span>
              </div>
              <div className="text-gray-400 mb-2 text-sm">See how you performed in each skill area.</div>
              <div className="flex flex-col gap-2">
                {skills && skills.length > 0 ? skills.map((skill: string, idx: number) => (
                  <div key={skill} className="flex items-center gap-4">
                    <span className="w-48">{idx + 1}. {skill}</span>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-2 bg-yellow-400" style={{ width: `${(candidateScores[idx] / idealScores[idx]) * 100}%` }}></div>
                    </div>
                  </div>
                )) : <div className="text-gray-400">No skills available for this task.</div>}
              </div>
            </div>
            {/* Skill Summary Radar Chart */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="text-green-400 w-5 h-5" />
                <span className="font-bold text-lg">Skill Summary</span>
              </div>
              <div className="text-gray-400 mb-2 text-sm">Visual summary of your skill ratings compared to the ideal.</div>
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-4 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-2"></span> Ideal Score
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-400 ml-6 mr-2"></span> Candidate Score
                </div>
                <canvas id="myChart" />
              </div>
            </div>
            {/* Skills Wise Overview */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="text-yellow-300 w-5 h-5" />
                <span className="font-bold text-lg">Skills Wise Overview</span>
              </div>
              <div className="text-gray-400 mb-2 text-sm">Detailed breakdown and explanation for each skill.</div>
              <div className="bg-gray-800 rounded-lg p-6">
                {skills.map((skill: string, idx: number) => (
                  <div key={skill} className="mb-6 border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">{idx + 1}. {skill}</span>
                      <span className="ml-auto text-orange-400 font-bold">{candidateScores[idx]}/{idealScores[idx]}</span>
                    </div>
                    <div className="text-gray-200 mb-2">{explanations[idx] || ''}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Strengths & Weaknesses */}
            <div className="mb-8 flex gap-8">
              <div className="flex-1 bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="text-green-300 w-4 h-4" />
                  <span className="font-bold text-green-300">Key strengths</span>
                </div>
                {strengths && strengths.length > 0 ? (
                  <ul className="list-disc ml-6 text-green-200">
                    {strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                ) : <div className="text-green-200">-</div>}
              </div>
              <div className="flex-1 bg-red-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="text-red-300 w-4 h-4" />
                  <span className="font-bold text-red-300">Area of Improvement</span>
                </div>
                {weaknesses && weaknesses.length > 0 ? (
                  <ul className="list-disc ml-6 text-red-200">
                    {weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                ) : <div className="text-red-200">-</div>}
              </div>
            </div>
            {/* Overall Feedback */}
            <div className="mb-8">
              <div className="font-bold text-lg mb-2">Overall Feedback</div>
              <div className="bg-gray-800 rounded-lg p-6 text-gray-200">{overallFeedback}</div>
            </div>
            {/* Transcript Section (replaces Custom Questions) */}
            {transcript && transcript.length > 0 && (
              <div className="mb-8">
                <div className="font-bold text-lg mb-2">Task Transcript</div>
                <div className="bg-gray-800 rounded-lg p-6">
                  {transcript.map((msg: any, i: number) => (
                    <div key={i} className="mb-2">
                      <span className="font-semibold text-blue-200">{msg.speaker === 'interviewer' ? 'Unstop Bot' : 'You'}:</span> <span className="text-gray-200">{msg.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}