import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';
import {
  Trophy,
  Award,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  BookOpen,
  Code,
  Calendar,
  ShieldCheck,
  Star,
  FileCheck,
  RefreshCw,
  Loader2,
  FileText
} from 'lucide-react';

export const StudentAiRewardCard: React.FC<{ studentId?: string }> = ({ studentId }) => {
  const [rewardData, setRewardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReward = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await API.getStudentAiReward(studentId);
      if (res.rewardScore) {
        setRewardData(res.rewardScore);
      } else {
        setError('No reward data available yet.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to calculate AI Reward score.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReward();
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-mono">Gemini AI analyzing student portal records & computing reward points...</p>
      </div>
    );
  }

  if (error || !rewardData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-xs text-red-300 font-mono">{error || 'Unable to load Gemini AI reward metrics.'}</p>
        <button
          onClick={fetchReward}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono inline-flex items-center space-x-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry AI Calculation</span>
        </button>
      </div>
    );
  }

  const {
    totalPoints,
    categoryPoints,
    activitiesConsidered,
    evidenceSources,
    performanceLevel,
    awardEligibility,
    recommendedAward,
    aiReasoning,
    confidenceScore
  } = rewardData;

  const categoryIcons: Record<string, any> = {
    academics: BookOpen,
    nptel: FileCheck,
    leetcode: Code,
    projects: Trophy,
    hackathons: Star,
    research: FileText,
    participation: Award,
    attendance: Calendar,
    discipline: ShieldCheck,
    skills: Code
  };

  const getPerformanceBadgeColor = (level: string) => {
    switch ((level || '').toUpperCase()) {
      case 'OUTSTANDING':
        return 'bg-purple-950 border-purple-700 text-purple-300';
      case 'EXCELLENT':
        return 'bg-emerald-950 border-emerald-700 text-emerald-300';
      case 'VERY GOOD':
        return 'bg-blue-950 border-blue-700 text-blue-300';
      case 'GOOD':
        return 'bg-amber-950 border-amber-700 text-amber-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 p-0.5 shadow-lg">
            <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white">Gemini AI Reward & Recognition Engine</h2>
              <span className="bg-purple-950/80 border border-purple-700/60 text-purple-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Verified Portal Data</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs font-mono mt-0.5">
              Individual activity analysis, category reward scoring, and AI award recommendation.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">Total Reward Score</div>
            <div className="text-2xl font-extrabold text-amber-400 font-mono">{totalPoints} <span className="text-xs text-slate-400 font-normal">pts</span></div>
          </div>
          <button
            onClick={fetchReward}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition"
            title="Recalculate Gemini AI Reward Score"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">Performance Level</div>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold font-mono ${getPerformanceBadgeColor(performanceLevel)}`}>
              {performanceLevel || 'Evaluated'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">Recommended Award</div>
          <div className="text-sm font-bold text-amber-300 font-sans truncate">{recommendedAward || 'Candidate'}</div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">Award Eligibility</div>
          <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold font-mono">
            <CheckCircle2 className="w-4 h-4" />
            <span className="truncate">{awardEligibility || 'Eligible'}</span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">AI Reliability / Confidence</div>
          <div className="text-sm font-bold text-purple-300 font-mono">{confidenceScore}% Verified Data</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span>Category-Wise Reward Point Breakdown</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(categoryPoints || {}).map(([cat, pts]: [string, any]) => {
            const IconComponent = categoryIcons[cat] || Star;
            return (
              <div key={cat} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <IconComponent className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-300 capitalize truncate font-mono">{cat}</span>
                </div>
                <span className="text-xs font-extrabold text-amber-400 font-mono shrink-0 ml-2">+{pts}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activities & Evidence Source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
          <h4 className="font-bold text-white uppercase text-[11px] text-slate-400">Verified Activities Analyzed</h4>
          <ul className="space-y-1.5 text-slate-300">
            {Array.isArray(activitiesConsidered) && activitiesConsidered.length > 0 ? (
              activitiesConsidered.map((act: string, idx: number) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-amber-400">•</span>
                  <span>{act}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500 italic">No activity logs recorded.</li>
            )}
          </ul>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
          <h4 className="font-bold text-white uppercase text-[11px] text-slate-400">Evidence / Database Sources</h4>
          <ul className="space-y-1.5 text-slate-300">
            {Array.isArray(evidenceSources) && evidenceSources.length > 0 ? (
              evidenceSources.map((ev: string, idx: number) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-emerald-400">✓</span>
                  <span>{ev}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500 italic">Standard database system metrics.</li>
            )}
          </ul>
        </div>
      </div>

      {/* AI Synthesis Reasoning */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-950 to-indigo-950/40 border border-purple-800/40 p-4 rounded-xl space-y-2">
        <div className="flex items-center space-x-2 text-purple-300 font-bold text-xs font-mono">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Gemini AI Evaluation Reasoning</span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed font-sans">
          {aiReasoning || 'Gemini AI evaluated verified academic performance, certifications, coding practice, projects, attendance, and discipline records from the database.'}
        </p>
      </div>
    </div>
  );
};
