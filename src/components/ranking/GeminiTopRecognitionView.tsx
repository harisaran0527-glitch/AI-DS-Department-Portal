import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../../services/api';
import {
  Trophy,
  Crown,
  Sparkles,
  Users,
  RefreshCw,
  AlertCircle,
  Medal,
  Flame,
  UserCheck
} from 'lucide-react';

interface WinnerData {
  rank: 1 | 2;
  isAvailable: boolean;
  isTie?: boolean;
  studentId?: string;
  studentName?: string;
  registerNo?: string;
  year?: string;
  section?: string;
  score?: number;
  scoreBreakdown?: any;
  aiExplanation?: string;
  message?: string;
}

interface CategoryResult {
  categoryKey: string;
  title: string;
  description: string;
  firstPlace: WinnerData;
  secondPlace: WinnerData;
}

interface TopRecognitionResponse {
  yearFilter?: string;
  sectionFilter?: string;
  calculatedAt: string;
  geminiApiStatus?: {
    isConfigured: boolean;
    model: string;
    statusMessage: string;
  };
  bestStudent: CategoryResult;
  bestTeamHead: CategoryResult;
  bestEliteStudent: CategoryResult;
  bestLeetCodePerformer: CategoryResult;
}

interface GeminiTopRecognitionViewProps {
  userRole: 'STUDENT' | 'FACULTY' | 'HOD' | 'ADMIN';
  assignedYear?: string;
  assignedSection?: string;
}

