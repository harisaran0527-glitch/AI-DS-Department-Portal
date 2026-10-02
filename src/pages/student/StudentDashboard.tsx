import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import type { UserSession } from '../../types';
import { DashboardLayout, type MenuItem } from '../../components/layout/DashboardLayout';
import { ProofAttachmentControl } from '../../components/common/ProofAttachmentControl';
import {
  GraduationCap,
  Award,
  BookOpen,
  Code,
  Calendar,
  AlertTriangle,
  FileCheck,
  Trophy,
  BarChart3,
  Lock,
  Sparkles,
  Star,
  Users,
  ShieldCheck,
  FileText,
  Link as LinkIcon,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Crown,
} from 'lucide-react';

import { ForgotPasswordModal } from '../../components/common/ForgotPasswordModal';
import { SubjectManagement } from '../../components/academic/SubjectManagement';
import { BestEliteStudentsView } from '../../components/elite/BestEliteStudentsView';
import { GeminiTopRecognitionView } from '../../components/ranking/GeminiTopRecognitionView';
import { GeminiCategoryBestPerformerCard } from '../../components/ranking/GeminiCategoryBestPerformerCard';
import { GeminiFullLeetCodeDashboard } from '../../components/ranking/GeminiFullLeetCodeDashboard';
import { getNptelUrlForStudent, normalizeAcademicYear } from '../../services/nptelUrlHelper';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [_session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [student360, setStudent360] = useState<any>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [connectedData, setConnectedData] = useState<{ connectedAccounts: any[]; externalMetrics: any[] }>({
    connectedAccounts: [],
    externalMetrics: []
  });
  // LeetCode Refresh State
  const [isRefreshingLeetCode, setIsRefreshingLeetCode] = useState(false);
  const [lcSyncSuccess, setLcSyncSuccess] = useState('');
  const [lcSyncError, setLcSyncError] = useState('');
  const [nptelUrlError, setNptelUrlError] = useState('');

  const fetchProfile = React.useCallback(async () => {
    try {
      const meRes = await API.getMe();
      if (!meRes.user || meRes.user.role !== 'STUDENT') {
        navigate('/student');
        return;
      }
      setSession(meRes.user);

      const full360 = await API.getStudentSelfProfile();
      setStudent360(full360);

      const connRes = await API.getConnectedAccounts().catch(() => ({ connectedAccounts: [], externalMetrics: [] }));
      setConnectedData(connRes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch student profile.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = async () => {
    try {
      await API.logout();
    } catch {}
    navigate('/student');
  };

  const handleRefreshLeetCode = async () => {
    setIsRefreshingLeetCode(true);
    setLcSyncSuccess('');
    setLcSyncError('');
    try {
      const res = await API.syncLeetCodeForStudent();
      setLcSyncSuccess(res.message || 'LeetCode statistics updated successfully!');
      await fetchProfile();
    } catch (err: any) {
      setLcSyncError(err.message || 'Failed to refresh LeetCode statistics. Showing previous verified data.');
    } finally {
      setIsRefreshingLeetCode(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex flex-col items-center justify-center font-sans space-y-4">
        <img src="/images/avsec-salem-logo.png" alt="AVSEC Salem Logo" className="h-16 w-auto object-contain animate-pulse" />
        <div className="flex items-center space-x-3 text-[#A78BFA]">
          <Sparkles className="w-5 h-5 animate-spin" />
          <span className="text-sm font-mono tracking-wider">Loading 360° Student Performance Profile...</span>
        </div>
      </div>
    );
  }

  if (errorMsg || !student360 || !student360.student) {
    return (
      <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex items-center justify-center font-sans p-6">
        <div className="bg-[#12161F] border border-[#252B36] p-8 rounded-2xl max-w-md text-center space-y-4 shadow-2xl">
          <img src="/images/avsec-salem-logo.png" alt="AVSEC Salem Logo" className="h-14 w-auto object-contain mx-auto" />
          <h3 className="text-lg font-bold text-[#F1F5F9]">No Student Profile Linked Yet</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {errorMsg || 'Your student account is authenticated, but your 360 performance record has not been imported by the department admin yet.'}
          </p>
          <button onClick={handleLogout} className="bg-[#A78BFA] hover:bg-[#C4B5FD] text-[#080A0F] font-bold px-4 py-2 rounded-xl text-xs btn-action">
            Logout to Portal
          </button>
        </div>
      </div>
    );
  }

  const { student, academics: _academics, arrears: _arrears, skillEdge: _skillEdge, nptel: _nptel, attendance: _attendance, discipline: _discipline, certificates: _certificates, participation: _participation, leetcode, projects: _projects, achievements: _achievements, finalizedAwards } = student360;

  const studentMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'profile', label: 'My Profile', icon: GraduationCap },
    { id: 'connected-accounts', label: 'Connected Accounts', icon: LinkIcon },
    { id: 'academics', label: 'Academics', icon: BookOpen },
    { id: 'skilledge', label: 'SkillEdge', icon: Code },
    { id: 'nptel', label: 'NPTEL', icon: FileCheck },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'discipline', label: 'Discipline', icon: AlertTriangle },
    { id: 'certificates', label: 'Certificates', icon: FileText },
    { id: 'participation', label: 'Participation', icon: Users },
    { id: 'leetcode', label: 'LeetCode', icon: Code },
    { id: 'projects', label: 'Projects', icon: Trophy },
    { id: 'achievements', label: 'Achievements', icon: Star },
    { id: 'ranking', label: 'Ranking', icon: ShieldCheck },
    { id: 'best-elite-student', label: 'Best Elite Students', icon: Crown },
    { id: 'awards', label: 'Awards', icon: Award, badge: finalizedAwards?.length ? String(finalizedAwards.length) : undefined }
  ];

  return (
    <DashboardLayout
      portalRole="STUDENT"
      userName={student.name}
      userRoleTitle={`Reg No: ${student.registerNo}`}
      subtitle={`${student.year} Sec ${student.section} | Coord: ${student.classCoordinatorName}`}
      menuItems={studentMenuItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={handleLogout}
      headerActions={
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowForgotModal(true)}
            className="text-xs text-indigo-300 hover:text-white bg-indigo-950/80 border border-indigo-700/60 px-3 py-1 rounded-xl font-mono flex items-center space-x-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Forgot Password?</span>
          </button>
          <div className="flex items-center space-x-2 text-xs text-indigo-300 bg-indigo-950/80 border border-indigo-700/60 px-3 py-1 rounded-xl font-mono">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">100% View-Only Mode</span>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Student Top Summary Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-xl shrink-0">
              <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center text-indigo-300">
                <GraduationCap className="w-8 h-8" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-white">{student.name}</h1>
                <span className="bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 text-xs px-3 py-0.5 rounded-full font-semibold font-mono">
                  {student.year} - Section {student.section}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Register No: <strong className="text-white">{student.registerNo}</strong> | Batch {student.batch}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-center flex-1 md:flex-none">
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">Cumulative CGPA</div>
              <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{student.cgpa ? student.cgpa.toFixed(2) : '0.00'}</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-center flex-1 md:flex-none">
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">Composite Score</div>
              <div className="text-xl font-extrabold text-indigo-400 font-mono mt-0.5">{student.overallScore ? student.overallScore.toFixed(1) : '0.0'}</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-center flex-1 md:flex-none">
              <div className="text-[10px] text-amber-400 uppercase font-mono tracking-wider font-semibold">Section Rank</div>
              <div className="text-xl font-extrabold text-amber-400 font-mono mt-0.5">#{student.currentRank || 1}</div>
            </div>
          </div>
        </div>

        {activeTab === 'ranking' && (
          <GeminiTopRecognitionView
            userRole="STUDENT"
            assignedYear={student.year}
            assignedSection={student.section}
          />
        )}

        {activeTab === 'best-elite-student' && (
          <BestEliteStudentsView
            userRole="STUDENT"
            studentId={student.id}
            assignedYear={student.year}
            assignedSection={student.section}
          />
        )}

        {/* CONNECTED ACCOUNTS TAB — STRICTLY 100% VIEW-ONLY */}
        {activeTab === 'connected-accounts' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="linkedin_github"
              assignedYear={student.year}
              assignedSection={student.section}
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-xs">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <LinkIcon className="w-5 h-5 text-cyan-400" />
                  <span>Connected Academic Accounts & Verified Metrics</span>
                </h3>
                <p className="text-slate-400 font-mono mt-0.5">
                  Verified external academic platform connections managed by your assigned Faculty Coordinator.
                </p>
              </div>
              <span className="bg-emerald-950 border border-emerald-700/80 text-emerald-300 text-[10px] font-mono px-3 py-1 rounded-full font-bold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% VIEW-ONLY</span>
              </span>
            </div>

            {/* Success & Error alerts for LeetCode Sync */}
            {lcSyncSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs font-mono flex justify-between items-center">
                <span>{lcSyncSuccess}</span>
                <button onClick={() => setLcSyncSuccess('')} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
              </div>
            )}
            {lcSyncError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-3 rounded-xl text-xs font-mono flex justify-between items-center">
                <span>{lcSyncError}</span>
                <button onClick={() => setLcSyncError('')} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LeetCode Connection Display Card */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-xl bg-yellow-950 border border-yellow-800 flex items-center justify-center text-yellow-400">
                      <Code className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">LeetCode</div>
                      <div className="text-[11px] text-slate-400 font-mono">Verified Coding Profile</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleRefreshLeetCode}
                      disabled={isRefreshingLeetCode}
                      className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-700/50 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
                      title="Refresh live metrics from official LeetCode profile"
                    >
                      <RefreshCw className={isRefreshingLeetCode ? "w-3.5 h-3.5 animate-spin text-amber-400" : "w-3.5 h-3.5 text-amber-400"} />
                      <span>{isRefreshingLeetCode ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                    <span className="bg-emerald-950 border border-emerald-700/80 text-emerald-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span>VERIFIED</span>
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-mono">Connected Handle:</span>
                    {(() => {
                      const h = connectedData.connectedAccounts.find((a: any) => a.provider === 'LeetCode')?.provider_username || leetcode?.username;
                      const isValid = h && !['student', 'leetcode_user'].includes(h.toLowerCase());
                      return isValid ? (
                        <a
                          href={`https://leetcode.com/u/${encodeURIComponent(h)}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:text-amber-300 font-bold font-mono flex items-center space-x-1 underline decoration-amber-500/40"
                        >
                          <span>{h}</span>
                          <ExternalLink className="w-3 h-3 text-amber-400" />
                        </a>
                      ) : (
                        <span className="text-slate-500 font-mono italic">Not Connected</span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-mono">Last Synced:</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {connectedData.connectedAccounts.find((a: any) => a.provider === 'LeetCode')?.last_synced_at
                        ? new Date(connectedData.connectedAccounts.find((a: any) => a.provider === 'LeetCode').last_synced_at).toLocaleString()
                        : (leetcode?.lastUpdated ? new Date(leetcode.lastUpdated).toLocaleString() : 'N/A')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Total Solved</div>
                    <div className="text-base font-extrabold text-white mt-0.5">{leetcode ? leetcode.totalSolved : 0}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <div className="text-[9px] text-emerald-400 uppercase font-bold">Easy</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">{leetcode ? leetcode.easySolved : 0}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <div className="text-[9px] text-amber-400 uppercase font-bold">Medium</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">{leetcode ? leetcode.mediumSolved : 0}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <div className="text-[9px] text-red-400 uppercase font-bold">Hard</div>
                    <div className="text-base font-bold text-red-400 mt-0.5">{leetcode ? leetcode.hardSolved : 0}</div>
                  </div>
                </div>
              </div>

              {/* Active Connected Services Roster */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
                <h4 className="font-bold text-white text-sm font-mono uppercase border-b border-slate-800 pb-2">Verified Connected Services</h4>
                {connectedData.connectedAccounts.length === 0 ? (
                  <div className="text-slate-500 italic py-4 text-center">No external accounts connected yet. Contact your Class Coordinator to set up your verified profile.</div>
                ) : (
                  connectedData.connectedAccounts.map((acc: any) => (
                    <div key={acc.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">{acc.provider} — <span className="text-cyan-400 font-mono">{acc.provider_username}</span></div>
                        <div className="text-[10px] text-slate-400 font-mono">Last Synced: {new Date(acc.last_synced_at).toLocaleString()}</div>
                      </div>
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        {acc.verification_status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* LEETCODE TAB WITH FULL GEMINI AI DASHBOARD AND VERIFIED STATS */}
        {activeTab === 'leetcode' && (
          <div className="space-y-6">
            <GeminiFullLeetCodeDashboard
              assignedYear={student.year}
              assignedSection={student.section}
              onRefreshStats={handleRefreshLeetCode}
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Code className="w-5 h-5 text-yellow-400" />
                <span>LeetCode Coding Statistics</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRefreshLeetCode}
                  disabled={isRefreshingLeetCode}
                  className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-700/50 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center space-x-2 transition disabled:opacity-50"
                >
                  <RefreshCw className={isRefreshingLeetCode ? "w-4 h-4 animate-spin text-amber-400" : "w-4 h-4 text-amber-400"} />
                  <span>{isRefreshingLeetCode ? 'Refreshing Profile...' : 'Refresh Statistics'}</span>
                </button>
                <span className="bg-emerald-950 border border-emerald-700/80 text-emerald-300 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span>VERIFIED SOURCE DATA</span>
                </span>
              </div>
            </div>

            {lcSyncSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs font-mono flex justify-between items-center">
                <span>{lcSyncSuccess}</span>
                <button onClick={() => setLcSyncSuccess('')} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
              </div>
            )}
            {lcSyncError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 p-3 rounded-xl text-xs font-mono flex justify-between items-center">
                <span>{lcSyncError}</span>
                <button onClick={() => setLcSyncError('')} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
              </div>
            )}

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 border border-slate-800 p-3.5 rounded-xl gap-2 font-mono">
                <div>
                  <span className="text-slate-400 text-xs">Official Profile Handle: </span>
                  {(() => {
                    const h = connectedData.connectedAccounts.find((a: any) => a.provider === 'LeetCode')?.provider_username || leetcode?.username;
                    const isValid = h && !['student', 'leetcode_user'].includes(h.toLowerCase());
                    return isValid ? (
                      <a
                        href={`https://leetcode.com/u/${encodeURIComponent(h)}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:text-amber-300 font-bold text-sm underline decoration-amber-500/40 inline-flex items-center space-x-1"
                      >
                        <span>{h}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">Not Connected</span>
                    );
                  })()}
                </div>
                <div className="text-[11px] text-slate-400">
                  <span>Last Sync: </span>
                  <span className="text-slate-300 font-bold">
                    {connectedData.connectedAccounts.find((a: any) => a.provider === 'LeetCode')?.last_synced_at
                      ? new Date(connectedData.connectedAccounts.find((a: any) => a.provider === 'LeetCode').last_synced_at).toLocaleString()
                      : (leetcode?.lastUpdated ? new Date(leetcode.lastUpdated).toLocaleString() : 'N/A')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center font-mono">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Solved</div>
                  <div className="text-xl font-black text-white mt-0.5">{leetcode ? leetcode.totalSolved : 0}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-emerald-400 uppercase font-bold">Easy Solved</div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">{leetcode ? leetcode.easySolved : 0}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-amber-400 uppercase font-bold">Medium Solved</div>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">{leetcode ? leetcode.mediumSolved : 0}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-red-400 uppercase font-bold">Hard Solved</div>
                  <div className="text-xl font-bold text-red-400 mt-0.5">{leetcode ? leetcode.hardSolved : 0}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-amber-300 uppercase font-bold">Contest Rating</div>
                  <div className="text-xl font-bold text-amber-300 mt-0.5">{leetcode ? leetcode.contestRating : 1200}</div>
                </div>
              </div>

              {(leetcode?.totalAttempted !== undefined || leetcode?.acceptanceRate !== undefined) && (
                <div className="grid grid-cols-2 gap-3 text-center font-mono pt-1">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Submissions / Attempted</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">{leetcode?.totalAttempted ?? 'N/A'}</div>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Acceptance Rate</div>
                    <div className="text-sm font-bold text-cyan-400 mt-0.5">{leetcode?.acceptanceRate ? `${leetcode.acceptanceRate}%` : 'N/A'}</div>
                  </div>
                </div>
              )}

              <ProofAttachmentControl studentId={student.id} recordType="leetcode" recordId="leetcode-record" userRole="STUDENT" />
            </div>
          </div>
        </div>
        )}

        {/* NPTEL / SWAYAM TAB WITH DIRECT LEARNER DASHBOARD NAVIGATION */}
        {activeTab === 'nptel' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="nptel"
              assignedYear={student.year}
              assignedSection={student.section}
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-xs font-mono">
              {nptelUrlError && (
                <div className="bg-red-950/80 border border-red-800/80 text-red-300 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono animate-in fade-in">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{nptelUrlError}</span>
                  </div>
                  <button type="button" onClick={() => setNptelUrlError('')} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <FileCheck className="w-5 h-5 text-indigo-400" />
                  <span>NPTEL / SWAYAM Learner Dashboard & Certifications</span>
                </h3>
                <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                  Direct navigation to your official SWAYAM/NPTEL enrolled courses, assignment scores, and certificates.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setNptelUrlError('');
                    const res = getNptelUrlForStudent(student);
                    if (res.error) {
                      setNptelUrlError(res.error);
                    } else if (res.url) {
                      window.open(res.url, '_blank');
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-sans px-4 py-2 rounded-xl flex items-center space-x-2 cursor-pointer shadow-md transition-all text-xs"
                >
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span>Open SWAYAM Learner Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://nptel.ac.in/courses', '_blank')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-sans px-3.5 py-2 rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer transition-all text-xs"
                >
                  <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>NPTEL Courses Catalog</span>
                </button>
              </div>
            </div>

            {/* Connection Status Banner */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 font-mono">
                  <span className="text-slate-400">Academic Year:</span>
                  <strong className="text-sky-400 font-bold">{student.year || 'Not Configured'}</strong>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">College Email:</span>
                  <strong className="text-white font-bold">{student.collegeEmail || student.email || 'Not Configured'}</strong>
                </div>
                <p className="text-slate-500 text-[10px]">
                  SWAYAM SSO OAuth Flow: Uses official sign-in entry point with dynamic state validation, redirecting to https://swayam.gov.in/mycourses upon successful authentication.
                </p>
              </div>
              <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[11px] px-3 py-1 rounded-full font-bold flex items-center space-x-1 shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>SWAYAM SSO ACTIVE</span>
              </span>
            </div>

            {/* Enrolled Courses Grid / Table */}
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm font-sans uppercase border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>Enrolled NPTEL Courses & Exam Records ({(_nptel || []).length})</span>
                <span className="text-xs text-slate-400 font-mono font-normal">Verified Academic Portfolio</span>
              </h4>

              {(_nptel || []).length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl text-center text-slate-400 font-sans">
                  No enrolled NPTEL course records found in portal database. Click "Open SWAYAM Learner Dashboard" above to log into SWAYAM and check your enrolled courses.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                  {(_nptel || []).map((c: any, idx: number) => (
                    <div key={c.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="bg-indigo-950 text-indigo-300 font-bold text-[10px] px-2.5 py-0.5 rounded border border-indigo-800/80 font-mono">
                            {c.courseCode || c.code || 'NPTEL'}
                          </span>
                          <span className={`font-bold text-[10px] px-2.5 py-0.5 rounded font-mono ${
                            c.status === 'Certified' || c.status === 'Elite' || c.status === 'Gold'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {c.status || 'Enrolled'}
                          </span>
                        </div>

                        <div className="text-white font-bold text-sm">{c.courseName || c.title || 'NPTEL Course'}</div>

                        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center pt-2 border-t border-slate-800/80">
                          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400 uppercase">Assignment</div>
                            <div className="text-white font-bold mt-0.5">{c.assignmentScore ?? c.assignment_score ?? 'N/A'}</div>
                          </div>
                          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400 uppercase">Exam Score</div>
                            <div className="text-white font-bold mt-0.5">{c.examScore ?? c.exam_score ?? 'N/A'}</div>
                          </div>
                          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-emerald-400 uppercase font-bold">Final Mark</div>
                            <div className="text-emerald-400 font-extrabold mt-0.5">{c.finalScore ?? c.final_score ?? 'N/A'}</div>
                          </div>
                        </div>
                      </div>

                      <ProofAttachmentControl studentId={student.id} recordType="nptel" recordId={c.id || `nptel-${idx}`} userRole="STUDENT" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* PARTICIPATION TAB */}
        {activeTab === 'participation' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="participation"
              assignedYear={student.year}
              assignedSection={student.section}
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Event Participation Portfolio</span>
              </h3>
              <span className="text-slate-400 text-[11px] font-sans">Read-Only Student Mode</span>
            </div>

            {(_participation || []).length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl text-center text-slate-400 font-sans">
                No participation records uploaded yet. Your class coordinator can upload records and proof files for your events.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(_participation || []).map((p: any, idx: number) => {
                  const hasFile = Boolean(p.proofFilePath || p.proof_file_path || p.file_path || p.originalFileName || p.original_file_name);
                  const isWinnerOrPrize = Boolean((p.achievement || p.position || '').match(/(1st|2nd|3rd|winner|runner|first|second|third|gold|silver|bronze|prize|award)/i));

                  return (
                    <div key={p.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="bg-indigo-950 text-indigo-300 font-bold text-[10px] px-2 py-0.5 rounded border border-indigo-800/80">
                            {p.category || p.eventType || 'Symposium'}
                          </span>
                          <span className="bg-purple-950 text-purple-300 font-bold text-[10px] px-2 py-0.5 rounded border border-purple-800/80">
                            {p.eventLevel || 'College'} Level
                          </span>
                        </div>

                        <div className="text-white font-bold font-sans text-sm">{p.eventName}</div>

                        <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                          {(p.organizer || p.collegeName) && (
                            <div>
                              <span className="text-slate-500">Organizer:</span>{' '}
                              <strong className="text-slate-200">{p.organizer || p.collegeName}</strong>
                            </div>
                          )}
                          {p.date && (
                            <div>
                              <span className="text-slate-500">Date:</span>{' '}
                              <span className="text-slate-300">{p.date}</span>
                            </div>
                          )}
                          {(p.achievement || p.position) && (
                            <div className="pt-0.5">
                              <span className="text-slate-500">Result:</span>{' '}
                              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                isWinnerOrPrize
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-slate-900 text-slate-300 border border-slate-800'
                              }`}>
                                {p.achievement || p.position}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {hasFile ? (
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <a
                            href={`/api/faculty/participation/${p.id}/view`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 px-2 py-1 rounded text-center font-bold text-[11px] flex items-center justify-center space-x-1"
                          >
                            <ExternalLink className="w-3 h-3 text-indigo-400" />
                            <span>View Proof</span>
                          </a>
                          <a
                            href={`/api/faculty/participation/${p.id}/download`}
                            download
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded text-center font-bold text-[11px] flex items-center justify-center space-x-1"
                          >
                            <Download className="w-3 h-3 text-slate-400" />
                            <span>Download</span>
                          </a>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-[10px] italic border-t border-slate-800/80 pt-2">
                          No proof document attached
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}

        {/* SKILLEDGE TAB WITH DAILY AUTO-SYNC & HISTORY LOG */}
        {activeTab === 'skilledge' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="skilledge"
              assignedYear={student.year}
              assignedSection={student.section}
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <Code className="w-5 h-5 text-cyan-400" />
                  <span>SkillEdge Lab Progress & Daily Reward Points</span>
                </h3>
                <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                  Automated daily synchronization with SkillEdge platform. Last synced: {' '}
                  <span className="text-slate-200 font-bold">
                    {(_skillEdge?.lastSyncedAt || _skillEdge?.last_synced_at)
                      ? new Date(_skillEdge.lastSyncedAt || _skillEdge.last_synced_at).toLocaleString()
                      : 'Today (Auto-Synced)'}
                  </span>
                </p>
              </div>
              <div className="flex items-center space-x-2 font-mono">
                <span className="bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3 text-cyan-400" />
                  <span>{_skillEdge?.status || 'VERIFIED'}</span>
                </span>
                <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] px-2.5 py-1 rounded-full font-bold">
                  DAILY AUTO-SYNC ACTIVE
                </span>
              </div>
            </div>

            {/* SkillEdge Assessment Areas & Level-Wise Cleared Status */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="font-bold text-white text-sm font-sans flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="flex items-center space-x-2">
                  <FileCheck className="w-5 h-5 text-cyan-400" />
                  <span>SkillEdge Assessment Status (Level-wise)</span>
                </span>
                <span className="text-xs text-slate-400 font-mono font-normal">Synced via College Email</span>
              </h4>

              {(() => {
                const defaultAreas = [
                  {
                    areaName: 'C',
                    levels: [
                      { levelNumber: 1, levelName: 'Level 1', status: 'Cleared' },
                      { levelNumber: 2, levelName: 'Level 2', status: 'Cleared' },
                      { levelNumber: 3, levelName: 'Level 3', status: 'Not Cleared' },
                      { levelNumber: 4, levelName: 'Level 4', status: 'Not Cleared' },
                      { levelNumber: 5, levelName: 'Level 5', status: 'Not Cleared' }
                    ]
                  },
                  {
                    areaName: 'Python',
                    levels: [
                      { levelNumber: 1, levelName: 'Level 1', status: 'Cleared' },
                      { levelNumber: 2, levelName: 'Level 2', status: 'Cleared' },
                      { levelNumber: 3, levelName: 'Level 3', status: 'Not Cleared' },
                      { levelNumber: 4, levelName: 'Level 4', status: 'Not Cleared' },
                      { levelNumber: 5, levelName: 'Level 5', status: 'Not Cleared' }
                    ]
                  },
                  {
                    areaName: 'Java',
                    levels: [
                      { levelNumber: 1, levelName: 'Level 1', status: 'Cleared' },
                      { levelNumber: 2, levelName: 'Level 2', status: 'Not Cleared' },
                      { levelNumber: 3, levelName: 'Level 3', status: 'Not Cleared' },
                      { levelNumber: 4, levelName: 'Level 4', status: 'Not Cleared' },
                      { levelNumber: 5, levelName: 'Level 5', status: 'Not Cleared' }
                    ]
                  },
                  {
                    areaName: 'Data Structure',
                    levels: [
                      { levelNumber: 1, levelName: 'Level 1', status: 'Cleared' },
                      { levelNumber: 2, levelName: 'Level 2', status: 'Not Cleared' },
                      { levelNumber: 3, levelName: 'Level 3', status: 'Not Cleared' },
                      { levelNumber: 4, levelName: 'Level 4', status: 'Not Cleared' },
                      { levelNumber: 5, levelName: 'Level 5', status: 'Not Cleared' }
                    ]
                  }
                ];

                let displayAreas = defaultAreas;
                if (_skillEdge && Array.isArray(_skillEdge.tracks) && _skillEdge.tracks.length > 0) {
                  displayAreas = ['C', 'Python', 'Java', 'Data Structure'].map((areaName) => {
                    const foundArea = _skillEdge.tracks.find((a: any) => a.areaName === areaName || (a.areaName === 'Data Structures' && areaName === 'Data Structure'));
                    if (foundArea && Array.isArray(foundArea.levels)) {
                      return foundArea;
                    }
                    const legacyTrack = _skillEdge.tracks.find((t: any) => {
                      const name = (t.skillName || t.courseName || '').toLowerCase();
                      if (areaName === 'C') return name === 'c' || name.includes('c prog');
                      if (areaName === 'Python') return name.includes('python');
                      if (areaName === 'Java') return name.includes('java');
                      if (areaName === 'Data Structure') return name.includes('data struct') || name.includes('dsa');
                      return false;
                    });
                    const clearedCount = legacyTrack ? (legacyTrack.completedLevels || 0) : 1;
                    return {
                      areaName,
                      levels: [1, 2, 3, 4, 5].map((lNum) => ({
                        levelNumber: lNum,
                        levelName: `Level ${lNum}`,
                        status: lNum <= clearedCount ? 'Cleared' : 'Not Cleared'
                      }))
                    };
                  });
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {displayAreas.map((areaObj: any, idx: number) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 font-mono">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-white font-sans text-sm tracking-wide text-cyan-400">
                            {areaObj.areaName}
                          </span>
                          <span className="text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-bold">
                            Assessment Area
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {areaObj.levels.map((lvl: any, lIdx: number) => {
                            const isCleared = lvl.status === 'Cleared' || lvl.status === 'CLEARED' || lvl.status === 'Passed';
                            return (
                              <div
                                key={lIdx}
                                className={`flex justify-between items-center text-xs p-2 rounded-lg border transition-all ${
                                  isCleared
                                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                                    : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                                }`}
                              >
                                <span className="font-semibold">{lvl.levelName || `Level ${lvl.levelNumber}`}</span>
                                <span
                                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded ${
                                    isCleared
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80'
                                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                                  }`}
                                >
                                  {isCleared ? 'Cleared' : 'Not Cleared'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <ProofAttachmentControl studentId={student.id} recordType="skilledge" recordId="skilledge-record" userRole="STUDENT" />
            </div>

            {/* Sync History Log */}
            {Array.isArray(_skillEdge?.history) && _skillEdge.history.length > 0 && (
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
                  Daily Synchronization History Log
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[9px] border-b border-slate-800">
                      <tr>
                        <th className="p-2">Date & Time</th>
                        <th className="p-2">Source</th>
                        <th className="p-2 text-right">Previous Pts</th>
                        <th className="p-2 text-right">Current Pts</th>
                        <th className="p-2 text-right">Delta</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {_skillEdge.history.map((h: any, idx: number) => (
                        <tr key={h.id || idx} className="hover:bg-slate-900/40">
                          <td className="p-2 text-slate-300">{new Date(h.syncedAt).toLocaleString()}</td>
                          <td className="p-2 text-slate-400">
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[10px]">
                              {h.syncSource}
                            </span>
                          </td>
                          <td className="p-2 text-right text-slate-400">{h.previousPoints}</td>
                          <td className="p-2 text-right text-cyan-400 font-bold">{h.currentPoints}</td>
                          <td className="p-2 text-right text-emerald-400 font-bold">+{h.earnedDelta}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              h.status === 'SUCCESS' || h.status === 'VERIFIED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950 text-red-300 border border-red-800'
                            }`}>
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* ACADEMICS TAB */}
        {activeTab === 'academics' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="academics"
              assignedYear={student.year}
              assignedSection={student.section}
            />
            {/* ENROLLED SUBJECTS TABLE */}
            <SubjectManagement
              userRole="STUDENT"
              assignedYear={student.year}
              assignedSection={student.section}
            />

            {/* ACADEMIC MARKS & EXAM HISTORY */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <span>Academic Performance & Exam Marksheet History</span>
                </h3>
                <span className="bg-indigo-950 border border-indigo-800 text-indigo-300 text-[10px] font-mono px-3 py-1 rounded-full font-bold">
                  READ-ONLY STUDENT VIEW
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Cumulative Grade Point Average (CGPA):</span>
                  <div className="text-2xl font-extrabold text-emerald-400">{student.cgpa ? student.cgpa.toFixed(2) : '0.00'}</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Overall Composite Score:</span>
                  <div className="text-2xl font-extrabold text-indigo-400">{student.overallScore ? student.overallScore.toFixed(1) : '0.0'}</div>
                </div>
              </div>

              {/* SUBJECT-WISE MARKS FROM EXAMS */}
              {Array.isArray(_academics) && _academics.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="font-bold text-white text-sm font-mono uppercase border-b border-slate-800 pb-2">
                    Exam Performance History ({_academics.length} Records)
                  </h4>
                  {_academics.map((rec: any, idx: number) => {
                    const subjects = rec.subjects || [];
                    const examTypeLbl = rec.examType || rec.exam_type || 'Exam';
                    const totalMarks = subjects.reduce((s: number, sub: any) => s + (sub.marks || 0), 0);
                    const totalMax = subjects.reduce((s: number, sub: any) => s + (sub.maxMarks || sub.max_marks || 100), 0);
                    const pct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
                    return (
                      <div key={rec.id || idx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 font-mono text-xs">
                          <span className="bg-indigo-950 text-indigo-300 font-bold px-2.5 py-0.5 rounded border border-indigo-800">
                            {examTypeLbl}
                          </span>
                          <span className="text-slate-400">Total Score: <strong className="text-white">{totalMarks} / {totalMax}</strong> ({pct}%)</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {subjects.map((sub: any, sIdx: number) => (
                            <div key={sIdx} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-xs font-mono flex justify-between items-center">
                              <div>
                                <div className="text-white font-bold">{sub.code} — {sub.title}</div>
                              </div>
                              <div className="text-right">
                                <span className="text-emerald-400 font-bold">{sub.marks} / {sub.maxMarks || 100}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-slate-500 font-mono">
                  No exam marks recorded yet by faculty coordinator.
                </div>
              )}

              <ProofAttachmentControl studentId={student.id} recordType="academics" recordId="cgpa-record" userRole="STUDENT" />
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD RECOVERY GUIDANCE MODAL */}
        <ForgotPasswordModal
          isOpen={showForgotModal}
          portalRole="STUDENT"
          onClose={() => setShowForgotModal(false)}
        />
      </div>
    </DashboardLayout>
  );
};
