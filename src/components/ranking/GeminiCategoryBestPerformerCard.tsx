import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';
import { Sparkles, Trophy, Crown, Medal, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface GeminiCategoryBestPerformerCardProps {
  categoryKey: string;
  userRole?: string;
  assignedYear?: string;
  assignedSection?: string;
  className?: string;
}

export const GeminiCategoryBestPerformerCard: React.FC<GeminiCategoryBestPerformerCardProps> = ({
  categoryKey,
  assignedYear,
  assignedSection,
  className = ''
}) => {
  const [categoryData, setCategoryData] = useState<any>(null);
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSecondPlace, setShowSecondPlace] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadRanking = async () => {
      setIsLoading(true);
      try {
        const res = await API.getAllCategoryRankings(assignedYear, assignedSection);
        if (isMounted && res) {
          setStatusInfo(res.geminiApiStatus);
          if (res.categories && res.categories[categoryKey]) {
            setCategoryData(res.categories[categoryKey]);
          }
        }
      } catch (_err) {
        // Silent catch fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadRanking();
    return () => {
      isMounted = false;
    };
  }, [categoryKey, assignedYear, assignedSection]);

  if (isLoading) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3 text-xs font-mono text-slate-400 ${className}`}>
        <Sparkles className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
        <span>Evaluating Gemini AI Category Best Performer...</span>
      </div>
    );
  }

  if (!categoryData || !categoryData.firstPlace) return null;

  const first = categoryData.firstPlace;
  const second = categoryData.secondPlace;
  const isGeminiActive = statusInfo?.isConfigured;

  return (
    <div className={`bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-3 font-sans text-xs ${className}`}>
      {/* Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
              <span>{categoryData.title || 'Gemini AI Category Best Performer'}</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">{categoryData.description}</p>
          </div>
        </div>

        <span
          className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 border shrink-0 ${
            isGeminiActive
              ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
              : 'bg-amber-950 text-amber-300 border-amber-700/80'
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>{isGeminiActive ? 'Gemini 2.5 Flash Active' : 'Rule Engine Fallback'}</span>
        </span>
      </div>

      {/* Top 1 Performer Spotlight */}
      {first.isAvailable ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
          <div className="md:col-span-5 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md font-mono flex items-center space-x-1">
                <Crown className="w-3 h-3" />
                <span>#1 BEST PERFORMER</span>
              </span>
              {first.year && (
                <span className="text-[10px] font-mono text-slate-400">
                  {first.year} - Sec {first.section}
                </span>
              )}
            </div>
            <h4 className="text-base font-extrabold text-white flex items-center space-x-1.5">
              <span>{first.studentName}</span>
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </h4>
            <div className="text-[11px] text-slate-400 font-mono">
              Register No: <strong className="text-white">{first.registerNo}</strong>
            </div>
          </div>

          <div className="md:col-span-3 text-left md:text-center border-y md:border-y-0 md:border-x border-slate-800 py-2 md:py-0 px-3">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Verified Score</div>
            <div className="text-xl font-black font-mono text-amber-400">
              {first.score !== undefined ? first.score.toFixed(1) : '0.0'}
              <span className="text-xs font-normal text-slate-500"> / 100</span>
            </div>
          </div>

          <div className="md:col-span-4 space-y-1">
            <div className="text-[10px] text-indigo-400 font-mono font-bold uppercase flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>AI Rationale</span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
              {first.aiExplanation || 'Top performer identified based on verified academic and activity records.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-slate-400 text-xs font-mono p-3 bg-slate-950 rounded-xl border border-slate-800">
          No eligible performers found yet in this category for the current selection.
        </div>
      )}

      {/* 2nd Place Expand Toggle */}
      {second && second.isAvailable && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowSecondPlace(!showSecondPlace)}
            className="text-slate-400 hover:text-white text-[11px] font-mono flex items-center space-x-1 transition-all cursor-pointer outline-none"
          >
            <span>{showSecondPlace ? 'Hide 2nd Place Performer' : 'View 2nd Place Performer'}</span>
            {showSecondPlace ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showSecondPlace && (
            <div className="mt-2.5 bg-slate-950 border border-slate-800 p-3 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-5 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="bg-slate-800 text-slate-200 font-black text-[10px] px-2 py-0.5 rounded-md font-mono flex items-center space-x-1">
                    <Medal className="w-3 h-3 text-slate-400" />
                    <span>#2 SECOND PLACE</span>
                  </span>
                  {second.year && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {second.year} - Sec {second.section}
                    </span>
                  )}
                </div>
                <h5 className="text-sm font-bold text-white">{second.studentName}</h5>
                <div className="text-[11px] text-slate-400 font-mono">Reg: {second.registerNo}</div>
              </div>

              <div className="md:col-span-3 text-left md:text-center">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Score</div>
                <div className="text-lg font-bold font-mono text-slate-200">
                  {second.score !== undefined ? second.score.toFixed(1) : '0.0'} / 100
                </div>
              </div>

              <div className="md:col-span-4 text-[11px] text-slate-300">
                {second.aiExplanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
