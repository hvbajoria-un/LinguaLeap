import React from 'react';

interface InterviewPDFExportProps {
  logoUrl: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  summary: string;
  score: number;
  scoreLabel: string;
  skills: { name: string; candidate: number; ideal: number; }[];
  radarChartUrl: string; // base64 image
  strengths: string[];
  weaknesses: string[];
  tasks: Array<{
    name: string;
    score: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    radarChartUrl?: string;
    skills: { name: string; candidate: number; ideal: number; explanation: string; }[];
    feedback: string;
    transcript: Array<{ speaker: string; message: string; }>;
  }>;
  transcript: Array<{ speaker: string; message: string; }>;
}

const BRAND_BLUE = '#003366';
const BRAND_YELLOW = '#FFD600';
const LIGHT_GRAY = '#F7FAFC';
const CARD_SHADOW = '0 2px 8px rgba(0,0,0,0.07)';
const LOGO_URL = 'https://d8it4huxumps7.cloudfront.net/uploads/images/unstop/branding-guidelines/logos/blue/Unstop-Logo-Blue-Large.png';

function formatDate(date: Date) {
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

const Footer: React.FC<{ page: number; total: number }> = ({ page, total }) => (
  <div style={{
    width: '100%',
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    padding: '8px 0 0 0',
    borderTop: '1px solid #e5e7eb',
    marginTop: 24,
  }}>
    <span>© Unstop. All rights reserved.</span>
    <span style={{ float: 'right', color: '#003366', fontWeight: 600 }}>{page}/{total}</span>
  </div>
);

const Header: React.FC = () => (
  <div style={{ width: '100%', background: BRAND_BLUE, height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', marginBottom: 32 }}>
    <img src={LOGO_URL} alt="Logo" style={{ height: 32 }} />
  </div>
);

export const InterviewPDFExport: React.FC<InterviewPDFExportProps> = ({
  logoUrl,
  candidateName,
  candidateEmail,
  role,
  summary,
  score,
  scoreLabel,
  skills,
  radarChartUrl,
  strengths,
  weaknesses,
  tasks,
  transcript,
}) => {
  const today = new Date();
  const totalPages = 2 + tasks.length + 1; // cover + summary + tasks + transcript
  let pageNum = 1;
  return (
    <div className="w-[800px] bg-white text-gray-900 font-sans relative">
      {/* --- COVER PAGE --- */}
      <div className="h-[1130px] flex flex-col justify-between relative page-break-after" style={{ background: 'linear-gradient(120deg, #f7fafc 60%, #e3e9f6 100%)' }}>
        {/* Watermark logo */}
        <img src={LOGO_URL} alt="Watermark" style={{ position: 'absolute', right: 40, top: 120, width: 320, opacity: 0.07, zIndex: 0 }} />
        <div className="flex flex-col items-center justify-center flex-1 z-10">
          <img src={LOGO_URL} alt="Logo" className="h-16 mb-8" />
          <div className="text-2xl font-semibold text-gray-700 mb-2 tracking-wide">Interview Evaluation Report</div>
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6 text-center" style={{ letterSpacing: '-1px' }}>{role}</h1>
          <div className="text-3xl font-bold text-blue-900 mb-2">{candidateName}</div>
          <div className="text-lg text-gray-600 mb-2">{candidateEmail}</div>
          <div className="text-base text-gray-500 mb-8">{formatDate(today)}</div>
        </div>
        <div className="w-full flex items-end">
          <div className="flex-1 h-8 bg-[#003366]" />
          <div className="flex-1 h-8 bg-[#FFD600]" />
        </div>
        <Footer page={pageNum++} total={totalPages} />
      </div>

      {/* --- SUMMARY PAGE --- */}
      <div className="h-[1130px] flex flex-col page-break-after relative" style={{ background: LIGHT_GRAY }}>
        <Header />
        <div className="flex-1 flex flex-col justify-center items-center px-12">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-10 mb-8" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center gap-8 mb-8">
              <div className="flex flex-col items-center justify-center flex-1">
                <div className="text-6xl font-extrabold text-yellow-500 mb-2">{score.toFixed(1)}</div>
                <div className="text-lg font-semibold mb-2 uppercase tracking-wider text-gray-700">{scoreLabel}</div>
                <div className="text-gray-500 text-center">Overall Interview Score</div>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <img src={radarChartUrl} alt="Skill Radar Chart" className="w-64 h-64" style={{ background: '#f7fafc', borderRadius: 16, boxShadow: CARD_SHADOW }} />
                <div className="text-xs text-gray-400 mt-2">Skill Summary</div>
              </div>
            </div>
            <div className="flex gap-8 mb-8">
              <div className="flex-1 bg-green-50 rounded-lg p-4 border border-green-100">
                <div className="font-bold text-green-700 mb-2">Key Strengths</div>
                <ul className="list-disc ml-6 text-green-800">
                  {strengths.length ? strengths.map((s, i) => <li key={i}>{s}</li>) : <li>-</li>}
                </ul>
              </div>
              <div className="flex-1 bg-red-50 rounded-lg p-4 border border-red-100">
                <div className="font-bold text-red-700 mb-2">Areas of Improvement</div>
                <ul className="list-disc ml-6 text-red-800">
                  {weaknesses.length ? weaknesses.map((w, i) => <li key={i}>{w}</li>) : <li>-</li>}
                </ul>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="font-bold mb-2 text-lg text-blue-900">Skills Performance</h3>
              <ul>
                {skills.map((s, i) => (
                  <li key={s.name} className="flex items-center mb-2">
                    <span className="w-48 font-medium text-gray-700">{i + 1}. {s.name}</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden mx-2">
                      <div className="h-2 bg-yellow-400" style={{ width: `${(s.candidate / s.ideal) * 100}%` }}></div>
                    </div>
                    <span className="text-sm text-gray-600 font-semibold">{s.candidate}/{s.ideal}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              <div className="font-bold text-blue-900 mb-2">Overall Feedback</div>
              <div className="bg-blue-50 rounded-lg p-4 text-gray-800 border border-blue-100">{summary}</div>
            </div>
          </div>
        </div>
        <Footer page={pageNum++} total={totalPages} />
      </div>

      {/* --- TASK PAGES --- */}
      {tasks.map((task, idx) => (
        <div key={idx} className="h-[1130px] flex flex-col page-break-after relative" style={{ background: LIGHT_GRAY }}>
          <Header />
          <div className="flex-1 flex flex-col justify-center items-center px-12">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-10 mb-8" style={{ boxShadow: CARD_SHADOW }}>
              <div className="flex items-center gap-8 mb-6">
                <h2 className="text-2xl font-bold text-blue-900 flex-1">Task: {task.name}</h2>
                <span className="text-lg font-semibold text-yellow-600">Score: {task.score.toFixed(1)}</span>
              </div>
              <div className="mb-4">
                <div className="font-bold mb-2 text-gray-700">Summary</div>
                <div className="text-gray-700 mb-4">{task.summary}</div>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 bg-green-50 rounded-lg p-4 border border-green-100">
                    <div className="font-bold text-green-700 mb-2">Key Strengths</div>
                    <ul className="list-disc ml-6 text-green-800">
                      {task.strengths.length ? task.strengths.map((s, i) => <li key={i}>{s}</li>) : <li>-</li>}
                    </ul>
                  </div>
                  <div className="flex-1 bg-red-50 rounded-lg p-4 border border-red-100">
                    <div className="font-bold text-red-700 mb-2">Areas of Improvement</div>
                    <ul className="list-disc ml-6 text-red-800">
                      {task.weaknesses.length ? task.weaknesses.map((w, i) => <li key={i}>{w}</li>) : <li>-</li>}
                    </ul>
                  </div>
                </div>
                {task.radarChartUrl && (
                  <div className="flex justify-center mb-4">
                    <img src={task.radarChartUrl} alt="Task Radar Chart" className="w-64 h-64" style={{ background: '#f7fafc', borderRadius: 16, boxShadow: CARD_SHADOW }} />
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold mb-2 text-blue-900">Skills Breakdown</h3>
                  <ul>
                    {task.skills.map((s, i) => (
                      <li key={s.name} className="mb-2">
                        <span className="font-semibold text-gray-700">{i + 1}. {s.name}:</span> <span className="text-yellow-700 font-bold">{s.candidate}/{s.ideal}</span>
                        <div className="text-gray-700 ml-4">{s.explanation}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mb-4">
                  <h3 className="font-bold mb-2 text-blue-900">Overall Feedback</h3>
                  <div className="bg-blue-50 rounded-lg p-4 text-gray-800 border border-blue-100">{task.feedback}</div>
                </div>
              </div>
              {/* Task Transcript */}
              {task.transcript && task.transcript.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-bold mb-2 text-blue-900">Task Transcript</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {task.transcript.map((msg, i) => (
                      <div key={i} className="mb-2">
                        <span className="font-semibold text-blue-700">{msg.speaker === 'interviewer' ? 'Unstop Bot' : 'You'}:</span> <span className="text-gray-800">{msg.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <Footer page={pageNum++} total={totalPages} />
        </div>
      ))}

      {/* --- FULL TRANSCRIPT PAGE --- */}
      <div className="h-[1130px] flex flex-col page-break-after relative" style={{ background: LIGHT_GRAY }}>
        <Header />
        <div className="flex-1 flex flex-col justify-center items-center px-12">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-10 mb-8" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Full Interview Transcript</h2>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 max-h-[700px] overflow-y-auto">
              {transcript.map((msg, i) => (
                <div key={i} className="mb-2">
                  <span className="font-semibold text-blue-700">{msg.speaker === 'interviewer' ? 'Unstop Bot' : 'You'}:</span> <span className="text-gray-800">{msg.message}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 text-xs text-gray-400 text-center">
              *This report is AI-generated; please ensure to review and verify all information before making any decisions.*
            </div>
          </div>
        </div>
        <Footer page={pageNum++} total={totalPages} />
      </div>
    </div>
  );
}; 