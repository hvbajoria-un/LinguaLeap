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
const LIGHT_GRAY = '#F8F9FA';
const DARK_GRAY = '#6C757D';
const BLACK = '#212529';

// A4 dimensions at 96 DPI: 794px x 1123px
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const GeometricShape: React.FC<{
  color: string;
  style: React.CSSProperties;
  className?: string;
}> = ({ color, style, className = '' }) => (
  <div 
    className={`absolute ${className}`}
    style={{ 
      ...style,
      backgroundColor: color,
      clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)',
    }}
  />
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
  const totalPages = 3 + tasks.length; // cover + candidate details + summary + tasks
  let pageNum = 1;

  return (
    <div className="bg-white text-gray-900 font-sans" style={{ width: A4_WIDTH }}>
      {/* --- TITLE PAGE --- */}
      <div 
        className="relative overflow-hidden page-break-after"
        style={{ 
          width: A4_WIDTH, 
          height: A4_HEIGHT,
          backgroundColor: LIGHT_GRAY 
        }}
      >
        {/* Geometric Background Elements */}
        <GeometricShape
          color={BRAND_YELLOW}
          style={{ 
            top: 280,
            right: -50,
            width: 400,
            height: 200,
            transform: 'rotate(15deg)',
          }}
        />

        <GeometricShape
          color={BRAND_BLUE}
          style={{ 
            bottom: 0,
            left: 0,
            width: A4_WIDTH,
            height: 180,
            clipPath: 'polygon(0 60%, 100% 0%, 100% 100%, 0% 100%)',
          }}
        />

        <GeometricShape
          color={BRAND_YELLOW}
          style={{ 
            top: 200,
            left: -100,
            width: 300,
            height: 150,
            transform: 'rotate(-25deg)',
            opacity: 0.8,
          }}
        />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Main Title */}
          <div className="flex-1 flex items-center justify-start pl-16">
            <div>
              <h1 
                className="font-bold leading-tight mb-8"
                style={{ 
                  fontSize: '64px',
                  color: BLACK,
                  letterSpacing: '-2px'
                }}
              >
                AI Interview<br />Report
              </h1>
            </div>
          </div>

          {/* Candidate Info Section */}
          <div 
            className="text-white px-16 py-8"
            style={{ 
              backgroundColor: BRAND_BLUE,
              marginBottom: 0,
            }}
          >
            <h2 className="text-2xl font-semibold mb-2">{candidateName}</h2>
            <p className="text-lg opacity-90">{candidateEmail}</p>
          </div>
        </div>
      </div>

      {/* --- CANDIDATE DETAILS PAGE --- */}
      <div 
        className="page-break-after bg-white"
        style={{ 
          width: A4_WIDTH, 
          height: A4_HEIGHT,
          padding: '60px 50px'
        }}
      >
        {/* Header */}
        <div className="mb-12">
          <h2 
            className="font-bold mb-8"
            style={{ 
              fontSize: '32px',
              color: BLACK,
              borderBottom: `3px solid ${BRAND_BLUE}`,
              paddingBottom: '12px'
            }}
          >
            Candidate Details
          </h2>
        </div>

        {/* Candidate Info Box */}
        <div 
          className="rounded-lg p-8 mb-12"
          style={{ 
            border: `2px solid ${LIGHT_GRAY}`,
            backgroundColor: '#FFFFFF'
          }}
        >
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4" style={{ color: BLACK }}>
                {candidateName}
              </h3>
              <p className="text-gray-600 mb-2">{candidateEmail}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Applied on:</span>
                <span>{formatDate(today)}</span>
              </div>
            </div>
            <div>
              <div className="text-right">
                <span className="text-sm text-gray-500">Position:</span>
                <p className="font-semibold text-lg" style={{ color: BRAND_BLUE }}>
                  {role}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Extended Form Details */}
        <div className="mb-12">
          <h3 
            className="font-bold text-xl mb-6"
            style={{ color: BLACK }}
          >
            Extended Form Details
          </h3>
          <div className="text-gray-600 leading-relaxed">
            <p className="mb-4">
              <strong>Assessment Overview:</strong> This comprehensive evaluation assesses the candidate's 
              technical competencies, soft skills, and cultural fit through structured interview processes.
            </p>
            <p className="mb-4">
              <strong>Evaluation Criteria:</strong> Performance measured across {skills.length} key skill areas 
              with detailed scoring and feedback mechanisms.
            </p>
            <div className="flex items-center justify-between mt-8 p-4 rounded" 
                 style={{ backgroundColor: LIGHT_GRAY }}>
              <span className="text-sm">📄 Interview Report - {candidateName.replace(/\s+/g, '')}.pdf</span>
              <span className="text-sm" style={{ color: BRAND_BLUE }}>View File 📎</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- REPORT OVERVIEW PAGE --- */}
      <div 
        className="page-break-after bg-white"
        style={{ 
          width: A4_WIDTH, 
          height: A4_HEIGHT,
          padding: '60px 50px'
        }}
      >
        {/* Header */}
        <div className="mb-12">
          <h2 
            className="font-bold mb-8"
            style={{ 
              fontSize: '32px',
              color: BLACK,
              borderBottom: `3px solid ${BRAND_BLUE}`,
              paddingBottom: '12px'
            }}
          >
            Report Overview & Guidelines
          </h2>
        </div>

        {/* Introduction Section */}
        <div className="mb-10">
          <h3 className="font-bold text-xl mb-4" style={{ color: BLACK }}>
            Introduction
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            This report provides a comprehensive evaluation of the candidate's performance during the AI-powered 
            interview process. Our advanced assessment framework evaluates both technical competencies and soft skills 
            to provide a holistic view of the candidate's suitability for the role.
          </p>
        </div>

        {/* How to Use Section */}
        <div className="mb-10">
          <h3 className="font-bold text-xl mb-4" style={{ color: BLACK }}>
            How to use this report
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            This report is structured to provide actionable insights:
          </p>
          <ul className="list-disc ml-6 text-gray-700 space-y-2">
            <li><strong>Detailed Analysis:</strong> Each skill area is evaluated with specific scores and detailed feedback on performance.</li>
            <li><strong>Competency Insights:</strong> Specific recommendations highlight key personality traits and areas for development.</li>
            <li><strong>Behavioral Assessment:</strong> Understanding of work style, communication preferences, and team dynamics.</li>
          </ul>
        </div>

        {/* Benefits Section */}
        <div className="mb-10">
          <h3 className="font-bold text-xl mb-4" style={{ color: BLACK }}>
            Benefits of the thrive competency report
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            This comprehensive assessment provides valuable insights for:
          </p>
          <ul className="list-disc ml-6 text-gray-700 space-y-2">
            <li><strong>Hiring Decisions:</strong> Data-driven insights to support recruitment and selection processes.</li>
            <li><strong>Personal Growth:</strong> Identify areas for development and suitable leadership advice to help you grow.</li>
            <li><strong>Performance Development:</strong> Use your insights to enhance your performance and understand your strengths.</li>
            <li><strong>Improved Relationships:</strong> Understand your personality impacts your interactions with others and learn how to navigate them effectively.</li>
          </ul>
        </div>

        {/* Score Interpretation */}
        <div>
          <h3 className="font-bold text-xl mb-4" style={{ color: BLACK }}>
            Score Interpretation System
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm"><strong>8-10:</strong> Excellent Performance</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <span className="text-sm"><strong>6-7:</strong> Good Performance</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm"><strong>4-5:</strong> Average Performance</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm"><strong>1-3:</strong> Needs Improvement</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- SUMMARY PAGE --- */}
      <div 
        className="page-break-after bg-white"
        style={{ 
          width: A4_WIDTH, 
          height: A4_HEIGHT,
          padding: '60px 50px'
        }}
      >
        {/* Header */}
        <div className="mb-8">
          <h2 
            className="font-bold mb-4"
            style={{ 
              fontSize: '32px',
              color: BLACK,
              borderBottom: `3px solid ${BRAND_BLUE}`,
              paddingBottom: '12px'
            }}
          >
            Assessment Summary
          </h2>
        </div>

        {/* Score and Chart Section */}
        <div className="flex gap-8 mb-8">
          <div className="flex-1">
            <div className="text-center mb-6">
              <div 
                className="text-6xl font-bold mb-2"
                style={{ color: BRAND_YELLOW }}
              >
                {score.toFixed(1)}
              </div>
              <div className="text-lg font-semibold uppercase tracking-wider text-gray-700 mb-2">
                {scoreLabel}
              </div>
              <div className="text-gray-500">Overall Interview Score</div>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <img 
              src={radarChartUrl} 
              alt="Skill Assessment Radar Chart" 
              className="w-64 h-64 rounded-lg"
              style={{ 
                backgroundColor: LIGHT_GRAY,
                border: `2px solid ${LIGHT_GRAY}`
              }}
            />
          </div>
        </div>

        {/* Skills Performance */}
        <div className="mb-8">
          <h3 className="font-bold text-xl mb-4" style={{ color: BLACK }}>
            Skills Performance Overview
          </h3>
          <div className="space-y-3">
            {skills.map((skill, i) => (
              <div key={skill.name} className="flex items-center">
                <span className="w-48 font-medium text-gray-700">
                  {i + 1}. {skill.name}
                </span>
                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden mx-4">
                  <div 
                    className="h-3 rounded-full"
                    style={{ 
                      width: `${Math.min((skill.candidate / skill.ideal) * 100, 100)}%`,
                      backgroundColor: skill.candidate >= skill.ideal * 0.8 ? '#10B981' : 
                                     skill.candidate >= skill.ideal * 0.6 ? '#3B82F6' :
                                     skill.candidate >= skill.ideal * 0.4 ? '#F59E0B' : '#EF4444'
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-600 w-12 text-right">
                  {skill.candidate}/{skill.ideal}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths and Weaknesses */}
        <div className="flex gap-6 mb-8">
          <div className="flex-1">
            <div 
              className="rounded-lg p-6"
              style={{ 
                backgroundColor: '#F0FDF4',
                border: '2px solid #BBF7D0'
              }}
            >
              <h4 className="font-bold text-green-800 mb-3">Key Strengths</h4>
              <ul className="list-disc ml-5 text-green-700 space-y-1">
                {strengths.length ? strengths.map((s, i) => (
                  <li key={i} className="text-sm">{s}</li>
                )) : <li className="text-sm">No specific strengths identified</li>}
              </ul>
            </div>
          </div>
          <div className="flex-1">
            <div 
              className="rounded-lg p-6"
              style={{ 
                backgroundColor: '#FEF2F2',
                border: '2px solid #FECACA'
              }}
            >
              <h4 className="font-bold text-red-800 mb-3">Areas for Improvement</h4>
              <ul className="list-disc ml-5 text-red-700 space-y-1">
                {weaknesses.length ? weaknesses.map((w, i) => (
                  <li key={i} className="text-sm">{w}</li>
                )) : <li className="text-sm">No specific areas identified</li>}
              </ul>
            </div>
          </div>
        </div>

        {/* Overall Feedback */}
        <div>
          <h3 className="font-bold text-xl mb-4" style={{ color: BLACK }}>
            Overall Assessment
          </h3>
          <div 
            className="rounded-lg p-6 text-gray-800"
            style={{ 
              backgroundColor: '#F8FAFC',
              border: `2px solid ${LIGHT_GRAY}`
            }}
          >
            {summary}
          </div>
        </div>
      </div>

      {/* --- TASK PAGES --- */}
      {tasks.map((task, idx) => (
        <div 
          key={idx} 
          className="page-break-after bg-white"
          style={{ 
            width: A4_WIDTH, 
            height: A4_HEIGHT,
            padding: '60px 50px'
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 
                className="font-bold"
                style={{ 
                  fontSize: '28px',
                  color: BLACK
                }}
              >
                {task.name}
              </h2>
              <div 
                className="text-2xl font-bold px-4 py-2 rounded-lg"
                style={{ 
                  backgroundColor: BRAND_YELLOW,
                  color: BLACK
                }}
              >
                {task.score.toFixed(1)}/10
              </div>
            </div>
            <div 
              className="h-1 w-full rounded"
              style={{ backgroundColor: BRAND_BLUE }}
            />
          </div>

          {/* Task Summary */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-3" style={{ color: BLACK }}>
              Performance Summary
            </h3>
            <p className="text-gray-700 leading-relaxed">{task.summary}</p>
          </div>

          {/* Skills Breakdown */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-3" style={{ color: BLACK }}>
              Skills Assessment
            </h3>
            <div className="space-y-4">
              {task.skills.map((skill, i) => (
                <div key={skill.name} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">{skill.name}</span>
                    <span 
                      className="font-bold px-3 py-1 rounded text-sm"
                      style={{ 
                        backgroundColor: skill.candidate >= skill.ideal * 0.8 ? '#10B981' : 
                                       skill.candidate >= skill.ideal * 0.6 ? '#3B82F6' :
                                       skill.candidate >= skill.ideal * 0.4 ? '#F59E0B' : '#EF4444',
                        color: 'white'
                      }}
                    >
                      {skill.candidate}/{skill.ideal}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{skill.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths and Improvements */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <h4 className="font-semibold text-green-700 mb-2">Strengths</h4>
              <ul className="list-disc ml-4 text-green-600 text-sm space-y-1">
                {task.strengths.length ? task.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                )) : <li>No specific strengths noted</li>}
              </ul>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-red-700 mb-2">Areas for Improvement</h4>
              <ul className="list-disc ml-4 text-red-600 text-sm space-y-1">
                {task.weaknesses.length ? task.weaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                )) : <li>No specific areas noted</li>}
              </ul>
            </div>
          </div>

          {/* Detailed Feedback */}
          <div>
            <h3 className="font-bold text-lg mb-3" style={{ color: BLACK }}>
              Detailed Feedback
            </h3>
            <div 
              className="rounded-lg p-4 text-gray-700"
              style={{ 
                backgroundColor: LIGHT_GRAY,
                border: `1px solid #E5E7EB`
              }}
            >
              {task.feedback}
            </div>
          </div>
        </div>
      ))}

      {/* --- TRANSCRIPT PAGE --- */}
      <div 
        className="bg-white"
        style={{ 
          width: A4_WIDTH, 
          minHeight: A4_HEIGHT,
          padding: '60px 50px'
        }}
      >
        {/* Header */}
        <div className="mb-8">
          <h2 
            className="font-bold mb-4"
            style={{ 
              fontSize: '32px',
              color: BLACK,
              borderBottom: `3px solid ${BRAND_BLUE}`,
              paddingBottom: '12px'
            }}
          >
            Interview Transcript
          </h2>
        </div>

        {/* Transcript Content */}
        <div 
          className="rounded-lg p-6"
          style={{ 
            backgroundColor: LIGHT_GRAY,
            border: `1px solid #E5E7EB`,
            maxHeight: '800px',
            overflowY: 'auto'
          }}
        >
          {transcript.map((msg, i) => (
            <div key={i} className="mb-4 pb-3 border-b border-gray-200 last:border-b-0">
              <div className="flex items-start gap-3">
                <span 
                  className="font-semibold text-sm px-3 py-1 rounded-full"
                  style={{ 
                    backgroundColor: msg.speaker === 'interviewer' ? BRAND_BLUE : BRAND_YELLOW,
                    color: msg.speaker === 'interviewer' ? 'white' : BLACK
                  }}
                >
                  {msg.speaker === 'interviewer' ? 'AI Interviewer' : 'Candidate'}
                </span>
                <div className="flex-1">
                  <p className="text-gray-800 leading-relaxed">{msg.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            This report is AI-generated. Please review and verify all information before making decisions.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            © Unstop. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
