import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, API_BASE, fetchWithResilience } from '../../services/api';
import type { UserSession, Student, ScoringConfig, AcademicYear, Section } from '../../types';
import { DashboardLayout, type MenuItem } from '../../components/layout/DashboardLayout';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { ProofAttachmentControl } from '../../components/common/ProofAttachmentControl';
import {
  Crown,
  Users,
  CheckCircle,
  Users2,
  BarChart3,
  Key,
  BookOpen
} from 'lucide-react';

import { ForgotPasswordModal } from '../../components/common/ForgotPasswordModal';
import { SubjectManagement } from '../../components/academic/SubjectManagement';
import { HodFacultyWorkspaceView } from '../../components/hod/HodFacultyWorkspaceView';
import { HodAwardCandidatesView } from '../../components/ranking/HodAwardCandidatesView';

export const HODDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Filters
  const [selectedYear, setSelectedYear] = useState<AcademicYear | 'ALL'>('2nd Year');
  const [selectedSection, setSelectedSection] = useState<Section | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>({
    academicWeight: 25,
    skillEdgeWeight: 15,
    nptelWeight: 10,
    participationWeight: 10,
    certificatesWeight: 10,
    attendanceWeight: 10,
    disciplineWeight: 5,
    leetcodeWeight: 10,
    projectsWeight: 5
  });
  const [awardCandidates, setAwardCandidates] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const handleLogout = async () => {
    try {
      await API.logout();
    } catch {}
    navigate('/hod');
  };



  // Selected student for HOD 360 Inspection
  const [selectedHODStudent, setSelectedHODStudent] = useState<Student | null>(null);
  const [hod360Data, setHod360Data] = useState<any>(null);
  const [hodModalTab, setHodModalTab] = useState<'academics' | 'arrears' | 'skilledge' | 'nptel' | 'attendance' | 'discipline' | 'certificates' | 'participation' | 'leetcode' | 'projects' | 'achievements'>('academics');

  // Delete Target Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string; isAward?: boolean; isRecord?: boolean; studentId?: string; recordType?: string; recordId?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDeleteHOD = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.isAward) {
        await API.deleteFinalizedAwardForHOD(deleteTarget.id);
      } else if (deleteTarget.isRecord && deleteTarget.studentId && deleteTarget.recordType && deleteTarget.recordId) {
        await API.deletePerformanceRecordForHOD(deleteTarget.studentId, deleteTarget.recordType, deleteTarget.recordId);
        if (selectedHODStudent) {
          const res = await fetchWithResilience(`${API_BASE}/hod/students/${selectedHODStudent.id}/360`, { credentials: 'include' });
          const data = await res.json();
          setHod360Data(data);
        }
      } else {
        await API.deleteStudentAccount(deleteTarget.id);
      }
      setDeleteTarget(null);
      await fetchDepartmentData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchDepartmentData = React.useCallback(async () => {
    try {
      const meRes = await API.getMe();
      if (!meRes.user || meRes.user.role !== 'HOD') {
        navigate('/hod');
        return;
      }
      setSession(meRes.user);

      const [stuRes, candRes, cfgRes] = await Promise.all([
        API.getDepartmentStudents(selectedYear, selectedSection),
        API.getAIAwardCandidates(selectedYear),
        API.getScoringConfig()
      ]);

      setStudents(stuRes.students || []);
      setAwardCandidates(candRes.candidates || null);
      if (cfgRes?.config) {
        setScoringConfig(cfgRes.config);
      }
    } catch (err: any) {
      console.error(err);
    }
  }, [navigate, selectedYear, selectedSection]);

  useEffect(() => {
    fetchDepartmentData();
  }, [fetchDepartmentData]);

  const handleOpenHOD360 = async (stu: Student) => {
    setSelectedHODStudent(stu);
    try {
      const res = await fetchWithResilience(`${API_BASE}/hod/students/${stu.id}/360`, { credentials: 'include' });
      const data = await res.json();
      setHod360Data(data);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch student 360 data.');
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.registerNo.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  if (!session) return null;

  const hodMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'faculty', label: 'Faculty Roster', icon: Users2 },
    { id: 'subjects', label: 'Department Subjects', icon: BookOpen }
  ];

  return (
    <DashboardLayout
      portalRole="HOD"
      userName={session.name}
      userRoleTitle="HOD — AVSEC Salem"
      subtitle={`AVSEC Salem — AI & DS Overview | ${selectedYear} ${selectedSection}`}
      menuItems={hodMenuItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={handleLogout}
      headerActions={
        <button
          onClick={() => setShowForgotModal(true)}
          className="text-xs text-indigo-300 hover:text-white bg-indigo-950/80 border border-indigo-700/60 px-3 py-1 rounded-xl font-mono flex items-center space-x-1.5"
        >
          <Key className="w-3.5 h-3.5 text-indigo-400" />
          <span>Forgot Password?</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* YEAR & SECTION CONTROLLER */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-mono font-bold">Year Filter:</span>
            {['ALL', '1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y as any)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedYear === y ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-mono font-bold">Section Filter:</span>
            {['ALL', 'A', 'B', 'C'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSection(s as any)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedSection === s ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Sec {s}
              </button>
            ))}
          </div>
        </div>

        {/* 1. DEPARTMENT FACULTY ROSTER & INDIVIDUAL WORKSPACES */}
        {activeTab === 'faculty' && (
          <HodFacultyWorkspaceView
            selectedYearFilter={selectedYear}
            selectedSectionFilter={selectedSection}
          />
        )}

        {/* 2. DEPARTMENT SUBJECTS MANAGEMENT */}
        {activeTab === 'subjects' && (
          <SubjectManagement
            userRole="HOD"
            assignedYear={selectedYear === 'ALL' ? undefined : selectedYear}
            assignedSection={selectedSection === 'ALL' ? undefined : selectedSection}
          />
        )}

        {/* 3. DASHBOARD: OVERVIEW, AWARD CANDIDATES, & ACTUAL STUDENTS */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-slate-400 font-mono uppercase font-bold">Department Students</div>
                  <div className="text-2xl font-extrabold text-white mt-1 font-mono">{students.length} Students</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400"><Users className="w-6 h-6" /></div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-slate-400 font-mono uppercase font-bold">Award Candidates</div>
                  <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">{students.length > 0 ? '5 Categories (Top 2 Each)' : '0 Candidates'}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400"><Crown className="w-6 h-6" /></div>
              </div>
            </div>

            {/* TOP 2 CANDIDATES PER AWARD CATEGORY */}
            <HodAwardCandidatesView
              assignedYear={selectedYear === 'ALL' ? undefined : selectedYear}
              assignedSection={selectedSection === 'ALL' ? undefined : selectedSection}
              onSelectStudent360={(stuId) => {
                const target = students.find((s) => s.id === stuId);
                if (target) {
                  handleOpenHOD360(target);
                } else {
                  handleOpenHOD360({ id: stuId } as any);
                }
              }}
            />

            {/* ACTUAL DEPARTMENT STUDENT OVERVIEW */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white font-sans">Department Student Overview</h2>

                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  No uploaded students found in database matching current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 font-mono uppercase">
                        <th className="py-3 px-3">Year</th>
                        <th className="py-3 px-3">Reg No</th>
                        <th className="py-3 px-3">Student Name</th>
                        <th className="py-3 px-3">Faculty / Staff</th>
                        <th className="py-3 px-3">Section</th>
                        <th className="py-3 px-3">College Mail</th>
                        <th className="py-3 px-3 text-center">CGPA</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredStudents.map((stu: any) => (
                        <tr key={stu.id} className="hover:bg-slate-950 font-mono">
                          <td className="py-3 px-3 text-slate-300">{stu.year}</td>
                          <td className="py-3 px-3 font-bold text-amber-400">{stu.registerNo}</td>
                          <td className="py-3 px-3 font-bold text-white font-sans">{stu.name}</td>
                          <td className="py-3 px-3 text-indigo-300 font-sans font-medium text-[11px]">{stu.facultyName || stu.faculty_name || stu.classCoordinatorName || 'Unassigned'}</td>
                          <td className="py-3 px-3 text-slate-300">Sec {stu.section}</td>
                          <td className="py-3 px-3 text-slate-400">{stu.email}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-400">
                            {(stu.cgpa !== null && stu.cgpa !== undefined && stu.cgpa !== '') ? Number(stu.cgpa).toFixed(2) : 'N/A'}
                          </td>
                          <td className="py-3 px-3 text-right font-sans">
                            <button
                              onClick={() => handleOpenHOD360(stu)}
                              className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold"
                            >
                              360° Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* HOD 360 INSPECTION & PROOF MANAGEMENT MODAL */}
      {selectedHODStudent && hod360Data && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>HOD Department 360° Student Profile</span>
                  <span className="bg-amber-950 border border-amber-700 text-amber-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                    READ-ONLY VIEW
                  </span>
                </h3>
                <p className="text-slate-400 font-mono">Student: <strong className="text-white">{selectedHODStudent.name}</strong> | Reg No: {selectedHODStudent.registerNo} | {selectedHODStudent.year} Section {selectedHODStudent.section}</p>
              </div>
              <button onClick={() => setSelectedHODStudent(null)} className="bg-slate-800 text-slate-300 p-1 rounded-lg">✕</button>
            </div>

            {/* 11 Category Tabs inside Modal */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800 font-semibold">
              {['academics', 'arrears', 'skilledge', 'nptel', 'attendance', 'discipline', 'certificates', 'participation', 'leetcode', 'projects', 'achievements'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setHodModalTab(cat as any)}
                  className={`px-3 py-1.5 rounded-lg capitalize ${hodModalTab === cat ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950 text-slate-400'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Category Proof Attachment Controls (READ-ONLY FOR HOD) */}
            {hodModalTab === 'academics' && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-emerald-400 mb-2 font-mono uppercase">Academic Marksheet & Result Proof</h4>
                  <ProofAttachmentControl studentId={selectedHODStudent.id} recordType="academics" recordId="cgpa-record" userRole="HOD" readOnly={true} />
                </div>
              </div>
            )}

            {hodModalTab === 'skilledge' && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-cyan-400 mb-2 font-mono uppercase">SkillEdge Completion Screenshot Proof</h4>
                  <ProofAttachmentControl studentId={selectedHODStudent.id} recordType="skilledge" recordId="skilledge-record" userRole="HOD" readOnly={true} />
                </div>
              </div>
            )}

            {hodModalTab === 'attendance' && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-indigo-400 mb-2 font-mono uppercase">Attendance Supporting Document</h4>
                  <ProofAttachmentControl studentId={selectedHODStudent.id} recordType="attendance" recordId="attendance-record" userRole="HOD" readOnly={true} />
                </div>
              </div>
            )}

            {hodModalTab === 'leetcode' && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-yellow-400 font-mono uppercase">LeetCode Verified Metrics</h4>
                    <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span>VERIFIED SOURCE DATA</span>
                    </span>
                  </div>
                  <p className="text-slate-300 font-mono text-[11px]">
                    Total Solved: <strong className="text-white">{hod360Data.leetcode?.totalSolved || 0}</strong> | Contest Rating: <strong className="text-amber-400">{hod360Data.leetcode?.contestRating || 1200}</strong>
                  </p>
                  <ProofAttachmentControl studentId={selectedHODStudent.id} recordType="leetcode" recordId="leetcode-record" userRole="HOD" readOnly={true} />
                </div>
              </div>
            )}

            {['arrears', 'nptel', 'discipline', 'certificates', 'participation', 'projects', 'achievements'].includes(hodModalTab) && (
              <div className="space-y-3">
                {((hod360Data[hodModalTab] || []) as any[]).map((rec: any) => (
                  <div key={rec.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center font-bold text-white">
                      <span>{rec.courseName || rec.subjectCode || rec.title || rec.eventName || rec.remark || 'Record Item'}</span>
                    </div>
                    <ProofAttachmentControl studentId={selectedHODStudent.id} recordType={hodModalTab} recordId={rec.id} userRole="HOD" readOnly={true} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button onClick={() => setSelectedHODStudent(null)} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl font-bold">Close Profile</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        recordName={deleteTarget?.name || ''}
        recordType={deleteTarget?.type || ''}
        onConfirm={handleConfirmDeleteHOD}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      <ForgotPasswordModal
        isOpen={showForgotModal}
        portalRole="HOD"
        onClose={() => setShowForgotModal(false)}
      />
    </DashboardLayout>
  );
};
