import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../../services/api';
import {
  Code,
  Crown,
  Sparkles,
  Trophy,
  Medal,
  Flame,
  Zap,
  Award,
  BarChart3,
  TrendingUp,
  UserCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ShieldCheck
} from 'lucide-react';

interface GeminiFullLeetCodeDashboardProps {
  assignedYear?: string;
  assignedSection?: string;
  onRefreshStats?: () => void;
}

export const GeminiFullLeetCodeDashboard: React.FC<GeminiFullLeetCodeDashboardProps> = ({
  assignedYear,
  assignedSection,
  onRefreshStats
}) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await API.getLeetCodeFullAnalytics(assignedYear, assignedSection);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Gemini AI LeetCode Analytics.');
    } finally {
      setIsLoading(false);
    }
  }, [assignedYear, assignedSection]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = async () => {
    if (onRefreshStats) {
      await onRefreshStats();
    }
    await fetchAnalytics();
  };

  const isGeminiActive = data?.geminiApiStatus?.isConfigured;

  return (
    <div className="space-y-6 text-xs font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-600 p-0.5 shadow-lg">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
              <Code className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white flex flex-wrap items-center gap-2">
              <span>Gemini AI LeetCode Performance Dashboard</span>
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 border ${
                  isGeminiActive
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
                    : 'bg-amber-950 text-amber-300 border-amber-700/80'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{isGeminiActive ? 'Gemini 2.5 Flash Active' : 'Rule Engine Fallback'}</span>
              </span>
            </h2>
            <p className="text-slate-400 font-mono text-[11px]">
              Full-page AI performance overview, 1st & 2nd place rankings, analytics, strengths, and head-to-head comparison.
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 shadow-md transition-all cursor-pointer font-mono text-xs disabled:opacity-50"
        >
          <RefreshCw className={isLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          <span>{isLoading ? 'Analyzing LeetCode Data...' : 'Refresh LeetCode Analytics'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-800 text-red-300 p-4 rounded-xl flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchAnalytics} className="bg-red-900 hover:bg-red-800 text-white px-3 py-1 rounded-lg text-xs font-bold">
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <div className="text-white font-bold text-sm">Running Gemini AI LeetCode Deep Analysis...</div>
          <div className="text-slate-400 font-mono text-xs">Evaluating verified problem counts, difficulty breakdown, contest rating, and consistency.</div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* SECTION A: Gemini AI Performance Overview (KPI Cards + Spotlight) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-mono flex items-center justify-between">
                <span>Top Solved Count</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">
                {data.overview.topSolvedCount}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Lead Coder Total Solved</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-mono flex items-center justify-between">
                <span>Highest Contest Rating</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {data.overview.highestRating}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Global Contest Metric</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-mono flex items-center justify-between">
                <span>Hard Problems Solved</span>
                <Flame className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black font-mono text-rose-400">
                {data.overview.totalHardSolved}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Algorithmic Mastery</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-mono flex items-center justify-between">
                <span>Active Coders</span>
                <UserCheck className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black font-mono text-sky-400">
                {data.overview.totalCandidates}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Verified Roster Coders</div>
            </div>
          </div>

          {/* AI Executive Summary Box */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/40 p-5 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold text-xs uppercase">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Gemini AI Performance Rationale</span>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed font-medium">
              {data.overview.overallExplanation}
            </p>
          </div>

          {/* SECTION B: Gemini AI Ranking System (1st Place & 2nd Place) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>Gemini AI LeetCode Ranking System</span>
              </h3>
              <span className="bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-mono px-3 py-1 rounded-full font-bold">
                Top 2 Positions Only
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1st Place Card */}
              <LeetCodeWinnerCard winner={data.firstPlace} expectedRank={1} />

              {/* 2nd Place Card */}
              <LeetCodeWinnerCard winner={data.secondPlace} expectedRank={2} />
            </div>
          </div>

          {/* SECTION C & SECTION F: Gemini AI Performance Analysis & Difficulty Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <BarChart3 className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-extrabold text-white">Gemini AI Difficulty Analysis</h3>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono text-center">
                <div className="bg-slate-950 border border-emerald-900/60 p-3 rounded-xl">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase">Easy Solved</div>
                  <div className="text-lg font-black text-white mt-1">
                    {data.performanceAnalysis.easySolvedTotal}
                  </div>
                  <div className="text-[10px] text-slate-500">{data.trends.difficultyRatio.easyPercent}% of Total</div>
                </div>

                <div className="bg-slate-950 border border-amber-900/60 p-3 rounded-xl">
                  <div className="text-[10px] text-amber-400 font-bold uppercase">Medium Solved</div>
                  <div className="text-lg font-black text-white mt-1">
                    {data.performanceAnalysis.mediumSolvedTotal}
                  </div>
                  <div className="text-[10px] text-slate-500">{data.trends.difficultyRatio.mediumPercent}% of Total</div>
                </div>

                <div className="bg-slate-950 border border-rose-900/60 p-3 rounded-xl">
                  <div className="text-[10px] text-rose-400 font-bold uppercase">Hard Solved</div>
                  <div className="text-lg font-black text-white mt-1">
                    {data.performanceAnalysis.hardSolvedTotal}
                  </div>
                  <div className="text-[10px] text-slate-500">{data.trends.difficultyRatio.hardPercent}% of Total</div>
                </div>
              </div>

              {/* Progress Bar Visual Ratio */}
              <div className="space-y-1.5 pt-1 font-mono">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Problem Distribution Ratio</span>
                  <span>Easy / Med / Hard</span>
                </div>
                <div className="h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                  <div style={{ width: `${data.trends.difficultyRatio.easyPercent}%` }} className="bg-emerald-500 h-full" />
                  <div style={{ width: `${data.trends.difficultyRatio.mediumPercent}%` }} className="bg-amber-500 h-full" />
                  <div style={{ width: `${data.trends.difficultyRatio.hardPercent}%` }} className="bg-rose-500 h-full" />
                </div>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed pt-1">
                {data.performanceAnalysis.analysisText}
              </p>
            </div>

            {/* SECTION D: Strengths & Improvement Insights */}
            <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-extrabold text-white">Gemini AI Strengths & Insights</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-[10px] text-emerald-400 font-mono font-bold uppercase flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified Key Strengths</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-1 pl-1">
                    {data.insights.strengths.map((str: string, i: number) => (
                      <li key={i}>{str}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <div className="text-[10px] text-indigo-400 font-mono font-bold uppercase flex items-center space-x-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>AI Recommendations</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-1 pl-1">
                    {data.insights.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION E: Gemini AI Head-to-Head Comparison */}
          {data.secondPlace && data.secondPlace.isAvailable && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-extrabold text-white">Gemini AI Head-to-Head Comparison</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Metric</th>
                      <th className="py-2.5 px-3 text-amber-400">1st Place: {data.firstPlace.studentName}</th>
                      <th className="py-2.5 px-3 text-slate-300">2nd Place: {data.secondPlace.studentName}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">Total Solved</td>
                      <td className="py-2.5 px-3 font-bold text-amber-400">{data.firstPlace.leetCodeStats?.totalSolved || 0}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{data.secondPlace.leetCodeStats?.totalSolved || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">Easy Solved</td>
                      <td className="py-2.5 px-3 text-emerald-400">{data.firstPlace.leetCodeStats?.easySolved || 0}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{data.secondPlace.leetCodeStats?.easySolved || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">Medium Solved</td>
                      <td className="py-2.5 px-3 text-amber-400">{data.firstPlace.leetCodeStats?.mediumSolved || 0}</td>
                      <td className="py-2.5 px-3 text-amber-400">{data.secondPlace.leetCodeStats?.mediumSolved || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">Hard Solved</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">{data.firstPlace.leetCodeStats?.hardSolved || 0}</td>
                      <td className="py-2.5 px-3 text-rose-400">{data.secondPlace.leetCodeStats?.hardSolved || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-400">Contest Rating</td>
                      <td className="py-2.5 px-3 text-sky-400 font-bold">{data.firstPlace.leetCodeStats?.contestRating || 1200}</td>
                      <td className="py-2.5 px-3 text-sky-400">{data.secondPlace.leetCodeStats?.contestRating || 1200}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 text-xs">
                <span className="text-indigo-400 font-mono font-bold uppercase block mb-1">AI Comparative Breakdown</span>
                {data.insights.rankingComparisonText}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

interface LeetCodeWinnerCardProps {
  winner: any;
  expectedRank: 1 | 2;
}

const LeetCodeWinnerCard: React.FC<LeetCodeWinnerCardProps> = ({ winner, expectedRank }) => {
  const isFirst = expectedRank === 1;

  if (!winner || !winner.isAvailable) {
    return (
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-2 min-h-[220px]">
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 font-bold">
          {isFirst ? '🥇' : '🥈'}
        </div>
        <div className="font-bold text-slate-400 text-xs font-mono uppercase">
          {isFirst ? '1st Place Position Unavailable' : '2nd Place Position Unavailable'}
        </div>
        <p className="text-slate-500 text-[11px] max-w-xs font-mono">
          {winner?.message || 'Insufficient eligible LeetCode database records.'}
        </p>
      </div>
    );
  }

  const lc = winner.leetCodeStats;

  return (
    <div
      className={`relative bg-slate-950 rounded-2xl p-5 space-y-4 border transition-all ${
        isFirst
          ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 via-slate-950 to-slate-950 shadow-xl shadow-amber-950/20'
          : 'border-slate-700/80 bg-gradient-to-b from-slate-900/40 via-slate-950 to-slate-950 shadow-md'
      }`}
    >
      {/* Header Bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span
            className={`font-black text-xs px-3 py-1 rounded-full font-mono flex items-center space-x-1 border ${
              isFirst ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            {isFirst ? <Crown className="w-3.5 h-3.5" /> : <Medal className="w-3.5 h-3.5" />}
            <span>{winner.isTie ? `TIED #${expectedRank} PLACE` : `${expectedRank === 1 ? '1ST' : '2ND'} PLACE`}</span>
          </span>

          {winner.year && (
            <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded">
              {winner.year} - Sec {winner.section}
            </span>
          )}
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">Coding Score</span>
          <span className={`text-xl font-black font-mono ${isFirst ? 'text-amber-400' : 'text-slate-200'}`}>
            {winner.score !== undefined ? winner.score.toFixed(1) : '0.0'}
            <span className="text-xs font-normal text-slate-500"> / 100</span>
          </span>
        </div>
      </div>

      {/* Student Details */}
      <div>
        <h4 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>{winner.studentName}</span>
          <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        </h4>
        <div className="text-xs text-slate-400 font-mono mt-0.5">
          Register No: <strong className="text-white">{winner.registerNo}</strong>
        </div>
      </div>

      {/* Problem Stats Pill Grid */}
      {lc && (
        <div className="grid grid-cols-4 gap-2 font-mono text-center pt-1">
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg">
            <div className="text-[9px] text-slate-400 uppercase">Total</div>
            <div className="text-sm font-bold text-white">{lc.totalSolved || 0}</div>
          </div>
          <div className="bg-slate-900 border border-emerald-900/60 p-2 rounded-lg">
            <div className="text-[9px] text-emerald-400 uppercase">Easy</div>
            <div className="text-sm font-bold text-emerald-400">{lc.easySolved || 0}</div>
          </div>
          <div className="bg-slate-900 border border-amber-900/60 p-2 rounded-lg">
            <div className="text-[9px] text-amber-400 uppercase">Medium</div>
            <div className="text-sm font-bold text-amber-400">{lc.mediumSolved || 0}</div>
          </div>
          <div className="bg-slate-900 border border-rose-900/60 p-2 rounded-lg">
            <div className="text-[9px] text-rose-400 uppercase">Hard</div>
            <div className="text-sm font-bold text-rose-400">{lc.hardSolved || 0}</div>
          </div>
        </div>
      )}

      {/* Gemini AI Rationale */}
      {winner.aiExplanation && (
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center space-x-1.5 text-indigo-400 font-mono text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Gemini AI Rationale</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed font-sans font-medium">
            {winner.aiExplanation}
          </p>
        </div>
      )}
    </div>
  );
};