export const GeminiTopRecognitionView: React.FC<GeminiTopRecognitionViewProps> = ({
  userRole,
  assignedYear,
  assignedSection
}) => {
  const [data, setData] = useState<TopRecognitionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(assignedYear || 'ALL');
  const [sectionFilter, setSectionFilter] = useState<string>(assignedSection || 'ALL');

  const fetchRankings = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await API.getTopRecognitionRankings(
        yearFilter === 'ALL' ? undefined : yearFilter,
        sectionFilter === 'ALL' ? undefined : sectionFilter
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Gemini AI Top Recognition Rankings.');
    } finally {
      setIsLoading(false);
    }
  }, [yearFilter, sectionFilter]);

  useEffect(() => {
    if (assignedYear && assignedYear !== yearFilter) {
      setYearFilter(assignedYear);
    }
    if (assignedSection && assignedSection !== sectionFilter) {
      setSectionFilter(assignedSection);
    }
  }, [assignedYear, assignedSection]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return (
    <div className="space-y-6 text-xs font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
                <Crown className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex flex-wrap items-center gap-2">
                <span>Gemini AI Student Recognition & Rankings</span>
                <span className="bg-indigo-950 border border-indigo-800 text-indigo-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                  1st & 2nd Place Only
                </span>
                {data?.geminiApiStatus && (
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 border ${
                      data.geminiApiStatus.isConfigured
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
                        : 'bg-amber-950 text-amber-300 border-amber-700/80'
                    }`}
                    title={data.geminiApiStatus.statusMessage}
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{data.geminiApiStatus.isConfigured ? 'Gemini 2.5 Flash Active' : 'Gemini AI Status: Rule Engine Active'}</span>
                  </span>
                )}
              </h2>
              <p className="text-slate-400 font-mono text-[11px]">
                Deterministic backend score calculation & comparative Gemini AI rationale analysis.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Filters for HOD / Faculty */}
          {(userRole === 'HOD' || userRole === 'ADMIN' || userRole === 'FACULTY') && (
            <div className="flex items-center space-x-2 bg-[#1B205F] border border-white/14 p-1.5 rounded-xl font-mono">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-[#252B86] text-white border border-white/14 rounded-lg px-2 py-1 text-[11px] font-bold outline-none"
              >
                <option value="ALL">All Years</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
              </select>

              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="bg-[#252B86] text-white border border-white/14 rounded-lg px-2 py-1 text-[11px] font-bold outline-none"
              >
                <option value="ALL">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
              </select>
            </div>
          )}

          <button
            onClick={fetchRankings}
            disabled={isLoading}
            className="btn-action bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2 rounded-xl flex items-center space-x-2 shadow-md transition-all cursor-pointer font-mono text-xs disabled:opacity-50"
          >
            <RefreshCw className={isLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
            <span>{isLoading ? 'Analyzing Data...' : 'Refresh Rankings'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-800 text-red-300 p-4 rounded-xl flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchRankings} className="bg-red-900 hover:bg-red-800 text-white px-3 py-1 rounded-lg text-xs font-bold">
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="bg-[#3039A8] border border-white/14 rounded-2xl p-12 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <div className="text-white font-bold text-sm">Running Gemini AI Category Analysis...</div>
          <div className="text-[#D9DEFF] font-mono text-xs">Evaluating verified records across Best Student, Best Team Head, Best Elite Student, and Best LeetCode.</div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Category 1: Best Student */}
          <CategorySection
            icon={<Trophy className="w-5 h-5 text-amber-400" />}
            iconBg="bg-amber-950 border-amber-800 text-amber-400"
            category={data.bestStudent}
          />

          {/* Category 2: Best Team Head */}
          <CategorySection
            icon={<Users className="w-5 h-5 text-sky-400" />}
            iconBg="bg-sky-950 border-sky-800 text-sky-400"
            category={data.bestTeamHead}
          />

          {/* Category 3: Best Elite Student */}
          <CategorySection
            icon={<Sparkles className="w-5 h-5 text-purple-400" />}
            iconBg="bg-purple-950 border-purple-800 text-purple-400"
            category={data.bestEliteStudent}
          />

          {/* Category 4: Best LeetCode Performer */}
          <CategorySection
            icon={<Flame className="w-5 h-5 text-emerald-400" />}
            iconBg="bg-emerald-950 border-emerald-800 text-emerald-400"
            category={data.bestLeetCodePerformer}
          />
        </div>
      ) : null}
    </div>
  );
};

interface CategorySectionProps {
  icon: React.ReactNode;
  iconBg: string;
  category: CategoryResult;
}

const CategorySection: React.FC<CategorySectionProps> = ({ icon, iconBg, category }) => {
  return (
    <div className="bg-[#3039A8] border border-white/14 rounded-2xl p-6 space-y-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-white/14 pb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">{category.title}</h3>
            <p className="text-[#D9DEFF] font-mono text-[11px]">{category.description}</p>
          </div>
        </div>
        <span className="bg-[#1B205F] border border-white/14 text-[#D9DEFF] text-[10px] font-mono px-3 py-1 rounded-full font-bold">
          Top 2 Positions Only
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1st Place Winner Card */}
        <WinnerCard winner={category.firstPlace} expectedRank={1} />

        {/* 2nd Place Winner Card */}
        <WinnerCard winner={category.secondPlace} expectedRank={2} />
      </div>
    </div>
  );
};

interface WinnerCardProps {
  winner: WinnerData;
  expectedRank: 1 | 2;
}

const WinnerCard: React.FC<WinnerCardProps> = ({ winner, expectedRank }) => {
  const isFirst = expectedRank === 1;

  if (!winner || !winner.isAvailable) {
    return (
      <div className="bg-[#1B205F] border border-white/14 rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-2 min-h-[180px]">
        <div className="w-10 h-10 rounded-full bg-[#252B86] border border-white/14 flex items-center justify-center text-[#AEB7F5] font-bold">
          {isFirst ? '🥇' : '🥈'}
        </div>
        <div className="font-bold text-[#D9DEFF] text-xs font-mono uppercase">
          {isFirst ? '1st Place Position Unavailable' : '2nd Place Position Unavailable'}
        </div>
        <p className="text-[#AEB7F5] text-[11px] max-w-xs font-mono">
          {winner?.message || 'Insufficient eligible database records found for this position.'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-[#1B205F] rounded-2xl p-5 space-y-4 border transition-all ${
        isFirst
          ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 via-[#1B205F] to-[#1B205F] shadow-xl shadow-amber-950/20'
          : 'border-white/14 bg-gradient-to-b from-[#252B86]/40 via-[#1B205F] to-[#1B205F] shadow-md'
      }`}
    >
      {/* Rank & Score Header Bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span
            className={`font-black text-xs px-3 py-1 rounded-full font-mono flex items-center space-x-1 border ${
              isFirst
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-[#252B86] text-white border-white/14'
            }`}
          >
            {isFirst ? <Crown className="w-3.5 h-3.5" /> : <Medal className="w-3.5 h-3.5" />}
            <span>{winner.isTie ? `TIED #${expectedRank} PLACE` : `${expectedRank === 1 ? '1ST' : '2ND'} PLACE`}</span>
          </span>

          {winner.year && (
            <span className="bg-[#252B86] border border-white/14 text-[#D9DEFF] text-[10px] font-mono px-2 py-0.5 rounded">
              {winner.year} - Sec {winner.section}
            </span>
          )}
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[#AEB7F5] uppercase font-mono block">Category Score</span>
          <span className={`text-xl font-black font-mono ${isFirst ? 'text-amber-400' : 'text-white'}`}>
            {winner.score !== undefined ? winner.score.toFixed(1) : '0.0'}
            <span className="text-xs font-normal text-[#AEB7F5]"> / 100</span>
          </span>
        </div>
      </div>

      {/* Student Details */}
      <div>
        <h4 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>{winner.studentName}</span>
          <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        </h4>
        <div className="text-xs text-[#D9DEFF] font-mono mt-0.5">
          Register No: <strong className="text-white">{winner.registerNo}</strong>
        </div>
      </div>

      {/* Gemini AI Rationale Box */}
      {winner.aiExplanation && (
        <div className="bg-[#252B86] border border-white/14 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center space-x-1.5 text-cyan-300 font-mono text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <span>Gemini AI Comparative Rationale</span>
          </div>
          <p className="text-white text-xs leading-relaxed font-sans font-medium">
            {winner.aiExplanation}
          </p>
        </div>
      )}
    </div>
  );
};
