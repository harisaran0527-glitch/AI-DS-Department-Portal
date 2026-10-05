import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';
import {
  Trophy,
  Award,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Eye,
  RefreshCw,
  Loader2,
  Check,
  X,
  ShieldCheck,
  Star,
  BookOpen,
  Code
} from 'lucide-react';

export const HodAwardCandidatesView: React.FC<{
  assignedYear?: string;
  assignedSection?: string;
  onSelectStudent360?: (studentId: string) => void;
}> = ({ assignedYear, assignedSection, onSelectStudent360 }) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected candidate for review modal
  const [reviewCandidate, setReviewCandidate] = useState<any | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchCandidates = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await API.getHodAwardCandidatesV2(assignedYear, assignedSection);
      setCandidates(res.candidates || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load award candidates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [assignedYear, assignedSection]);

  const handleAction = async (studentId: string, action: 'APPROVE' | 'REJECT', remarks?: string) => {
    setIsSubmittingAction(true);
    setActionSuccess('');
    try {
      const res = await API.postHodAwardAction(studentId, { action, remarks: remarks || actionReason });
      setActionSuccess(res.message || `Candidate ${action.toLowerCase()}d successfully.`);
      setReviewCandidate(null);
      setActionReason('');
      await fetchCandidates();
    } catch (err: any) {
      alert(err.message || 'Failed to update award status.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.studentName || '').toLowerCase().includes(q) ||
      (c.registerNo || '').toLowerCase().includes(q) ||
      (c.recommendedAward || '').toLowerCase().includes(q) ||
      (c.awardCategory || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-0.5 shadow-lg">
            <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white">🏆 Gemini AI Student Award Candidates</h2>
              <span className="bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                HOD FINAL AUTHORITY
              </span>
            </div>
            <p className="text-slate-400 text-xs font-mono mt-0.5">
              Individual reward score calculations & AI award candidate recommendations for department approval.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search candidate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <button
            onClick={fetchCandidates}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition"
            title="Refresh candidates"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs font-mono flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Award Category Cards (Top 2 Candidates per Category) */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Evaluating student records & calculating top 2 award candidates per category...</p>
        </div>
      ) : error ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-xs text-red-300 font-mono">{error}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-mono text-xs shadow-xl">
          No student records found in database to evaluate award candidates.
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { id: 'best-student', title: 'BEST STUDENT', icon: Trophy, color: 'text-amber-400', badge: 'bg-amber-950 border-amber-800 text-amber-300' },
            { id: 'best-team-head', title: 'BEST TEAM HEAD', icon: Star, color: 'text-indigo-400', badge: 'bg-indigo-950 border-indigo-800 text-indigo-300' },
            { id: 'best-leetcode', title: 'BEST LEETCODE PERFORMER', icon: Code, color: 'text-yellow-400', badge: 'bg-yellow-950 border-yellow-800 text-yellow-300' },
            { id: 'best-academic', title: 'BEST ACADEMIC PERFORMER', icon: BookOpen, color: 'text-emerald-400', badge: 'bg-emerald-950 border-emerald-800 text-emerald-300' },
            { id: 'best-project', title: 'BEST PROJECT PERFORMER', icon: ShieldCheck, color: 'text-cyan-400', badge: 'bg-cyan-950 border-cyan-800 text-cyan-300' }
          ].map((cat) => {
            let sorted = [...candidates];
            if (cat.id === 'best-student') {
              sorted.sort((a, b) => (b.totalRewardScore || b.totalPoints || 0) - (a.totalRewardScore || a.totalPoints || 0));
            } else if (cat.id === 'best-team-head') {
              sorted.sort((a, b) => (b.categoryPoints?.projects || 0) - (a.categoryPoints?.projects || 0) || (b.totalRewardScore || b.totalPoints || 0) - (a.totalRewardScore || a.totalPoints || 0));
            } else if (cat.id === 'best-leetcode') {
              sorted.sort((a, b) => (b.categoryPoints?.leetCode || 0) - (a.categoryPoints?.leetCode || 0) || (b.totalRewardScore || b.totalPoints || 0) - (a.totalRewardScore || a.totalPoints || 0));
            } else if (cat.id === 'best-academic') {
              sorted.sort((a, b) => (b.categoryPoints?.academic || 0) - (a.categoryPoints?.academic || 0) || (b.totalRewardScore || b.totalPoints || 0) - (a.totalRewardScore || a.totalPoints || 0));
            } else if (cat.id === 'best-project') {
              sorted.sort((a, b) => (b.categoryPoints?.projects || 0) - (a.categoryPoints?.projects || 0) || (b.totalRewardScore || b.totalPoints || 0) - (a.totalRewardScore || a.totalPoints || 0));
            }

            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              sorted = sorted.filter(
                (c) =>
                  (c.studentName || '').toLowerCase().includes(q) ||
                  (c.registerNo || '').toLowerCase().includes(q)
              );
            }

            const top2 = sorted.slice(0, 2);
            if (top2.length === 0) return null;

            const IconComp = cat.icon;

            return (
              <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <IconComp className={`w-5 h-5 ${cat.color}`} />
                    <h3 className="text-sm font-extrabold text-white font-mono tracking-wide uppercase">{cat.title}</h3>
                  </div>
                  <span className={`border px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${cat.badge}`}>
                    TOP 2 ELIGIBLE CANDIDATES
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {top2.map((cand, idx) => {
                    const isApproved = cand.status === 'APPROVED';
                    const isRejected = cand.status === 'REJECTED';
                    const score = cand.totalRewardScore || cand.totalPoints || 0;

                    return (
                      <div
                        key={cand.studentId || idx}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold ${idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-white'}`}>
                                #{idx + 1}
                              </span>
                              <div>
                                <h4 className="font-bold text-white text-sm leading-tight">{cand.studentName}</h4>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  Reg No: <span className="text-amber-400 font-bold">{cand.registerNo}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-extrabold text-amber-400 font-mono">
                                {score} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                              </div>
                              <span className="text-[9px] text-purple-300 font-mono block">{cand.performanceLevel || 'Evaluated'}</span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-300 font-mono flex flex-wrap gap-2 py-1">
                            <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                              {cand.year} — Section {cand.section}
                            </span>
                            <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-indigo-300">
                              Faculty: {cand.facultyName || cand.classCoordinatorName || 'Assigned Staff'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed italic bg-slate-900/60 p-2 rounded-lg border border-slate-900 line-clamp-2">
                            "{cand.aiReasoning || 'Selected based on verifiable academic, coding, and activity performance.'}"
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                          <div>
                            {isApproved ? (
                              <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>APPROVED</span>
                              </span>
                            ) : isRejected ? (
                              <span className="bg-red-950 border border-red-700 text-red-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center space-x-1">
                                <XCircle className="w-3 h-3 text-red-400" />
                                <span>REJECTED</span>
                              </span>
                            ) : (
                              <span className="bg-amber-950 border border-amber-700 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center space-x-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>ELIGIBLE</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5">
                            {onSelectStudent360 && (
                              <button
                                onClick={() => onSelectStudent360(cand.studentId)}
                                className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 px-2.5 py-1 rounded text-[10px] font-mono font-semibold"
                              >
                                View 360
                              </button>
                            )}

                            <button
                              onClick={() => handleAction(cand.studentId, 'APPROVE')}
                              disabled={isApproved || isSubmittingAction}
                              className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white px-2.5 py-1 rounded text-[10px] font-mono font-bold disabled:opacity-40"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => handleAction(cand.studentId, 'REJECT')}
                              disabled={isRejected || isSubmittingAction}
                              className="bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white px-2.5 py-1 rounded text-[10px] font-mono font-bold disabled:opacity-40"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>Review AI Award Recommendation</span>
                </h3>
                <p className="text-slate-400 font-mono">
                  Student: <strong className="text-white">{reviewCandidate.studentName}</strong> ({reviewCandidate.registerNo})
                </p>
              </div>
              <button onClick={() => setReviewCandidate(null)} className="bg-slate-800 text-slate-300 p-1 rounded-lg">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Reward Score</span>
                <div className="text-xl font-extrabold text-amber-400">{reviewCandidate.totalPoints} points</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Recommended Award</span>
                <div className="text-sm font-bold text-emerald-300">{reviewCandidate.recommendedAward}</div>
              </div>
            </div>

            {/* Category Scores */}
            <div className="space-y-2 font-mono">
              <h4 className="font-bold text-slate-400 uppercase text-[10px]">Category Points Breakdown</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(reviewCandidate.categoryPoints || {}).map(([cat, pts]: [string, any]) => (
                  <div key={cat} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between">
                    <span className="capitalize text-slate-300 text-[11px]">{cat}:</span>
                    <span className="font-bold text-amber-400 text-[11px]">+{pts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-purple-300 text-[11px] font-mono flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Reasoning Synthesis</span>
              </h4>
              <p className="text-slate-300 leading-relaxed font-sans">{reviewCandidate.aiReasoning}</p>
            </div>

            {/* Activities & Evidence */}
            <div className="space-y-2 font-mono">
              <h4 className="font-bold text-slate-400 uppercase text-[10px]">Activities & Evidence Considered</h4>
              <ul className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-slate-300 text-[11px]">
                {Array.isArray(reviewCandidate.activitiesConsidered) && reviewCandidate.activitiesConsidered.map((act: string, i: number) => (
                  <li key={i}>• {act}</li>
                ))}
              </ul>
            </div>

            {/* HOD Decision Inputs */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="block text-xs font-mono font-bold text-slate-300">
                HOD Decision Notes / Remarks (Optional):
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter approval note or rejection reason..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                rows={2}
              />

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setReviewCandidate(null)}
                  className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>

                <button
                  onClick={() => handleAction(reviewCandidate.studentId, 'REJECT')}
                  disabled={isSubmittingAction}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center space-x-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject Recommendation</span>
                </button>

                <button
                  onClick={() => handleAction(reviewCandidate.studentId, 'APPROVE')}
                  disabled={isSubmittingAction}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Award</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
