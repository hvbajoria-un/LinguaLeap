import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Role, other } from '../types/interview';
import { Button } from './ui/Button';
import { GoogleGenerativeAI} from "@google/generative-ai";
import { MdWifi, MdHeadsetMic, MdVolumeOff, MdSchedule, MdSpeed, MdCall, MdVolumeUp, MdSpellcheck, MdTextFields, MdInfo } from 'react-icons/md';
import { useInterviewMetaStore } from '../store/interviewStore';

export function InterviewSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // Step state for multi-page flow
  const [selectedRole, setSelectedRole] = useState<Role>('Speech Asessment');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [otherRole, setOtherRole] = useState<other>('');
  const [idealRating, setIdealRating] = useState<number[]>([]);

  const setInterviewMeta = useInterviewMetaStore((state) => state.setInterviewMeta);

  const predefinedmarketingSkills = [
    'Marketing Strategy',
    'Business Development',
    'Data Analysis',
    'Communication',
    'Market Research'
  ];

  const predefinedSDESkills = [
    'Python',
    'Problem Solving',
    'Angular',
    'Data Structures & Algorithms',
    'Computer Fundamentals'
  ];

  const predefinedSpeechSkills = [
    'Phonological & Oral Fluency',
    'Linguistic Knowledge & Structure',
    'Reading & Comprehension',
    'Memory & Executive Control',
    'Written Production & Mechanics'
  ];

  const predefinedMarketingManagerLongFormSkills = [
    'Marketing Strategy',
    'Business Development',
    'Data Analysis',
    'Communication',
    'Leadership',
    'Market Research', 
    'Sales',
    'Content Creation'
  ];

  let predefinedOtherSkills: string[] = [];

  useEffect(() => {
    if (selectedRole === 'Marketing Manager') {
      setSkills([]);
      predefinedmarketingSkills.forEach(skill => {
          setSkills(prevSkills => [...prevSkills, skill]);
      });
    } 
    else if (selectedRole === 'SDE') {
      setSkills([]);
      predefinedSDESkills.forEach(skill => {
          setSkills(prevSkills => [...prevSkills, skill]);
      });
    }
    else if (selectedRole === 'Speech Assessment') {
      setSkills([]);
      predefinedSpeechSkills.forEach(skill => {
          setSkills(prevSkills => [...prevSkills, skill]);
      });
    }
    else if (selectedRole === 'Marketing Manager (Long Form)') {
      setSkills([]);
      predefinedMarketingManagerLongFormSkills.forEach(skill => {
          setSkills(prevSkills => [...prevSkills, skill]);
      });
    }
    else if (selectedRole === 'Marketing Manager (Demo)') {
      setSkills([]);
      predefinedmarketingSkills.forEach(skill => {
        setSkills(prevSkills => [...prevSkills, skill]);
    });
    }
    else {
      setSkills([]);
    }
  }, [selectedRole]);

  useEffect(() => {
    if (selectedRole === 'Others' && (skills.length === 5 || skills.length === 0)) {
      setSkills([]);
      const apiKey = 'AIzaSyDHGWLeiroFLiCqfahIWCrDkWEjpjbFcMI';
      const genAI = new GoogleGenerativeAI(apiKey);
      
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        systemInstruction: "Extract the top 5 relevant skills from the provided job description that are crucial for evaluating candidates during the interview.\n\n# Steps\n\n1. **Analyze the Job Description**:\n   - Carefully review the job description to identify the core responsibilities and requirements mentioned.\n   - Highlight specific technical, behavioral, or interpersonal skills emphasized.\n\n2. **Prioritize Skills**:\n   - Focus on the most critical skills explicitly required for performing the key tasks or responsibilities mentioned in the description.\n   - Exclude general, vague, or peripheral qualities unless they are directly relevant to the role.\n\n3. **Rank and Select Top 5**:\n   - Identify and rank the skills by importance based on how central they are to the core duties of the role.\n   - Select the top 5 most relevant skills that will form the basis for evaluating candidates in the interview.\n\n4. **Provide Clear Outputs**:\n   - List the selected skills in an array format, separated by commas.\n   - Optionally, include a brief reason/context for choosing each skill if requested.\n\n# Output Format\n\nThe output should be provided in an array format:\n\n`[Skill 1, Skill 2, Skill 3, Skill 4, Skill 5]`\n\n# Notes\n\n- Tailor the skills to the specific job provided, avoiding generic or redundant terms.\n- If the job description does not explicitly mention skills, infer them from the stated responsibilities and technical requirements.\n- Ensure the selected skills are actionable and measurable, aiding in effective candidate evaluation.\n\n# Example\n\n**Input (Job Description)**:\n\"Software Engineer needed with expertise in Python, cloud development, and agile methodologies. Strong problem-solving skills and the ability to work collaboratively in a team environment are essential. Experience with CI/CD and containerization tools like Docker is highly desirable.\"\n\n**Output**:\n`[Python programming, Cloud development, Agile methodologies, Problem-solving, CI/CD and containerization tools]`",
      });
      
      const generationConfig = {
        temperature: 0.5,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
      };
    }
  }, [selectedRole, skills.length]);

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleStartInterview = () => {
    async function run() {
      const idealratings = [0.5,0.8,0.6,0.7,0.9]
      setIdealRating(idealratings);
      setTimeout(() => {
        // If no skills are selected (coming from test overview), use default English skills
        const finalSkills = skills.length > 0 ? skills : [
          'Pronunciation', 'Fluency', 'Attention', 'Focus',
          'Working Memory', 'Syntactic Awareness', 'Grammar', 'Logical Sequencing', 'Listening Comprehension',
          'Vocabulary', 'Contextual Understanding', 'Word Appropriateness', 'Grammatical Fit', 'Spelling Accuracy',
          'Reading Comprehension', 'Paraphrasing', 'Content Accuracy', 'Written Expression', 'Time Management'
        ];
        const finalRole = selectedRole || 'English Assessment';
        const finalOtherRole = otherRole || '';
        
        if (idealRating.length > 0) {
          setInterviewMeta({ selectedRole: finalRole, skills: finalSkills, otherRole: finalOtherRole, idealRating });
          navigate('/interview-room/task/1', { state: { selectedRole: finalRole, skills: finalSkills, otherRole: finalOtherRole, idealRating } });
        }
      }, 100);
    }
    run();
  };

  // --- Step Content Renderers ---
  const renderWelcome = () => (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-2xl mx-auto rounded-2xl shadow-xl bg-slate-800/80 p-10">
        <h1 className="text-4xl font-extrabold text-sky-300 mb-2 text-center tracking-tight drop-shadow">English 4-Skills Essentials Test</h1>
        <div className="w-16 h-1 bg-sky-400 mx-auto mb-4 rounded" />
        <p className="mb-8 text-slate-100 text-center text-lg">We're excited to help you practice your English skills. This short, friendly test will guide you through a few sample questions. <span className='block mt-2 text-sky-300'>You can go back and change your answers at any time!</span></p>
        <div className="flex justify-center gap-6 mb-10 flex-wrap">
          <div className="flex flex-col items-center bg-sky-900/60 rounded-xl p-4 w-32 shadow">
            <span className="bg-sky-400 text-white rounded-full w-12 h-12 flex items-center justify-center mb-2 font-bold text-xl shadow">S</span>
            <span className="text-base font-medium text-sky-100">Speaking</span>
          </div>
          <div className="flex flex-col items-center bg-emerald-900/60 rounded-xl p-4 w-32 shadow">
            <span className="bg-emerald-300 text-white rounded-full w-12 h-12 flex items-center justify-center mb-2 font-bold text-xl shadow">L</span>
            <span className="text-base font-medium text-emerald-100">Listening</span>
          </div>
          <div className="flex flex-col items-center bg-purple-900/60 rounded-xl p-4 w-32 shadow">
            <span className="bg-purple-300 text-white rounded-full w-12 h-12 flex items-center justify-center mb-2 font-bold text-xl shadow">R</span>
            <span className="text-base font-medium text-purple-100">Reading</span>
          </div>
          <div className="flex flex-col items-center bg-orange-900/60 rounded-xl p-4 w-32 shadow">
            <span className="bg-orange-300 text-white rounded-full w-12 h-12 flex items-center justify-center mb-2 font-bold text-xl shadow">W</span>
            <span className="text-base font-medium text-orange-100">Writing</span>
          </div>
        </div>
        <Button className="w-full bg-sky-600 hover:bg-sky-500 focus:ring-2 focus:ring-sky-400 text-lg py-3 rounded-xl transition-all duration-150" onClick={() => setStep(2)}>
          Start Assessment
        </Button>
      </div>
    </div>
  );

  const renderSetupRequirements = () => (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-3xl mx-auto rounded-2xl shadow-xl bg-slate-800/80 p-10">
        <h2 className="text-3xl font-extrabold text-sky-300 mb-4 text-center tracking-tight drop-shadow">Setup Requirements</h2>
        <p className="mb-8 text-slate-100 text-center text-lg">Before you begin, make sure you have everything you need for a smooth experience. <span className='block mt-2 text-sky-300'>Don't worry, you can always come back to this step!</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          <div className="bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900 flex flex-col gap-2">
            <div className="font-bold text-sky-300 text-lg flex items-center gap-2"><MdWifi className="inline" />Stable Internet</div>
            <div className="text-base text-slate-100">A computer with a stable internet connection.</div>
          </div>
          <div className="bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900 flex flex-col gap-2">
            <div className="font-bold text-sky-300 text-lg flex items-center gap-2"><MdHeadsetMic className="inline" />Headset with Microphone</div>
            <div className="text-base text-slate-100">A headset with a boom microphone. The microphone should be positioned 3-5 cm from your mouth.</div>
          </div>
          <div className="bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900 flex flex-col gap-2">
            <div className="font-bold text-sky-300 text-lg flex items-center gap-2"><MdVolumeOff className="inline" />Quiet Environment</div>
            <div className="text-base text-slate-100">A quiet room without distractions. Even a fan can be noisy!</div>
          </div>
          <div className="bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900 flex flex-col gap-2">
            <div className="font-bold text-sky-300 text-lg flex items-center gap-2"><MdSchedule className="inline" />Uninterrupted Time</div>
            <div className="text-base text-slate-100">Enough time to complete the test. You won't be able to pause.</div>
          </div>
        </div>
        <Button className="w-full bg-sky-600 hover:bg-sky-500 focus:ring-2 focus:ring-sky-400 text-lg py-3 rounded-xl transition-all duration-150" onClick={() => setStep(3)}>
          Next
        </Button>
      </div>
    </div>
  );

  const renderTips = () => (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-2xl mx-auto rounded-2xl shadow-xl bg-slate-800/80 p-10">
        <h2 className="text-3xl font-extrabold text-sky-300 mb-4 text-center tracking-tight drop-shadow">Tips for the Speaking Section</h2>
        <p className="mb-8 text-slate-100 text-center text-lg">Follow these friendly tips to do your best. <span className='block mt-2 text-sky-300'>Just be yourself and speak naturally!</span></p>
        <div className="mb-6 bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900">
          <div className="font-bold text-sky-300 mb-1 text-lg flex items-center gap-2"><MdSpeed className="inline" />Speak at a Normal Speed</div>
          <div className="text-base text-slate-100">Speak at a <span className="font-semibold">normal speed</span> like you would during a conversation.</div>
        </div>
        <div className="mb-6 bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900">
          <div className="font-bold text-emerald-300 mb-1 text-lg flex items-center gap-2"><MdCall className="inline" />Talk Like You're on the Phone</div>
          <div className="text-base text-slate-100">Speak like you are <span className="font-semibold">talking to a person</span> on the phone. No need to speak too carefully or slowly.</div>
        </div>
        <div className="mb-10 bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900">
          <div className="font-bold text-purple-300 mb-1 text-lg flex items-center gap-2"><MdVolumeUp className="inline" />Use Normal Volume</div>
          <div className="text-base text-slate-100">Speak at a <span className="font-semibold">normal volume</span>, not too loud or too soft.</div>
        </div>
        <Button className="w-full bg-sky-600 hover:bg-sky-500 focus:ring-2 focus:ring-sky-400 text-lg py-3 rounded-xl transition-all duration-150" onClick={() => setStep(4)}>
          Next
        </Button>
      </div>
    </div>
  );

  const renderWritingTips = () => (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-2xl mx-auto rounded-2xl shadow-xl bg-slate-800/80 p-10">
        <h2 className="text-3xl font-extrabold text-sky-300 mb-4 text-center tracking-tight drop-shadow">Tips for the Writing Section</h2>
        <p className="mb-8 text-slate-100 text-center text-lg">Follow these friendly tips for the best results. <span className='block mt-2 text-sky-300'>Take your time and do your best!</span></p>
        <div className="mb-6 bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900">
          <div className="font-bold text-sky-300 mb-1 text-lg flex items-center gap-2"><MdSpellcheck className="inline" />Review Your Responses</div>
          <div className="text-base text-slate-100">Review your responses for correct grammar, spelling, and punctuation.</div>
        </div>
        <div className="mb-6 bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900">
          <div className="font-bold text-emerald-300 mb-1 text-lg flex items-center gap-2"><MdTextFields className="inline" />Avoid Capital Letters</div>
          <div className="text-base text-slate-100">Do not write in all capital letters.</div>
        </div>
        <div className="mb-10 bg-slate-700 rounded-xl p-6 text-left shadow border border-sky-900">
          <div className="font-bold text-purple-300 mb-1 text-lg flex items-center gap-2"><MdInfo className="inline" />Include Details</div>
          <div className="text-base text-slate-100">Try to include as many details as you can in your responses. Do not copy the prompt.</div>
        </div>
        <Button className="w-full bg-sky-600 hover:bg-sky-500 focus:ring-2 focus:ring-sky-400 text-lg py-3 rounded-xl transition-all duration-150" onClick={() => setStep(4)}>
          Next
        </Button>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl bg-slate-800/80 p-10">
        <h2 className="text-3xl font-extrabold text-sky-300 mb-4 text-center tracking-tight drop-shadow">Test Overview</h2>
        <p className="mb-8 text-slate-100 text-center text-lg">Here are the parts of the test you will complete. <span className='block mt-2 text-sky-300'>You can review this at any time!</span></p>
        <div className="overflow-x-auto mb-10">
          <table className="min-w-full text-base text-slate-100 rounded-xl overflow-hidden">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 font-semibold border-r border-slate-600 w-32">Part</th>
                <th className="px-4 py-3 font-semibold border-r border-slate-600">Task</th>
                <th className="px-4 py-3 font-semibold border-r border-slate-600">Description</th>
                <th className="px-4 py-3 font-semibold">Skills</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 w-32">Part A</td>
                <td className="px-4 py-3 border-r border-slate-700">Repeat</td>
                <td className="px-4 py-3 border-r border-slate-700">Listen and repeat sentences</td>
                <td className="px-4 py-3">Speaking & Listening</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 w-32">Part B</td>
                <td className="px-4 py-3 border-r border-slate-700">Sentence Builds</td>
                <td className="px-4 py-3 border-r border-slate-700">Rearrange word groups into sentences</td>
                <td className="px-4 py-3">Speaking & Listening</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 w-32">Part C</td>
                <td className="px-4 py-3 border-r border-slate-700">Conversations</td>
                <td className="px-4 py-3 border-r border-slate-700">Answer questions about conversations</td>
                <td className="px-4 py-3">Listening & Speaking</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 w-32">Part D</td>
                <td className="px-4 py-3 border-r border-slate-700">Sentence Completion</td>
                <td className="px-4 py-3 border-r border-slate-700">Complete sentences with appropriate words</td>
                <td className="px-4 py-3">Reading & Writing</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 w-32">Part E</td>
                <td className="px-4 py-3 border-r border-slate-700">Dictation</td>
                <td className="px-4 py-3 border-r border-slate-700">Type sentences exactly as heard</td>
                <td className="px-4 py-3">Listening & Writing</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="px-4 py-3 border-r border-slate-700 w-32">Part F</td>
                <td className="px-4 py-3 border-r border-slate-700">Passage Reconstruction</td>
                <td className="px-4 py-3 border-r border-slate-700">Read, remember, and reconstruct a passage in your own words</td>
                <td className="px-4 py-3">Listening & Writing</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Button className="w-full bg-sky-600 hover:bg-sky-500 focus:ring-2 focus:ring-sky-400 text-lg py-3 rounded-xl transition-all duration-150" onClick={handleStartInterview}>
          Start English Assessment
        </Button>
      </div>
    </div>
  );

  // --- Main Render ---
  if (step === 1) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      {renderWelcome()}
    </div>
  );
  if (step === 2) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      {renderSetupRequirements()}
    </div>
  );
  if (step === 3) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      {renderTips()}
    </div>
  );
  if (step === 4) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      {renderOverview()}
    </div>
  );

  // --- Step 5: Interview Setup Form (existing form) ---
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-gray-800 rounded-lg shadow p-6 w-full">
        <h2 className="text-2xl font-bold text-white mb-6">
          Interview Setup
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-200">
              Select Role
            </label>
            <div className="mt-1 relative">
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value as Role);
                }}
                className="block w-full pl-3 pr-10 py-2 text-white bg-gray-700 border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="SDE">SDE</option>
                <option value="Marketing Manager">Marketing Manager</option>
                <option value="Marketing Manager (Long Form)">Marketing Manager (Long Form)</option>
                <option value="Marketing Manager (Demo)">Marketing Manager (Demo)</option>
                <option value="Speech Assessment">Speech Assessment</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          { selectedRole === 'Others' &&<div>
            <label className="block text-sm font-medium text-gray-200">
              Role Name
            </label>
            <input
              type="text"
              value={otherRole}
              onChange={(e) => setOtherRole(e.target.value as other)}
              placeholder="Type role name"
              className="block w-full mt-1 pl-3 pr-10 py-2 text-white bg-gray-700 border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            />
          </div>
          }
          
          <div>
            <label className="block text-sm font-medium text-gray-200">
              Skills
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyUp={(e) => e.key === 'Enter' && handleAddSkill()}
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Add a skill"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-600 rounded-r-md bg-gray-700 hover:bg-gray-600"
              >
                <Plus className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center px-2.5 py-2 rounded-full text-xs font-medium bg-blue-900 text-blue-200"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-1 inline-flex items-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setStep(4)}
              className="w-1/2 bg-gray-600 hover:bg-gray-700"
            >
              Back
            </Button>
            <Button
              onClick={handleStartInterview}
              disabled={(selectedRole !== 'Others' && skills.length === 0 ) || (selectedRole === 'Others' && otherRole === '')}  
              className="w-1/2 bg-blue-600 hover:bg-blue-700"
            >
              Start Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}