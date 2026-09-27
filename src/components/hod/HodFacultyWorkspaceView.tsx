import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../../services/api';
import {
  Users,
  Search,
  ArrowLeft,
  BookOpen,
  Award,
  Trophy,
  CheckCircle,
  Clock,
  Sparkles,
  FileText,
  Code,
  GraduationCap,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Filter,
  CheckCircle2,
  XCircle,
  Layers,
  BarChart2
} from 'lucide-react';
import { ProofAttachmentControl } from '../common/ProofAttachmentControl';

interface HodFacultyWorkspaceViewProps {
  selectedYearFilter?: string;
  selectedSectionFilter?: string;
}

export const HodFacultyWorkspaceView: React.FC<HodFacultyWorkspaceViewProps> = ({
  selectedYearFilter = 'ALL',
  selectedSectionFilter = 'ALL'
}) => {
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [listError, setListError] = useState<string>('');
  const [searchFacultyQuery, setSearchFacultyQuery] = useState<string>('');

  // Individual Workspace State
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState<boolean>(false);
  const [workspaceError, setWorkspaceError] = useState<string>('');

  // Workspace Student Filtering
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [performanceCategory, setPerformanceCategory] = useState<string>('ALL');

  // Modal Inspector State for assigned student
  const [inspectStudent, setInspectStudent] = useState<any | null>(null);
  const [inspect360, setInspect360] = useState<any | null>(null);
  const [inspectModalTab, setInspectModalTab] = useState<string>('academics');

  const fetchFacultyList = useCallback(async () => {
    setIsLoadingList(true);
    setListError('');
    try {
      const res = await API.getHodFacultyList();
      setFacultyList(res.faculty || []);
    } catch (err: any) {
      setListError(err.message || 'Failed to fetch department faculty list.');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadFacultyWorkspace = useCallback(async (facultyId: string) => {
    setSelectedFacultyId(facultyId);
    setIsLoadingWorkspace(true);
    setWorkspaceError('');
    setWorkspaceData(null);
    setStudentSearchQuery('');
    setPerformanceCategory('ALL');
    try {
      const res = await API.getHodFacultyWorkspace(facultyId);
      setWorkspaceData(res);
    } catch (err: any) {
      setWorkspaceError(err.message || 'Failed to load faculty workspace details.');
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    fetchFacultyList();
  }, [fetchFacultyList]);

  const handleOpenStudent360 = (student: any) => {
    setInspectStudent(student);
    const full360 = workspaceData?.workspace360?.find((w: any) => w.student?.id === student.id) || null;
    setInspect360(full360);
    setInspectModalTab('academics');
  };

  // Filter main faculty roster list by year, section, and search query
  const filteredFaculty = facultyList.filter((f) => {
    const matchesYear = selectedYearFilter === 'ALL' || f.year === selectedYearFilter;
    const matchesSection = selectedSectionFilter === 'ALL' || f.section === selectedSectionFilter;
    const query = searchFacultyQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      (f.name || '').toLowerCase().includes(query) ||
      (f.email || '').toLowerCase().includes(query) ||
      (f.identifier || '').toLowerCase().includes(query) ||
      (f.facultyRole || '').toLowerCase().includes(query);

    return matchesYear && matchesSection && matchesQuery;
  });

  // MODE 2: DEDICATED INDIVIDUAL FACULTY WORKSPACE VIEW
  if (selectedFacultyId && (isLoadingWorkspace || workspaceData || workspaceError)) {
    const f = workspaceData?.faculty;
    const summary = workspaceData?.summary;
    const students = workspaceData?.students || [];
    const workspace360List = workspaceData?.workspace360 || [];

    // Map 360 data to student rows
    const enrichedStudents = students.map((stu: any) => {
      const s360 = workspace360List.find((w: any) => w.student?.id === stu.id) || {};
      const attendancePct = s360.attendance?.overallPercentage || s360.attendance?.overall_percentage || 85;
      const arrearsCount = s360.arrears?.standingArrears || s360.arrears?.historyArrears || stu.historyArrears || 0;
      const skilledgePts = s360.skillEdge?.totalRewardPoints || stu.skillEdgePoints || 0;
      const nptelCount = s360.nptel?.courses?.length || (s360.nptel?.verifiedCourses ? 1 : 0);
      const certsCount = s360.certificates?.length || 0;
      const pendingCertsCount = s360.certificates?.filter((c: any) => c.verification_status === 'Pending' || c.verificationStatus === 'Pending').length || 0;
      const projectsCount = s360.projects?.length || 0;
      const leetcodeSolved = s360.leetcode?.totalSolved || s360.leetcode?.solved_count || stu.leetCodeSolved || 0;

      return {
        ...stu,
        s360,
        attendancePct,
        arrearsCount,
        skilledgePts,
        nptelCount,
        certsCount,
        pendingCertsCount,
        projectsCount,
        leetcodeSolved
      };
    });

    // Filter students by search query & performance category
    const filteredStudents = enrichedStudents.filter((stu: any) => {
      const q = studentSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (stu.name || '').toLowerCase().includes(q) ||
        (stu.registerNo || stu.register_no || '').toLowerCase().includes(q);

      let matchesCategory = true;
      if (performanceCategory === 'ARREARS') {
        matchesCategory = stu.arrearsCount > 0;
      } else if (performanceCategory === 'TOP_PERFORMERS') {
        matchesCategory = (stu.cgpa || 0) >= 8.0;
      } else if (performanceCategory === 'HIGH_SKILLEDGE') {
        matchesCategory = stu.skilledgePts >= 100;
      } else if (performanceCategory === 'NPTEL') {
        matchesCategory = stu.nptelCount > 0;
      } else if (performanceCategory === 'PENDING_VERIFICATION') {
        matchesCategory = stu.pendingCertsCount > 0;
      } else if (performanceCategory === 'LEETCODE') {
        matchesCategory = stu.leetcodeSolved > 0;
      }

      return matchesSearch && matchesCategory;
    });

    // Total pending task counter across this faculty's workspace
    const totalPendingVerifications = enrichedStudents.reduce((acc: number, s: any) => acc + s.pendingCertsCount, 0);

    return (
      <div className="space-y-6 text-xs font-sans">
        {/* Back Navigation Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <button
            onClick={() => {
              setSelectedFacultyId(null);
              setWorkspaceData(null);
            }}
            className="flex items-center space-x-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl font-semibold border border-slate-800 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Back to Faculty List</span>
          </button>

          {f && (
            <div className="flex items-center space-x-3 font-mono">
              <span className="text-slate-400">Faculty Workspace:</span>
              <span className="bg-indigo-950 border border-indigo-700/80 text-indigo-300 px-3 py-1 rounded-full font-bold">
                {f.name} ({f.year} — Section {f.section})
              </span>
            </div>
          )}
        </div>

        {isLoadingWorkspace && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 font-mono">
            <Clock className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
            Loading dedicated faculty workspace & student performance metrics...
          </div>
        )}

        {workspaceError && (
          <div className="bg-red-950/80 border border-red-800 text-red-300 p-4 rounded-2xl flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{workspaceError}</span>
          </div>
        )}

        {workspaceData && f && (
          <>
            {/* Faculty Profile & Workspace Metrics Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-amber-500 p-0.5 shadow-lg">
                    <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-indigo-400 font-extrabold text-xl font-mono">
                      {f.name.substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-white">{f.name}</h2>
                      <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                        {f.isActive ? 'ACTIVE FACULTY' : 'INACTIVE'}
                      </span>
                    </div>
                    <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                      ID: <span className="text-slate-200">{f.identifier}</span> | Email: <span className="text-slate-200">{f.email}</span> | Role: <span className="text-amber-400 font-bold">{f.facultyRole}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-right font-mono">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Assigned Class Workspace</div>
                  <div className="text-sm font-extrabold text-indigo-400">{f.department} — {f.year} Sec {f.section}</div>
                </div>
              </div>

              {/* Summary Metrics & Task Submission Tracker */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono">
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase">Assigned Roster</div>
                  <div className="text-lg font-extrabold text-white mt-0.5">{summary?.totalStudents || 0} Students</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase">Class Avg CGPA</div>
                  <div className="text-lg font-extrabold text-emerald-400 mt-0.5">{summary?.avgCgpa ? summary.avgCgpa.toFixed(2) : '0.00'}</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase">Avg SkillEdge</div>
                  <div className="text-lg font-extrabold text-cyan-400 mt-0.5">{summary?.avgSkillEdge || 0} Pts</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase">Verified Certs</div>
                  <div className="text-lg font-extrabold text-amber-400 mt-0.5">{summary?.totalCertificates || 0} Records</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase">Projects & Events</div>
                  <div className="text-lg font-extrabold text-indigo-400 mt-0.5">{(summary?.totalEvents || 0) + (summary?.totalProjects || 0)} Total</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase">Pending Submissions</div>
                  <div className={`text-lg font-extrabold mt-0.5 ${totalPendingVerifications > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                    {totalPendingVerifications} Pending
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Student Roster with Search, Category Filter, and Detailed Performance Metrics */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Faculty Monitoring Workspace Roster</span>
                    <span className="bg-slate-950 text-indigo-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-900/60 font-bold">
                      {filteredStudents.length} of {students.length} Students
                    </span>
                  </h3>
                  <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                    Real student records strictly assigned to {f.name} ({f.year} Sec {f.section}).
                  </p>
                </div>

                {/* Student Search & Category Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search name or reg no..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Performance Category Filter Tabs */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 font-mono text-[11px]">
                {[
                  { id: 'ALL', label: 'All Students' },
                  { id: 'TOP_PERFORMERS', label: '⭐ Top Performers (CGPA ≥ 8.0)' },
                  { id: 'ARREARS', label: '⚠️ Arrears Track' },
                  { id: 'HIGH_SKILLEDGE', label: '⚡ SkillEdge (≥100 pts)' },
                  { id: 'NPTEL', label: '🎓 NPTEL Enrolled' },
                  { id: 'LEETCODE', label: '💻 LeetCode Active' },
                  { id: 'PENDING_VERIFICATION', label: '⏳ Pending Tasks' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPerformanceCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                      performanceCategory === cat.id
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {filteredStudents.length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 p-8 text-center text-slate-400 font-mono rounded-xl space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <div>No assigned students match the current category filter or search query.</div>
                  <p className="text-slate-500 text-[11px]">Try clearing the search query or selecting "All Students".</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px]">
                        <th className="py-3 px-3">Reg No</th>
                        <th className="py-3 px-3">Student Name</th>
                        <th className="py-3 px-3 text-center">Attendance</th>
                        <th className="py-3 px-3 text-center">CGPA</th>
                        <th className="py-3 px-3 text-center">Arrears</th>
                        <th className="py-3 px-3 text-center">SkillEdge</th>
                        <th className="py-3 px-3 text-center">NPTEL</th>
                        <th className="py-3 px-3 text-center">Certs / Proofs</th>
                        <th className="py-3 px-3 text-center">LeetCode</th>
                        <th className="py-3 px-3 text-center">Elite Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {filteredStudents.map((stu: any) => (
                        <tr key={stu.id} className="hover:bg-slate-950/80 transition-colors">
                          <td className="py-3 px-3 text-slate-300 font-bold">{stu.registerNo || stu.register_no}</td>
                          <td className="py-3 px-3 font-bold text-white font-sans">{stu.name}</td>
                          <td className="py-3 px-3 text-center font-bold">
                            <span className={stu.attendancePct >= 80 ? 'text-emerald-400' : 'text-red-400'}>
                              {stu.attendancePct}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-400">
                            {stu.cgpa ? stu.cgpa.toFixed(2) : '0.00'}
                          </td>
                          <td className="py-3 px-3 text-center font-bold">
                            {stu.arrearsCount > 0 ? (
                              <span className="bg-red-950 border border-red-800 text-red-300 px-2 py-0.5 rounded-md text-[10px]">
                                {stu.arrearsCount} Arrears
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-cyan-400">{stu.skilledgePts} pts</td>
                          <td className="py-3 px-3 text-center font-bold text-amber-400">
                            {stu.nptelCount > 0 ? `${stu.nptelCount} Enrolled` : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <span className="text-white font-bold">{stu.certsCount}</span>
                              {stu.pendingCertsCount > 0 && (
                                <span className="bg-amber-950 border border-amber-800 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-bold" title="Pending verifications">
                                  {stu.pendingCertsCount} P
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-yellow-400">
                            {stu.leetcodeSolved > 0 ? `${stu.leetcodeSolved} Solved` : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {stu.isEliteStudent ? (
                              <span className="bg-amber-950 border border-amber-700 text-amber-300 text-[9px] px-2 py-0.5 rounded-full font-bold">
                                ELITE
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[10px]">REGULAR</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleOpenStudent360(stu)}
                              className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1 font-sans"
                            >
                              <span>360° View</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Inspector for Student in Faculty Workspace */}
        {inspectStudent && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-xs font-sans">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <span>Student 360° Monitoring Profile</span>
                    <span className="bg-indigo-950 text-indigo-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-800">
                      {inspectStudent.name}
                    </span>
                  </h3>
                  <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                    Reg No: <strong className="text-slate-200">{inspectStudent.registerNo || inspectStudent.register_no}</strong> | Year: {inspectStudent.year} Sec {inspectStudent.section}
                  </p>
                </div>
                <button
                  onClick={() => setInspectStudent(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl hover:text-white transition-all font-mono font-bold"
                >
                  ✕ Close
                </button>
              </div>

              {/* Tabs inside Modal */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800 font-mono">
                {[
                  { id: 'academics', label: '📖 Academics & SGPA/CGPA' },
                  { id: 'attendance', label: '📊 Attendance' },
                  { id: 'skilledge', label: '⚡ SkillEdge' },
                  { id: 'nptel', label: '🎓 NPTEL Courses' },
                  { id: 'certificates', label: '📜 Certificates' },
                  { id: 'projects', label: '🚀 Projects' },
                  { id: 'leetcode', label: '💻 LeetCode' },
                  { id: 'discipline', label: '🛡️ Discipline & Fines' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setInspectModalTab(cat.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      inspectModalTab === cat.id
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-lg'
                        : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {inspectModalTab === 'academics' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-emerald-400 uppercase text-sm">Academic Record & Marksheet Proof</h4>
                    <span className="text-slate-400">CGPA: <strong className="text-emerald-400 text-base">{inspectStudent.cgpa ? inspectStudent.cgpa.toFixed(2) : '0.00'}</strong></span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">1st Year SGPA</div>
                      <div className="text-sm font-bold text-white mt-0.5">{inspect360?.academics?.sgpa_sem1 || inspectStudent.sgpa_sem1 || 'N/A'} / {inspect360?.academics?.sgpa_sem2 || inspectStudent.sgpa_sem2 || 'N/A'}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">Standing Arrears</div>
                      <div className="text-sm font-bold text-red-400 mt-0.5">{inspect360?.arrears?.standingArrears || inspectStudent.standingArrears || 0}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">History Arrears</div>
                      <div className="text-sm font-bold text-amber-400 mt-0.5">{inspect360?.arrears?.historyArrears || inspectStudent.historyArrears || 0}</div>
                    </div>
                  </div>
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="academics" recordId="cgpa-record" userRole="HOD" />
                </div>
              )}

              {inspectModalTab === 'attendance' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-indigo-400 uppercase text-sm">Attendance Summary & Verified Proof</h4>
                    <span className="text-indigo-400 font-bold text-base">{inspect360?.attendance?.overallPercentage || inspectStudent.attendancePct || 85}%</span>
                  </div>
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="attendance" recordId="attendance-record" userRole="HOD" />
                </div>
              )}

              {inspectModalTab === 'skilledge' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-cyan-400 uppercase text-sm">SkillEdge Points & Achievements</h4>
                    <span className="text-cyan-400 font-bold text-base">{inspect360?.skillEdge?.totalRewardPoints || inspectStudent.skilledgePts || 0} Pts</span>
                  </div>
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="skilledge" recordId="skilledge-record" userRole="HOD" />
                </div>
              )}

              {inspectModalTab === 'nptel' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-amber-400 uppercase text-sm">NPTEL / SWAYAM Course Records</h4>
                    <span className="text-amber-400 font-bold text-xs">{inspect360?.nptel?.courses?.length || 0} Courses Enrolled</span>
                  </div>
                  {inspect360?.nptel?.courses?.length > 0 ? (
                    <div className="space-y-2">
                      {inspect360.nptel.courses.map((c: any, idx: number) => (
                        <div key={idx} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{c.courseName || c.title || 'NPTEL Course'}</div>
                            <div className="text-[10px] text-slate-400">Score: {c.score || 'In Progress'} | Status: {c.status || 'Verified'}</div>
                          </div>
                          <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold">VERIFIED</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs">No NPTEL courses recorded for this student yet.</div>
                  )}
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="nptel" recordId="nptel-record" userRole="HOD" />
                </div>
              )}

              {inspectModalTab === 'certificates' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-amber-400 uppercase text-sm">Certificates & Verification Status</h4>
                    <span className="text-amber-400 font-bold text-xs">{inspect360?.certificates?.length || 0} Submissions</span>
                  </div>
                  {inspect360?.certificates?.length > 0 ? (
                    <div className="space-y-2">
                      {inspect360.certificates.map((cert: any) => (
                        <div key={cert.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{cert.title || cert.courseName}</div>
                            <div className="text-[10px] text-slate-400">Issuer: {cert.issuer} | Date: {cert.issue_date || cert.issueDate}</div>
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${cert.verification_status === 'Verified' ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-amber-950 border-amber-800 text-amber-300'}`}>
                            {cert.verification_status || cert.verificationStatus || 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs">No certificate records submitted yet.</div>
                  )}
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="certificates" recordId="certificates-record" userRole="HOD" />
                </div>
              )}

              {inspectModalTab === 'projects' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-indigo-400 uppercase text-sm">Projects & Repositories</h4>
                    <span className="text-indigo-400 font-bold text-xs">{inspect360?.projects?.length || 0} Projects</span>
                  </div>
                  {inspect360?.projects?.length > 0 ? (
                    <div className="space-y-2">
                      {inspect360.projects.map((p: any) => (
                        <div key={p.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <div className="font-bold text-white">{p.title}</div>
                          <div className="text-[10px] text-slate-400 mt-1">{p.description}</div>
                          <div className="text-[10px] text-indigo-400 mt-1 font-mono">Tech Stack: {p.tech_stack || p.techStack}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs">No projects uploaded yet.</div>
                  )}
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="projects" recordId="projects-record" userRole="HOD" />
                </div>
              )}

              {inspectModalTab === 'leetcode' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-yellow-400 uppercase text-sm">LeetCode Statistics</h4>
                    <span className="text-yellow-400 font-bold text-xs">Username: {inspect360?.leetcode?.username || 'Not Connected'}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">Total Solved</div>
                      <div className="text-base font-bold text-yellow-400 mt-0.5">{inspect360?.leetcode?.totalSolved || 0}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-emerald-400">Easy</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">{inspect360?.leetcode?.easySolved || 0}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-amber-400">Medium</div>
                      <div className="text-base font-bold text-amber-400 mt-0.5">{inspect360?.leetcode?.mediumSolved || 0}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-red-400">Hard</div>
                      <div className="text-base font-bold text-red-400 mt-0.5">{inspect360?.leetcode?.hardSolved || 0}</div>
                    </div>
                  </div>
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="leetcode" recordId="leetcode-record" userRole="HOD" />
                </div>
              )}

              {inspectModalTab === 'discipline' && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-red-400 uppercase text-sm">Discipline Records & Fines</h4>
                    <span className="text-red-400 font-bold text-xs">{inspect360?.discipline?.length || 0} Incidents</span>
                  </div>
                  {inspect360?.discipline?.length > 0 ? (
                    <div className="space-y-2">
                      {inspect360.discipline.map((d: any) => (
                        <div key={d.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{d.incident_description || d.reason}</div>
                            <div className="text-[10px] text-slate-400">Fine: ₹{d.fine_amount || d.fineAmount || 0} | Date: {d.incident_date || d.incidentDate}</div>
                          </div>
                          <span className="bg-red-950 border border-red-800 text-red-300 text-[10px] px-2 py-0.5 rounded-full font-bold">RECORDED</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs">Clean record — No disciplinary actions or fines recorded.</div>
                  )}
                  <ProofAttachmentControl studentId={inspectStudent.id} recordType="discipline" recordId="discipline-record" userRole="HOD" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // MODE 1: FACULTY ROSTER LIST VIEW
  return (
    <div className="space-y-6 text-xs font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700 flex items-center justify-center text-indigo-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
                <span>Department Faculty Roster & Workspaces</span>
                <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                  AUTO-SYNCHRONIZED WITH ADMIN
                </span>
              </h2>
              <p className="text-slate-400 font-mono text-[11px]">
                Click any staff member to open their dedicated faculty workspace, assigned student roster, and proof records.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search staff by name, email, ID..."
            value={searchFacultyQuery}
            onChange={(e) => setSearchFacultyQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {isLoadingList && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 font-mono">
          <Clock className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          Fetching real-time department faculty roster from database...
        </div>
      )}

      {listError && (
        <div className="bg-red-950/80 border border-red-800 text-red-300 p-4 rounded-2xl flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{listError}</span>
        </div>
      )}

      {!isLoadingList && !listError && (
        <>
          {filteredFaculty.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-white font-bold text-sm font-mono">No Faculty Members Found</div>
              <p className="text-slate-400 text-xs font-mono max-w-md mx-auto">
                No active faculty members match your filter query. Add faculty members in Admin Panel → Add Faculty to populate this list automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFaculty.map((f) => (
                <div
                  key={f.id}
                  onClick={() => loadFacultyWorkspace(f.id)}
                  className="bg-slate-900 hover:bg-slate-900/90 border border-slate-800 hover:border-indigo-500/60 rounded-2xl p-5 shadow-xl transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-950 to-slate-800 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-bold font-mono text-sm group-hover:scale-105 transition-transform">
                          {f.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors flex items-center space-x-1.5">
                            <span>{f.name}</span>
                          </h3>
                          <span className="text-[11px] text-amber-400 font-mono font-semibold">{f.facultyRole}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${f.isActive ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                        {f.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span>Faculty ID / Reg:</span>
                        <strong className="text-slate-200">{f.identifier}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>College Email:</span>
                        <strong className="text-slate-200 truncate max-w-[160px]">{f.email}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Class Workspace:</span>
                        <strong className="text-indigo-400 font-bold">{f.year} — Sec {f.section}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
                    <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Assigned Roster: <strong className="text-white font-bold">{f.assignedStudentsCount} Students</strong></span>
                    </div>

                    <div className="text-indigo-400 group-hover:text-amber-400 text-xs font-bold flex items-center space-x-1 transition-colors font-sans">
                      <span>Workspace</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
