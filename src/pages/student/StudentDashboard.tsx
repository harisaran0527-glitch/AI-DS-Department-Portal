import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, openAuthenticatedFile, clearSessionAuth } from '../../services/api';
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
  Download,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

import { ForgotPasswordModal } from '../../components/common/ForgotPasswordModal';
import { SubjectManagement } from '../../components/academic/SubjectManagement';
import { BestEliteStudentsView } from '../../components/elite/BestEliteStudentsView';
import { GeminiTopRecognitionView } from '../../components/ranking/GeminiTopRecognitionView';
import { GeminiCategoryBestPerformerCard } from '../../components/ranking/GeminiCategoryBestPerformerCard';
import { GeminiFullLeetCodeDashboard } from '../../components/ranking/GeminiFullLeetCodeDashboard';
import { StudentAiRewardCard } from '../../components/ranking/StudentAiRewardCard';
import { StudentDisciplineView } from '../../components/discipline/StudentDisciplineView';
import { getNptelUrlForStudent } from '../../services/nptelUrlHelper';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [_session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [student360, setStudent360] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
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

  // First Login Password Change State
  const [showFirstLoginChangeModal, setShowFirstLoginChangeModal] = useState(false);
  const [changeCurrPass, setChangeCurrPass] = useState('');
  const [changeNewPass, setChangeNewPass] = useState('');
  const [changeConfirmPass, setChangeConfirmPass] = useState('');
  const [changePassError, setChangePassError] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const [loadingSlow, setLoadingSlow] = useState<boolean>(false);

  const fetchProfile = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    setLoadingSlow(false);

    let isDone = false;
    // Safety watchdog: ensure loading screen NEVER hangs indefinitely (max 8s)
    const slowTimer = setTimeout(() => {
      if (!isDone) setLoadingSlow(true);
    }, 3000);
    const watchdogTimer = setTimeout(() => {
      if (!isDone) {
        setIsLoading(false);
        setErrorMsg('Loading 360° Profile timed out. The server may be waking up or busy. Please retry.');
      }
    }, 8000);

    try {
      // 1. Parallelize authentication check and essential 360 profile load
      const [meRes, full360] = await Promise.all([
        API.getMe('STUDENT'),
        API.getStudentSelfProfile({ timeoutMs: 7000 })
      ]);

      if (!meRes.user || meRes.user.role !== 'STUDENT') {
        isDone = true;
        clearTimeout(slowTimer);
        clearTimeout(watchdogTimer);
        clearSessionAuth('STUDENT');
        navigate('/student', { replace: true });
        return;
      }

      setSession(meRes.user);
      if (meRes.user.requiresPasswordChange) {
        setShowFirstLoginChangeModal(true);
      }

      // Essential student 360 profile data is ready - render dashboard immediately!
      setStudent360(full360);
      setIsLoading(false);
      isDone = true;
      clearTimeout(slowTimer);
      clearTimeout(watchdogTimer);

      // 2. Load secondary non-critical data in background without blocking dashboard display
      API.getConnectedAccounts()
        .then(connRes => setConnectedData(connRes))
        .catch(() => setConnectedData({ connectedAccounts: [], externalMetrics: [] }));
    } catch (err: any) {
      isDone = true;
      clearTimeout(slowTimer);
      clearTimeout(watchdogTimer);
      console.error('Error loading Student 360 profile:', err);

      const isAuthError = err?.status === 401 ||
        err?.status === 403 ||
        err?.message?.toLowerCase().includes('session expired') ||
        err?.message?.toLowerCase().includes('unauthorized') ||
        err?.message?.toLowerCase().includes('sign in again') ||
        err?.message?.toLowerCase().includes('different portal');

      if (isAuthError) {
        clearSessionAuth('STUDENT');
        navigate('/student', { replace: true });
        return;
      }

      setErrorMsg(err.message || 'Failed to load student profile. Please check your connection and retry.');
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = async () => {
    try {
      await API.logout('STUDENT');
    } catch (error) {
      console.warn('Backend logout unavailable, clearing local session:', error);
    } finally {
      clearSessionAuth('STUDENT');
      navigate('/student', { replace: true });
    }
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

  const handleViewParticipation = (partId: string) => {
    void openAuthenticatedFile(`/faculty/participation/${encodeURIComponent(partId)}/view`, 'STUDENT')
      .catch(error => alert(error instanceof Error ? error.message : 'Attachment could not be loaded.'));
  };

  const handleDownloadParticipation = (partId: string, filename?: string) => {
    void openAuthenticatedFile(`/faculty/participation/${encodeURIComponent(partId)}/download`, 'STUDENT', { download: true, filename })
      .catch(error => alert(error instanceof Error ? error.message : 'Attachment could not be loaded.'));
  };

  const handleViewCertificate = (certId: string) => {
    void openAuthenticatedFile(`/faculty/certificates/${encodeURIComponent(certId)}/view`, 'STUDENT')
      .catch(error => alert(error instanceof Error ? error.message : 'Attachment could not be loaded.'));
  };

  const handleDownloadCertificate = (certId: string, filename?: string) => {
    void openAuthenticatedFile(`/faculty/certificates/${encodeURIComponent(certId)}/download`, 'STUDENT', { download: true, filename })
      .catch(error => alert(error instanceof Error ? error.message : 'Attachment could not be loaded.'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex flex-col items-center justify-center font-sans space-y-4 p-4 text-center">
        <img src="/images/avsec-salem-logo.png" alt="AVSEC Salem Logo" className="h-9 w-auto max-h-9 max-w-[36px] object-contain animate-pulse" />
        <div className="flex items-center space-x-3 text-[#A78BFA]">
          <Sparkles className="w-5 h-5 animate-spin" />
          <span className="text-sm font-mono tracking-wider">Loading 360° Student Performance Profile...</span>
        </div>
        {loadingSlow && (
          <p className="text-xs text-slate-400 font-mono animate-fade-in max-w-sm">
            Connecting to secure database... (taking longer than usual, please wait)
          </p>
        )}
      </div>
    );
  }

  if (errorMsg || !student360 || !student360.student) {
    const isTimeoutOrNetwork = Boolean(
      errorMsg && (
        errorMsg.toLowerCase().includes('timeout') ||
        errorMsg.toLowerCase().includes('network') ||
        errorMsg.toLowerCase().includes('failed to fetch') ||
        errorMsg.toLowerCase().includes('gateway') ||
        errorMsg.toLowerCase().includes('504') ||
        errorMsg.toLowerCase().includes('503') ||
        errorMsg.toLowerCase().includes('502')
      )
    );

    return (
      <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex items-center justify-center font-sans p-6">
        <div className="bg-[#12161F] border border-[#252B36] p-8 rounded-2xl max-w-md text-center space-y-4 shadow-2xl">
          <img src="/images/avsec-salem-logo.png" alt="AVSEC Salem Logo" className="h-9 w-auto max-h-9 max-w-[36px] object-contain mx-auto" />
          <h3 className="text-lg font-bold text-[#F1F5F9]">
            {isTimeoutOrNetwork ? 'Connection / Loading Issue' : 'No Student Profile Linked Yet'}
          </h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {errorMsg || 'Your student account is authenticated, but your 360 performance record has not been imported by the department admin yet.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fetchProfile()}
              className="bg-[#A78BFA] hover:bg-[#C4B5FD] text-[#080A0F] font-bold px-4 py-2 rounded-xl text-xs btn-action flex items-center space-x-1.5 cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Loading Profile</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors"
            >
              Logout to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { student, academics: _academics, arrears: _arrears, skillEdge: _skillEdge, nptel: _nptel, attendance: _attendance, discipline: _discipline, certificates: _certificates, participation: _participation, leetcode, projects: _projects, achievements: _achievements, finalizedAwards } = student360;

  const registerNoDisplay = student.registerNo || student.register_no || (_session as any)?.identifier || (_session as any)?.registerNo || 'N/A';
  const coordinatorDisplay = student.classCoordinatorName || (student as any).class_coordinator_name || 'Assigned Faculty';
  const cgpaDisplay = (student.cgpa !== null && student.cgpa !== undefined && String(student.cgpa).trim() !== '' && !isNaN(Number(student.cgpa)))
    ? Number(student.cgpa).toFixed(2)
    : 'N/A';
  const scoreDisplay = typeof student.overallScore === 'number'
    ? student.overallScore.toFixed(1)
    : typeof (student as any).overall_score === 'number'
      ? (student as any).overall_score.toFixed(1)
      : '0.0';
  const rankVal = student.currentRank ?? (student as any).current_rank;
  const rankDisplay = (typeof rankVal === 'number' && rankVal > 0 && rankVal < 99)
    ? `#${rankVal}`
    : 'Unranked';

  const studentMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'profile', label: 'My Profile', icon: GraduationCap },
    { id: 'connected-accounts', label: 'Connected Accounts', icon: LinkIcon },
    { id: 'academics', label: 'Academics', icon: BookOpen },
    { id: 'skilledge', label: 'SkillEdge', icon: Code },
    { id: 'nptel', label: 'NPTEL', icon: FileCheck },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'discipline', label: 'Discipline', icon: ShieldAlert },
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
      userRoleTitle={`Reg No: ${registerNoDisplay}`}
      subtitle={`${student.year} Sec ${student.section} | Coord: ${coordinatorDisplay}`}
      menuItems={studentMenuItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={handleLogout}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowForgotModal(true)}
            className="min-h-[44px] text-xs text-indigo-300 hover:text-white bg-indigo-950/80 border border-indigo-700/60 px-3.5 py-2 rounded-xl font-mono flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Forgot Password?</span>
          </button>
          <div className="min-h-[44px] flex items-center space-x-2 text-xs text-indigo-300 bg-indigo-950/80 border border-indigo-700/60 px-3.5 py-2 rounded-xl font-mono">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">100% View-Only Mode</span>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Student Top Summary Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-xl shrink-0">
              <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center text-indigo-300">
                <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white">{student.name}</h1>
                <span className="bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full font-semibold font-mono">
                  {student.year} - Section {student.section}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-mono mt-0.5">
                Register No: <strong className="text-white">{registerNoDisplay}</strong> | Batch {student.batch}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-4 w-full md:w-auto">
            <div className="bg-slate-950 border border-slate-800 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-center flex-1 md:flex-none">
              <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">CGPA</div>
              <div className="text-base sm:text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{cgpaDisplay}</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-center flex-1 md:flex-none">
              <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">Score</div>
              <div className="text-base sm:text-xl font-extrabold text-indigo-400 font-mono mt-0.5">{scoreDisplay}</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-center flex-1 md:flex-none">
              <div className="text-[9px] sm:text-[10px] text-amber-400 uppercase font-mono tracking-wider font-semibold">Rank</div>
              <div className="text-base sm:text-xl font-extrabold text-amber-400 font-mono mt-0.5">{rankDisplay}</div>
            </div>
          </div>
        </div>

        {activeTab === 'discipline' && <StudentDisciplineView records={_discipline} />}

        {(activeTab === 'dashboard' || activeTab === 'awards') && (
          <StudentAiRewardCard studentId={student.id} />
        )}

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

        {/* CERTIFICATES TAB */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="certificates"
              assignedYear={student.year}
              assignedSection={student.section}
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <FileText className="w-5 h-5 text-sky-400" />
                  <span>Technical & Course Certificates</span>
                </h3>
                <span className="text-slate-400 text-[11px] font-sans">Read-Only Student Portfolio</span>
              </div>

              {(_certificates || []).length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl text-center text-slate-400 font-sans">
                  No technical certificates uploaded yet. Your class coordinator can verify and upload certificates for your profile.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {(_certificates || []).map((c: any, idx: number) => {
                    const hasFile = Boolean(c.filePath || c.file_path || c.proofFilePath || c.proof_file_path || c.originalFileName || c.original_file_name);
                    return (
                      <div key={c.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="bg-sky-950 text-sky-300 font-bold text-[10px] px-2 py-0.5 rounded border border-sky-800/80">
                              {c.category || 'Technical Certification'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">{c.platform}</span>
                          </div>
                          <div className="text-white font-bold font-sans text-sm">{c.courseName || c.course_name}</div>
                          <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                            {(c.issueDate || c.issue_date) && (
                              <div>
                                <span className="text-slate-500">Issued:</span>{' '}
                                <span className="text-slate-300">{c.issueDate || c.issue_date}</span>
                              </div>
                            )}
                            {(c.certificateId || c.certificate_id) && (
                              <div>
                                <span className="text-slate-500">Cert ID:</span>{' '}
                                <span className="text-slate-300">{c.certificateId || c.certificate_id}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {hasFile ? (
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewCertificate(c.id)}
                              className="flex-1 bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800/80 px-2 py-1 rounded text-center font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3 text-sky-400" />
                              <span>View File</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadCertificate(c.id, c.originalFileName || c.original_file_name)}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded text-center font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3 text-slate-400" />
                              <span>Download</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-slate-500 text-[10px] italic border-t border-slate-800/80 pt-2">
                            No document file attached
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
                          <button
                            type="button"
                            onClick={() => handleViewParticipation(p.id)}
                            className="flex-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 px-2 py-1 rounded text-center font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3 text-indigo-400" />
                            <span>View Proof</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadParticipation(p.id, p.originalFileName || p.original_file_name)}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded text-center font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3 text-slate-400" />
                            <span>Download</span>
                          </button>
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

        {/* ATTENDANCE TAB (VIEW-ONLY FOR STUDENT) */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="attendance"
              assignedYear={student.year}
              assignedSection={student.section}
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-xs font-mono">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    <span>My Attendance Record & History</span>
                  </h3>
                  <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                    View-only student portal. Attendance records are updated via official faculty monthly bulk imports and daily logs.
                  </p>
                </div>
                <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[11px] px-3 py-1 rounded-full font-bold flex items-center space-x-1 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>READ-ONLY VIEW</span>
                </span>
              </div>

              {/* OVERALL SUMMARY STAT METRIC CARDS */}
              {(() => {
                const totalWorking = _attendance?.totalWorkingDays ?? _attendance?.total_working_days ?? 0;
                const presentDays = _attendance?.presentDays ?? _attendance?.present_days ?? 0;
                const absentDays = _attendance?.absentDays ?? _attendance?.absent_days ?? 0;
                const odDays = _attendance?.odDays ?? _attendance?.od_days ?? 0;
                const mlDays = _attendance?.mlDays ?? _attendance?.ml_days ?? 0;
                const pct = _attendance?.percentage ?? 0;

                let pctBadgeStyle = 'bg-emerald-950 text-emerald-300 border-emerald-800';
                if (pct < 65) pctBadgeStyle = 'bg-red-950 text-red-300 border-red-800';
                else if (pct < 75) pctBadgeStyle = 'bg-amber-950 text-amber-300 border-amber-800';

                return (
                  <div className="space-y-4 font-mono">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Total Working Days</div>
                        <div className="text-xl font-black text-white mt-1">{totalWorking}</div>
                      </div>
                      <div className="bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-emerald-400 font-mono uppercase font-bold flex items-center justify-between">
                          <span>P</span>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="text-xl font-black text-emerald-300 mt-1">{presentDays}</div>
                      </div>
                      <div className="bg-red-950/40 border border-red-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-red-400 font-mono uppercase font-bold flex items-center justify-between">
                          <span>A</span>
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        </div>
                        <div className="text-xl font-black text-red-300 mt-1">{absentDays}</div>
                      </div>
                      <div className="bg-amber-950/40 border border-amber-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-amber-400 font-mono uppercase font-bold flex items-center justify-between">
                          <span>ON</span>
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="text-xl font-black text-amber-300 mt-1">{odDays}</div>
                      </div>
                      <div className="bg-sky-950/40 border border-sky-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-sky-400 font-mono uppercase font-bold flex items-center justify-between">
                          <span>ML</span>
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                        </div>
                        <div className="text-xl font-black text-sky-300 mt-1">{mlDays}</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Attendance %</div>
                        <div className="mt-1">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-extrabold border ${pctBadgeStyle}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {totalWorking > 0 && (
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden flex border border-slate-800">
                        <div style={{ width: `${(presentDays / totalWorking) * 100}%` }} className="bg-emerald-500 h-full" title={`P: ${presentDays}`} />
                        <div style={{ width: `${(absentDays / totalWorking) * 100}%` }} className="bg-red-500 h-full" title={`A: ${absentDays}`} />
                        <div style={{ width: `${(odDays / totalWorking) * 100}%` }} className="bg-amber-500 h-full" title={`ON: ${odDays}`} />
                        <div style={{ width: `${(mlDays / totalWorking) * 100}%` }} className="bg-sky-500 h-full" title={`ML: ${mlDays}`} />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* DAILY DATE-WISE ATTENDANCE LOG TABLE */}
              <div className="space-y-3 font-mono">
                <h4 className="font-bold text-white text-sm font-sans uppercase border-b border-slate-800 pb-2 flex justify-between items-center">
                  <span>Daily Date-Wise History Logs</span>
                  <span className="text-xs text-slate-400 font-mono font-normal">Individual Daily Records</span>
                </h4>

                {Array.isArray(_attendance?.historyLogs) && _attendance.historyLogs.length > 0 ? (
                  <>
                    {/* Desktop table */}
                    <div className="hidden sm:block bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                      <table className="w-full text-left font-sans text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="py-3 px-4 font-bold w-12 text-center">#</th>
                            <th className="py-3 px-4 font-bold">Attendance Date</th>
                            <th className="py-3 px-4 font-bold text-center">Status</th>
                            <th className="py-3 px-4 font-bold">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                          {_attendance.historyLogs.map((log: any, idx: number) => {
                            const raw = (log.status || '').trim().toUpperCase();
                            const shortStatus = (raw === 'P' || raw === 'PRESENT') ? 'P' :
                                                (raw === 'A' || raw === 'ABSENT') ? 'A' :
                                                (raw === 'ON' || raw === 'OD' || raw === 'ON DUTY' || raw === 'ONDUTY') ? 'ON' :
                                                (raw === 'ML' || raw === 'LEAVE' || raw === 'MEDICAL LEAVE') ? 'ML' : (raw || 'UNMARKED');
                            return (
                              <tr key={idx} className="hover:bg-slate-900/60">
                                <td className="py-2.5 px-4 text-center text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-4 font-bold text-emerald-400">{log.date}</td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                    shortStatus === 'P' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                    shortStatus === 'A' ? 'bg-red-950 text-red-300 border border-red-800' :
                                    shortStatus === 'ON' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                    shortStatus === 'ML' ? 'bg-sky-950 text-sky-300 border border-sky-800' :
                                    'bg-slate-800 text-slate-400 border border-slate-700'
                                  }`}>
                                    {shortStatus}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-400 text-[11px]">{log.recordedBy || 'Faculty'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2 max-h-96 overflow-y-auto pr-1">
                      {_attendance.historyLogs.map((log: any, idx: number) => {
                        const raw = (log.status || '').trim().toUpperCase();
                        const shortStatus = (raw === 'P' || raw === 'PRESENT') ? 'P' :
                                            (raw === 'A' || raw === 'ABSENT') ? 'A' :
                                            (raw === 'ON' || raw === 'OD' || raw === 'ON DUTY' || raw === 'ONDUTY') ? 'ON' :
                                            (raw === 'ML' || raw === 'LEAVE' || raw === 'MEDICAL LEAVE') ? 'ML' : (raw || 'UNMARKED');
                        return (
                          <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] text-slate-500 font-mono w-5">#{idx + 1}</span>
                              <div>
                                <div className="font-bold text-emerald-400 font-mono">{log.date}</div>
                                <div className="text-[10px] text-slate-500">{log.recordedBy || 'Faculty'}</div>
                              </div>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] font-mono ${
                              shortStatus === 'P' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                              shortStatus === 'A' ? 'bg-red-950 text-red-300 border border-red-800' :
                              shortStatus === 'ON' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                              shortStatus === 'ML' ? 'bg-sky-950 text-sky-300 border border-sky-800' :
                              'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {shortStatus}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-slate-500 font-mono">
                    No daily attendance logs recorded yet.
                  </div>
                )}
              </div>
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
                  <div className="text-2xl font-extrabold text-emerald-400">{cgpaDisplay !== 'N/A' ? cgpaDisplay : 'Not Available'}</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Overall Composite Score:</span>
                  <div className="text-2xl font-extrabold text-indigo-400">{scoreDisplay}</div>
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

        {/* PROJECTS & HARDWARE SHOWCASE TAB */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="projects"
              assignedYear={student.year}
              assignedSection={student.section}
            />

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-indigo-400" />
                  <span>My Project Showcase — Software & Hardware Records</span>
                </h3>
                <span className="bg-indigo-950 border border-indigo-800 text-indigo-300 text-[10px] font-mono px-3 py-1 rounded-full font-bold">
                  VERIFIED STUDENT PORTFOLIO
                </span>
              </div>

              {Array.isArray(_projects) && _projects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {_projects.map((p: any, idx: number) => (
                    <div key={p.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 shadow-md">
                      <div className="flex justify-between items-center">
                        <span className="bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-800 font-mono">
                          {p.category || 'Software'}
                        </span>
                        <span className="text-slate-500 text-[10px] font-mono">ID: {p.id}</span>
                      </div>
                      <div className="text-white font-bold font-sans text-sm">{p.title}</div>
                      {p.description && <div className="text-slate-400 text-xs font-mono">{p.description}</div>}
                      {p.liveUrl && (
                        <a href={p.liveUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline block truncate text-xs font-mono">
                          Live Demo: {p.liveUrl}
                        </a>
                      )}
                      {p.githubUrl && (
                        <a href={p.githubUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline block truncate text-xs font-mono">
                          GitHub: {p.githubUrl}
                        </a>
                      )}

                      {/* Attached Project Documentation & Photos */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <ProofAttachmentControl
                          studentId={student.id}
                          recordType="projects"
                          recordId={p.id}
                          userRole="STUDENT"
                          readOnly={true}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-slate-500 font-mono">
                  No project records or documentation submitted yet. Projects added by faculty coordinator will appear here.
                </div>
              )}
            </div>
          </div>
        )}

        {/* FIRST LOGIN MANDATORY PASSWORD CHANGE MODAL */}
        {showFirstLoginChangeModal && (
          <div className="fixed inset-0 z-50 bg-[#080A0F]/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 bg-slate-900 border border-slate-700 text-slate-200">
              <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">First-Time Login Security</h3>
                  <p className="text-[11px] text-amber-400 font-mono">Mandatory Password Update Required</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Your initial password was set to your Register Number. For your security, please update your account with a private password.
              </p>

              {changePassError && (
                <div className="bg-rose-950/80 border border-rose-500 text-rose-200 p-2.5 rounded-xl text-xs font-mono flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{changePassError}</span>
                </div>
              )}

              {changePassSuccess && (
                <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 p-2.5 rounded-xl text-xs font-mono flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{changePassSuccess}</span>
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setChangePassError('');
                  if (!changeCurrPass) {
                    setChangePassError('Please enter your initial password (Register Number).');
                    return;
                  }
                  if (!changeNewPass || changeNewPass.length < 6) {
                    setChangePassError('New password must be at least 6 characters.');
                    return;
                  }
                  if (changeNewPass !== changeConfirmPass) {
                    setChangePassError('New password and confirmation do not match.');
                    return;
                  }
                  setIsChangingPass(true);
                  try {
                    await API.changePassword(changeCurrPass, changeNewPass);
                    setChangePassSuccess('Password updated successfully. Please sign in again.');
                    setTimeout(() => {
                      clearSessionAuth('STUDENT');
                      navigate('/student', { replace: true });
                    }, 1800);
                  } catch (err: any) {
                    setChangePassError(err.message || 'Failed to update password.');
                  } finally {
                    setIsChangingPass(false);
                  }
                }}
                className="space-y-3 font-mono text-xs"
              >
                <div>
                  <label className="text-slate-400 block mb-1">Current Portal Password</label>
                  <input
                    type="password"
                    value={changeCurrPass}
                    onChange={(e) => setChangeCurrPass(e.target.value)}
                    placeholder="Enter Register Number"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">New Private Password (min 6 characters)</label>
                  <input
                    type="password"
                    value={changeNewPass}
                    onChange={(e) => setChangeNewPass(e.target.value)}
                    placeholder="Enter New Password"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={changeConfirmPass}
                    onChange={(e) => setChangeConfirmPass(e.target.value)}
                    placeholder="Confirm New Password"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold font-sans text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isChangingPass ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Save & Continue to Portal</span>
                    )}
                  </button>
                </div>
              </form>
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
