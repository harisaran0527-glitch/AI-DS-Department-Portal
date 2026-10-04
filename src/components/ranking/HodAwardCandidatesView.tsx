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
}> = ({ assignedYear, assignedSection }) => {
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

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Evaluating student records & ranking award candidates...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-xs text-red-300 font-mono">{error}</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No award candidates generated yet or matching search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono uppercase">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Student Info</th>
                  <th className="py-3 px-4">Reward Score</th>
                  <th className="py-3 px-4">Award Category & Title</th>
                  <th className="py-3 px-4">AI Reason & Evidence</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">HOD Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredCandidates.map((cand) => {
                  const isApproved = cand.status === 'APPROVED';
                  const isRejected = cand.status === 'REJECTED';
                  return (
                    <tr key={cand.studentId} className="hover:bg-slate-950/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs ${cand.rank === 1 ? 'bg-amber-500 text-slate-950 font-extrabold' : cand.rank === 2 ? 'bg-slate-300 text-slate-950 font-extrabold' : cand.rank === 3 ? 'bg-amber-700 text-white font-extrabold' : 'bg-slate-800 text-slate-300'}`}>
                          #{cand.rank}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{cand.studentName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Reg No: <span className="text-amber-400 font-bold">{cand.registerNo}</span> | Year {cand.year} Sec {cand.section}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-base font-extrabold text-amber-400 font-mono">
                          {cand.totalPoints} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                        </div>
                        <div className="text-[10px] text-purple-300 font-mono">Level: {cand.performanceLevel}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block bg-amber-950/60 border border-amber-800/80 text-amber-300 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                          {cand.recommendedAward}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{cand.awardCategory}</div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                          {cand.aiReasoning}
                        </p>
                        <div className="text-[10px] text-slate-400 font-mono truncate mt-1">
                          Source: {Array.isArray(cand.evidenceSources) ? cand.evidenceSources.slice(0, 2).join(', ') : 'Portal Database'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isApproved ? (
                          <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>APPROVED</span>
                          </span>
                        ) : isRejected ? (
                          <span className="bg-red-950 border border-red-700 text-red-300 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center space-x-1">
                            <XCircle className="w-3 h-3 text-red-400" />
                            <span>REJECTED</span>
                          </span>
                        ) : (
                          <span className="bg-amber-950 border border-amber-700 text-amber-300 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center space-x-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>AI RECOMMENDED</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setReviewCandidate(cand)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold flex items-center space-x-1 transition"
                            title="Review full AI breakdown & evidence"
                          >
                            <Eye className="w-3.5 h-3.5 text-sky-400" />
                            <span>Review</span>
                          </button>

                          <button
                            onClick={() => handleAction(cand.studentId, 'APPROVE')}
                            disabled={isApproved || isSubmittingAction}
                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center space-x-1 transition disabled:opacity-40"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => handleAction(cand.studentId, 'REJECT')}
                            disabled={isRejected || isSubmittingAction}
                            className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center space-x-1 transition disabled:opacity-40"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
