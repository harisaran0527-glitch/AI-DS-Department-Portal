import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../../services/api';
import type { Student } from '../../types';
import {
  Crown,
  Search,
  Code,
  BookOpen,
  Award,
  Trophy,
  FileCheck,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Filter,
  User,
  Star,
  Download,
  Edit3,
  X,
  Check,
  ShieldCheck,
  Trash2,
  PlusCircle,
  Sparkles,
  Sliders
} from 'lucide-react';

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" />
  </svg>
);

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export type EliteCategoryKey =
  | 'skilledge'
  | 'academics'
  | 'leetcode'
  | 'linkedin'
  | 'github'
  | 'hackathons'
  | 'projects'
  | 'nptel'
  | 'certificates';

export interface EliteCategoryOption {
  key: EliteCategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const ELITE_CATEGORY_OPTIONS: EliteCategoryOption[] = [
  {
    key: 'skilledge',
    label: 'SkillEdge Reward Points',
    icon: Code,
    description: 'Calculated lab completion reward points and verified track levels.'
  },
  {
    key: 'academics',
    label: 'Academic Performance',
    icon: BookOpen,
    description: 'Cumulative GPA (CGPA), SGPA, semester exam marksheets, and credit history.'
  },
  {
    key: 'leetcode',
    label: 'LeetCode',
    icon: Code,
    description: 'Verified algorithmic problem-solving counts, difficulty breakdown, and contest rating.'
  },
  {
    key: 'linkedin',
    label: 'LinkedIn Profile',
    icon: LinkedinIcon,
    description: 'Professional student LinkedIn network profiles.'
  },
  {
    key: 'github',
    label: 'GitHub URL',
    icon: GithubIcon,
    description: 'Open-source code repositories and developer profile links.'
  },
  {
    key: 'hackathons',
    label: 'Hackathon Achievement',
    icon: Trophy,
    description: 'Verified hackathon participations, winning positions, and prizes.'
  },
  {
    key: 'projects',
    label: 'Projects',
    icon: Star,
    description: 'Software and hardware project portfolios, live URLs, and code links.'
  },
  {
    key: 'nptel',
    label: 'NPTEL',
    icon: FileCheck,
    description: 'SWAYAM NPTEL course certifications, exam scores, and weekly proof logs.'
  },
  {
    key: 'certificates',
    label: 'Certificate Courses',
    icon: FileText,
    description: 'Verified technical certifications and issuing platform documents.'
  }
];

interface BestEliteStudentsViewProps {
  userRole: 'FACULTY' | 'HOD' | 'ADMIN' | 'STUDENT';
  assignedYear?: string;
  assignedSection?: string;
  selectedCategory?: EliteCategoryKey;
  onSelectStudent?: (student: Student) => void;
}

export const BestEliteStudentsView: React.FC<BestEliteStudentsViewProps> = ({
  userRole,
  assignedYear,
  assignedSection,
  selectedCategory: propCategory,
  onSelectStudent
}) => {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [student360Map, setStudent360Map] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Dropdown Category Selection
  const [selectedCategory, setSelectedCategory] = useState<EliteCategoryKey>(propCategory || 'skilledge');

  useEffect(() => {
    if (propCategory) {
      setSelectedCategory(propCategory);
    }
  }, [propCategory]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(assignedYear || 'ALL');
  const [sectionFilter, setSectionFilter] = useState<string>(assignedSection || 'ALL');

  // Management Modal & Selected Profile Modal State
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [manageSearch, setManageSearch] = useState<string>('');
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<Student | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Profile Edit Form State
  const [editLinkedin, setEditLinkedin] = useState<string>('');
  const [editGithub, setEditGithub] = useState<string>('');
  const [editLeetCodeUsername, setEditLeetCodeUsername] = useState<string>('');
  const [editCgpa, setEditCgpa] = useState<number>(0);
  const [editSkillEdgePoints, setEditSkillEdgePoints] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, [userRole, assignedYear, assignedSection, yearFilter, sectionFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      let roster: Student[] = [];

      if (userRole === 'HOD' || userRole === 'ADMIN') {
        const res = await API.getDepartmentStudents(
          yearFilter === 'ALL' ? undefined : yearFilter,
          sectionFilter === 'ALL' ? undefined : sectionFilter
        );
        roster = res.students || [];
      } else if (userRole === 'FACULTY') {
        const res = await API.getAssignedRoster();
        roster = res.students || [];
      } else {
        const meRes = await API.getStudentSelfProfile();
        if (meRes?.student) {
          roster = [meRes.student];
          setStudent360Map({ [meRes.student.id]: meRes });
        }
      }

      setAllStudents(roster);

      if (userRole !== 'STUDENT' && roster.length > 0) {
        const map360: Record<string, any> = {};
        await Promise.all(
          roster.map(async (stu) => {
            try {
              if (userRole === 'HOD' || userRole === 'ADMIN') {
                const res = await fetch(`/api/hod/students/${stu.id}/360`, { credentials: 'include' });
                if (res.ok) {
                  map360[stu.id] = await res.json();
                }
              } else {
                const res = await API.getStudent360ForFaculty(stu.id);
                map360[stu.id] = res;
              }
            } catch {
              // Silently ignore single student fetch errors
            }
          })
        );
        setStudent360Map(map360);
      }
    } catch (err: any) {
      console.error('Failed to load Best Elite Students data:', err);
      setErrorMsg(err.message || 'Failed to load Elite Students dataset.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Elite Designation Handler
  const handleToggleEliteStatus = async (studentId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await API.setStudentEliteStatus(studentId, newStatus, userRole === 'FACULTY' ? 'FACULTY' : 'HOD');
      await fetchData();
      if (selectedProfileStudent && selectedProfileStudent.id === studentId) {
        setSelectedProfileStudent((prev) => (prev ? { ...prev, isEliteStudent: newStatus, is_elite_student: newStatus ? 1 : 0 } : null));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update Elite Student designation.');
    }
  };

  // Open Profile & Populate Edit Form
  const handleOpenProfileModal = (stu: Student) => {
    setSelectedProfileStudent(stu);
    setIsEditMode(false);
    const data360 = student360Map[stu.id] || {};
    setEditLinkedin(stu.linkedinUrl || (stu as any).linkedin_url || '');
    setEditGithub(stu.githubUrl || (stu as any).github_url || '');
    setEditLeetCodeUsername(data360.leetcode?.username || '');
    setEditCgpa(stu.cgpa || 0);
    setEditSkillEdgePoints(data360.skillEdge?.totalRewardPoints || 0);
  };

  // Save Profile Edits Handler
  const handleSaveProfileEdits = async () => {
    if (!selectedProfileStudent) return;
    setIsSavingProfile(true);
    try {
      await API.updateStudentProfile(
        selectedProfileStudent.id,
        {
          linkedinUrl: editLinkedin.trim(),
          githubUrl: editGithub.trim(),
          leetcodeUsername: editLeetCodeUsername.trim(),
          cgpa: editCgpa,
          skillEdgePoints: editSkillEdgePoints
        },
        userRole === 'FACULTY' ? 'FACULTY' : 'HOD'
      );
      await fetchData();
      setIsEditMode(false);
      alert(`Updated profile details for ${selectedProfileStudent.name} successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile details.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Filter students: ONLY show students marked as Elite Students
  const eliteDesignatedStudents = useMemo(() => {
    if (userRole === 'STUDENT') return allStudents;
    return allStudents.filter((s) => Boolean(s.isEliteStudent || (s as any).is_elite_student === 1));
  }, [allStudents, userRole]);

  // Evaluator & sorter per category
  const evaluatedStudents = useMemo(() => {
    return eliteDesignatedStudents
      .map((stu) => {
        const data360 = student360Map[stu.id] || {};
        const regNo = stu.registerNo || (stu as any).register_no || '';
        const name = stu.name || '';

        let numericMetric = 0;
        let categoryDetail: any = null;
        let hasData = false;

        switch (selectedCategory) {
          case 'skilledge': {
            const se = data360.skillEdge;
            if (se) {
              const pts = se.totalRewardPoints || 0;
              numericMetric = pts;
              hasData = pts > 0 || Boolean(se.skilledgeHandle) || Boolean(se.tracks?.length);
              categoryDetail = {
                handle: se.skilledgeHandle || stu.email || regNo,
                pts,
                completionPct: se.overallCompletionPct || 0,
                tracksCount: se.tracks ? se.tracks.length : 0,
                status: se.status || 'VERIFIED'
              };
            }
            break;
          }

          case 'academics': {
            const cgpa = stu.cgpa || 0;
            numericMetric = cgpa;
            const acads = data360.academics || [];
            hasData = cgpa > 0 || acads.length > 0;
            categoryDetail = {
              cgpa,
              examRecordsCount: acads.length,
              overallScore: stu.overallScore || 0,
              examList: acads
            };
            break;
          }

          case 'leetcode': {
            const lc = data360.leetcode;
            if (lc && (lc.totalSolved > 0 || lc.username)) {
              const username = lc.username;
              const isValidUser = username && !['student', 'leetcode_user', 'null'].includes(username.toLowerCase());
              if (isValidUser || lc.totalSolved > 0) {
                hasData = true;
                numericMetric = lc.totalSolved || 0;
                categoryDetail = {
                  username,
                  totalSolved: lc.totalSolved || 0,
                  easySolved: lc.easySolved || 0,
                  mediumSolved: lc.mediumSolved || 0,
                  hardSolved: lc.hardSolved || 0,
                  contestRating: lc.contestRating || 1200,
                  acceptanceRate: lc.acceptanceRate || 0
                };
              }
            }
            break;
          }

          case 'linkedin': {
            const url = stu.linkedinUrl || (stu as any).linkedin_url || (data360.student as any)?.linkedin_url;
            if (url && url.trim() && url !== 'N/A') {
              hasData = true;
              numericMetric = 1;
              categoryDetail = { url: url.trim() };
            }
            break;
          }

          case 'github': {
            const url = stu.githubUrl || (stu as any).github_url || (data360.student as any)?.github_url || (data360.projects || []).find((p: any) => p.githubUrl || p.github_url)?.githubUrl;
            if (url && url.trim() && url !== 'N/A') {
              hasData = true;
              numericMetric = 1;
              categoryDetail = { url: url.trim() };
            }
            break;
          }

          case 'hackathons': {
            const parts = data360.participation || [];
            const hackathons = parts.filter((p: any) => {
              const cat = (p.category || p.eventType || '').toLowerCase();
              const nameStr = (p.eventName || p.event_name || '').toLowerCase();
              return cat.includes('hackathon') || nameStr.includes('hackathon') || Boolean(p.achievement || p.position);
            });
            if (hackathons.length > 0) {
              hasData = true;
              numericMetric = hackathons.length;
              categoryDetail = {
                count: hackathons.length,
                records: hackathons
              };
            }
            break;
          }

          case 'projects': {
            const projs = data360.projects || [];
            if (projs.length > 0) {
              hasData = true;
              numericMetric = projs.length;
              categoryDetail = {
                count: projs.length,
                records: projs
              };
            }
            break;
          }

          case 'nptel': {
            const nptelList = data360.nptel || [];
            if (nptelList.length > 0) {
              hasData = true;
              const avgScore = nptelList.reduce((s: number, n: any) => s + (n.finalScore || 0), 0) / nptelList.length;
              numericMetric = avgScore;
              categoryDetail = {
                count: nptelList.length,
                avgScore: Math.round(avgScore),
                records: nptelList
              };
            }
            break;
          }

          case 'certificates': {
            const certs = data360.certificates || [];
            if (certs.length > 0) {
              hasData = true;
              numericMetric = certs.length;
              categoryDetail = {
                count: certs.length,
                records: certs
              };
            }
            break;
          }
        }

        return {
          student: stu,
          regNo,
          name,
          hasData,
          numericMetric,
          categoryDetail
        };
      })
      .filter((item) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.regNo.toLowerCase().includes(q);
      })
      .sort((a, b) => b.numericMetric - a.numericMetric);
  }, [eliteDesignatedStudents, student360Map, selectedCategory, searchQuery]);

  const activeCategoryOption = ELITE_CATEGORY_OPTIONS.find((c) => c.key === selectedCategory)!;
  const CategoryIcon = activeCategoryOption.icon;

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-[#101828] to-slate-900 border border-amber-500/30 p-6 rounded-2xl space-y-4 font-mono shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 z-10 relative">
          <div>
            <div className="flex items-center space-x-2 text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Department Recognition Engine</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2.5 font-sans">
              <Crown className="w-6 h-6 text-amber-400" />
              <span>Best Elite Students Module</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Showing verified performance metric rankings for explicitly designated Elite Students across nine source modules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {userRole !== 'STUDENT' && (
              <button
                onClick={() => setShowManageModal(true)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <Sliders className="w-4 h-4" />
                <span>Manage Elite Designation ({eliteDesignatedStudents.length})</span>
              </button>
            )}

            {/* CATEGORY SELECTOR DROPDOWN */}
            <div className="flex items-center space-x-2 bg-slate-950 border border-amber-500/50 p-2 rounded-xl">
              <Filter className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-slate-400 font-bold hidden sm:inline">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as EliteCategoryKey)}
                className="bg-slate-900 text-amber-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-amber-700/60 focus:outline-none cursor-pointer"
              >
                {ELITE_CATEGORY_OPTIONS.map((opt, idx) => (
                  <option key={opt.key} value={opt.key}>
                    {idx + 1}. {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ACTIVE CATEGORY DESCRIPTION BAR */}
        <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center space-x-3 text-xs z-10 relative">
          <CategoryIcon className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-300 font-sans">
            <strong className="text-white font-bold">{activeCategoryOption.label}:</strong> {activeCategoryOption.description}
          </span>
        </div>
      </div>

      {/* ERROR ALERT */}
      {errorMsg && (
        <div className="bg-red-950/80 border border-red-800 text-red-300 p-4 rounded-2xl text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* CONTROLS & SEARCH BAR */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl font-mono">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <User className="w-4 h-4 text-amber-400" />
            <span>Displaying <strong>{evaluatedStudents.length}</strong> Elite Students in Scope</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Student Name or Reg No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* STUDENT CARDS GRID */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-400 font-mono space-y-3">
          <Crown className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs">Loading Elite Student records across source database modules...</p>
        </div>
      ) : eliteDesignatedStudents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-2xl text-center space-y-4">
          <Crown className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white font-sans">No Elite Students Designated Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Not all students in the department portal are Elite Students. Select top performers from your roster to feature them in the Best Elite Students rankings.
          </p>
          {userRole !== 'STUDENT' && (
            <button
              onClick={() => setShowManageModal(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 mx-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Mark Students as Elite</span>
            </button>
          )}
        </div>
      ) : evaluatedStudents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-slate-400 font-mono">
          No Elite Student matches found for "{searchQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluatedStudents.map((item, idx) => {
            const { student, regNo, name, hasData, categoryDetail } = item;
            const rank = idx + 1;

            return (
              <div
                key={student.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl transition-all space-y-4 shadow-lg flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="bg-amber-950 border border-amber-700 text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
                          #{rank} Rank
                        </span>
                        <span className="bg-slate-800 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
                          {student.year} Sec {student.section}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1.5 truncate">{name}</h3>
                      <p className="text-[11px] text-slate-400 font-mono">{regNo}</p>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-amber-400">
                      <Crown className="w-5 h-5" />
                    </div>
                  </div>

                  {/* CATEGORY SPECIFIC DETAIL VIEW */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-2">
                    {!hasData ? (
                      <div className="text-slate-500 italic py-2 text-center">No Data Available</div>
                    ) : (
                      <>
                        {selectedCategory === 'skilledge' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Reward Points:</span>
                              <strong className="text-cyan-400 font-bold">{categoryDetail.pts} Pts</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Overall Track Completion:</span>
                              <span className="text-slate-300">{categoryDetail.completionPct}%</span>
                            </div>
                          </div>
                        )}

                        {selectedCategory === 'academics' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cumulative CGPA:</span>
                              <strong className="text-emerald-400 font-bold">{categoryDetail.cgpa.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Exam Marksheets:</span>
                              <span className="text-indigo-300">{categoryDetail.examRecordsCount} Records</span>
                            </div>
                          </div>
                        )}

                        {selectedCategory === 'leetcode' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">LeetCode Solved:</span>
                              <strong className="text-yellow-400 font-bold">{categoryDetail.totalSolved} Problems</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Contest Rating:</span>
                              <span className="text-amber-300 font-bold">{categoryDetail.contestRating}</span>
                            </div>
                            {categoryDetail.username && (
                              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                                Username: <span className="text-slate-200">{categoryDetail.username}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {selectedCategory === 'linkedin' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">LinkedIn Profile:</span>
                              <span className="text-emerald-400 font-bold text-[10px]">CONNECTED</span>
                            </div>
                            <a
                              href={categoryDetail.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline truncate block text-[11px]"
                            >
                              {categoryDetail.url}
                            </a>
                          </div>
                        )}

                        {selectedCategory === 'github' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">GitHub Profile:</span>
                              <span className="text-emerald-400 font-bold text-[10px]">CONNECTED</span>
                            </div>
                            <a
                              href={categoryDetail.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline truncate block text-[11px]"
                            >
                              {categoryDetail.url}
                            </a>
                          </div>
                        )}

                        {selectedCategory === 'hackathons' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Hackathon Achievements:</span>
                              <strong className="text-purple-400 font-bold">{categoryDetail.count} Events</strong>
                            </div>
                            <div className="text-[10px] text-slate-300 truncate">
                              Latest: {categoryDetail.records[0]?.eventName || categoryDetail.records[0]?.title || 'Hackathon Winner'}
                            </div>
                          </div>
                        )}

                        {selectedCategory === 'projects' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Project Portfolio:</span>
                              <strong className="text-indigo-400 font-bold">{categoryDetail.count} Projects</strong>
                            </div>
                            <div className="text-[10px] text-slate-300 truncate">
                              Latest: {categoryDetail.records[0]?.title || 'AI Project'}
                            </div>
                          </div>
                        )}

                        {selectedCategory === 'nptel' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">NPTEL Courses:</span>
                              <strong className="text-emerald-400 font-bold">{categoryDetail.count} Courses</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Average Final Score:</span>
                              <span className="text-amber-300 font-bold">{categoryDetail.avgScore}%</span>
                            </div>
                          </div>
                        )}

                        {selectedCategory === 'certificates' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Technical Certificates:</span>
                              <strong className="text-cyan-400 font-bold">{categoryDetail.count} Certificates</strong>
                            </div>
                            <div className="text-[10px] text-slate-300 truncate">
                              Latest: {categoryDetail.records[0]?.courseName || categoryDetail.records[0]?.title || 'Certification'}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenProfileModal(student)}
                    className="flex-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>View / Edit Elite Profile</span>
                  </button>

                  {userRole !== 'STUDENT' && (
                    <button
                      onClick={() => handleToggleEliteStatus(student.id, true)}
                      title="Remove from Elite Students"
                      className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-400 p-2 rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MANAGE ELITE DESIGNATION MODAL */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col text-xs font-sans">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  <span>Manage Elite Student Designations</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Select top performing students to feature in Best Elite Students category rankings.
                </p>
              </div>
              <button onClick={() => setShowManageModal(false)} className="bg-slate-800 text-slate-300 p-1.5 rounded-lg hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search roster by name or register number..."
                value={manageSearch}
                onChange={(e) => setManageSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder:text-slate-500 font-mono"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {allStudents
                .filter((s) => {
                  const q = manageSearch.toLowerCase().trim();
                  if (!q) return true;
                  return s.name.toLowerCase().includes(q) || s.registerNo.toLowerCase().includes(q);
                })
                .map((stu) => {
                  const isElite = Boolean(stu.isEliteStudent || (stu as any).is_elite_student === 1);
                  return (
                    <div key={stu.id} className="pt-2 flex items-center justify-between hover:bg-slate-950/50 p-2 rounded-xl transition-all">
                      <div>
                        <div className="font-bold text-white text-xs">{stu.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Reg: {stu.registerNo} | {stu.year} Sec {stu.section} | CGPA: {stu.cgpa ? stu.cgpa.toFixed(2) : '0.00'}
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleEliteStatus(stu.id, isElite)}
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center space-x-1.5 ${
                          isElite
                            ? 'bg-amber-950 border border-amber-700 text-amber-300 hover:bg-red-950 hover:border-red-800 hover:text-red-300'
                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-amber-500 hover:text-slate-950'
                        }`}
                      >
                        {isElite ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-amber-400" />
                            <span>Elite Student (Click to Remove)</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Mark as Elite Student</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button onClick={() => setShowManageModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold font-mono">
                Done Managing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED ELITE STUDENT PROFILE & EDIT MODAL */}
      {selectedProfileStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-xs font-sans">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <span>{selectedProfileStudent.name}</span>
                    <span className="bg-amber-950 border border-amber-700 text-amber-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                      ELITE STUDENT PROFILE
                    </span>
                  </h3>
                  <p className="text-slate-400 font-mono text-xs mt-0.5">
                    Reg No: {selectedProfileStudent.registerNo} | {selectedProfileStudent.year} Section {selectedProfileStudent.section}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {userRole !== 'STUDENT' && (
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      isEditMode ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-indigo-950 border border-indigo-800 text-indigo-300 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditMode ? 'Cancel Editing' : 'Edit Profile Details'}</span>
                  </button>
                )}
                <button onClick={() => setSelectedProfileStudent(null)} className="bg-slate-800 text-slate-300 p-2 rounded-xl hover:bg-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* EDIT PROFILE FORM MODE */}
            {isEditMode ? (
              <div className="bg-slate-950 border border-amber-500/40 p-5 rounded-2xl space-y-4 font-mono">
                <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>Edit Source Module Profile Details</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">Cumulative CGPA:</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={editCgpa}
                      onChange={(e) => setEditCgpa(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">SkillEdge Reward Points:</label>
                    <input
                      type="number"
                      value={editSkillEdgePoints}
                      onChange={(e) => setEditSkillEdgePoints(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">LeetCode Handle / Username:</label>
                    <input
                      type="text"
                      placeholder="e.g. johndoe_lc"
                      value={editLeetCodeUsername}
                      onChange={(e) => setEditLeetCodeUsername(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">LinkedIn Profile URL:</label>
                    <input
                      type="text"
                      placeholder="https://linkedin.com/in/..."
                      value={editLinkedin}
                      onChange={(e) => setEditLinkedin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-slate-400 text-[11px]">GitHub Profile URL:</label>
                    <input
                      type="text"
                      placeholder="https://github.com/..."
                      value={editGithub}
                      onChange={(e) => setEditGithub(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setIsEditMode(false)}
                    className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfileEdits}
                    disabled={isSavingProfile}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs flex items-center space-x-2"
                  >
                    {isSavingProfile ? <Crown className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save Profile Changes</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* ALL 9 CATEGORY SECTIONS SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              {/* 1. SkillEdge */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-cyan-400 font-bold">
                  <span>1. SkillEdge Points</span>
                  <Code className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-white">
                  {student360Map[selectedProfileStudent.id]?.skillEdge?.totalRewardPoints || 0} Pts
                </div>
              </div>

              {/* 2. Academics */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-emerald-400 font-bold">
                  <span>2. Academic CGPA</span>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-white">
                  {selectedProfileStudent.cgpa ? selectedProfileStudent.cgpa.toFixed(2) : '0.00'}
                </div>
              </div>

              {/* 3. LeetCode */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-yellow-400 font-bold">
                  <span>3. LeetCode Solved</span>
                  <Code className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-white">
                  {student360Map[selectedProfileStudent.id]?.leetcode?.totalSolved || 0} Solved
                </div>
              </div>

              {/* 4. LinkedIn */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-blue-400 font-bold">
                  <span>4. LinkedIn Profile</span>
                  <LinkedinIcon className="w-4 h-4" />
                </div>
                <div className="text-xs truncate text-slate-300">
                  {selectedProfileStudent.linkedinUrl || (selectedProfileStudent as any).linkedin_url || 'No Data Available'}
                </div>
              </div>

              {/* 5. GitHub */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-purple-400 font-bold">
                  <span>5. GitHub Profile</span>
                  <GithubIcon className="w-4 h-4" />
                </div>
                <div className="text-xs truncate text-slate-300">
                  {selectedProfileStudent.githubUrl || (selectedProfileStudent as any).github_url || 'No Data Available'}
                </div>
              </div>

              {/* 6. Hackathons */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-amber-400 font-bold">
                  <span>6. Hackathons</span>
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-white">
                  {(student360Map[selectedProfileStudent.id]?.participation || []).filter((p: any) =>
                    (p.category || p.eventType || '').toLowerCase().includes('hackathon') || (p.eventName || '').toLowerCase().includes('hackathon')
                  ).length} Events
                </div>
              </div>

              {/* 7. Projects */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-indigo-400 font-bold">
                  <span>7. Projects</span>
                  <Star className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-white">
                  {(student360Map[selectedProfileStudent.id]?.projects || []).length} Projects
                </div>
              </div>

              {/* 8. NPTEL */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-emerald-400 font-bold">
                  <span>8. NPTEL</span>
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-white">
                  {(student360Map[selectedProfileStudent.id]?.nptel || []).length} Courses
                </div>
              </div>

              {/* 9. Certificates */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-cyan-400 font-bold">
                  <span>9. Certificates</span>
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-white">
                  {(student360Map[selectedProfileStudent.id]?.certificates || []).length} Certificates
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              {userRole !== 'STUDENT' ? (
                <button
                  onClick={() => {
                    handleToggleEliteStatus(selectedProfileStudent.id, true);
                    setSelectedProfileStudent(null);
                  }}
                  className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-mono px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Remove from Elite Designation
                </button>
              ) : <div />}
              <button
                onClick={() => setSelectedProfileStudent(null)}
                className="bg-slate-800 text-slate-200 px-5 py-2 rounded-xl text-xs font-bold font-mono"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
