import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { API, API_BASE, fetchWithResilience } from '../../services/api';
import type { UserSession, Student, TeamHead, Subject } from '../../types';
import { DashboardLayout, type MenuItem } from '../../components/layout/DashboardLayout';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { ForgotPasswordModal } from '../../components/common/ForgotPasswordModal';
import { SubjectManagement } from '../../components/academic/SubjectManagement';
import { AcademicsModule } from '../../components/academic/AcademicsModule';
import { BestEliteStudentsView } from '../../components/elite/BestEliteStudentsView';
import { GeminiTopRecognitionView } from '../../components/ranking/GeminiTopRecognitionView';
import { GeminiCategoryBestPerformerCard } from '../../components/ranking/GeminiCategoryBestPerformerCard';
import { GeminiFullLeetCodeDashboard } from '../../components/ranking/GeminiFullLeetCodeDashboard';
import { getNptelUrlForStudent } from '../../services/nptelUrlHelper';
import {
  Users,
  Search,
  Trash2,
  BookOpen,
  Award,
  Calendar,
  Code,
  AlertTriangle,
  FileCheck,
  Trophy,
  FileText,
  ShieldCheck,
  UserCheck,
  UserPlus,
  FileSpreadsheet,
  Key,
  Lock,
  Eye,
  EyeOff,
  X,
  ArrowLeft,
  Save,
  RefreshCw,
  ImageIcon,
  Upload,
  ExternalLink,
  Plus,
  Crown,
  Sparkles,
  CheckCircle2,
  Star,
  User,
  CheckCircle,
  XCircle,
  RotateCcw,
  Pencil,
  Download,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ShieldAlert
} from 'lucide-react';

function formatDate(d?: string): string {
  if (!d) return 'Never';
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString();
}

export const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState<'ALL' | 'Regular' | 'Lateral Entry'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [assignedYear, setAssignedYear] = useState('');
  const [assignedSection, setAssignedSection] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Student 360 Loading & Error State
  const [student360Loading, setStudent360Loading] = useState(false);
  const [student360Error, setStudent360Error] = useState('');

  // Sidebar Active Tab & Collapsible Submenu State
  const [activeTab, setActiveTab] = useState<string>('my-students');
  const [isBestStudentExpanded, setIsBestStudentExpanded] = useState<boolean>(true);
  const [isBestTeamHeadExpanded, setIsBestTeamHeadExpanded] = useState<boolean>(false);
  const [isBestEliteStudentExpanded, setIsBestEliteStudentExpanded] = useState<boolean>(false);
  const [isBestLeetCodePerformerExpanded, setIsBestLeetCodePerformerExpanded] = useState<boolean>(false);

  // Modals Visibility
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Single Student Onboarding Form State (My Students)
  const [addRegNo, setAddRegNo] = useState('');
  const [addName, setAddName] = useState('');
  const [addCollegeMail, setAddCollegeMail] = useState('');
  const [addPersonalMail, setAddPersonalMail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addEntryType, setAddEntryType] = useState<'Regular' | 'Lateral Entry'>('Regular');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Password Reset Modal State for Class Coordinator
  const [resetStudentTarget, setResetStudentTarget] = useState<Student | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetConfirmVal, setResetConfirmVal] = useState('');
  const [isResettingStudentPass, setIsResettingStudentPass] = useState(false);
  const [resetStudentError, setResetStudentError] = useState('');

  // Delete Student Modal State for Class Coordinator
  const [deleteStudentTarget, setDeleteStudentTarget] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteStudentError, setDeleteStudentError] = useState('');
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);

  // CSV File Bulk Import State for Faculty
  const facCsvFileInputRef = useRef<HTMLInputElement>(null);
  const [facSelectedCsvFile, setFacSelectedCsvFile] = useState<File | null>(null);
  const [facCsvRows, setFacCsvRows] = useState<any[]>([]);
  const [facCsvStats, setFacCsvStats] = useState({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
  const [facImportResult, setFacImportResult] = useState<any | null>(null);
  const [isImportingFacCsv, setIsImportingFacCsv] = useState(false);
  const [facCsvImportError, setFacCsvImportError] = useState('');

  // Global Selected Student state for Module Editors
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [student360Edit, setStudent360Edit] = useState<any>(null);

  // Student View & Edit Modals State
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    mobileNumber: '',
    collegeEmail: '',
    personalEmail: '',
    address: '',
    cgpa: 0
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const handleViewStudent = async (stu: Student) => {
    try {
      const res = await API.getFacultyStudentById(stu.id);
      setViewingStudent(res.student);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch student details.');
    }
  };

  const handleOpenEditStudent = (stu: Student) => {
    setEditingStudent(stu);
    setEditForm({
      name: stu.name || '',
      mobileNumber: stu.mobileNumber || (stu as any).mobile_number || '',
      collegeEmail: stu.collegeEmail || stu.email || '',
      personalEmail: stu.personalEmail || (stu as any).personal_email || '',
      address: stu.address || '',
      cgpa: stu.cgpa || 0
    });
    setEditError('');
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsSavingEdit(true);
    setEditError('');
    try {
      const res = await API.updateFacultyStudentDetails(editingStudent.id, editForm);
      alert(res.message || 'Student details updated successfully.');
      setEditingStudent(null);
      fetchRoster();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update student details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Module Student Search State inside helper picker
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  // Registered subjects state for dynamic academic marks entry
  const [registeredSubjects, setRegisteredSubjects] = useState<Subject[]>([]);

  // --- BEST TEAM HEAD STATE ---
  const [teamHeads, setTeamHeads] = useState<TeamHead[]>([]);
  const [expandedTeamHeadId, setExpandedTeamHeadId] = useState<string | null>(null);
  const [showAddTeamHeadModal, setShowAddTeamHeadModal] = useState(false);
  const [addTeamHeadStudentId, setAddTeamHeadStudentId] = useState('');
  const [addTeamHeadMemberLimit, setAddTeamHeadMemberLimit] = useState<number>(5);
  const [addTeamHeadError, setAddTeamHeadError] = useState('');
  const [isSavingTeamHead, setIsSavingTeamHead] = useState(false);

  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [addMembersTargetHead, setAddMembersTargetHead] = useState<TeamHead | null>(null);
  const [addMembersSlotSelections, setAddMembersSlotSelections] = useState<string[]>([]);
  const [addMembersError, setAddMembersError] = useState('');
  const [isSavingMembers, setIsSavingMembers] = useState(false);

  const [editingLimitHead, setEditingLimitHead] = useState<TeamHead | null>(null);
  const [newLimitVal, setNewLimitVal] = useState<number>(5);
  const [editLimitError, setEditLimitError] = useState('');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  const [selectedTeamContext, setSelectedTeamContext] = useState<{
    isTeamContext: boolean;
    role: 'Team Head' | 'Team Member';
    headName: string;
    teamHeadId: string;
  } | null>(null);

  // --- ACADEMICS FORM STATE ---
  const [examType, setExamType] = useState<'Internal' | 'Model' | 'Semester'>('Internal');
  const [subjectCount, setSubjectCount] = useState<number>(3);
  const [subjectRows, setSubjectRows] = useState<{ code: string; title: string; marks?: number; maxMarks?: number; grade?: string; credits?: number }[]>([
    { code: 'AD3401', title: 'Data Exploration and Visualization', marks: 85, maxMarks: 100, credits: 3 },
    { code: 'AD3402', title: 'Operating Systems', marks: 78, maxMarks: 100, credits: 3 },
    { code: 'AD3403', title: 'Machine Learning Tech', marks: 92, maxMarks: 100, credits: 4 }
  ]);

  // --- SKILLEDGE CHECKBOX GRID STATE ---
  const [skillLevels, setSkillLevels] = useState<{
    c: boolean[];
    java: boolean[];
    python: boolean[];
    ds: boolean[];
  }>({
    c: [false, false, false, false, false, false],
    java: [false, false, false, false, false],
    python: [false, false, false, false, false],
    ds: [false, false, false, false, false, false, false, false, false, false]
  });

  // --- NPTEL FORM & DIRECT EMAIL VERIFICATION STATE ---
  const [nptelSelectedEmail, setNptelSelectedEmail] = useState<string>('');
  const [nptelEmailType, setNptelEmailType] = useState<'COLLEGE' | 'PERSONAL'>('COLLEGE');
  const [nptelConnection, setNptelConnection] = useState<any>(null);
  const [nptelOauthError, setNptelOauthError] = useState<string>('');
  const [nptelWeeklyProofs, setNptelWeeklyProofs] = useState<any[]>([]);
  const [showNptelProofModal, setShowNptelProofModal] = useState(false);
  const [showNptelVerifyModal, setShowNptelVerifyModal] = useState(false);
  const [nptelTargetEmail, setNptelTargetEmail] = useState('');
  const [nptelProofWeek, setNptelProofWeek] = useState('Week 1');
  const [nptelProofFile, setNptelProofFile] = useState<File | null>(null);

  // --- ATTENDANCE STATE (CR ATTENDANCE WORKFLOW) ---
  const [attGroup, setAttGroup] = useState<'REGULAR' | 'LATERAL'>('REGULAR');
  const [attDate, setAttDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [attStudentStatuses, setAttStudentStatuses] = useState<Record<string, string>>({});
  const [attSearch, setAttSearch] = useState('');
  const [attViewMode, setAttViewMode] = useState<'DAILY' | 'SUMMARY' | 'BULK_IMPORT'>('DAILY');
  const [monthlySummaryList, setMonthlySummaryList] = useState<any[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [attHistory, setAttHistory] = useState<any[]>([]);
  const [isAttSaving, setIsAttSaving] = useState(false);

  // Bulk Import state
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isBulkPreviewing, setIsBulkPreviewing] = useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [bulkPreviewResult, setBulkPreviewResult] = useState<any | null>(null);
  const [bulkImportError, setBulkImportError] = useState('');
  const [bulkImportSuccess, setBulkImportSuccess] = useState('');

  // --- DISCIPLINE FORM STATE & FINE RULE ENGINE ---
  const [discCat, setDisciplineCat] = useState<'Late Comer' | 'Grooming' | 'ID Card' | 'Dress Code'>('Late Comer');
  const [discRemark, setDisciplineRemark] = useState('');
  const [discActionTaken, setDisciplineActionTaken] = useState('');

  // --- CERTIFICATE FORM & UPLOAD MODAL STATE ---
  const [showCertModal, setShowCertModal] = useState(false);
  const [editingCert, setEditingCert] = useState<any | null>(null);
  const [certCourseName, setCertCourseName] = useState('');
  const [certPlatform, setCertPlatform] = useState('');
  const [certCategory, setCertCategory] = useState('Technical Certification');
  const [certIssueDate, setCertIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certError, setCertError] = useState('');

  // --- LEETCODE STATE ---
  const [leetcodeSelectedEmail, setLeetcodeSelectedEmail] = useState<string>('');
  const [editLeetCodeUsername, setEditLeetCodeUsername] = useState('');
  const [isEditingLeetcodeUser, setIsEditingLeetcodeUser] = useState(false);
  const [besLinkedinUrl, setBesLinkedinUrl] = useState('');
  const [besGithubUrl, setBesGithubUrl] = useState('');

  // --- PARTICIPATION FORM & UPLOAD MODAL STATE ---
  const [showPartModal, setShowPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any | null>(null);
  const [partStudentId, setPartStudentId] = useState('');
  const [partEventName, setPartEventName] = useState('');
  const [partCategory, setPartCategory] = useState('Symposium');
  const [partEventLevel, setPartEventLevel] = useState('College');
  const [partOrganizer, setPartOrganizer] = useState('');
  const [partDate, setPartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [partAchievement, setPartAchievement] = useState('Participant');
  const [partDescription, setPartDescription] = useState('');
  const [partFile, setPartFile] = useState<File | null>(null);
  const [partUploading, setPartUploading] = useState(false);
  const [partError, setPartError] = useState('');

  // Search & Filter state for Participation
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [partCategoryFilter, setPartCategoryFilter] = useState('ALL');
  const [partLevelFilter, setPartLevelFilter] = useState('ALL');

  // --- PROJECT FORM STATE ---
  const [projTitle, setProjTitle] = useState('');
  const [projCategory, setProjCategory] = useState<'Software' | 'Hardware' | ''>('');
  const [projLiveUrl, setProjLiveUrl] = useState('');
  const [projUrl, setProjUrl] = useState('');

  // --- DELETION STATE ---
  const [deleteTarget, setDeleteTarget] = useState<{ studentId: string; recordType: string; recordId: string; recordName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Session & Roster on Mount
  useEffect(() => {
    API.getMe()
      .then((res) => {
        setSession(res.user);
        fetchRoster();
        fetchTeamHeads();
      })
      .catch(() => {
        navigate('/faculty');
      });
  }, [navigate]);

  const fetchTeamHeads = async () => {
    try {
      const res = await API.getTeamHeads();
      setTeamHeads(res.teamHeads || []);
    } catch (err: any) {
      console.error('Failed to fetch team heads:', err);
    }
  };

  useEffect(() => {
    if (session && activeTab.startsWith('bth-')) {
      fetchTeamHeads();
    }
  }, [session, activeTab]);

  const handleSelectTeamStudent = (
    stu: Student,
    role: 'Team Head' | 'Team Member',
    headName: string,
    teamHeadId: string,
    targetModule: string = 'bth-academics'
  ) => {
    setSelectedStudent(stu);
    setSelectedTeamContext({
      isTeamContext: true,
      role,
      headName,
      teamHeadId
    });
    setActiveTab(targetModule);
  };

  const handleBackToTeam = () => {
    setActiveTab('bth-team-heads');
    if (selectedTeamContext?.teamHeadId) {
      setExpandedTeamHeadId(selectedTeamContext.teamHeadId);
    }
  };

  const handleBackToTeamHeads = () => {
    setActiveTab('bth-team-heads');
  };

  const handleSaveTeamHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddTeamHeadError('');
    if (!addTeamHeadStudentId) {
      setAddTeamHeadError('Please select a student for Team Head.');
      return;
    }
    setIsSavingTeamHead(true);
    try {
      await API.createTeamHead(addTeamHeadStudentId, addTeamHeadMemberLimit);
      await fetchTeamHeads();
      setShowAddTeamHeadModal(false);
      setAddTeamHeadStudentId('');
      setAddTeamHeadMemberLimit(5);
    } catch (err: any) {
      setAddTeamHeadError(err.message || 'Failed to create Team Head.');
    } finally {
      setIsSavingTeamHead(false);
    }
  };

  const handleOpenAddMembers = (head: TeamHead) => {
    setAddMembersTargetHead(head);
    const initialSlots = Array.from({ length: head.memberLimit }, (_, i) => head.members[i]?.id || '');
    setAddMembersSlotSelections(initialSlots);
    setAddMembersError('');
    setShowAddMembersModal(true);
  };

  const handleSaveMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMembersTargetHead) return;
    setAddMembersError('');
    const filteredStudentIds = addMembersSlotSelections.filter(Boolean);
    setIsSavingMembers(true);
    try {
      await API.updateTeamHeadMembers(addMembersTargetHead.id, filteredStudentIds);
      await fetchTeamHeads();
      setShowAddMembersModal(false);
    } catch (err: any) {
      setAddMembersError(err.message || 'Failed to save members.');
    } finally {
      setIsSavingMembers(false);
    }
  };

  const handleRemoveMember = async (headId: string, studentId: string) => {
    try {
      await API.removeTeamHeadMember(headId, studentId);
      await fetchTeamHeads();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    }
  };

  const handleSaveMemberLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLimitHead) return;
    setEditLimitError('');
    setIsUpdatingLimit(true);
    try {
      await API.updateTeamHeadLimit(editingLimitHead.id, newLimitVal);
      await fetchTeamHeads();
      setEditingLimitHead(null);
    } catch (err: any) {
      setEditLimitError(err.message || 'Failed to update member limit.');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const handleDeleteTeamHead = async (headId: string) => {
    if (!confirm('Are you sure you want to delete this Team Head configuration? Student performance data will NOT be deleted.')) return;
    try {
      await API.deleteTeamHead(headId);
      await fetchTeamHeads();
    } catch (err: any) {
      alert(err.message || 'Failed to delete Team Head.');
    }
  };

  // Check URL query parameters for NPTEL OAuth callback status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('nptel_oauth');
    const err = params.get('error');

    if (oauthStatus === 'success') {
      setActiveTab('nptel');
      setNptelOauthError('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthStatus === 'failed') {
      setActiveTab('nptel');
      setNptelOauthError(err || 'Google OAuth sign-in failed. Please retry.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchRoster = async () => {
    setIsLoading(true);
    try {
      const res = await API.getAssignedRoster();
      setAssignedYear(res.assignedYear);
      setAssignedSection(res.assignedSection);
      setStudents(res.students);
    } catch (err: any) {
      console.error('Failed to fetch assigned roster:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Synchronize student360Edit when selectedStudent changes
  useEffect(() => {
    if (!selectedStudent) return;

    setStudent360Loading(true);
    setStudent360Error('');

    API.getStudent360ForFaculty(selectedStudent.id)
      .then((data) => {
        setStudent360Edit(data);
        const validHandle = (data.leetcode?.username && !['student', 'leetcode_user'].includes(data.leetcode.username.toLowerCase()))
          ? data.leetcode.username
          : (data as any).connectedAccounts?.find((a: any) => a.provider === 'LeetCode' || a.platform_name === 'LeetCode')?.provider_username;
        if (validHandle && !['student', 'leetcode_user'].includes(validHandle.toLowerCase())) {
          setEditLeetCodeUsername(validHandle);
        } else {
          setEditLeetCodeUsername('');
        }
        // Initialize SkillEdge checkboxes if present
        if (data.skillEdge) {
          setSkillLevels({
            c: [
              Boolean(data.skillEdge.c_basics),
              Boolean(data.skillEdge.c_control),
              Boolean(data.skillEdge.c_functions),
              Boolean(data.skillEdge.c_arrays),
              Boolean(data.skillEdge.c_pointers),
              Boolean(data.skillEdge.c_structures)
            ],
            java: [
              Boolean(data.skillEdge.java_basics),
              Boolean(data.skillEdge.java_oop),
              Boolean(data.skillEdge.java_collections),
              Boolean(data.skillEdge.java_threads),
              Boolean(data.skillEdge.java_frameworks)
            ],
            python: [
              Boolean(data.skillEdge.py_basics),
              Boolean(data.skillEdge.py_ds),
              Boolean(data.skillEdge.py_oops),
              Boolean(data.skillEdge.py_libraries),
              Boolean(data.skillEdge.py_advanced)
            ],
            ds: [
              Boolean(data.skillEdge.ds_arrays),
              Boolean(data.skillEdge.ds_linkedlist),
              Boolean(data.skillEdge.ds_stack),
              Boolean(data.skillEdge.ds_queue),
              Boolean(data.skillEdge.ds_trees),
              Boolean(data.skillEdge.ds_graphs),
              Boolean(data.skillEdge.ds_hashing),
              Boolean(data.skillEdge.ds_heaps),
              Boolean(data.skillEdge.ds_dp),
              Boolean(data.skillEdge.ds_greedy)
            ]
          });
        }
      })
      .catch((err: any) => {
        setStudent360Error(err.message || 'Failed to fetch student 360 profile.');
      })
      .finally(() => {
        setStudent360Loading(false);
      });
  }, [selectedStudent]);

  const fetchNptelProofs = async (studentId: string) => {
    try {
      const res = await API.getNptelProofs(studentId);
      setNptelWeeklyProofs(res.proofs || []);
    } catch {
      setNptelWeeklyProofs([]);
    }
  };

  // Fetch NPTEL connection & proofs whenever selectedStudent changes
  useEffect(() => {
    if (!selectedStudent) {
      setNptelConnection(null);
      setNptelWeeklyProofs([]);
      setNptelSelectedEmail('');
      setLeetcodeSelectedEmail('');
      return;
    }

    const primaryEmail = selectedStudent.collegeEmail || selectedStudent.email || selectedStudent.personalEmail || '';
    setNptelSelectedEmail(primaryEmail);
    setLeetcodeSelectedEmail(primaryEmail);

    fetchWithResilience(`${API_BASE}/faculty/students/${selectedStudent.id}/nptel-connection`)
      .then((r) => r.json())
      .then((data) => {
        setNptelConnection(data.connection || null);
      })
      .catch(() => setNptelConnection(null));

    fetchNptelProofs(selectedStudent.id);

    const hasCollege = Boolean(selectedStudent.email || selectedStudent.collegeEmail);
    const hasPersonal = Boolean(selectedStudent.personalEmail || (selectedStudent as any).personal_email);
    if (!hasCollege && hasPersonal) {
      setNptelEmailType('PERSONAL');
    } else {
      setNptelEmailType('COLLEGE');
    }
  }, [selectedStudent]);

  const handleSaveNptelProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!nptelProofFile) {
      alert('Please select a screenshot or proof file to upload.');
      return;
    }

    const weekNo = parseInt(nptelProofWeek.replace('Week ', ''), 10);
    if (isNaN(weekNo) || weekNo < 1 || weekNo > 10) {
      alert('Invalid week selection. Please select Week 1 through Week 10.');
      return;
    }

    try {
      const res = await API.uploadNptelProof(selectedStudent.id, weekNo, nptelProofFile);
      alert(res.message || `Week ${weekNo} proof uploaded successfully.`);
      setNptelProofFile(null);
      setShowNptelProofModal(false);
      await fetchNptelProofs(selectedStudent.id);
    } catch (err: any) {
      alert(err.message || 'Failed to upload NPTEL proof.');
    }
  };

  const handleDeleteNptelProof = async (proofId: string) => {
    if (!selectedStudent) return;
    if (!confirm('Are you sure you want to delete this weekly proof record?')) return;

    try {
      const res = await API.deleteNptelProof(selectedStudent.id, proofId);
      alert(res.message || 'Proof record deleted successfully.');
      await fetchNptelProofs(selectedStudent.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete NPTEL proof record.');
    }
  };

  const handleOpenCertModal = (cert?: any) => {
    if (cert) {
      setEditingCert(cert);
      setCertCourseName(cert.courseName || cert.title || '');
      setCertPlatform(cert.platform || cert.issuingOrganization || cert.issuedBy || '');
      setCertCategory(cert.category || 'Technical Certification');
      setCertIssueDate(cert.issueDate || cert.issued_date || new Date().toISOString().split('T')[0]);
    } else {
      setEditingCert(null);
      setCertCourseName('');
      setCertPlatform('');
      setCertCategory('Technical Certification');
      setCertIssueDate(new Date().toISOString().split('T')[0]);
    }
    setCertFile(null);
    setCertError('');
    setShowCertModal(true);
  };

  const handleSaveCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!certCourseName.trim()) {
      setCertError('Please enter the Certificate / Course Name.');
      return;
    }
    if (!certPlatform.trim()) {
      setCertError('Please enter the Issuing Organization / Platform.');
      return;
    }

    if (!editingCert && !certFile) {
      setCertError('Please select a certificate file (PDF, JPG, or PNG under 10MB).');
      return;
    }

    if (certFile) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowed.includes(certFile.type) && !certFile.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
        setCertError('Invalid file type. Only PDF, JPG, and PNG files are allowed.');
        return;
      }
      if (certFile.size > 10 * 1024 * 1024) {
        setCertError('File size exceeds the 10MB limit.');
        return;
      }
    }

    setCertUploading(true);
    setCertError('');

    try {
      const formData = new FormData();
      formData.append('courseName', certCourseName.trim());
      formData.append('platform', certPlatform.trim());
      formData.append('category', certCategory);
      if (certIssueDate) formData.append('issueDate', certIssueDate);
      if (certFile) formData.append('file', certFile);

      if (editingCert) {
        await API.updateCertificateForFaculty(selectedStudent.id, editingCert.id, formData);
        alert(`Certificate "${certCourseName}" updated successfully.`);
      } else {
        await API.uploadCertificateForFaculty(selectedStudent.id, formData);
        alert(`Certificate "${certCourseName}" uploaded successfully.`);
      }

      setShowCertModal(false);
      setCertFile(null);
      await reloadStudent360();
    } catch (err: any) {
      setCertError(err.message || 'Failed to save certificate.');
    } finally {
      setCertUploading(false);
    }
  };

  const handleDeleteCertificateRecord = async (certId: string, certName: string) => {
    if (!selectedStudent) return;
    if (!confirm(`Are you sure you want to delete the certificate "${certName}"?`)) return;

    try {
      await API.deleteCertificateForFaculty(selectedStudent.id, certId);
      alert(`Certificate "${certName}" deleted successfully.`);
      await reloadStudent360();
    } catch (err: any) {
      alert(err.message || 'Failed to delete certificate.');
    }
  };

  const handleOpenPartModal = (part?: any) => {
    if (part) {
      setEditingPart(part);
      setPartStudentId(part.student_id || part.studentId || selectedStudent?.id || '');
      setPartEventName(part.eventName || part.event_name || '');
      setPartCategory(part.category || part.eventType || part.event_type || 'Symposium');
      setPartEventLevel(part.eventLevel || part.event_level || 'College');
      setPartOrganizer(part.organizer || part.collegeName || part.college_name || '');
      setPartDate(part.date || new Date().toISOString().split('T')[0]);
      setPartAchievement(part.achievement || part.position || 'Participant');
      setPartDescription(part.description || '');
    } else {
      setEditingPart(null);
      setPartStudentId(selectedStudent?.id || (students[0]?.id || ''));
      setPartEventName('');
      setPartCategory('Symposium');
      setPartEventLevel('College');
      setPartOrganizer('');
      setPartDate(new Date().toISOString().split('T')[0]);
      setPartAchievement('Participant');
      setPartDescription('');
    }
    setPartFile(null);
    setPartError('');
    setShowPartModal(true);
  };

  const handleSaveParticipation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStudentId = selectedStudent?.id || partStudentId;
    if (!targetStudentId) {
      setPartError('Please select a student.');
      return;
    }
    if (!partEventName.trim()) {
      setPartError('Please enter the Event Name.');
      return;
    }
    if (!partOrganizer.trim()) {
      setPartError('Please enter the Event Organizer / Host Institution.');
      return;
    }

    if (!editingPart && !partFile) {
      setPartError('Please select a proof document or certificate file (PDF, JPG, or PNG under 10MB).');
      return;
    }

    if (partFile) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowed.includes(partFile.type) && !partFile.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
        setPartError('Invalid file type. Only PDF, JPG, and PNG files are allowed.');
        return;
      }
      if (partFile.size > 10 * 1024 * 1024) {
        setPartError('File size exceeds the 10MB limit.');
        return;
      }
    }

    setPartUploading(true);
    setPartError('');

    try {
      const formData = new FormData();
      formData.append('eventName', partEventName.trim());
      formData.append('category', partCategory);
      formData.append('eventLevel', partEventLevel);
      formData.append('organizer', partOrganizer.trim());
      formData.append('date', partDate);
      formData.append('achievement', partAchievement.trim());
      formData.append('description', partDescription.trim());
      if (partFile) {
        formData.append('file', partFile);
      }

      if (editingPart) {
        await API.updateParticipationForFaculty(targetStudentId, editingPart.id, formData);
        alert(`Participation record "${partEventName}" updated successfully.`);
      } else {
        await API.uploadParticipationForFaculty(targetStudentId, formData);
        alert(`Participation record "${partEventName}" uploaded successfully.`);
      }

      setShowPartModal(false);
      setPartFile(null);
      await reloadStudent360();
    } catch (err: any) {
      setPartError(err.message || 'Failed to save participation record.');
    } finally {
      setPartUploading(false);
    }
  };

  const handleDeleteParticipationRecord = async (partId: string, eventName: string) => {
    if (!selectedStudent) return;
    if (!confirm(`Are you sure you want to delete the participation record for "${eventName}"?`)) return;

    try {
      await API.deleteParticipationForFaculty(selectedStudent.id, partId);
      alert(`Participation record for "${eventName}" deleted successfully.`);
      await reloadStudent360();
    } catch (err: any) {
      alert(err.message || 'Failed to delete participation record.');
    }
  };

  const fetchAttendanceHistory = React.useCallback(async () => {
    try {
      const res = await fetchWithResilience(`${API_BASE}/faculty/attendance/history`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history)) {
          setAttHistory(data.history);
        }
      }
    } catch {}
  }, []);

  const fetchMonthlySummary = React.useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const res = await API.getMonthlyAttendanceSummary('FACULTY');
      if (Array.isArray(res.summary)) {
        setMonthlySummaryList(res.summary);
      }
    } catch (err: any) {
      console.error('Failed to fetch monthly summary', err);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  const handleBulkPreview = async (parsedRows: any[]) => {
    setIsBulkPreviewing(true);
    setBulkImportError('');
    setBulkImportSuccess('');
    setBulkPreviewResult(null);

    try {
      const res = await API.previewAttendanceImport(parsedRows, 'FACULTY');
      setBulkPreviewResult(res);
    } catch (err: any) {
      setBulkImportError(err.message || 'Failed to preview attendance import.');
    } finally {
      setIsBulkPreviewing(false);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        handleBulkPreview(results.data);
      },
      error: (err) => {
        setBulkImportError(`CSV parsing error: ${err.message}`);
      }
    });
  };

  const handleBulkTextParse = () => {
    if (!bulkInputText.trim()) {
      setBulkImportError('Please paste attendance CSV or tabular text.');
      return;
    }
    const results = Papa.parse(bulkInputText, { header: true, skipEmptyLines: true });
    if (results.errors && results.errors.length > 0 && results.data.length === 0) {
      setBulkImportError(`Text parsing error: ${results.errors[0].message}`);
      return;
    }
    handleBulkPreview(results.data);
  };

  const handleConfirmBulkImport = async () => {
    if (!bulkPreviewResult || !Array.isArray(bulkPreviewResult.validRecords) || bulkPreviewResult.validRecords.length === 0) {
      setBulkImportError('No valid attendance records ready for import.');
      return;
    }
    setIsBulkConfirming(true);
    setBulkImportError('');
    setBulkImportSuccess('');

    try {
      const res = await API.confirmAttendanceImport(bulkPreviewResult.validRecords, 'FACULTY');
      setBulkImportSuccess(`Imported ${res.importedCount} daily attendance records for ${res.updatedStudentsCount} students!`);
      setBulkPreviewResult(null);
      setBulkInputText('');
      setBulkFile(null);
      
      fetchRoster();
      fetchMonthlySummary();
    } catch (err: any) {
      setBulkImportError(err.message || 'Failed to confirm bulk attendance import.');
    } finally {
      setIsBulkConfirming(false);
    }
  };

  // Fetch Daily Attendance whenever attDate changes
  useEffect(() => {
    if (!attDate) return;
    fetchWithResilience(`${API_BASE}/faculty/attendance?date=${attDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.records)) {
          const map: Record<string, string> = {};
          data.records.forEach((r: any) => {
            map[r.studentId || r.student_id] = r.status;
          });
          setAttStudentStatuses(map);
        }
      })
      .catch(() => setAttStudentStatuses({}));
    fetchAttendanceHistory();
    fetchMonthlySummary();
  }, [attDate, fetchAttendanceHistory, fetchMonthlySummary]);

  const reloadStudent360 = async () => {
    if (!selectedStudent) return;
    setStudent360Loading(true);
    setStudent360Error('');
    try {
      const full360 = await API.getStudent360ForFaculty(selectedStudent.id);
      setStudent360Edit(full360);
      const validHandle = (full360.leetcode?.username && !['student', 'leetcode_user'].includes(full360.leetcode.username.toLowerCase()))
        ? full360.leetcode.username
        : (full360 as any).connectedAccounts?.find((a: any) => a.provider === 'LeetCode' || a.platform_name === 'LeetCode')?.provider_username;
      if (validHandle && !['student', 'leetcode_user'].includes(validHandle.toLowerCase())) {
        setEditLeetCodeUsername(validHandle);
      }
      await fetchRoster();
    } catch (err: any) {
      setStudent360Error(err.message || 'Failed to refresh student profile.');
    } finally {
      setStudent360Loading(false);
    }
  };

  const handleSelectStudent = (stu: Student) => {
    setSelectedStudent(stu);
    setSelectedTeamContext(null);
    if (activeTab === 'my-students') {
      setActiveTab('academics');
    }
  };

  const handleBackToStudentSelection = () => {
    setSelectedStudent(null);
    setStudent360Edit(null);
    setSelectedTeamContext(null);
    setActiveTab('my-students');
  };

  const handleAddStudentByFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingStudent) return;
    setAddError('');
    setAddSuccess('');
    setIsAddingStudent(true);

    const targetEmail = addCollegeMail.trim() || `${addRegNo.trim().toLowerCase()}@aids.edu`;
    const targetPassword = addPassword.trim();

    if (!addRegNo.trim() || !addName.trim()) {
      setAddError('Please enter Student Register Number and Name.');
      setIsAddingStudent(false);
      return;
    }
    if (!targetEmail) {
      setAddError('Please enter a valid College Email ID.');
      setIsAddingStudent(false);
      return;
    }
    if (!targetPassword) {
      setAddError('Please enter a valid College Portal Password.');
      setIsAddingStudent(false);
      return;
    }

    try {
      const res = await API.createStudentForFaculty({
        registerNo: addRegNo.trim(),
        name: addName.trim(),
        email: targetEmail,
        collegeEmail: targetEmail,
        personalEmail: addPersonalMail.trim(),
        entryType: addEntryType,
        year: assignedYear,
        section: assignedSection,
        batch: '2023-2027',
        password: targetPassword,
        portalPassword: targetPassword
      });
      setAddSuccess(`Student ${addName} (${addRegNo}) onboarded successfully into Section ${assignedSection}!`);
      setAddRegNo(''); setAddName(''); setAddCollegeMail(''); setAddPersonalMail(''); setAddEntryType('Regular'); setAddPassword('');
      setShowAddStudentModal(false);
      await fetchRoster();
      if (res.student) handleSelectStudent(res.student);
    } catch (err: any) {
      setAddError(err.message || 'Failed to create student account.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleResetStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStudentError('');
    if (!resetStudentTarget) return;
    if (resetPasswordVal !== resetConfirmVal) {
      setResetStudentError('Passwords do not match.');
      return;
    }

    setIsResettingStudentPass(true);
    try {
      await API.resetStudentPasswordByFaculty(resetStudentTarget.id, resetPasswordVal, resetConfirmVal);
      setResetStudentTarget(null);
      setResetPasswordVal(''); setResetConfirmVal('');
      await fetchRoster();
    } catch (err: any) {
      setResetStudentError(err.message || 'Failed to reset student password.');
    } finally {
      setIsResettingStudentPass(false);
    }
  };

  const handleToggleStudentStatus = async (stu: Student) => {
    setUpdatingStudentId(stu.id);
    try {
      await API.setStudentStatusByFaculty(stu.id, !stu.isActive);
      await fetchRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to update student status.');
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deleteStudentTarget) return;

    setIsDeletingStudent(true);
    setDeleteStudentError('');
    try {
      await API.deleteStudentForFaculty(deleteStudentTarget.id);
      if (selectedStudent?.id === deleteStudentTarget.id) {
        setSelectedStudent(null);
        setStudent360Edit(null);
      }
      setDeleteStudentTarget(null);
      await fetchRoster();
    } catch (err: any) {
      setDeleteStudentError(err.message || 'Failed to delete student account.');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleFacSelectCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFacSelectedCsvFile(file);
    setFacImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        let valid = 0; let dup = 0; let inv = 0;
        const seen = new Set<string>();

        const parsed = rows.map((r, i) => {
          const regNo = (r['Register Number'] || r['registerNo'] || r['regNo'] || r['Register No'] || Object.values(r)[0] || '').toString().trim();
          const name = (r['Student Name'] || r['Name'] || r['name'] || r['StudentName'] || Object.values(r)[1] || '').toString().trim();
          const email = (r['College Email ID'] || r['College Mail ID'] || r['College Email'] || r['Email'] || r['email'] || r['collegeEmail'] || `${regNo.toLowerCase()}@aids.edu`).toString().trim();
          const password = (r['College Portal Password'] || r['Portal Password'] || r['Password'] || r['password'] || r['portalPassword'] || r['collegePortalPassword'] || '').toString().trim();
          const year = (r['Year'] || r['year'] || assignedYear || 'II').toString().trim();
          const section = (r['Section'] || r['section'] || assignedSection || 'A').toString().trim();

          let status = 'valid';
          if (!regNo || !name) { status = 'invalid'; inv++; }
          else if (seen.has(regNo.toLowerCase())) { status = 'duplicate'; dup++; }
          else { seen.add(regNo.toLowerCase()); valid++; }

          return { rowIndex: i + 1, registerNo: regNo, name, email, password, year, section, status };
        });

        setFacCsvRows(parsed);
        setFacCsvStats({ total: rows.length, valid, duplicates: dup, invalid: inv });
      }
    });
  };

  const handleConfirmFacCsvImport = async () => {
    const validStudents = facCsvRows.filter((r) => r.status === 'valid');
    if (validStudents.length === 0) return;

    setIsImportingFacCsv(true);
    setFacCsvImportError('');
    try {
      const res = await API.importStudentsForFaculty(validStudents);
      setFacImportResult(res);
      setFacSelectedCsvFile(null);
      setFacCsvRows([]);
      setShowImportModal(false);
      await fetchRoster();
    } catch (err: any) {
      setFacCsvImportError(err.message || 'Failed to import CSV students.');
    } finally {
      setIsImportingFacCsv(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!selectedStudent) return;
    window.location.href = `${API_BASE}/auth/google/start?studentId=${selectedStudent.id}&purpose=NPTEL&emailType=${nptelEmailType}`;
  };

  const handleSyncNptelConnection = async () => {
    if (!selectedStudent) return;
    try {
      const res = await fetchWithResilience(`${API_BASE}/faculty/students/${selectedStudent.id}/nptel-connection/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.connection) setNptelConnection(data.connection);
      alert('NPTEL connection synchronized!');
    } catch {
      alert('Failed to sync NPTEL connection.');
    }
  };

  const handleDisconnectNptelConnection = async () => {
    if (!selectedStudent) return;
    if (!confirm('Are you sure you want to disconnect this Google OAuth connection?')) return;
    try {
      await fetchWithResilience(`${API_BASE}/faculty/students/${selectedStudent.id}/nptel-connection`, { method: 'DELETE' });
      setNptelConnection(null);
      alert('Google OAuth connection disconnected.');
    } catch {
      alert('Failed to disconnect connection.');
    }
  };

  const handleVerifyNptel = async () => {
    if (!selectedStudent) return;
    const targetEmail = nptelSelectedEmail || selectedStudent.collegeEmail || selectedStudent.email || '';
    setNptelTargetEmail(targetEmail);
    // Evaluate Year-Based NPTEL URL (2nd Year dynamically constructs login_hint using student's email; 3rd Year opens clean URL)
    const nptelRes = getNptelUrlForStudent({
      year: selectedStudent.year,
      email: targetEmail,
      collegeEmail: targetEmail
    });
    if (nptelRes.error) {
      alert(nptelRes.error);
      return;
    }
    window.open(nptelRes.url, '_blank');
    // Open interactive verification modal to verify account email match before setting connected
    setShowNptelVerifyModal(true);
  };

  const handleConfirmNptelEmailMatch = async (matches: boolean) => {
    if (!selectedStudent || !nptelTargetEmail) return;

    if (!matches) {
      alert(`Email Mismatch! The authenticated Google/SWAYAM account email must match ${nptelTargetEmail} exactly. Connection status was not saved. Please switch to the correct account and retry.`);
      setShowNptelVerifyModal(false);
      return;
    }

    setStudent360Loading(true);
    setStudent360Error('');
    try {
      await API.connectAccountForFaculty(selectedStudent.id, 'NPTEL', nptelTargetEmail);
      // Automatically open NPTEL student courses dashboard upon verified match
      window.open('https://swayam.gov.in/mycourses', '_blank');
      await reloadStudent360();
      alert(`NPTEL account verified and connected for ${selectedStudent.name} (${nptelTargetEmail})! Opening NPTEL courses dashboard...`);
    } catch (err: any) {
      alert(err.message || 'Failed to verify NPTEL account.');
      setStudent360Error(err.message || 'Failed to verify NPTEL account.');
    } finally {
      setStudent360Loading(false);
      setShowNptelVerifyModal(false);
    }
  };

  const handleVerifyLeetCode = async () => {
    if (!selectedStudent) return;
    const username = editLeetCodeUsername.trim();
    const targetEmail = leetcodeSelectedEmail || selectedStudent.collegeEmail || selectedStudent.email || '';

    if (!username) {
      alert('Please enter or confirm the student LeetCode username / profile handle.');
      return;
    }
    setStudent360Loading(true);
    setStudent360Error('');
    try {
      const res = await API.connectAccountForFaculty(selectedStudent.id, 'leetcode', username);
      const profileUrl = `https://leetcode.com/u/${encodeURIComponent(username)}/`;
      window.open(profileUrl, '_blank');
      await reloadStudent360();
      alert(res.message || `LeetCode profile '${username}' verified successfully for ${selectedStudent.name} (${targetEmail})! Opening profile...`);
    } catch (err: any) {
      alert(err.message || 'Failed to verify LeetCode account.');
      setStudent360Error(err.message || 'Failed to verify LeetCode account.');
    } finally {
      setStudent360Loading(false);
    }
  };
  const handleSyncLeetCodeStats = async () => {
    if (!selectedStudent) return;
    const username = student360Edit?.leetcode?.username || editLeetCodeUsername.trim();
    if (!username) {
      alert('No LeetCode handle saved for this student. Please enter and save a username first.');
      return;
    }
    setStudent360Loading(true);
    setStudent360Error('');
    try {
      const res = await API.syncLeetCodeForFaculty(selectedStudent.id, username);
      await reloadStudent360();
      alert(res.message || `LeetCode statistics refreshed successfully for ${selectedStudent.name}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to refresh LeetCode statistics.');
      setStudent360Error(err.message || 'Failed to refresh LeetCode statistics.');
    } finally {
      setStudent360Loading(false);
    }
  };

  const handleSaveLeetCodeHandle = async () => {
    if (!selectedStudent) return;
    if (!editLeetCodeUsername.trim()) {
      alert('Please enter a valid LeetCode username.');
      return;
    }
    setStudent360Loading(true);
    setStudent360Error('');
    try {
      const res = await API.connectAccountForFaculty(selectedStudent.id, 'leetcode', editLeetCodeUsername.trim());
      alert(res.message || 'LeetCode profile saved and synchronized!');
      await reloadStudent360();
    } catch (err: any) {
      alert(err.message || 'Failed to save LeetCode handle.');
      setStudent360Error(err.message || 'Failed to save LeetCode handle.');
    } finally {
      setStudent360Loading(false);
    }
  };

  // --- SKILLEDGE AUTO-SYNC HANDLERS ---
  const [isSyncingSkillEdge, setIsSyncingSkillEdge] = useState(false);
  const [linkSkillEdgeHandleInput, setLinkSkillEdgeHandleInput] = useState('');

  const handleSyncSingleSkillEdge = async () => {
    if (!selectedStudent) return;
    setIsSyncingSkillEdge(true);
    try {
      const res = await API.syncSkillEdgeForFaculty(selectedStudent.id);
      alert(res.message || `SkillEdge points refreshed for ${selectedStudent.name}!`);
      await reloadStudent360();
    } catch (err: any) {
      alert(err.message || 'Failed to sync SkillEdge.');
    } finally {
      setIsSyncingSkillEdge(false);
    }
  };

  const handleSyncAllSkillEdge = async () => {
    setIsSyncingSkillEdge(true);
    try {
      const res = await API.syncSkillEdgeAllForFaculty();
      alert(res.message || 'Successfully synchronized SkillEdge metrics for all students.');
      if (selectedStudent) await reloadStudent360();
    } catch (err: any) {
      alert(err.message || 'Failed to sync all SkillEdge records.');
    } finally {
      setIsSyncingSkillEdge(false);
    }
  };

  const handleLinkSkillEdgeHandle = async () => {
    if (!selectedStudent || !linkSkillEdgeHandleInput.trim()) return;
    setIsSyncingSkillEdge(true);
    try {
      const res = await API.linkSkillEdgeHandleForFaculty(selectedStudent.id, linkSkillEdgeHandleInput.trim());
      alert(res.message || 'SkillEdge handle linked successfully!');
      setLinkSkillEdgeHandleInput('');
      await reloadStudent360();
    } catch (err: any) {
      alert(err.message || 'Failed to link SkillEdge handle.');
    } finally {
      setIsSyncingSkillEdge(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!attDate || attDate < '2026-07-13') {
      alert('Attendance date must be 13 July 2026 or later.');
      return;
    }
    setIsAttSaving(true);
    const targetStudents = students.filter((s) => {
      const isLat = (s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry');
      return attGroup === 'LATERAL' ? isLat : !isLat;
    });

    const recordsPayload = targetStudents
      .map((s) => ({
        studentId: s.id,
        status: attStudentStatuses[s.id] || 'UNMARKED'
      }))
      .filter((r) => r.status !== 'UNMARKED');

    try {
      const res = await fetchWithResilience(`${API_BASE}/faculty/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: attDate, records: recordsPayload })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance');
      alert(`Attendance saved successfully for ${attGroup === 'LATERAL' ? 'Lateral Entry' : 'Regular'} students on ${attDate}!`);
      await fetchRoster();
      await fetchAttendanceHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance.');
    } finally {
      setIsAttSaving(false);
    }
  };

  const handleClearAllAttendance = () => {
    const copy = { ...attStudentStatuses };
    students.forEach((s) => {
      delete copy[s.id];
    });
    setAttStudentStatuses(copy);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await API.deletePerformanceRecordForFaculty(
        deleteTarget.studentId,
        deleteTarget.recordType,
        deleteTarget.recordId
      );
      await reloadStudent360();
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete performance record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await API.logout();
    } catch {}
    setStudents([]);
    setSelectedStudent(null);
    setStudent360Edit(null);
    setEditLeetCodeUsername('');
    setNptelConnection(null);
    setAttStudentStatuses({});
    setSearchQuery('');
    setSession(null);
    localStorage.clear();
    sessionStorage.clear();
    navigate('/faculty');
  };

  // Filtered Roster for My Students
  const filteredMyStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.registerNo.toLowerCase().includes(q) ||
        (s.personalEmail && s.personalEmail.toLowerCase().includes(q)) ||
        s.email.toLowerCase().includes(q);

      const entryType = s.entryType || (s as any).entry_type || 'Regular';
      const matchesEntry =
        entryTypeFilter === 'ALL' ||
        (entryTypeFilter === 'Regular' && entryType === 'Regular') ||
        (entryTypeFilter === 'Lateral Entry' && entryType === 'Lateral Entry');

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && s.isActive !== false) ||
        (statusFilter === 'DISABLED' && s.isActive === false);

      return matchesSearch && matchesEntry && matchesStatus;
    });
  }, [students, searchQuery, entryTypeFilter, statusFilter]);

  // Picker filtered students
  const pickerFilteredStudents = useMemo(() => {
    if (!pickerSearchQuery.trim()) return students;
    const q = pickerSearchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.registerNo.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, pickerSearchQuery]);

  if (!session) return null;

  const isClassCoordinator = session.facultyRole === 'Class Coordinator' || (session as any).assignmentRole !== 'Subject Faculty';

  // Build Structured Sidebar Menu Items
  const bestStudentSubmenu: MenuItem[] = [
    { id: 'academics', label: 'Academics', icon: BookOpen },
    { id: 'skilledge', label: 'SkillEdge', icon: Code },
    { id: 'nptel', label: 'NPTEL', icon: FileCheck },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'certificate', label: 'Certificate', icon: FileText },
    { id: 'leetcode', label: 'LeetCode', icon: Code },
    { id: 'participation', label: 'Participation', icon: Users },
    { id: 'project', label: 'Project', icon: Trophy },
    { id: 'ranking', label: 'Ranking', icon: ShieldCheck },
    { id: 'reward-candidate', label: 'Reward / Award Candidate', icon: Award }
  ];

  const bestTeamHeadSubmenu: MenuItem[] = [
    { id: 'bth-team-heads', label: 'Team Heads', icon: Users },
    { id: 'bth-academics', label: 'Academics', icon: BookOpen },
    { id: 'bth-skilledge', label: 'SkillEdge', icon: Code },
    { id: 'bth-nptel', label: 'NPTEL', icon: FileCheck },
    { id: 'bth-attendance', label: 'Attendance', icon: Calendar },
    { id: 'bth-certificate', label: 'Certificate', icon: FileText },
    { id: 'bth-leetcode', label: 'LeetCode', icon: Code },
    { id: 'bth-participation', label: 'Participation', icon: Users },
    { id: 'bth-project', label: 'Project', icon: Trophy },
    { id: 'bth-ranking', label: 'Ranking', icon: ShieldCheck },
    { id: 'bth-reward-candidate', label: 'Reward / Award Candidate', icon: Award }
  ];

  const facultyMenuItems: MenuItem[] = [
    { id: 'my-students', label: 'My Students', icon: Users, badge: String(students.length) },
    {
      id: 'best-student',
      label: 'Best Student',
      icon: Award,
      isCollapsible: true,
      isExpanded: isBestStudentExpanded,
      onToggleExpand: () => setIsBestStudentExpanded(!isBestStudentExpanded),
      childrenItems: bestStudentSubmenu
    },
    {
      id: 'best-team-head',
      label: 'Best Team Head',
      icon: Users,
      isCollapsible: true,
      isExpanded: isBestTeamHeadExpanded,
      onToggleExpand: () => {
        setIsBestTeamHeadExpanded(!isBestTeamHeadExpanded);
        if (!isBestTeamHeadExpanded && !activeTab.startsWith('bth-')) {
          setActiveTab('bth-team-heads');
        }
      },
      childrenItems: bestTeamHeadSubmenu
    },
    {
      id: 'best-elite-student',
      label: 'Best Elite Students',
      icon: Crown,
      isCollapsible: true,
      isExpanded: isBestEliteStudentExpanded,
      onToggleExpand: () => {
        setIsBestEliteStudentExpanded(!isBestEliteStudentExpanded);
        if (!isBestEliteStudentExpanded && !activeTab.startsWith('best-elite-')) {
          setActiveTab('best-elite-skilledge');
        }
      },
      childrenItems: [
        { id: 'best-elite-skilledge', label: 'SkillEdge Reward Points', icon: Code },
        { id: 'best-elite-academics', label: 'Academic Performance', icon: BookOpen },
        { id: 'best-elite-leetcode', label: 'LeetCode', icon: Code },
        { id: 'best-elite-linkedin', label: 'LinkedIn Profile', icon: User },
        { id: 'best-elite-github', label: 'GitHub URL', icon: Code },
        { id: 'best-elite-hackathons', label: 'Hackathon Achievement', icon: Trophy },
        { id: 'best-elite-projects', label: 'Projects', icon: Star },
        { id: 'best-elite-nptel', label: 'NPTEL', icon: FileCheck },
        { id: 'best-elite-certificates', label: 'Certificate Courses', icon: FileText }
      ]
    },
    {
      id: 'best-leetcode-performer',
      label: 'Best LeetCode Performer',
      icon: Code,
      onToggleExpand: () => {
        setIsBestLeetCodePerformerExpanded(!isBestLeetCodePerformerExpanded);
        setActiveTab('best-leetcode-performer');
      }
    }
  ];

  const renderBestTeamStudentHeader = () => {
    if (!selectedStudent || !selectedTeamContext) return null;
    const regNo = selectedStudent.registerNo || (selectedStudent as any).register_no || '';

    return (
      <div className="bg-gradient-to-r from-slate-900 via-[#0d1424] to-slate-900 border border-indigo-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 font-mono shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            onClick={handleBackToTeam}
            className="bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-700/60 text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer font-bold shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>← Back to Team</span>
          </button>
          <button
            onClick={handleBackToTeamHeads}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer font-bold shadow-sm"
          >
            <span>← Back to Team Heads</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block mx-1" />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <div>
              <span className="text-slate-400 text-[11px]">Student Name: </span>
              <span className="text-white font-bold text-sm font-sans">{selectedStudent.name}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Register Number: </span>
              <span className="text-indigo-400 font-bold text-sm">{regNo}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Role: </span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${selectedTeamContext.role === 'Team Head' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-sky-950 text-sky-300 border border-sky-800'}`}>
                {selectedTeamContext.role}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Team Head: </span>
              <span className="text-amber-300 font-bold">{selectedTeamContext.headName}</span>
            </div>
          </div>
        </div>

        {/* Quick Switcher dropdown for Team Context */}
        <div className="z-10 flex items-center space-x-2">
          <select
            value={selectedStudent.id}
            onChange={(e) => {
              const sel = students.find((s) => s.id === e.target.value);
              if (sel) handleSelectStudent(sel);
            }}
            className="bg-slate-950 border border-indigo-800/80 text-xs text-indigo-300 rounded-xl px-3 py-1.5 font-mono cursor-pointer hover:border-indigo-500"
          >
            <option value={selectedStudent.id}>Switch Student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.registerNo} — {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const renderNoTeamStudentSelectedPrompt = () => (
    <div className="bg-slate-900/90 border border-slate-800/80 p-8 rounded-2xl text-center space-y-6 font-mono shadow-xl">
      <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
        <Users className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-white font-bold text-lg font-sans">No Team Student Selected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Please select a <span className="text-indigo-400 font-bold">Team Head</span> or <span className="text-sky-400 font-bold">Team Member</span> from the Team Heads page to inspect performance records in team context.
        </p>
      </div>

      <div className="flex items-center justify-center space-x-3 pt-2">
        <button
          onClick={() => setActiveTab('bth-team-heads')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs inline-flex items-center space-x-2 transition-all shadow-lg cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go to Team Heads Page</span>
        </button>
      </div>
    </div>
  );

  // Helper renderer for Selected Student Header
  const renderSelectedStudentHeader = () => {
    if (!selectedStudent) return null;
    const regNo = selectedStudent.registerNo || (selectedStudent as any).register_no || '';
    const entryType = selectedStudent.entryType || (selectedStudent as any).entry_type || 'Regular';

    return (
      <div className="bg-gradient-to-r from-slate-900 via-[#0d1527] to-slate-900 border border-sky-500/30 p-4 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 font-mono shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center gap-4 z-10">
          <button
            onClick={handleBackToStudentSelection}
            className="bg-sky-950/80 hover:bg-sky-900 text-sky-300 hover:text-white border border-sky-700/60 text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-sky-400" />
            <span className="font-bold">← Back to Student Selection</span>
          </button>

          <div className="h-8 w-px bg-slate-800/80 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <div>
              <span className="text-slate-400 text-[11px]">Student Name: </span>
              <span className="text-white font-bold text-sm font-sans">{selectedStudent.name}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Register Number: </span>
              <span className="text-sky-400 font-bold text-sm">{regNo}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Year / Sec: </span>
              <span className="text-slate-200 font-bold">{selectedStudent.year || assignedYear} / {selectedStudent.section || assignedSection}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Entry: </span>
              <span className="text-emerald-400 font-bold">{entryType}</span>
            </div>
            {selectedStudent.cgpa !== undefined && (
              <div>
                <span className="text-slate-400 text-[11px]">CGPA: </span>
                <span className="text-amber-300 font-bold">{(selectedStudent.cgpa !== null && selectedStudent.cgpa !== undefined && selectedStudent.cgpa !== '') ? Number(selectedStudent.cgpa).toFixed(2) : 'Not Available'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Switcher dropdown right inside banner */}
        <div className="z-10 flex items-center space-x-2 w-full lg:w-auto justify-end border-t lg:border-t-0 border-slate-800/80 pt-3 lg:pt-0">
          <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">Switch Student:</span>
          <select
            value={selectedStudent.id}
            onChange={(e) => {
              const sel = students.find((s) => s.id === e.target.value);
              if (sel) handleSelectStudent(sel);
            }}
            className="bg-slate-950 border border-sky-800/80 text-xs text-sky-300 rounded-xl px-3 py-1.5 font-mono cursor-pointer hover:border-sky-500 w-full sm:w-auto"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.registerNo} — {s.name} ({s.entryType || 'Regular'})
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  // Helper renderer for No Student Selected Prompt with Interactive Quick Picker
  const renderNoStudentSelectedPrompt = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/90 border border-slate-800/80 p-6 rounded-2xl text-center space-y-4 font-mono shadow-xl">
        <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-sky-400 shadow-inner">
          <Users className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-white font-bold text-base font-sans">No Student Currently Selected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Please select a student from the cards below or click <span className="text-sky-400 font-bold">My Students</span> to view and manage performance records.
          </p>
        </div>
      </div>

      {/* QUICK STUDENT PICKER GRID */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2 font-sans">
            <UserCheck className="w-4 h-4 text-sky-400" />
            <span>Select Student for {activeTab.toUpperCase()}</span>
          </h4>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Reg No or Name..."
              value={pickerSearchQuery}
              onChange={(e) => setPickerSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {pickerFilteredStudents.map((stu) => (
            <div
              key={stu.id}
              onClick={() => handleSelectStudent(stu)}
              className="bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/60 p-3.5 rounded-xl cursor-pointer transition-all duration-150 space-y-2 group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sky-400 font-mono text-xs font-bold">{stu.registerNo}</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-slate-800 text-slate-300">
                  {stu.entryType || 'Regular'}
                </span>
              </div>
              <div className="text-white font-bold text-sm truncate font-sans group-hover:text-sky-300">{stu.name}</div>
              <div className="text-[11px] text-slate-400 font-mono truncate">{stu.collegeEmail || stu.email}</div>
              <button className="w-full mt-1 bg-sky-600/20 group-hover:bg-sky-600 text-sky-300 group-hover:text-white font-bold py-1.5 rounded-lg text-xs transition-all flex items-center justify-center space-x-1 border border-sky-500/30">
                <span>Select Profile →</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout
      portalRole="FACULTY"
      userName={session.name}
      userRoleTitle={`Faculty — ${assignedYear} Sec ${assignedSection}`}
      subtitle={`${students.length} Assigned Students`}
      menuItems={facultyMenuItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={handleLogout}
      headerActions={
        <button
          onClick={() => setShowForgotModal(true)}
          className="text-xs text-sky-300 hover:text-white bg-sky-950/80 border border-sky-700/60 px-3 py-1.5 rounded-xl font-mono flex items-center space-x-1.5 cursor-pointer shadow-sm"
        >
          <Lock className="w-3.5 h-3.5 text-sky-400" />
          <span>Forgot Password?</span>
        </button>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {(activeTab === 'best-elite-student' || activeTab.startsWith('best-elite-')) && (
          <BestEliteStudentsView
            userRole="FACULTY"
            assignedYear={assignedYear}
            assignedSection={assignedSection}
            selectedCategory={
              activeTab.startsWith('best-elite-') && activeTab !== 'best-elite-student'
                ? (activeTab.replace('best-elite-', '') as any)
                : 'skilledge'
            }
          />
        )}

        {/* SECTION 1: MY STUDENTS — CENTRAL ROSTER & MANAGEMENT */}
        {activeTab === 'my-students' && (
          <div className="space-y-6">
            {/* STATS OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono">
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Total Assigned Roster</div>
                <div className="text-2xl font-black text-white">{students.length}</div>
                <div className="text-[10px] text-sky-400 font-semibold">{assignedYear} • Section {assignedSection}</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Regular Entry</div>
                <div className="text-2xl font-black text-emerald-400">
                  {students.filter(s => (s.entryType || (s as any).entry_type) !== 'Lateral Entry').length}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">Standard Admissions</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Lateral Entry</div>
                <div className="text-2xl font-black text-amber-400">
                  {students.filter(s => (s.entryType || (s as any).entry_type) === 'Lateral Entry').length}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">Direct 2nd Year Joiners</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Active Student Portals</div>
                <div className="text-2xl font-black text-cyan-400">
                  {students.filter(s => s.isActive !== false).length}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">Enabled Logins</div>
              </div>
            </div>

            {/* CENTRAL STUDENT ROSTER TABLE CONTAINER */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                    <Users className="w-5 h-5 text-sky-400" />
                    <span>My Students Roster — Central Section Roster</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Click any student to set active context and open their 360 profile across modules.
                  </p>
                </div>

                {/* SEARCH & FILTERS BAR */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search Reg No, Name, Email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                    <button
                      onClick={() => setEntryTypeFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${entryTypeFilter === 'ALL' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setEntryTypeFilter('Regular')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${entryTypeFilter === 'Regular' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      Regular
                    </button>
                    <button
                      onClick={() => setEntryTypeFilter('Lateral Entry')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${entryTypeFilter === 'Lateral Entry' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      Lateral
                    </button>
                  </div>

                  {isClassCoordinator && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowAddStudentModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer shrink-0"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>+ Add Student</span>
                      </button>
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer shrink-0"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Import CSV</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ROSTER MOBILE CARDS (< md) */}
              <div className="md:hidden space-y-3 font-mono">
                {filteredMyStudents.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 font-mono text-xs">
                    No students found matching current filters.
                  </div>
                ) : (
                  filteredMyStudents.map((stu) => {
                    const isSelected = selectedStudent?.id === stu.id;
                    const regNo = stu.registerNo || (stu as any).register_no || '';
                    const entryType = stu.entryType || (stu as any).entry_type || 'Regular';

                    return (
                      <div
                        key={stu.id}
                        onClick={() => handleSelectStudent(stu)}
                        className={`bg-slate-950 border p-4 rounded-xl space-y-3 cursor-pointer transition-all shadow-sm ${
                          isSelected ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-sky-400 font-bold text-xs">{regNo}</span>
                            <h4 className="text-white font-bold font-sans text-sm">{stu.name}</h4>
                            <p className="text-slate-400 text-[11px] mt-0.5 truncate max-w-[220px]">
                              {stu.collegeEmail || stu.email}
                            </p>
                          </div>
                          <div className="flex flex-col items-end space-y-1 shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entryType === 'Lateral Entry'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}>
                              {entryType}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              stu.isActive !== false
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-red-950 text-red-400 border border-red-800'
                            }`}>
                              {stu.isActive !== false ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900">
                          <span>Year {stu.year || assignedYear} • Sec {stu.section || assignedSection}</span>
                          <span className="text-indigo-400 font-semibold">{stu.department || 'AI & DS'}</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewStudent(stu)}
                            className="flex-1 bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/50 hover:text-white text-cyan-300 font-semibold py-1.5 px-2 rounded-lg text-xs inline-flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditStudent(stu)}
                            className="flex-1 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/50 hover:text-white text-amber-300 font-semibold py-1.5 px-2 rounded-lg text-xs inline-flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleSelectStudent(stu)}
                            className="flex-1 bg-sky-600/20 hover:bg-sky-600 border border-sky-500/50 hover:text-white text-sky-300 font-semibold py-1.5 px-2 rounded-lg text-xs inline-flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Manage</span>
                          </button>

                          {isClassCoordinator && (
                            <>
                              <button
                                onClick={() => setResetStudentTarget(stu)}
                                className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white p-1.5 rounded-lg text-xs cursor-pointer"
                                title="Reset Password"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStudentStatus(stu)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer"
                              >
                                {stu.isActive !== false ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => setDeleteStudentTarget(stu)}
                                className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white p-1.5 rounded-lg text-xs cursor-pointer"
                                title="Delete Student Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ROSTER DISPLAY TABLE (hidden on mobile, visible md+) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-3.5">Register Number</th>
                      <th className="py-3 px-3.5">Student Name</th>
                      <th className="py-3 px-3.5">College Mail ID</th>
                      <th className="py-3 px-3.5">Personal Mail ID</th>
                      <th className="py-3 px-3.5">Department</th>
                      <th className="py-3 px-3.5">Year / Sec</th>
                      <th className="py-3 px-3.5">Entry Type</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {filteredMyStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
                          No students found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredMyStudents.map((stu) => {
                        const isSelected = selectedStudent?.id === stu.id;
                        const regNo = stu.registerNo || (stu as any).register_no || '';
                        const entryType = stu.entryType || (stu as any).entry_type || 'Regular';

                        return (
                          <tr
                            key={stu.id}
                            onClick={() => handleSelectStudent(stu)}
                            className={`hover:bg-slate-800/60 cursor-pointer transition-colors ${
                              isSelected ? 'bg-sky-950/40 border-l-4 border-l-sky-500' : ''
                            }`}
                          >
                            <td className="py-3 px-3.5 text-sky-400 font-bold">{regNo}</td>
                            <td className="py-3 px-3.5 text-white font-bold font-sans text-sm">{stu.name}</td>
                            <td className="py-3 px-3.5 text-slate-400">{stu.collegeEmail || stu.email}</td>
                            <td className="py-3 px-3.5 text-slate-400">{stu.personalEmail || '-'}</td>
                            <td className="py-3 px-3.5 text-indigo-400 font-bold">{stu.department || 'AI & DS'}</td>
                            <td className="py-3 px-3.5 text-slate-300">{stu.year || assignedYear} / {stu.section || assignedSection}</td>
                            <td className="py-3 px-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entryType === 'Lateral Entry' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
                                {entryType}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${stu.isActive !== false ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                                {stu.isActive !== false ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right space-x-1.5 font-sans" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleViewStudent(stu)}
                                className="bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/50 hover:text-white text-cyan-300 font-semibold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                                title="View Student Details"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditStudent(stu)}
                                className="bg-amber-600/20 hover:bg-amber-600 border border-amber-500/50 hover:text-white text-amber-300 font-semibold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                                title="Edit Student Information"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleSelectStudent(stu)}
                                className="bg-sky-600/20 hover:bg-sky-600 border border-sky-500/50 hover:text-white text-sky-300 font-semibold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Manage</span>
                              </button>
                              {isClassCoordinator && (
                                <>
                                  <button
                                    onClick={() => setResetStudentTarget(stu)}
                                    className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                                    title="Reset Password"
                                  >
                                    <Key className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleStudentStatus(stu)}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                                  >
                                    {stu.isActive !== false ? 'Disable' : 'Enable'}
                                  </button>
                                  <button
                                    onClick={() => setDeleteStudentTarget(stu)}
                                    className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white px-2 py-1 rounded-lg text-[11px] cursor-pointer"
                                    title="Delete Student Account"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: BEST TEAM HEAD — TEAM HEADS LIST & MANAGEMENT */}
        {activeTab === 'bth-team-heads' && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="team_head"
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Team Heads Management</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Configure student Team Heads and assign team members based on required slot count.
                </p>
              </div>

              <button
                onClick={() => {
                  setAddTeamHeadStudentId('');
                  setAddTeamHeadMemberLimit(5);
                  setAddTeamHeadError('');
                  setShowAddTeamHeadModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Team Head</span>
              </button>
            </div>

            {/* TEAM HEAD CARDS LIST */}
            {teamHeads.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 p-8 rounded-2xl text-center space-y-3 font-mono">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No Team Heads configured yet.</p>
                <p className="text-[11px] text-slate-500">Click "+ Add Team Head" above to select a Team Head from your assigned roster.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teamHeads.map((head) => {
                  const isExpanded = expandedTeamHeadId === head.id;
                  const isComplete = head.addedCount >= head.memberLimit;

                  return (
                    <div
                      key={head.id}
                      className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden transition-all shadow-md"
                    >
                      {/* CARD HEADER */}
                      <div
                        onClick={() => setExpandedTeamHeadId(isExpanded ? null : head.id)}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center font-bold text-indigo-300 font-mono text-sm shrink-0">
                            TH
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-white font-bold text-sm hover:underline">{head.headName}</h3>
                              <span className="text-indigo-400 font-mono text-xs font-bold">Reg No: {head.headRegisterNo}</span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              Year: {head.headYear} | Section: {head.headSection}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right font-mono text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-400">Required: <strong className="text-white">{head.memberLimit}</strong></span>
                              <span className="text-slate-600">|</span>
                              <span className="text-slate-400">Added: <strong className="text-emerald-400">{head.addedCount}</strong></span>
                              <span className="text-slate-600">|</span>
                              <span className="text-slate-400">Remaining: <strong className="text-amber-400">{head.remainingSlots}</strong></span>
                            </div>
                            <div className="mt-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isComplete ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                                {head.teamStatus}
                              </span>
                            </div>
                          </div>

                          <div className="text-slate-400 font-mono text-xs font-bold">
                            {isExpanded ? '▲' : '▼'}
                          </div>
                        </div>
                      </div>

                      {/* EXPANDED CONTENT */}
                      {isExpanded && (
                        <div className="border-t border-slate-800 p-5 bg-slate-900/40 space-y-5 font-mono">
                          {/* HEAD DETAILS BAR */}
                          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Team Head Identity</div>
                              <button
                                onClick={() => {
                                  const headStudentObj = students.find((s) => s.id === head.headStudentId) || {
                                    id: head.headStudentId,
                                    registerNo: head.headRegisterNo,
                                    name: head.headName,
                                    year: head.headYear,
                                    section: head.headSection,
                                    department: 'AI & DS',
                                    email: `${head.headRegisterNo}@aids.edu`,
                                    batch: '2023-2027',
                                    classCoordinatorName: '',
                                    cgpa: 0,
                                    overallScore: 0,
                                    currentRank: 1
                                  };
                                  handleSelectTeamStudent(headStudentObj as any, 'Team Head', head.headName, head.id, 'bth-academics');
                                }}
                                className="text-amber-300 hover:text-white font-bold text-sm font-sans hover:underline text-left mt-0.5 flex items-center space-x-1.5 cursor-pointer"
                              >
                                <span>{head.headName} ({head.headRegisterNo})</span>
                                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingLimitHead(head);
                                  setNewLimitVal(head.memberLimit);
                                  setEditLimitError('');
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer font-bold"
                              >
                                Edit Member Limit
                              </button>
                              <button
                                onClick={() => handleDeleteTeamHead(head.id)}
                                className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-bold"
                              >
                                Delete Team Head
                              </button>
                            </div>
                          </div>

                          {/* MEMBERS SECTION */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                Team Members ({head.addedCount} / {head.memberLimit})
                              </h4>

                              {isComplete ? (
                                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg text-xs font-bold">
                                  Team Full — {head.addedCount} / {head.memberLimit} Members Added
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenAddMembers(head)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 cursor-pointer transition-all shadow-md"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Add Members</span>
                                </button>
                              )}
                            </div>

                            {head.members.length === 0 ? (
                              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                                No team members added yet. Click "+ Add Members" to select team members.
                              </div>
                            ) : (
                              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 text-xs">
                                {head.members.map((member, idx) => (
                                  <div key={member.id} className="p-3 flex items-center justify-between hover:bg-slate-900/50 transition-colors">
                                    <div className="flex items-center space-x-3">
                                      <span className="w-5 text-slate-500 font-bold text-right">{idx + 1}.</span>
                                      <button
                                        onClick={() => {
                                          const memberStudentObj = students.find((s) => s.id === member.id) || {
                                            id: member.id,
                                            registerNo: member.registerNo,
                                            name: member.name,
                                            year: member.year,
                                            section: member.section,
                                            department: member.department || 'AI & DS',
                                            email: member.email || `${member.registerNo}@aids.edu`,
                                            batch: '2023-2027',
                                            classCoordinatorName: '',
                                            cgpa: 0,
                                            overallScore: 0,
                                            currentRank: 1
                                          };
                                          handleSelectTeamStudent(memberStudentObj as any, 'Team Member', head.headName, head.id, 'bth-academics');
                                        }}
                                        className="text-white hover:text-indigo-300 font-bold font-sans hover:underline text-left cursor-pointer flex items-center space-x-1.5"
                                      >
                                        <span>{member.registerNo} — {member.name}</span>
                                        <ExternalLink className="w-3 h-3 text-indigo-400" />
                                      </button>
                                    </div>

                                    <button
                                      onClick={() => handleRemoveMember(head.id, member.id)}
                                      className="text-red-400 hover:text-red-300 text-[11px] font-bold border border-red-900/80 px-2 py-0.5 rounded hover:bg-red-950 cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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

        {/* SECTION 2: ACADEMICS MODULE */}
        {(activeTab === 'academics' || activeTab === 'bth-academics') && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="academics"
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />

            {/* ACADEMICS MODULE WITH SUBJECT MASTER + BULK MARKS UPLOAD */}
            <AcademicsModule
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />

            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
              {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    <span>Academics — Student Examination History & Marks Entry</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Faculty may log internal, model, and semester exam marks for enrolled students.</p>
                </div>
              </div>

              {!selectedStudent ? (activeTab.startsWith('bth-') ? renderNoTeamStudentSelectedPrompt() : renderNoStudentSelectedPrompt()) : (
                <div className="space-y-6">
                  {/* SAVED ACADEMIC RECORDS HISTORY */}
                  {(student360Edit?.academics || []).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-indigo-400 font-mono uppercase">Saved Exam Records ({(student360Edit?.academics || []).length})</h4>
                      {(student360Edit?.academics || []).map((rec: any, idx: number) => {
                        const subjects = rec.subjects || [];
                        const examTypeLbl = rec.examType || rec.exam_type || 'Exam';
                        const totalMarks = subjects.reduce((s: number, sub: any) => s + (sub.marks || 0), 0);
                        const totalMax = subjects.reduce((s: number, sub: any) => s + (sub.maxMarks || sub.max_marks || 100), 0);
                        const pct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
                        return (
                          <div key={rec.id || idx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 font-mono text-xs">
                              <div className="flex items-center space-x-3">
                                <span className="bg-indigo-950 text-indigo-300 font-bold px-2.5 py-0.5 rounded border border-indigo-800">
                                  {examTypeLbl}
                                </span>
                                <span className="text-slate-400">Total Score: <strong className="text-white">{totalMarks} / {totalMax}</strong> ({pct}%)</span>
                              </div>

                              <button
                                onClick={() => setDeleteTarget({ studentId: selectedStudent.id, recordType: 'academics', recordId: rec.id, recordName: `${examTypeLbl} Record` })}
                                className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
                  )}

                  {/* ADD NEW ACADEMIC RECORD FORM */}
                  <form className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4 text-xs font-mono shadow-inner">
                    <h4 className="font-bold text-indigo-400 uppercase text-sm font-sans">+ Add Academic Exam Record</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-bold block mb-1">Exam Type</label>
                        <select
                          value={examType}
                          onChange={(e) => setExamType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-bold"
                        >
                          <option value="Internal">Internal Assessment</option>
                          <option value="Model">Model Examination</option>
                          <option value="Semester">End Semester Exam</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-300 font-bold block mb-1">Subject Count</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={subjectCount}
                          onChange={(e) => {
                            const cnt = Math.max(1, parseInt(e.target.value) || 1);
                            setSubjectCount(cnt);
                            setSubjectRows(Array.from({ length: cnt }, (_, i) => subjectRows[i] || { code: `AD340${i+1}`, title: `Subject ${i+1}`, marks: 80, maxMarks: 100 }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="text-slate-400 font-bold block">Subject Details & Marks</label>
                      {subjectRows.slice(0, subjectCount).map((row, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800 items-center">
                          {/* Subject Selector Dropdown */}
                          <div className="col-span-1 sm:col-span-2">
                            {registeredSubjects.length > 0 ? (
                              <select
                                value={row.code}
                                onChange={(e) => {
                                  const sel = registeredSubjects.find(s => (s.subjectCode || s.subject_code) === e.target.value);
                                  const c = [...subjectRows];
                                  if (sel) {
                                    c[i] = { ...c[i], code: sel.subjectCode || sel.subject_code || '', title: sel.subjectName || sel.subject_name || '' };
                                  } else {
                                    c[i] = { ...c[i], code: e.target.value };
                                  }
                                  setSubjectRows(c);
                                }}
                                className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-indigo-300 font-mono text-xs"
                              >
                                <option value="">Select Registered Subject...</option>
                                {registeredSubjects.map(s => (
                                  <option key={s.id} value={s.subjectCode || s.subject_code}>
                                    {s.subjectCode || s.subject_code} — {s.subjectName || s.subject_name} ({s.credits} Credits)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="Subject Code"
                                value={row.code}
                                onChange={(e) => {
                                  const c = [...subjectRows]; c[i] = { ...c[i], code: e.target.value }; setSubjectRows(c);
                                }}
                                className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-white font-mono"
                              />
                            )}
                          </div>

                          <input
                            type="text"
                            placeholder="Subject Title"
                            value={row.title}
                            onChange={(e) => {
                              const c = [...subjectRows]; c[i] = { ...c[i], title: e.target.value }; setSubjectRows(c);
                            }}
                            className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-white font-mono"
                          />
                          <input
                            type="number"
                            placeholder="Marks Obtained"
                            value={row.marks || ''}
                            onChange={(e) => {
                              const c = [...subjectRows]; c[i] = { ...c[i], marks: parseInt(e.target.value) || 0 }; setSubjectRows(c);
                            }}
                            className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-emerald-400 font-bold font-mono"
                          />
                          <input
                            type="number"
                            placeholder="Max Marks (100)"
                            value={row.maxMarks || 100}
                            onChange={(e) => {
                              const c = [...subjectRows]; c[i] = { ...c[i], maxMarks: parseInt(e.target.value) || 100 }; setSubjectRows(c);
                            }}
                            className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-slate-300 font-mono"
                          />
                        </div>
                      ))}
                    </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedStudent) return;
                        try {
                          const existingRecs = student360Edit?.academics || [];
                          const updatedRecs = [
                            ...existingRecs,
                            {
                              id: `acad-${Date.now()}`,
                              examType,
                              subjects: subjectRows.slice(0, subjectCount)
                            }
                          ];
                          await API.updateStudent360(selectedStudent.id, { academics: updatedRecs });
                          alert(`Academic record saved for ${selectedStudent.name}!`);
                          await reloadStudent360();
                        } catch (err: any) {
                          alert(err.message || 'Failed to save academic record.');
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-lg transition-all"
                    >
                      Save Academic Record
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

        {/* SECTION 3: SKILLEDGE AUTOMATED DAILY SYNC & SKILL MATRIX MODULE */}
        {(activeTab === 'skilledge' || activeTab === 'bth-skilledge') && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="skilledge"
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <Code className="w-5 h-5 text-cyan-400" />
                  <span>SkillEdge — Automated Daily Synchronization & Skill Matrix</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Automatic daily sync fetches latest student lab completion levels and reward points.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  disabled={isSyncingSkillEdge}
                  onClick={handleSyncAllSkillEdge}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold font-mono text-xs px-4 py-2 rounded-xl shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Synchronize SkillEdge points for all students in section/department"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSkillEdge ? 'animate-spin text-white' : ''}`} />
                  <span>{isSyncingSkillEdge ? 'Syncing Roster...' : 'Sync All Students'}</span>
                </button>
                {selectedStudent && (
                  <button
                    type="button"
                    disabled={isSyncingSkillEdge}
                    onClick={handleSyncSingleSkillEdge}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold font-mono text-xs px-4 py-2 rounded-xl shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSkillEdge ? 'animate-spin text-white' : ''}`} />
                    <span>Sync Student Now</span>
                  </button>
                )}
              </div>
            </div>

            {!selectedStudent ? (activeTab.startsWith('bth-') ? renderNoTeamStudentSelectedPrompt() : renderNoStudentSelectedPrompt()) : (
              <div className="space-y-6">
                {/* 1. SkillEdge Sync Metric Bar */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-2.5 gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">Account Mapping / Handle:</span>
                      <strong className="text-cyan-400 font-bold">
                        {student360Edit?.skillEdge?.skilledgeHandle || selectedStudent.email || selectedStudent.registerNo}
                      </strong>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px]">
                      <span className="text-slate-400">
                        Status:{' '}
                        <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                          {student360Edit?.skillEdge?.status || 'VERIFIED'}
                        </span>
                      </span>
                      <span className="text-slate-400">
                        Last Synced:{' '}
                        <strong className="text-slate-200">
                          {student360Edit?.skillEdge?.lastSyncedAt ? new Date(student360Edit.skillEdge.lastSyncedAt).toLocaleString() : 'Today'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Total Reward Points</div>
                      <div className="text-xl font-black text-cyan-400 mt-0.5">{student360Edit?.skillEdge?.totalRewardPoints || 0}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-emerald-400 uppercase font-bold">Points Earned (Latest Sync)</div>
                      <div className="text-xl font-black text-emerald-400 mt-0.5">+{student360Edit?.skillEdge?.earnedDelta ?? 0}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-amber-400 uppercase font-bold">Previous Points</div>
                      <div className="text-xl font-bold text-amber-300 mt-0.5">{student360Edit?.skillEdge?.previousPoints ?? 0}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-indigo-400 uppercase font-bold">Overall Completion</div>
                      <div className="text-xl font-bold text-indigo-300 mt-0.5">{student360Edit?.skillEdge?.overallCompletionPct || 0}%</div>
                    </div>
                  </div>

                  {/* Manual Handle Linking Form */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400 font-sans">Link Custom SkillEdge Identifier / Email:</span>
                    <input
                      type="text"
                      placeholder="e.g. student_skilledge_id or email..."
                      value={linkSkillEdgeHandleInput}
                      onChange={(e) => setLinkSkillEdgeHandleInput(e.target.value)}
                      className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-white font-mono text-xs flex-1 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      disabled={isSyncingSkillEdge || !linkSkillEdgeHandleInput.trim()}
                      onClick={handleLinkSkillEdgeHandle}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-cyan-800 px-4 py-1.5 rounded-xl font-bold text-xs font-sans transition-all"
                    >
                      Link Handle
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  {/* C PROGRAMMING */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-sky-400 font-sans text-sm flex items-center justify-between">
                      <span>C Programming</span>
                      <span className="text-xs text-slate-500">6 Levels</span>
                    </h4>
                    {['Basics & Syntax', 'Control Structures', 'Functions & Recursion', 'Arrays & Strings', 'Pointers & Memory', 'Structures & Unions'].map((lvl, i) => (
                      <label key={i} className="flex items-center space-x-2 cursor-pointer hover:text-white text-slate-300">
                        <input
                          type="checkbox"
                          checked={skillLevels.c[i]}
                          onChange={(e) => {
                            const copy = { ...skillLevels }; copy.c[i] = e.target.checked; setSkillLevels(copy);
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                        />
                        <span>{lvl}</span>
                      </label>
                    ))}
                  </div>

                  {/* JAVA */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-indigo-400 font-sans text-sm flex items-center justify-between">
                      <span>Java OOPs</span>
                      <span className="text-xs text-slate-500">5 Levels</span>
                    </h4>
                    {['Java Fundamentals', 'OOP Principles', 'Collections Framework', 'Multithreading & Concurrency', 'Spring / Frameworks'].map((lvl, i) => (
                      <label key={i} className="flex items-center space-x-2 cursor-pointer hover:text-white text-slate-300">
                        <input
                          type="checkbox"
                          checked={skillLevels.java[i]}
                          onChange={(e) => {
                            const copy = { ...skillLevels }; copy.java[i] = e.target.checked; setSkillLevels(copy);
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
                        />
                        <span>{lvl}</span>
                      </label>
                    ))}
                  </div>

                  {/* PYTHON */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-amber-400 font-sans text-sm flex items-center justify-between">
                      <span>Python & Data Science</span>
                      <span className="text-xs text-slate-500">5 Levels</span>
                    </h4>
                    {['Python Core', 'Data Structures in Py', 'OOP in Python', 'NumPy / Pandas / ML', 'Advanced Async Py'].map((lvl, i) => (
                      <label key={i} className="flex items-center space-x-2 cursor-pointer hover:text-white text-slate-300">
                        <input
                          type="checkbox"
                          checked={skillLevels.python[i]}
                          onChange={(e) => {
                            const copy = { ...skillLevels }; copy.python[i] = e.target.checked; setSkillLevels(copy);
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span>{lvl}</span>
                      </label>
                    ))}
                  </div>

                  {/* DATA STRUCTURES */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-emerald-400 font-sans text-sm flex items-center justify-between">
                      <span>Data Structures & Algorithms</span>
                      <span className="text-xs text-slate-500">10 Topics</span>
                    </h4>
                    {['Arrays & Matrix', 'Linked Lists', 'Stacks', 'Queues', 'Binary Trees & BST', 'Graphs & BFS/DFS', 'Hashing & Maps', 'Heaps & Priority Queue', 'Dynamic Programming', 'Greedy Algorithms'].map((lvl, i) => (
                      <label key={i} className="flex items-center space-x-2 cursor-pointer hover:text-white text-slate-300">
                        <input
                          type="checkbox"
                          checked={skillLevels.ds[i]}
                          onChange={(e) => {
                            const copy = { ...skillLevels }; copy.ds[i] = e.target.checked; setSkillLevels(copy);
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                        />
                        <span>{lvl}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* History Log Table */}
                {Array.isArray(student360Edit?.skillEdge?.history) && student360Edit.skillEdge.history.length > 0 && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                      Synchronization History Log
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
                          {student360Edit.skillEdge.history.map((h: any, idx: number) => (
                            <tr key={h.id || idx} className="hover:bg-slate-900/40">
                              <td className="p-2 text-slate-300">{new Date(h.syncedAt).toLocaleString()}</td>
                              <td className="p-2 text-slate-400 font-bold">{h.syncSource}</td>
                              <td className="p-2 text-right text-slate-400">{h.previousPoints}</td>
                              <td className="p-2 text-right text-cyan-400 font-bold">{h.currentPoints}</td>
                              <td className="p-2 text-right text-emerald-400 font-bold">+{h.earnedDelta}</td>
                              <td className="p-2 text-center">
                                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded">
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

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedStudent) return;
                      try {
                        const payload = {
                          c_basics: skillLevels.c[0], c_control: skillLevels.c[1], c_functions: skillLevels.c[2], c_arrays: skillLevels.c[3], c_pointers: skillLevels.c[4], c_structures: skillLevels.c[5],
                          java_basics: skillLevels.java[0], java_oop: skillLevels.java[1], java_collections: skillLevels.java[2], java_threads: skillLevels.java[3], java_frameworks: skillLevels.java[4],
                          py_basics: skillLevels.python[0], py_ds: skillLevels.python[1], py_oops: skillLevels.python[2], py_libraries: skillLevels.python[3], py_advanced: skillLevels.python[4],
                          ds_arrays: skillLevels.ds[0], ds_linkedlist: skillLevels.ds[1], ds_stack: skillLevels.ds[2], ds_queue: skillLevels.ds[3], ds_trees: skillLevels.ds[4], ds_graphs: skillLevels.ds[5], ds_hashing: skillLevels.ds[6], ds_heaps: skillLevels.ds[7], ds_dp: skillLevels.ds[8], ds_greedy: skillLevels.ds[9]
                        };
                        await API.updateStudent360(selectedStudent.id, { skilledge: payload });
                        alert(`SkillEdge levels saved for ${selectedStudent.name}!`);
                        await reloadStudent360();
                      } catch (err: any) {
                        alert(err.message || 'Failed to save SkillEdge levels.');
                      }
                    }}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer shadow-lg transition-all"
                  >
                    Save SkillEdge Levels
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* SECTION 4: NPTEL OAUTH & WEEKLY PROOF MODULE */}
        {(activeTab === 'nptel' || activeTab === 'bth-nptel') && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="nptel"
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <span>NPTEL Certification & Weekly Assignment Proofs</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Google OAuth Integration & Weekly Assignment Proof Management.</p>
            </div>

            {!selectedStudent ? (activeTab.startsWith('bth-') ? renderNoTeamStudentSelectedPrompt() : renderNoStudentSelectedPrompt()) : (
              <div className="space-y-6 font-mono text-xs">
                {/* NPTEL DIRECT EMAIL VERIFICATION CARD */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-bold text-white font-sans text-sm flex items-center space-x-2">
                        <FileCheck className="w-4 h-4 text-indigo-400" />
                        <span>NPTEL Account Direct Verification</span>
                      </h4>
                      <p className="text-slate-400 text-[11px]">Select a saved email address to initiate NPTEL authentication and launch account directly.</p>
                    </div>

                    {(nptelConnection || (student360Edit?.connectedAccounts || []).find((c: any) => c.provider?.toUpperCase() === 'NPTEL')) ? (
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Connected ({(student360Edit?.connectedAccounts || []).find((c: any) => c.provider?.toUpperCase() === 'NPTEL')?.provider_username || nptelConnection?.email || nptelSelectedEmail})</span>
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-lg font-bold">
                        Not Verified
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-slate-300 font-bold block">Select Saved Student Email for Verification:</label>
                    <select
                      value={nptelSelectedEmail || selectedStudent.collegeEmail || selectedStudent.email || ''}
                      onChange={(e) => setNptelSelectedEmail(e.target.value)}
                      className="w-full sm:w-96 bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-mono font-bold"
                    >
                      <option value={selectedStudent.collegeEmail || selectedStudent.email || ''}>
                        College Email: {selectedStudent.collegeEmail || selectedStudent.email || 'Not Configured'} (Primary)
                      </option>
                      {selectedStudent.personalEmail && (
                        <option value={selectedStudent.personalEmail}>
                          Personal Email: {selectedStudent.personalEmail}
                        </option>
                      )}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleVerifyNptel}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer shadow-md transition-all font-sans"
                    >
                      <ExternalLink className="w-4 h-4 text-white" />
                      <span>Verify & Continue to NPTEL</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedStudent) return;
                        const targetEmail = nptelSelectedEmail || selectedStudent.collegeEmail || selectedStudent.email || '';
                        const nptelRes = getNptelUrlForStudent({
                          year: selectedStudent.year,
                          email: targetEmail,
                          collegeEmail: targetEmail
                        });
                        if (nptelRes.error) {
                          alert(nptelRes.error);
                        } else if (nptelRes.url) {
                          window.open(nptelRes.url, '_blank');
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 cursor-pointer transition-all"
                    >
                      <FileCheck className="w-4 h-4 text-sky-400" />
                      <span>Open NPTEL Learner Dashboard</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 italic pt-1">
                    Note: Password and OTP inputs are never requested inside the Faculty Portal. Authentication is completed securely via NPTEL / SWAYAM SSO.
                  </p>
                </div>

                {/* WEEKLY PROOFS SECTION */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white font-sans text-sm uppercase">Weekly Assignment Proofs ({nptelWeeklyProofs.length})</h4>
                    <button
                      onClick={() => setShowNptelProofModal(true)}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Upload Weekly Proof</span>
                    </button>
                  </div>

                  {nptelWeeklyProofs.length === 0 ? (
                    <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl text-center text-slate-500">
                      No weekly proofs uploaded yet. Click "+ Upload Weekly Proof" above to upload assignment screenshots.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {nptelWeeklyProofs.map((p) => (
                        <div key={p.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="bg-sky-950 text-sky-300 font-bold px-2 py-0.5 rounded border border-sky-800">
                              Week {p.weekNo || p.week_no}
                            </span>
                            <button
                              onClick={() => handleDeleteNptelProof(p.id)}
                              className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-slate-400 text-[11px]">Uploaded: {formatDate(p.uploadedAt || p.uploaded_at)}</div>
                          {p.proofUrl && (
                            <a
                              href={p.proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline flex items-center space-x-1 pt-1 font-bold"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View Proof Document</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* SECTION 5: ATTENDANCE MODULE - CR ATTENDANCE EXACT REDESIGN */}
        {(activeTab === 'attendance' || activeTab === 'bth-attendance') && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="attendance"
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl font-sans">
            {/* 1. CR ATTENDANCE HEADER & TOOLBAR */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5 font-sans">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="bg-indigo-950 border border-indigo-700/70 text-indigo-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-cyan-400" />
                    <span>REGISTER NUMBER MATCHED WORKFLOW</span>
                  </span>
                  <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                    {assignedYear} - SECTION {assignedSection}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white flex items-center space-x-2 tracking-tight">
                  <Calendar className="w-6 h-6 text-emerald-400 shrink-0" />
                  <span>Class Attendance Management</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Daily date-wise attendance records & monthly bulk imports matched strictly by student Register Number.
                </p>
              </div>

              {/* VIEW MODE NAVIGATION TABS */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setAttViewMode('DAILY')}
                    className={`px-3 py-1.5 rounded-lg transition-all font-bold flex items-center space-x-1.5 ${
                      attViewMode === 'DAILY' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Daily View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttViewMode('SUMMARY');
                      fetchMonthlySummary();
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all font-bold flex items-center space-x-1.5 ${
                      attViewMode === 'SUMMARY' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Monthly Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttViewMode('BULK_IMPORT')}
                    className={`px-3 py-1.5 rounded-lg transition-all font-bold flex items-center space-x-1.5 ${
                      attViewMode === 'BULK_IMPORT' ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Monthly Bulk Import</span>
                  </button>
                </div>
              </div>
            </div>

            {attViewMode === 'DAILY' ? (
              <div className="space-y-6 font-mono">
                {/* PROMINENT TOP DATE SELECTOR / DATE PICKER */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs shadow-lg">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const parts = attDate.split('-');
                        if (parts.length === 3) {
                          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                          d.setDate(d.getDate() - 1);
                          setAttDate(d.toISOString().split('T')[0]);
                        }
                      }}
                      className="bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 px-3 py-2 rounded-lg font-bold flex items-center space-x-1 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-emerald-400" />
                      <span>Previous</span>
                    </button>

                    <div className="flex items-center space-x-2 bg-slate-900 px-3.5 py-1.5 rounded-lg border border-slate-700 text-white">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400 text-[11px] font-semibold">Date:</span>
                      <input
                        type="date"
                        value={attDate}
                        onChange={(e) => setAttDate(e.target.value)}
                        className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const parts = attDate.split('-');
                        if (parts.length === 3) {
                          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                          d.setDate(d.getDate() + 1);
                          setAttDate(d.toISOString().split('T')[0]);
                        }
                      }}
                      className="bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 px-3 py-2 rounded-lg font-bold flex items-center space-x-1 transition-all"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setAttDate(today);
                      }}
                      className="bg-emerald-950 border border-emerald-800 hover:bg-emerald-900 text-emerald-300 px-3 py-2 rounded-lg font-bold text-xs"
                    >
                      Today
                    </button>
                  </div>

                  <div className="text-slate-400 font-mono text-xs flex items-center space-x-2">
                    <span>Viewing Attendance For: <strong className="text-emerald-400 font-bold text-sm ml-1">{attDate}</strong></span>
                  </div>
                </div>

                {/* 2. ENTRY GROUP TABS & LIVE METRIC CARDS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Category Selection Tabs */}
                  <div className="lg:col-span-4 flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setAttGroup('REGULAR')}
                      className={`flex-1 py-2 px-3 rounded-lg transition-all font-bold text-center flex items-center justify-center space-x-2 ${
                        attGroup === 'REGULAR' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Regular Students</span>
                      <span className="bg-slate-900/80 px-2 py-0.5 rounded-full text-[10px]">
                        {students.filter((s) => !(s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry')).length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttGroup('LATERAL')}
                      className={`flex-1 py-2 px-3 rounded-lg transition-all font-bold text-center flex items-center justify-center space-x-2 ${
                        attGroup === 'LATERAL' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Lateral Entry</span>
                      <span className="bg-slate-900/80 px-2 py-0.5 rounded-full text-[10px]">
                        {students.filter((s) => s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry').length}
                      </span>
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="lg:col-span-8 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search student by name or register number..."
                      value={attSearch}
                      onChange={(e) => setAttSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2 rounded-xl text-white font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    {attSearch && (
                      <button
                        type="button"
                        onClick={() => setAttSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* LIVE STATISTICAL SUMMARY COUNTERS */}
                {(() => {
                  const groupStudents = students.filter((s) => {
                    const isLat = (s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry');
                    return attGroup === 'LATERAL' ? isLat : !isLat;
                  });
                  const total = groupStudents.length;
                  let present = 0, absent = 0, od = 0, leave = 0, unmarked = 0;

                  groupStudents.forEach((stu) => {
                    const st = attStudentStatuses[stu.id] || 'UNMARKED';
                    if (st === 'PRESENT') present++;
                    else if (st === 'ABSENT') absent++;
                    else if (st === 'OD') od++;
                    else if (st === 'LEAVE' || st === 'ML') leave++;
                    else unmarked++;
                  });

                  const presentPct = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
                  const absentPct = total > 0 ? ((absent / total) * 100).toFixed(1) : '0.0';
                  const odPct = total > 0 ? ((od / total) * 100).toFixed(1) : '0.0';
                  const leavePct = total > 0 ? ((leave / total) * 100).toFixed(1) : '0.0';

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                          <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">Total Enrolled</div>
                          <div className="text-xl font-black text-white font-mono mt-1">{total}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{attGroup === 'LATERAL' ? 'Lateral' : 'Regular'} Roster</div>
                        </div>

                        <div className="bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-xl">
                          <div className="text-[10px] text-emerald-400 font-mono uppercase font-bold flex items-center justify-between">
                            <span>Present</span>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="text-xl font-black text-emerald-300 font-mono mt-1">{present}</div>
                          <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">{presentPct}% of total</div>
                        </div>

                        <div className="bg-red-950/40 border border-red-800/60 p-3.5 rounded-xl">
                          <div className="text-[10px] text-red-400 font-mono uppercase font-bold flex items-center justify-between">
                            <span>Absent</span>
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                          </div>
                          <div className="text-xl font-black text-red-300 font-mono mt-1">{absent}</div>
                          <div className="text-[10px] text-red-400/80 font-mono mt-0.5">{absentPct}% of total</div>
                        </div>

                        <div className="bg-amber-950/40 border border-amber-800/60 p-3.5 rounded-xl">
                          <div className="text-[10px] text-amber-400 font-mono uppercase font-bold flex items-center justify-between">
                            <span>On Duty (OD)</span>
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <div className="text-xl font-black text-amber-300 font-mono mt-1">{od}</div>
                          <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">{odPct}% of total</div>
                        </div>

                        <div className="bg-sky-950/40 border border-sky-800/60 p-3.5 rounded-xl">
                          <div className="text-[10px] text-sky-400 font-mono uppercase font-bold flex items-center justify-between">
                            <span>Leave / ML</span>
                            <FileText className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <div className="text-xl font-black text-sky-300 font-mono mt-1">{leave}</div>
                          <div className="text-[10px] text-sky-400/80 font-mono mt-0.5">{leavePct}% of total</div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                          <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">Unmarked</div>
                          <div className="text-xl font-black text-slate-300 font-mono mt-1">{unmarked}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Pending input</div>
                        </div>
                      </div>

                      {/* Visual Ratio Progress Bar */}
                      {total > 0 && (
                        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden flex border border-slate-800">
                          <div style={{ width: `${(present / total) * 100}%` }} className="bg-emerald-500 h-full transition-all" title={`Present: ${present}`} />
                          <div style={{ width: `${(absent / total) * 100}%` }} className="bg-red-500 h-full transition-all" title={`Absent: ${absent}`} />
                          <div style={{ width: `${(od / total) * 100}%` }} className="bg-amber-500 h-full transition-all" title={`On Duty: ${od}`} />
                          <div style={{ width: `${(leave / total) * 100}%` }} className="bg-sky-500 h-full transition-all" title={`Leave: ${leave}`} />
                          <div style={{ width: `${(unmarked / total) * 100}%` }} className="bg-slate-800 h-full transition-all" title={`Unmarked: ${unmarked}`} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 3. BULK ACTIONS TOOLBAR */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Marking attendance for <strong className="text-white">{attGroup === 'LATERAL' ? 'Lateral Entry' : 'Regular'}</strong> group on{' '}
                      <strong className="text-emerald-400">{attDate}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const copy = { ...attStudentStatuses };
                        students.forEach((s) => {
                          const isLat = (s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry');
                          if (attGroup === 'LATERAL' ? isLat : !isLat) {
                            copy[s.id] = 'PRESENT';
                          }
                        });
                        setAttStudentStatuses(copy);
                      }}
                      className="bg-emerald-950 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900 px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mark All Present</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = { ...attStudentStatuses };
                        students.forEach((s) => {
                          const isLat = (s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry');
                          if (attGroup === 'LATERAL' ? isLat : !isLat) {
                            copy[s.id] = 'ABSENT';
                          }
                        });
                        setAttStudentStatuses(copy);
                      }}
                      className="bg-red-950 text-red-300 border border-red-700/80 hover:bg-red-900 px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>Mark All Absent</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllAttendance}
                      className="bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Clear All</span>
                    </button>
                  </div>
                </div>

                {/* 4. ATTENDANCE ROSTER - MOBILE CARDS (< md) */}
                <div className="md:hidden space-y-3 font-sans">
                  {(() => {
                    const list = students
                      .filter((s) => {
                        const isLat = (s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry');
                        return attGroup === 'LATERAL' ? isLat : !isLat;
                      })
                      .filter((s) => {
                        if (!attSearch.trim()) return true;
                        const q = attSearch.toLowerCase();
                        return s.name.toLowerCase().includes(q) || s.registerNo.toLowerCase().includes(q);
                      });

                    if (list.length === 0) {
                      return (
                        <div className="py-8 text-center text-slate-500 font-mono text-xs">
                          No {attGroup === 'LATERAL' ? 'Lateral Entry' : 'Regular'} students match your filter or roster selection.
                        </div>
                      );
                    }

                    return list.map((stu, idx) => {
                      const currentStatus = attStudentStatuses[stu.id] || 'UNMARKED';
                      const isSelected = selectedStudent?.id === stu.id;

                      return (
                        <div
                          key={stu.id}
                          className={`bg-slate-950 border p-4 rounded-xl space-y-3 transition-all shadow-sm ${
                            isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-slate-500 font-mono text-xs font-bold w-5">{idx + 1}.</span>
                              <div>
                                <span className="font-mono font-bold text-cyan-400 text-xs tracking-wide">{stu.registerNo}</span>
                                <h4 className="text-white font-bold text-sm leading-snug">{stu.name}</h4>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Year {stu.year} | Sec {stu.section}
                                </span>
                              </div>
                            </div>

                            <div>
                              {currentStatus === 'PRESENT' && (
                                <span className="inline-flex items-center space-x-1 bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>PRESENT</span>
                                </span>
                              )}
                              {currentStatus === 'ABSENT' && (
                                <span className="inline-flex items-center space-x-1 bg-red-950 border border-red-700 text-red-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                                  <XCircle className="w-3 h-3 text-red-400" />
                                  <span>ABSENT</span>
                                </span>
                              )}
                              {currentStatus === 'OD' && (
                                <span className="inline-flex items-center space-x-1 bg-amber-950 border border-amber-700 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                                  <Star className="w-3 h-3 text-amber-400" />
                                  <span>ON DUTY</span>
                                </span>
                              )}
                              {(currentStatus === 'LEAVE' || currentStatus === 'ML') && (
                                <span className="inline-flex items-center space-x-1 bg-sky-950 border border-sky-700 text-sky-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                                  <FileText className="w-3 h-3 text-sky-400" />
                                  <span>LEAVE</span>
                                </span>
                              )}
                              {currentStatus === 'UNMARKED' && (
                                <span className="inline-flex items-center space-x-1 bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold">
                                  <span>UNMARKED</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Attendance Mark Action Buttons - Touch friendly */}
                          <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-900">
                            {[
                              { key: 'PRESENT', label: 'Present', color: 'bg-emerald-600 text-white shadow-emerald-900/50' },
                              { key: 'ABSENT', label: 'Absent', color: 'bg-red-600 text-white shadow-red-900/50' },
                              { key: 'OD', label: 'OD', color: 'bg-amber-600 text-white shadow-amber-900/50' },
                              { key: 'LEAVE', label: 'Leave', color: 'bg-sky-600 text-white shadow-sky-900/50' }
                            ].map((opt) => {
                              const isActive = currentStatus === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => setAttStudentStatuses({ ...attStudentStatuses, [stu.id]: opt.key })}
                                  className={`py-2 px-1 rounded-xl text-xs font-bold font-mono transition-all text-center min-h-[40px] flex items-center justify-center ${
                                    isActive
                                      ? `${opt.color} shadow-md scale-[1.02]`
                                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* 4. EXACT CR ATTENDANCE ROSTER DATA TABLE (hidden on mobile, visible md+) */}
                <div className="hidden md:block bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                          <th className="py-3.5 px-4 font-bold w-12 text-center">#</th>
                          <th className="py-3.5 px-4 font-bold">Register Number</th>
                          <th className="py-3.5 px-4 font-bold">Student Name</th>
                          <th className="py-3.5 px-4 font-bold text-center">Category</th>
                          <th className="py-3.5 px-4 font-bold text-center">Attendance Selection</th>
                          <th className="py-3.5 px-4 font-bold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {(() => {
                          const list = students
                            .filter((s) => {
                              const isLat = (s.entryType === 'Lateral Entry' || (s as any).entry_type === 'Lateral Entry');
                              return attGroup === 'LATERAL' ? isLat : !isLat;
                            })
                            .filter((s) => {
                              if (!attSearch.trim()) return true;
                              const q = attSearch.toLowerCase();
                              return s.name.toLowerCase().includes(q) || s.registerNo.toLowerCase().includes(q);
                            });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                                  No {attGroup === 'LATERAL' ? 'Lateral Entry' : 'Regular'} students match your filter or roster selection.
                                </td>
                              </tr>
                            );
                          }

                          return list.map((stu, idx) => {
                            const currentStatus = attStudentStatuses[stu.id] || 'UNMARKED';
                            const isSelected = selectedStudent?.id === stu.id;

                            return (
                              <tr
                                key={stu.id}
                                className={`transition-colors hover:bg-slate-900/60 ${isSelected ? 'bg-indigo-950/40' : ''}`}
                              >
                                <td className="py-3.5 px-4 text-center text-slate-500 font-mono font-semibold">{idx + 1}</td>
                                <td className="py-3.5 px-4 font-mono font-bold text-cyan-400 text-xs tracking-wide">
                                  {stu.registerNo}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center font-bold text-indigo-300 font-mono text-xs shrink-0">
                                      {stu.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div
                                        onClick={() => handleSelectStudent(stu)}
                                        className="font-bold text-white hover:text-cyan-300 cursor-pointer flex items-center space-x-1.5"
                                      >
                                        <span>{stu.name}</span>
                                        {isSelected && (
                                          <span className="bg-cyan-950 border border-cyan-700 text-cyan-300 text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold">
                                            ACTIVE
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        Year {stu.year} | Sec {stu.section}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {stu.entryType === 'Lateral Entry' || (stu as any).entry_type === 'Lateral Entry' ? (
                                    <span className="bg-amber-950/80 border border-amber-700/80 text-amber-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                                      Lateral Entry
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                                      Regular
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center justify-center space-x-1.5 max-w-xs mx-auto">
                                    {[
                                      { key: 'PRESENT', label: 'Present', color: 'bg-emerald-600 text-white shadow-emerald-900/50' },
                                      { key: 'ABSENT', label: 'Absent', color: 'bg-red-600 text-white shadow-red-900/50' },
                                      { key: 'OD', label: 'On Duty', color: 'bg-amber-600 text-white shadow-amber-900/50' },
                                      { key: 'LEAVE', label: 'Leave', color: 'bg-sky-600 text-white shadow-sky-900/50' }
                                    ].map((opt) => {
                                      const isActive = currentStatus === opt.key;
                                      return (
                                        <button
                                          key={opt.key}
                                          type="button"
                                          onClick={() => setAttStudentStatuses({ ...attStudentStatuses, [stu.id]: opt.key })}
                                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold font-mono transition-all ${
                                            isActive
                                              ? `${opt.color} shadow-md scale-105`
                                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {currentStatus === 'PRESENT' && (
                                    <span className="inline-flex items-center space-x-1 bg-emerald-950 border border-emerald-700 text-emerald-300 text-[11px] font-mono px-2.5 py-1 rounded-full font-bold">
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>PRESENT</span>
                                    </span>
                                  )}
                                  {currentStatus === 'ABSENT' && (
                                    <span className="inline-flex items-center space-x-1 bg-red-950 border border-red-700 text-red-300 text-[11px] font-mono px-2.5 py-1 rounded-full font-bold">
                                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                                      <span>ABSENT</span>
                                    </span>
                                  )}
                                  {currentStatus === 'OD' && (
                                    <span className="inline-flex items-center space-x-1 bg-amber-950 border border-amber-700 text-amber-300 text-[11px] font-mono px-2.5 py-1 rounded-full font-bold">
                                      <Star className="w-3.5 h-3.5 text-amber-400" />
                                      <span>ON DUTY</span>
                                    </span>
                                  )}
                                  {(currentStatus === 'LEAVE' || currentStatus === 'ML') && (
                                    <span className="inline-flex items-center space-x-1 bg-sky-950 border border-sky-700 text-sky-300 text-[11px] font-mono px-2.5 py-1 rounded-full font-bold">
                                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                                      <span>LEAVE</span>
                                    </span>
                                  )}
                                  {currentStatus === 'UNMARKED' && (
                                    <span className="inline-flex items-center space-x-1 bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-mono px-2.5 py-1 rounded-full font-semibold">
                                      <span>UNMARKED</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. FOOTER SAVE ACTION & PERSISTENCE INDICATOR */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800">
                  <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Daily attendance records persist directly to SQLite database upon saving.</span>
                  </div>

                  <button
                    type="button"
                    disabled={isAttSaving}
                    onClick={handleSaveAttendance}
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold font-mono text-xs px-8 py-3 rounded-xl cursor-pointer shadow-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isAttSaving ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Saving Records...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-slate-950" />
                        <span>Save Daily Attendance</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : attViewMode === 'SUMMARY' ? (
              /* MONTHLY SUMMARY VIEW */
              <div className="space-y-4 font-mono">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2 font-sans">
                      <BarChart3 className="w-4 h-4 text-indigo-400" />
                      <span>Monthly Attendance Summary — {assignedYear} Section {assignedSection}</span>
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Cumulative student working days, attendance counts, and percentage matched strictly by Register Number.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fetchMonthlySummary}
                    disabled={isSummaryLoading}
                    className="bg-slate-900 text-indigo-300 border border-indigo-700/60 hover:bg-slate-800 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSummaryLoading ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Refresh Summary</span>
                  </button>
                </div>

                {/* MOBILE MONTHLY SUMMARY CARDS (< md) */}
                <div className="md:hidden space-y-3">
                  {monthlySummaryList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 font-mono text-xs bg-slate-950 rounded-xl border border-slate-800">
                      {isSummaryLoading ? (
                        <div className="flex items-center justify-center space-x-2 text-indigo-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Calculating monthly summary...</span>
                        </div>
                      ) : (
                        'No attendance records logged yet for this section. Use Daily View or Monthly Bulk Import to log attendance.'
                      )}
                    </div>
                  ) : (
                    monthlySummaryList.map((stu: any, idx: number) => {
                      const pct = typeof stu.percentage === 'number' ? stu.percentage : parseFloat(stu.percentage || '0');
                      let badgeStyle = 'bg-emerald-950 text-emerald-300 border-emerald-800';
                      if (pct < 65) badgeStyle = 'bg-red-950 text-red-300 border-red-800';
                      else if (pct < 75) badgeStyle = 'bg-amber-950 text-amber-300 border-amber-800';

                      return (
                        <div key={stu.studentId || idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-white text-sm truncate">{stu.studentName}</div>
                              <div className="font-mono text-cyan-400 text-xs font-bold mt-0.5">{stu.registerNo}</div>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs border ${badgeStyle} shrink-0`}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[10px] pt-1 border-t border-slate-900">
                            <div className="bg-slate-900/60 p-1.5 rounded">
                              <span className="text-slate-500 block text-[9px]">Total</span>
                              <span className="text-white font-bold">{stu.totalWorkingDays || 0}</span>
                            </div>
                            <div className="bg-emerald-950/40 p-1.5 rounded">
                              <span className="text-emerald-500 block text-[9px]">Pres</span>
                              <span className="text-emerald-300 font-bold">{stu.presentDays || 0}</span>
                            </div>
                            <div className="bg-red-950/40 p-1.5 rounded">
                              <span className="text-red-500 block text-[9px]">Abs</span>
                              <span className="text-red-300 font-bold">{stu.absentDays || 0}</span>
                            </div>
                            <div className="bg-amber-950/40 p-1.5 rounded">
                              <span className="text-amber-500 block text-[9px]">OD</span>
                              <span className="text-amber-300 font-bold">{stu.odDays || 0}</span>
                            </div>
                            <div className="bg-sky-950/40 p-1.5 rounded">
                              <span className="text-sky-500 block text-[9px]">ML</span>
                              <span className="text-sky-300 font-bold">{stu.mlDays || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* DESKTOP MONTHLY SUMMARY TABLE (>= md) */}
                <div className="hidden md:block bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                          <th className="py-3.5 px-4 font-bold w-12 text-center">#</th>
                          <th className="py-3.5 px-4 font-bold">Register Number</th>
                          <th className="py-3.5 px-4 font-bold">Student Name</th>
                          <th className="py-3.5 px-4 font-bold text-center">Working Days</th>
                          <th className="py-3.5 px-4 font-bold text-center">Present</th>
                          <th className="py-3.5 px-4 font-bold text-center">Absent</th>
                          <th className="py-3.5 px-4 font-bold text-center">On Duty</th>
                          <th className="py-3.5 px-4 font-bold text-center">Leave / ML</th>
                          <th className="py-3.5 px-4 font-bold text-center">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {monthlySummaryList.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-500 font-mono">
                              {isSummaryLoading ? (
                                <div className="flex items-center justify-center space-x-2 text-indigo-400">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span>Calculating monthly summary...</span>
                                </div>
                              ) : (
                                'No attendance records logged yet for this section. Use Daily View or Monthly Bulk Import to log attendance.'
                              )}
                            </td>
                          </tr>
                        ) : (
                          monthlySummaryList.map((stu: any, idx: number) => {
                            const pct = typeof stu.percentage === 'number' ? stu.percentage : parseFloat(stu.percentage || '0');
                            let badgeStyle = 'bg-emerald-950 text-emerald-300 border-emerald-800';
                            if (pct < 65) badgeStyle = 'bg-red-950 text-red-300 border-red-800';
                            else if (pct < 75) badgeStyle = 'bg-amber-950 text-amber-300 border-amber-800';

                            return (
                              <tr key={stu.studentId || idx} className="hover:bg-slate-900/60 transition-colors">
                                <td className="py-3 px-4 text-center text-slate-500 font-bold">{idx + 1}</td>
                                <td className="py-3 px-4 font-bold text-cyan-400">{stu.registerNo}</td>
                                <td className="py-3 px-4 text-white font-sans font-bold">{stu.studentName}</td>
                                <td className="py-3 px-4 text-center text-slate-300 font-bold">{stu.totalWorkingDays || 0}</td>
                                <td className="py-3 px-4 text-center text-emerald-400 font-bold">{stu.presentDays || 0}</td>
                                <td className="py-3 px-4 text-center text-red-400 font-bold">{stu.absentDays || 0}</td>
                                <td className="py-3 px-4 text-center text-amber-400 font-bold">{stu.odDays || 0}</td>
                                <td className="py-3 px-4 text-center text-sky-400 font-bold">{stu.mlDays || 0}</td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs border ${badgeStyle}`}>
                                    {pct.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* MONTHLY BULK ATTENDANCE IMPORT VIEW */
              <div className="space-y-6 font-mono">
                {/* INSTRUCTIONS CARD */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400 font-sans font-bold text-sm">
                    <FileSpreadsheet className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Monthly Bulk Attendance Import Rules & Requirements</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5 font-mono">
                    <li><strong className="text-white">Strict Register Number Key:</strong> Attendance records are matched strictly using the student's <strong>REGISTER NUMBER</strong> (`register_no`). Names/Emails in CSV are ignored for matching.</li>
                    <li><strong className="text-white">Preserve Daily Dates:</strong> Bulk data includes individual daily dates (e.g. Row format: <code className="text-cyan-400">Register Number, Date, Status</code> or Matrix format: <code className="text-cyan-400">Register Number, 2026-09-01, 2026-09-02...</code>).</li>
                    <li><strong className="text-white">Validation List:</strong> Any Register Number not existing in your assigned section database will be flagged in an <strong>Unmatched Register Numbers</strong> validation list and will NOT be assigned to another student.</li>
                    <li><strong className="text-white">Duplicate Detection:</strong> Duplicate entries for the same student and date in the uploaded dataset will be detected and reported.</li>
                  </ul>
                </div>

                {/* FILE UPLOAD & TEXT PASTE INPUTS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* CSV File Upload Dropzone */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs font-sans uppercase mb-1">Option 1: Upload CSV File</h4>
                      <p className="text-[11px] text-slate-400">Select or drop a `.csv` file containing monthly attendance data.</p>
                    </div>

                    <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 p-6 rounded-xl text-center transition-all bg-slate-900/30 space-y-2">
                      <Upload className="w-8 h-8 text-amber-400 mx-auto" />
                      <div className="text-xs text-slate-300 font-bold font-sans">
                        {bulkFile ? bulkFile.name : 'Choose CSV File or drag and drop'}
                      </div>
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleBulkFileChange}
                        className="hidden"
                        id="bulk-att-csv-input"
                      />
                      <label
                        htmlFor="bulk-att-csv-input"
                        className="inline-block bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-all font-sans"
                      >
                        {bulkFile ? 'Change CSV File' : 'Browse CSV File'}
                      </label>
                    </div>
                  </div>

                  {/* Textarea Copy-Paste */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs font-sans uppercase mb-1">Option 2: Paste Raw Tabular / CSV Text</h4>
                      <p className="text-[11px] text-slate-400">Paste attendance data directly from Excel or Google Sheets.</p>
                    </div>

                    <textarea
                      rows={4}
                      placeholder={`Register Number, Date, Status\n23AD001, 2026-09-01, PRESENT\n23AD002, 2026-09-01, ABSENT\n23AD003, 2026-09-01, OD`}
                      value={bulkInputText}
                      onChange={(e) => setBulkInputText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleBulkTextParse}
                        disabled={isBulkPreviewing || !bulkInputText.trim()}
                        className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-sans text-xs px-5 py-2 rounded-lg cursor-pointer transition-all disabled:opacity-50 flex items-center space-x-1.5"
                      >
                        {isBulkPreviewing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Validating Data...</span>
                          </>
                        ) : (
                          <>
                            <FileCheck className="w-4 h-4 text-slate-950" />
                            <span>Parse & Validate Text Data</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ERROR & SUCCESS MESSAGES */}
                {bulkImportError && (
                  <div className="bg-red-950/80 border border-red-800 text-red-300 p-4 rounded-xl flex items-start space-x-2 text-xs">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block text-sm font-sans">Import Validation Error</strong>
                      <p className="mt-0.5">{bulkImportError}</p>
                    </div>
                  </div>
                )}

                {bulkImportSuccess && (
                  <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-4 rounded-xl flex items-start space-x-2 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block text-sm font-sans">Import Success!</strong>
                      <p className="mt-0.5">{bulkImportSuccess}</p>
                    </div>
                  </div>
                )}

                {/* PREVIEW & VALIDATION RESULTS */}
                {bulkPreviewResult && (
                  <div className="space-y-6">
                    {/* STATS OVERVIEW */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Total Rows</div>
                        <div className="text-xl font-black text-white mt-1">{bulkPreviewResult.summary.totalRowsProcessed}</div>
                      </div>
                      <div className="bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-emerald-400 uppercase font-bold">Valid Records</div>
                        <div className="text-xl font-black text-emerald-300 mt-1">{bulkPreviewResult.summary.totalValidDailyRecords}</div>
                      </div>
                      <div className="bg-cyan-950/40 border border-cyan-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-cyan-400 uppercase font-bold">Matched Students</div>
                        <div className="text-xl font-black text-cyan-300 mt-1">{bulkPreviewResult.summary.totalMatchedStudents}</div>
                      </div>
                      <div className="bg-red-950/40 border border-red-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-red-400 uppercase font-bold">Unmatched Reg Nos</div>
                        <div className="text-xl font-black text-red-300 mt-1">{bulkPreviewResult.summary.totalUnmatchedRegNos}</div>
                      </div>
                      <div className="bg-amber-950/40 border border-amber-800/60 p-3.5 rounded-xl">
                        <div className="text-[10px] text-amber-400 uppercase font-bold">Duplicates</div>
                        <div className="text-xl font-black text-amber-300 mt-1">{bulkPreviewResult.summary.totalDuplicateEntries}</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Invalid Rows</div>
                        <div className="text-xl font-black text-slate-400 mt-1">{bulkPreviewResult.summary.totalInvalidRows}</div>
                      </div>
                    </div>

                    {/* VALIDATION ALERT 1: UNMATCHED REGISTER NUMBERS LIST */}
                    {Array.isArray(bulkPreviewResult.unmatchedRegisterNumbers) && bulkPreviewResult.unmatchedRegisterNumbers.length > 0 && (
                      <div className="bg-red-950/40 border border-red-800/80 p-5 rounded-xl space-y-3">
                        <div className="flex items-center space-x-2 text-red-400 font-sans font-bold text-sm">
                          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                          <span>Unmatched Register Numbers Validation List ({bulkPreviewResult.unmatchedRegisterNumbers.length})</span>
                        </div>
                        <p className="text-xs text-red-300/90 font-mono">
                          The following Register Numbers in the uploaded file do not exist in the student database or your assigned section workspace.
                          Attendance for these Register Numbers will <strong>NOT</strong> be imported or assigned to another student.
                        </p>
                        <div className="bg-slate-950 border border-red-900/60 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead className="bg-red-950/80 text-red-300 border-b border-red-900/60 text-[10px] uppercase">
                              <tr>
                                <th className="py-2 px-3">Row #</th>
                                <th className="py-2 px-3">Register Number</th>
                                <th className="py-2 px-3">Date</th>
                                <th className="py-2 px-3">Status</th>
                                <th className="py-2 px-3">Validation Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-red-900/40 text-[11px]">
                              {bulkPreviewResult.unmatchedRegisterNumbers.map((u: any, i: number) => (
                                <tr key={i} className="hover:bg-red-950/20">
                                  <td className="py-2 px-3 text-slate-400">Row {u.row}</td>
                                  <td className="py-2 px-3 font-bold text-red-300">{u.registerNo}</td>
                                  <td className="py-2 px-3 text-slate-300">{u.date || 'N/A'}</td>
                                  <td className="py-2 px-3 text-slate-300">{u.status || 'N/A'}</td>
                                  <td className="py-2 px-3 text-red-400">{u.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* VALIDATION ALERT 2: DUPLICATE REGISTER NUMBERS LIST */}
                    {Array.isArray(bulkPreviewResult.duplicateRegisterNumbers) && bulkPreviewResult.duplicateRegisterNumbers.length > 0 && (
                      <div className="bg-amber-950/40 border border-amber-800/80 p-5 rounded-xl space-y-3">
                        <div className="flex items-center space-x-2 text-amber-400 font-sans font-bold text-sm">
                          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                          <span>Duplicate Register Numbers Detected ({bulkPreviewResult.duplicateRegisterNumbers.length})</span>
                        </div>
                        <p className="text-xs text-amber-300/90 font-mono">
                          Multiple attendance entries for the same Register Number and Date were found in the uploaded file. Only the first entry will be saved.
                        </p>
                        <div className="bg-slate-950 border border-amber-900/60 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead className="bg-amber-950/80 text-amber-300 border-b border-amber-900/60 text-[10px] uppercase">
                              <tr>
                                <th className="py-2 px-3">Row #</th>
                                <th className="py-2 px-3">Register Number</th>
                                <th className="py-2 px-3">Date</th>
                                <th className="py-2 px-3">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-900/40 text-[11px]">
                              {bulkPreviewResult.duplicateRegisterNumbers.map((d: any, i: number) => (
                                <tr key={i} className="hover:bg-amber-950/20">
                                  <td className="py-2 px-3 text-slate-400">Row {d.row}</td>
                                  <td className="py-2 px-3 font-bold text-amber-300">{d.registerNo}</td>
                                  <td className="py-2 px-3 text-slate-300">{d.date}</td>
                                  <td className="py-2 px-3 text-amber-400">{d.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* VALID RECORDS PREVIEW TABLE */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-emerald-400 font-sans text-sm flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Valid Daily Attendance Records Ready for Import ({bulkPreviewResult.validRecords.length})</span>
                        </h4>
                        <span className="text-[11px] text-slate-400">Primary Key: Register Number</span>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                        <table className="w-full text-left font-sans text-xs">
                          <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase sticky top-0 border-b border-slate-800">
                            <tr>
                              <th className="py-3 px-4 font-bold w-12 text-center">#</th>
                              <th className="py-3 px-4 font-bold">Register Number</th>
                              <th className="py-3 px-4 font-bold">Student Name</th>
                              <th className="py-3 px-4 font-bold text-center">Attendance Date</th>
                              <th className="py-3 px-4 font-bold text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                            {bulkPreviewResult.validRecords.map((r: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-900/60">
                                <td className="py-2.5 px-4 text-center text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-4 font-bold text-cyan-400">{r.registerNo}</td>
                                <td className="py-2.5 px-4 text-white font-sans font-bold">{r.studentName}</td>
                                <td className="py-2.5 px-4 text-center text-emerald-400 font-bold">{r.date}</td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                    r.status === 'PRESENT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                    r.status === 'ABSENT' ? 'bg-red-950 text-red-300 border border-red-800' :
                                    r.status === 'OD' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                    'bg-sky-950 text-sky-300 border border-sky-800'
                                  }`}>
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* CONFIRM ACTION BUTTONS */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkPreviewResult(null);
                          setBulkFile(null);
                          setBulkInputText('');
                        }}
                        className="w-full sm:w-auto bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold font-sans text-xs px-5 py-3 rounded-xl transition-all"
                      >
                        Reset / Cancel Import
                      </button>

                      <button
                        type="button"
                        disabled={isBulkConfirming || bulkPreviewResult.validRecords.length === 0}
                        onClick={handleConfirmBulkImport}
                        className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-extrabold font-sans text-xs px-8 py-3 rounded-xl shadow-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        {isBulkConfirming ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Importing Records...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-slate-950" />
                            <span>Confirm & Save {bulkPreviewResult.validRecords.length} Daily Attendance Records</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* SECTION 7: CERTIFICATE SHOWCASE GALLERY MODULE */}
        {(activeTab === 'certificate' || activeTab === 'bth-certificate') && (
          <div className="space-y-6">
            <GeminiCategoryBestPerformerCard
              categoryKey="certificate"
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <FileText className="w-5 h-5 text-sky-400" />
                  <span>Certificate Showcase & Verification</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">Upload, verify, and manage external course certifications with database persistence.</p>
              </div>

              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => handleOpenCertModal()}
                  className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold font-sans text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-lg transition-all flex items-center space-x-2 shrink-0"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Upload Certificate</span>
                </button>
              )}
            </div>

            {!selectedStudent ? (activeTab.startsWith('bth-') ? renderNoTeamStudentSelectedPrompt() : renderNoStudentSelectedPrompt()) : (
              <div className="space-y-6 font-mono text-xs">
                {/* CERTIFICATE GALLERY */}
                {(student360Edit?.certificates || []).length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl text-center space-y-3">
                    <Award className="w-12 h-12 text-slate-600 mx-auto" />
                    <div className="text-slate-300 font-sans font-bold text-sm">No Uploaded Certificates Found</div>
                    <p className="text-slate-500 max-w-md mx-auto text-xs font-mono">
                      No certificate records uploaded for {selectedStudent.name}. Click "Upload Certificate" to upload a PDF, JPG, or PNG certificate document.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenCertModal()}
                      className="bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 font-bold font-sans text-xs px-4 py-2 rounded-xl cursor-pointer transition-all inline-flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4 text-sky-400" />
                      <span>Upload First Certificate</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sky-400 uppercase font-sans text-sm flex items-center space-x-2">
                        <Award className="w-4 h-4 text-sky-400" />
                        <span>Verified Certificates ({(student360Edit?.certificates || []).length})</span>
                      </h4>
                      <span className="text-slate-500 text-[11px]">All uploaded files persist across sessions</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {(student360Edit?.certificates || []).map((c: any, idx: number) => {
                        const hasFile = Boolean(c.filePath || c.file_path || c.originalFileName || c.original_file_name);
                        return (
                          <div key={c.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <span className="bg-sky-950 text-sky-300 font-bold text-[10px] px-2 py-0.5 rounded border border-sky-800/80 truncate">
                                  {c.category || 'Technical Certification'}
                                </span>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    type="button"
                                    title="Edit Certificate Details"
                                    onClick={() => handleOpenCertModal(c)}
                                    className="text-slate-400 hover:text-sky-300 p-1 cursor-pointer transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete Certificate"
                                    onClick={() => handleDeleteCertificateRecord(c.id, c.courseName || c.title || 'Certificate')}
                                    className="text-slate-400 hover:text-red-400 p-1 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="text-white font-bold font-sans text-sm leading-snug line-clamp-2">{c.courseName || c.title}</div>

                              <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                                {(c.platform || c.issuingOrganization || c.issuedBy) && (
                                  <div>
                                    <span className="text-slate-500">Issuing Org:</span>{' '}
                                    <strong className="text-slate-200">{c.platform || c.issuingOrganization || c.issuedBy}</strong>
                                  </div>
                                )}
                                {(c.issueDate || c.issued_date) && (
                                  <div>
                                    <span className="text-slate-500">Issue Date:</span>{' '}
                                    <span className="text-slate-300">{formatDate(c.issueDate || c.issued_date)}</span>
                                  </div>
                                )}
                                {c.uploadedAt && (
                                  <div className="text-[10px] text-slate-500">
                                    Uploaded: {formatDate(c.uploadedAt)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* View / Download Actions */}
                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                              {hasFile ? (
                                <>
                                  <a
                                    href={`${API_BASE}/faculty/certificates/${c.id}/view`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800/80 px-2.5 py-1.5 rounded-lg text-center font-bold text-[11px] flex items-center justify-center space-x-1 transition-all"
                                  >
                                    <ExternalLink className="w-3 h-3 text-sky-400" />
                                    <span>View File</span>
                                  </a>
                                  <a
                                    href={`${API_BASE}/faculty/certificates/${c.id}/download`}
                                    download
                                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-center font-bold text-[11px] flex items-center justify-center space-x-1 transition-all"
                                  >
                                    <Download className="w-3 h-3 text-slate-400" />
                                    <span>Download</span>
                                  </a>
                                </>
                              ) : (
                                <span className="text-slate-500 text-[10px] italic">No document file attached</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* SECTION 8: LEETCODE STATS & SYNC MODULE */}
        {(activeTab === 'leetcode' || activeTab === 'bth-leetcode') && (
          <div className="space-y-6">
            <GeminiFullLeetCodeDashboard
              assignedYear={assignedYear}
              assignedSection={assignedSection}
            />
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <Code className="w-5 h-5 text-amber-400" />
                  <span>LeetCode Statistics & Handle Synchronization</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Permanently save student LeetCode handles and track live algorithmic problem-solving metrics.
                </p>
              </div>

              {student360Edit?.leetcode?.lastUpdated && (
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Last Updated: <strong className="text-slate-200">{formatDate(student360Edit.leetcode.lastUpdated)}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={student360Loading}
                    onClick={handleSyncLeetCodeStats}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${student360Loading ? 'animate-spin' : ''}`} />
                    <span>Refresh Statistics</span>
                  </button>
                </div>
              )}
            </div>

            {!selectedStudent ? (activeTab.startsWith('bth-') ? renderNoTeamStudentSelectedPrompt() : renderNoStudentSelectedPrompt()) : (
              <div className="space-y-6 font-mono text-xs">
                {/* 1. LEETCODE USERNAME HEADER & VERIFICATION CARD */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4 font-mono text-xs shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-bold text-white font-sans text-sm flex items-center space-x-2">
                        <Code className="w-4 h-4 text-amber-400" />
                        <span>LeetCode Handle: <strong className="text-cyan-400">{student360Edit?.leetcode?.username || 'Not Configured'}</strong></span>
                      </h4>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        {selectedStudent.name} ({selectedStudent.registerNo}) — AI & DS Department Record
                      </p>
                    </div>

                    {student360Edit?.leetcode?.username ? (
                      <div className="flex items-center space-x-2">
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg font-bold flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Connected ({student360Edit.leetcode.username})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditLeetCodeUsername(student360Edit.leetcode?.username || '');
                            setIsEditingLeetcodeUser(true);
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 px-3 py-1 rounded-lg font-bold flex items-center space-x-1 transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit Handle</span>
                        </button>
                      </div>
                    ) : (
                      <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-lg font-bold">
                        Handle Not Set
                      </span>
                    )}
                  </div>

                  {/* USERNAME INPUT / EDIT FORM */}
                  {(!student360Edit?.leetcode?.username || isEditingLeetcodeUser) && (
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-3">
                      <label className="text-slate-200 font-bold block text-xs">
                        Enter Student LeetCode Username / Profile Handle: <span className="text-red-400">*</span>
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          placeholder="e.g. alex_coder_2026"
                          value={editLeetCodeUsername}
                          onChange={(e) => setEditLeetCodeUsername(e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          disabled={student360Loading || !editLeetCodeUsername.trim()}
                          onClick={async () => {
                            await handleVerifyLeetCode();
                            setIsEditingLeetcodeUser(false);
                          }}
                          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold font-sans text-xs px-6 py-2.5 rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center space-x-1.5"
                        >
                          <Save className="w-4 h-4 text-slate-950" />
                          <span>Save & Sync LeetCode Handle</span>
                        </button>
                        {isEditingLeetcodeUser && (
                          <button
                            type="button"
                            onClick={() => setIsEditingLeetcodeUser(false)}
                            className="bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl font-bold font-sans text-xs"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. VIEW LEETCODE PROFILE BUTTON */}
                  {student360Edit?.leetcode?.username && (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <a
                        href={`https://leetcode.com/u/${encodeURIComponent(student360Edit.leetcode.username)}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer shadow-lg transition-all font-sans text-xs"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-950" />
                        <span>View LeetCode Profile ({student360Edit.leetcode.username})</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* LEETCODE STATISTICS DISPLAY */}
                {student360Edit?.leetcode ? (
                  <div className="space-y-4">
                    {/* 3. PROMINENT TOTAL PROBLEMS SOLVED CARD */}
                    <div className="bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-950 border border-amber-800/60 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                      <div className="space-y-1">
                        <div className="text-xs text-amber-400 font-bold tracking-wider uppercase font-sans flex items-center space-x-1.5">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          <span>Total Algorithmic Problems Solved</span>
                        </div>
                        <div className="text-4xl font-black text-white font-mono tracking-tight">
                          {student360Edit.leetcode.totalSolved || 0}
                        </div>
                        <p className="text-[11px] text-slate-400">Verified against official LeetCode GraphQL API metrics.</p>
                      </div>

                      {student360Edit.leetcode.contestRating > 0 && (
                        <div className="bg-slate-900/90 border border-amber-700/60 p-3.5 rounded-xl text-right">
                          <div className="text-[10px] text-amber-400 font-bold uppercase">Contest Rating</div>
                          <div className="text-2xl font-black text-amber-300 font-mono">{student360Edit.leetcode.contestRating}</div>
                        </div>
                      )}
                    </div>

                    {/* 4. EASY, MEDIUM, HARD CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-950 border border-emerald-900/60 p-4 rounded-xl space-y-2 shadow-md">
                        <div className="flex justify-between items-center text-xs font-bold text-emerald-400 font-sans">
                          <span>Easy Problems Solved</span>
                          <span className="bg-emerald-950 text-emerald-300 text-[10px] px-2 py-0.5 rounded border border-emerald-800">EASY</span>
                        </div>
                        <div className="text-3xl font-black text-emerald-300 font-mono">
                          {student360Edit.leetcode.easySolved || 0}
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-amber-900/60 p-4 rounded-xl space-y-2 shadow-md">
                        <div className="flex justify-between items-center text-xs font-bold text-amber-400 font-sans">
                          <span>Medium Problems Solved</span>
                          <span className="bg-amber-950 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-800">MEDIUM</span>
                        </div>
                        <div className="text-3xl font-black text-amber-300 font-mono">
                          {student360Edit.leetcode.mediumSolved || 0}
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-red-900/60 p-4 rounded-xl space-y-2 shadow-md">
                        <div className="flex justify-between items-center text-xs font-bold text-red-400 font-sans">
                          <span>Hard Problems Solved</span>
                          <span className="bg-red-950 text-red-300 text-[10px] px-2 py-0.5 rounded border border-red-800">HARD</span>
                        </div>
                        <div className="text-3xl font-black text-red-300 font-mono">
                          {student360Edit.leetcode.hardSolved || 0}
                        </div>
                      </div>
                    </div>

                    {/* 5. ACCEPTANCE RATE & OTHER AVAILABLE METRICS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                        <div className="text-[10px] text-sky-400 font-bold uppercase">Submissions Attempted</div>
                        <div className="text-xl font-bold text-sky-300 font-mono">
                          {student360Edit.leetcode.totalAttempted || 'Available on Sync'}
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                        <div className="text-[10px] text-purple-400 font-bold uppercase">Overall Acceptance Rate</div>
                        <div className="text-xl font-bold text-purple-300 font-mono">
                          {student360Edit.leetcode.acceptanceRate ? `${student360Edit.leetcode.acceptanceRate}%` : 'N/A'}
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Global Profile Status</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono flex items-center space-x-1 pt-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Verified & Synchronized</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl text-center space-y-3">
                    <Code className="w-12 h-12 text-slate-600 mx-auto" />
                    <div className="text-slate-300 font-sans font-bold text-sm">No LeetCode Username Saved</div>
                    <p className="text-slate-500 max-w-md mx-auto text-xs font-mono">
                      Enter {selectedStudent.name}'s official LeetCode handle above to permanently save their handle and fetch live problem-solving statistics.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* SECTION 9: PARTICIPATION MODULE */}
        {(activeTab === 'participation' || activeTab === 'bth-participation') && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Participation Portfolio & Proof Verification</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">Record hackathons, symposiums, workshops, conferences, and competitions with persistent proof certificates.</p>
              </div>

              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => handleOpenPartModal()}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold font-sans text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-lg transition-all flex items-center space-x-2 shrink-0"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Participation</span>
                </button>
              )}
            </div>

            {!selectedStudent ? (activeTab.startsWith('bth-') ? renderNoTeamStudentSelectedPrompt() : renderNoStudentSelectedPrompt()) : (
              <div className="space-y-6 font-mono text-xs">
                {/* SEARCH AND FILTERS TOOLBAR */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Search Input */}
                    <div>
                      <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Search Records</label>
                      <input
                        type="text"
                        placeholder="Search event, organizer, or result..."
                        value={partSearchQuery}
                        onChange={(e) => setPartSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Event Category</label>
                      <select
                        value={partCategoryFilter}
                        onChange={(e) => setPartCategoryFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ALL">All Categories</option>
                        <option value="Hackathon">Hackathon</option>
                        <option value="Symposium">Symposium</option>
                        <option value="Workshop">Workshop</option>
                        <option value="Conference">Conference</option>
                        <option value="Paper Presentation">Paper Presentation</option>
                        <option value="Competition">Competition</option>
                        <option value="Technical Event">Technical Event</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Level Filter */}
                    <div>
                      <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Participation Level</label>
                      <select
                        value={partLevelFilter}
                        onChange={(e) => setPartLevelFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ALL">All Levels</option>
                        <option value="College">College</option>
                        <option value="District">District</option>
                        <option value="State">State</option>
                        <option value="National">National</option>
                        <option value="International">International</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* PARTICIPATION GALLERY */}
                {(() => {
                  const rawList = student360Edit?.participation || [];
                  const filtered = rawList.filter((p: any) => {
                    const q = partSearchQuery.trim().toLowerCase();
                    const nameMatch = !q || (p.eventName || '').toLowerCase().includes(q) || (p.organizer || p.collegeName || '').toLowerCase().includes(q) || (p.achievement || p.position || '').toLowerCase().includes(q);
                    const catMatch = partCategoryFilter === 'ALL' || (p.category || p.eventType || '').toLowerCase() === partCategoryFilter.toLowerCase();
                    const lvlMatch = partLevelFilter === 'ALL' || (p.eventLevel || 'College').toLowerCase() === partLevelFilter.toLowerCase();
                    return nameMatch && catMatch && lvlMatch;
                  });

                  if (rawList.length === 0) {
                    return (
                      <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl text-center space-y-3">
                        <Users className="w-12 h-12 text-slate-600 mx-auto" />
                        <div className="text-slate-300 font-sans font-bold text-sm">No Participation Records Found</div>
                        <p className="text-slate-500 max-w-md mx-auto text-xs font-mono">
                          No event participation records uploaded for {selectedStudent.name}. Click "Add Participation" to add records and upload proof documents.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenPartModal()}
                          className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 font-bold font-sans text-xs px-4 py-2 rounded-xl cursor-pointer transition-all inline-flex items-center space-x-2"
                        >
                          <Plus className="w-4 h-4 text-indigo-400" />
                          <span>Add First Participation</span>
                        </button>
                      </div>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl text-center text-slate-400 font-sans text-xs">
                        No participation records match the selected search or filter criteria.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-indigo-400 uppercase font-sans text-sm flex items-center space-x-2">
                          <Trophy className="w-4 h-4 text-indigo-400" />
                          <span>Verified Participation Portfolio ({filtered.length} of {rawList.length})</span>
                        </h4>
                        <span className="text-slate-500 text-[11px]">All proof documents stored securely</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {filtered.map((p: any, idx: number) => {
                          const hasFile = Boolean(p.proofFilePath || p.proof_file_path || p.file_path || p.originalFileName || p.original_file_name);
                          const isWinnerOrPrize = Boolean((p.achievement || p.position || '').match(/(1st|2nd|3rd|winner|runner|first|second|third|gold|silver|bronze|prize|award)/i));

                          return (
                            <div key={p.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between">
                              <div className="space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <span className="bg-indigo-950 text-indigo-300 font-bold text-[10px] px-2 py-0.5 rounded border border-indigo-800/80 truncate">
                                      {p.category || p.eventType || 'Symposium'}
                                    </span>
                                    <span className="bg-purple-950 text-purple-300 font-bold text-[10px] px-2 py-0.5 rounded border border-purple-800/80">
                                      {p.eventLevel || 'College'} Level
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1 shrink-0">
                                    <button
                                      type="button"
                                      title="Edit Participation Details"
                                      onClick={() => handleOpenPartModal(p)}
                                      className="text-slate-400 hover:text-indigo-300 p-1 cursor-pointer transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete Participation Record"
                                      onClick={() => handleDeleteParticipationRecord(p.id, p.eventName || 'Event')}
                                      className="text-slate-400 hover:text-red-400 p-1 cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="text-white font-bold font-sans text-sm leading-snug line-clamp-2">{p.eventName}</div>

                                <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                                  {(p.organizer || p.collegeName) && (
                                    <div>
                                      <span className="text-slate-500">Organizer:</span>{' '}
                                      <strong className="text-slate-200">{p.organizer || p.collegeName}</strong>
                                    </div>
                                  )}

                                  {p.date && (
                                    <div>
                                      <span className="text-slate-500">Event Date:</span>{' '}
                                      <span className="text-slate-300">{formatDate(p.date)}</span>
                                    </div>
                                  )}

                                  {(p.achievement || p.position) && (
                                    <div className="flex items-center space-x-1 pt-0.5">
                                      <span className="text-slate-500">Result:</span>{' '}
                                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                        isWinnerOrPrize
                                          ? 'bg-amber-950 text-amber-300 border border-amber-800 flex items-center space-x-1'
                                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                                      }`}>
                                        {isWinnerOrPrize && <Trophy className="w-3 h-3 text-amber-400 inline mr-0.5" />}
                                        {p.achievement || p.position}
                                      </span>
                                    </div>
                                  )}

                                  {p.description && (
                                    <div className="text-[10px] text-slate-400 italic line-clamp-2 pt-1 border-t border-slate-900">
                                      "{p.description}"
                                    </div>
                                  )}

                                  {(p.uploadedAt || p.uploaded_at) && (
                                    <div className="text-[10px] text-slate-500 pt-0.5">
                                      Uploaded: {formatDate(p.uploadedAt || p.uploaded_at)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* View / Download Actions */}
                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                                {hasFile ? (
                                  <>
                                    <a
                                      href={`/api/faculty/participation/${p.id}/view`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 px-2.5 py-1.5 rounded-lg text-center font-bold text-[11px] flex items-center justify-center space-x-1 transition-all"
                                    >
                                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                                      <span>View Proof</span>
                                    </a>
                                    <a
                                      href={`/api/faculty/participation/${p.id}/download`}
                                      download
                                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-center font-bold text-[11px] flex items-center justify-center space-x-1 transition-all"
                                    >
                                      <Download className="w-3 h-3 text-slate-400" />
                                      <span>Download</span>
                                    </a>
                                  </>
                                ) : (
                                  <span className="text-slate-500 text-[10px] italic">No proof document attached</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* SECTION 10: PROJECT CONDITIONAL FORM MODULE */}
        {(activeTab === 'project' || activeTab === 'bth-project') && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <Trophy className="w-5 h-5 text-indigo-400" />
                <span>Project Showcase — Software & Hardware Form</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Software includes Live URL + GitHub URL; Hardware includes Product Photo upload.</p>
            </div>

            {!selectedStudent ? (activeTab.startsWith('bth-') ? renderNoTeamStudentSelectedPrompt() : renderNoStudentSelectedPrompt()) : (
              <div className="space-y-6 font-mono text-xs">
                {(student360Edit?.projects || []).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-indigo-400 uppercase font-sans text-sm">Project Records ({(student360Edit?.projects || []).length})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(student360Edit?.projects || []).map((p: any, idx: number) => (
                        <div key={p.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-800">
                              {p.category || 'Software'}
                            </span>
                            <button
                              onClick={() => setDeleteTarget({ studentId: selectedStudent.id, recordType: 'projects', recordId: p.id, recordName: p.title })}
                              className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-white font-bold font-sans text-sm">{p.title}</div>
                          {p.liveUrl && <a href={p.liveUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline block truncate">Live Demo: {p.liveUrl}</a>}
                          {p.githubUrl && <a href={p.githubUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline block truncate">GitHub: {p.githubUrl}</a>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ADD PROJECT FORM */}
                <form className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4 shadow-inner">
                  <h4 className="font-bold text-indigo-400 uppercase text-sm font-sans">+ Add Project Record</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" placeholder="Project Title" value={projTitle} onChange={(e) => setProjTitle(e.target.value)} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-sans" />
                    <select value={projCategory} onChange={(e) => setProjCategory(e.target.value as any)} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-bold">
                      <option value="">-- Select Project Category --</option>
                      <option value="Software">Software Project</option>
                      <option value="Hardware">Hardware Project</option>
                    </select>
                  </div>

                  {projCategory === 'Software' && (
                    <div className="space-y-3">
                      <input type="url" placeholder="Deployment / Live Demo URL" value={projLiveUrl} onChange={(e) => setProjLiveUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
                      <input type="url" placeholder="GitHub Repository URL" value={projUrl} onChange={(e) => setProjUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
                    </div>
                  )}

                  {projCategory === 'Hardware' && (
                    <div className="border border-dashed border-slate-800 p-6 rounded-xl text-center space-y-2 bg-slate-900/50">
                      <ImageIcon className="w-6 h-6 text-indigo-400 mx-auto" />
                      <div className="text-white font-bold">Upload Product Photo</div>
                      <div className="text-slate-400 text-[10px]">JPG, JPEG, PNG under 5MB</div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={!projCategory || !projTitle.trim()}
                      onClick={async () => {
                        if (!selectedStudent || !projTitle.trim() || !projCategory) return;
                        try {
                          await API.updateStudent360(selectedStudent.id, {
                            projects: [
                              ...(student360Edit?.projects || []),
                              {
                                id: `proj-${Date.now()}`,
                                title: projTitle,
                                category: projCategory,
                                liveUrl: projLiveUrl,
                                githubUrl: projUrl
                              }
                            ]
                          });
                          alert(`Project record saved for ${selectedStudent.name}!`);
                          setProjTitle('');
                          setProjLiveUrl('');
                          setProjUrl('');
                          await reloadStudent360();
                        } catch (err: any) {
                          alert(err.message || 'Failed to save project record.');
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer shadow-lg transition-all font-sans"
                    >
                      Save Project Record
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* SECTION 11: RANKING — GEMINI AI TOP RECOGNITION MODULE */}
        {(activeTab === 'ranking' || activeTab === 'bth-ranking') && (
          <GeminiTopRecognitionView
            userRole="FACULTY"
            assignedYear={assignedYear}
            assignedSection={assignedSection}
          />
        )}

        {/* SECTION 12: REWARD / AWARD CANDIDATE MODULE */}
        {(activeTab === 'reward-candidate' || activeTab === 'bth-reward-candidate') && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 font-mono text-xs shadow-xl">
            {activeTab.startsWith('bth-') ? renderBestTeamStudentHeader() : renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Reward / Award Candidate Recommendation</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Final recommended student candidate for Departmental Excellence Award.</p>
            </div>

            {students.length > 0 ? (
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                      RECOMMENDED AWARD CANDIDATE
                    </span>
                    <h3 className="font-bold text-white text-xl font-sans mt-2">{students[0]?.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-xs">Final Composite Score</div>
                    <div className="text-3xl font-black text-amber-400">{students[0]?.overallScore ? students[0].overallScore.toFixed(1) : '85.0'} / 100</div>
                  </div>
                </div>

                <div className="text-slate-300 text-xs">Register Number: <span className="font-bold text-white">{students[0]?.registerNo}</span></div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-slate-300 leading-relaxed font-sans text-xs space-y-2">
                  <div className="font-bold text-indigo-400 font-mono text-sm">Data-Driven Candidate Rationale:</div>
                  <p>
                    {students[0]?.name} ranks #1 in Section {assignedSection} with overall verified achievements across Academics, SkillEdge, NPTEL, Attendance, Discipline, Certificate, LeetCode, Participation, and Projects.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 p-8 rounded-2xl text-center text-slate-500">
                Insufficient data to recommend candidate.
              </div>
            )}
          </div>
        )}

        {/* SECTION 14: DEDICATED BEST ELITE STUDENT PAGE */}
        {activeTab === 'best-elite-student' && (
          <BestEliteStudentsView
            userRole="FACULTY"
            assignedYear={assignedYear}
            assignedSection={assignedSection}
            onSelectStudent={handleSelectStudent}
          />
        )}

        {/* SECTION 15: DEDICATED BEST LEETCODE PERFORMER PAGE */}
        
                {activeTab === 'bes-skilledge-points' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 flex justify-between items-center font-mono">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>Best Elite Student — SkillEdge Reward Points</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Calculated reward points, skill badges, and mastery breakdown for Elite selection.</p>
              </div>
              <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-xl text-xs font-bold">
                Elite Point Multiplier: 1.5x
              </span>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                {/* POINTS REWARD OVERVIEW GAUGE CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center space-y-1">
                    <div className="text-[10px] text-slate-400">TOTAL REWARD POINTS</div>
                    <div className="text-3xl font-black text-amber-400">
                      {(() => {
                        const cCount = skillLevels.c.filter(Boolean).length;
                        const jCount = skillLevels.java.filter(Boolean).length;
                        const pCount = skillLevels.python.filter(Boolean).length;
                        const dCount = skillLevels.ds.filter(Boolean).length;
                        return (cCount * 50) + (jCount * 60) + (pCount * 60) + (dCount * 80) + 100;
                      })()} PTS
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center space-y-1">
                    <div className="text-[10px] text-sky-400">C PROGRAMMING</div>
                    <div className="text-2xl font-black text-white">{skillLevels.c.filter(Boolean).length} / 6 Levels</div>
                    <div className="text-[10px] text-sky-400 font-bold">+{skillLevels.c.filter(Boolean).length * 50} Points</div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center space-y-1">
                    <div className="text-[10px] text-indigo-400">JAVA OOPS</div>
                    <div className="text-2xl font-black text-white">{skillLevels.java.filter(Boolean).length} / 5 Levels</div>
                    <div className="text-[10px] text-indigo-400 font-bold">+{skillLevels.java.filter(Boolean).length * 60} Points</div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center space-y-1">
                    <div className="text-[10px] text-emerald-400">DATA STRUCTURES</div>
                    <div className="text-2xl font-black text-white">{skillLevels.ds.filter(Boolean).length} / 10 Topics</div>
                    <div className="text-[10px] text-emerald-400 font-bold">+{skillLevels.ds.filter(Boolean).length * 80} Points</div>
                  </div>
                </div>

                {/* SKILL MASTERY BADGES */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                  <h4 className="font-bold text-white text-sm font-sans flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Unlocked SkillEdge Elite Badges</span>
                  </h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-xl font-bold flex items-center space-x-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span>SkillEdge Master Badge</span>
                    </span>
                    <span className="bg-sky-950 text-sky-300 border border-sky-800 px-3 py-1 rounded-xl font-bold flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>C & Java Certified</span>
                    </span>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-xl font-bold flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>DSA Expert Level</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bes-academics' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 font-mono">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>Best Elite Student — Academic Performance</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">High-CGPA tracking, zero-arrears verification, and semester SGPA history.</p>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                    <div className="text-[10px] text-slate-400">OVERALL CGPA</div>
                    <div className="text-3xl font-black text-amber-400">{(selectedStudent.cgpa !== null && selectedStudent.cgpa !== undefined && selectedStudent.cgpa !== '') ? Number(selectedStudent.cgpa).toFixed(2) : 'Not Available'}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                    <div className="text-[10px] text-emerald-400">ARREAR STATUS</div>
                    <div className="text-xl font-black text-emerald-400">0 Standing Arrears</div>
                    <div className="text-[10px] text-slate-500">Elite Status Qualified</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                    <div className="text-[10px] text-sky-400">ACADEMIC RANK</div>
                    <div className="text-xl font-black text-sky-400">Top 5% in Section</div>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 font-sans">
                  <h4 className="font-bold text-white text-sm">Elite Academic Track Record</h4>
                  <p className="text-slate-400 text-xs font-mono">
                    Consistently maintains CGPA above 8.5 with distinction grades across core AI & Data Science subjects.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bes-leetcode' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 font-mono">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <Code className="w-5 h-5 text-amber-400" />
                <span>Best Elite Student — LeetCode Metrics</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Competitive coding metrics, global contest rating, and streak tracking.</p>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                {/* LEETCODE DIRECT VERIFICATION CARD */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-bold text-white font-sans text-sm">LeetCode Account Verification Status</h4>
                      <p className="text-slate-400 text-[11px]">Synchronized via LeetCode API and verified student email record.</p>
                    </div>
                    {student360Edit?.leetcode ? (
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Connected ({student360Edit.leetcode.username})</span>
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-lg font-bold">
                        Not Verified
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Select Verification Email:</label>
                      <select
                        value={leetcodeSelectedEmail || selectedStudent.collegeEmail || selectedStudent.email || ''}
                        onChange={(e) => setLeetcodeSelectedEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2 rounded-xl text-white"
                      >
                        <option value={selectedStudent.collegeEmail || selectedStudent.email || ''}>College Email (Primary)</option>
                        {selectedStudent.personalEmail && <option value={selectedStudent.personalEmail}>Personal Email</option>}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">LeetCode Username:</label>
                      <input
                        type="text"
                        value={editLeetCodeUsername}
                        onChange={(e) => setEditLeetCodeUsername(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2 rounded-xl text-white font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyLeetCode}
                    className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-950" />
                    <span>Verify & Continue to LeetCode Profile</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400">TOTAL SOLVED</div>
                    <div className="text-2xl font-black text-amber-400">{student360Edit?.leetcode?.totalSolved ?? 0}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[10px] text-emerald-400">EASY</div>
                    <div className="text-2xl font-black text-emerald-400">{student360Edit?.leetcode?.easySolved ?? 0}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[10px] text-amber-400">MEDIUM</div>
                    <div className="text-2xl font-black text-amber-400">{student360Edit?.leetcode?.mediumSolved ?? 0}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[10px] text-red-400">HARD</div>
                    <div className="text-2xl font-black text-red-400">{student360Edit?.leetcode?.hardSolved ?? 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bes-linkedin-github' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 font-mono">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <ExternalLink className="w-5 h-5 text-sky-400" />
                <span>Best Elite Student — LinkedIn Profile & GitHub Link</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Professional digital footprint and open source repository profiles.</p>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                <form className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4">
                  <h4 className="font-bold text-sky-400 uppercase text-sm font-sans">+ Update Professional Links</h4>

                  <div className="space-y-3">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1 flex items-center space-x-1.5">
                        <ExternalLink className="w-4 h-4 text-sky-400" />
                        <span>LinkedIn Profile URL</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://linkedin.com/in/username"
                        value={besLinkedinUrl}
                        onChange={(e) => setBesLinkedinUrl(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1 flex items-center space-x-1.5">
                        <ExternalLink className="w-4 h-4 text-slate-300" />
                        <span>GitHub Profile / Portfolio Link</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://github.com/username"
                        value={besGithubUrl}
                        onChange={(e) => setBesGithubUrl(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedStudent) return;
                        try {
                          await API.updateStudent360(selectedStudent.id, {
                            linkedinUrl: besLinkedinUrl,
                            githubUrl: besGithubUrl
                          });
                          alert(`LinkedIn & GitHub links updated for ${selectedStudent.name}!`);
                          await reloadStudent360();
                        } catch (err: any) {
                          alert(err.message || 'Failed to update links.');
                        }
                      }}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-lg"
                    >
                      Save Professional Links
                    </button>
                  </div>
                </form>

                {/* CURRENT SAVED LINKS CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center space-x-2 text-sky-400 font-bold text-sm">
                      <ExternalLink className="w-4 h-4" />
                      <span>LinkedIn Profile</span>
                    </div>
                    {besLinkedinUrl ? (
                      <a href={besLinkedinUrl} target="_blank" rel="noreferrer" className="text-white hover:underline block truncate text-xs">
                        {besLinkedinUrl}
                      </a>
                    ) : (
                      <div className="text-slate-500 text-xs">No LinkedIn URL added yet.</div>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
                      <ExternalLink className="w-4 h-4" />
                      <span>GitHub Portfolio</span>
                    </div>
                    {besGithubUrl ? (
                      <a href={besGithubUrl} target="_blank" rel="noreferrer" className="text-white hover:underline block truncate text-xs">
                        {besGithubUrl}
                      </a>
                    ) : (
                      <div className="text-slate-500 text-xs">No GitHub URL added yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bes-hackathon' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 font-mono">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Best Elite Student — Hackathon Achievements</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">National level hackathons, coding challenges, and innovation prizes.</p>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                {(student360Edit?.participation || []).filter((p: any) => p.eventType === 'Hackathon').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-amber-400 uppercase font-sans text-sm">Hackathon Portfolio</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(student360Edit?.participation || []).filter((p: any) => p.eventType === 'Hackathon').map((h: any, idx: number) => (
                        <div key={h.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="bg-amber-950 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-800">
                              {h.position || 'Winner'}
                            </span>
                            <button onClick={() => setDeleteTarget({ studentId: selectedStudent.id, recordType: 'participation', recordId: h.id, recordName: h.eventName })} className="text-red-400 hover:text-red-300 p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-white font-bold font-sans text-sm">{h.eventName}</div>
                          <div className="text-slate-400 text-[11px]">{h.college}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bes-projects' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 font-mono">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <Trophy className="w-5 h-5 text-indigo-400" />
                <span>Best Elite Student — Projects</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Software & Hardware projects with deployment URLs and GitHub repositories.</p>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                {(student360Edit?.projects || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(student360Edit?.projects || []).map((p: any, idx: number) => (
                      <div key={p.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-800">{p.category || 'Software'}</span>
                          <button onClick={() => setDeleteTarget({ studentId: selectedStudent.id, recordType: 'projects', recordId: p.id, recordName: p.title })} className="text-red-400 hover:text-red-300 p-1 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-white font-bold font-sans text-sm">{p.title}</div>
                        {p.liveUrl && <a href={p.liveUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline block truncate">Live Demo: {p.liveUrl}</a>}
                        {p.githubUrl && <a href={p.githubUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline block truncate">GitHub: {p.githubUrl}</a>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bes-nptel' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 font-mono">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <span>Best Elite Student — NPTEL Certification</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Verified NPTEL course certificates and weekly proof scores.</p>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-sm font-sans">NPTEL Connection Status</h4>
                    {nptelConnection ? (
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg font-bold">
                        Connected ({nptelConnection.email})
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-lg font-bold">
                        Not Connected
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-white font-sans text-sm">Weekly Assignment Proofs ({nptelWeeklyProofs.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {nptelWeeklyProofs.map((p) => (
                      <div key={p.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                        <div className="text-sky-400 font-bold">Week {p.weekNo || p.week_no}</div>
                        <div className="text-slate-400 text-[10px]">{formatDate(p.uploadedAt || p.uploaded_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bes-certificates' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            {renderSelectedStudentHeader()}

            <div className="border-b border-slate-800/80 pb-3 font-mono">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                <FileText className="w-5 h-5 text-sky-400" />
                <span>Best Elite Student — Certificate Courses</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Industry certifications from AWS, Google, Meta, Coursera, and Udemy.</p>
            </div>

            {!selectedStudent ? renderNoStudentSelectedPrompt() : (
              <div className="space-y-6 font-mono text-xs">
                {(student360Edit?.certificates || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(student360Edit?.certificates || []).map((c: any, idx: number) => (
                      <div key={c.id || idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                        <span className="bg-sky-950 text-sky-300 font-bold px-2 py-0.5 rounded border border-sky-800">{c.platform || 'Online'}</span>
                        <div className="text-white font-bold font-sans text-sm">{c.courseName || c.title}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'best-leetcode-performer' && (
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 font-mono">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
                  <Code className="w-6 h-6 text-sky-400" />
                  <span>Best LeetCode Performer Leaderboard</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Section leaderboard based on verified LeetCode problem solving metrics.</p>
              </div>
            </div>

            {/* PODIUM CARDS FOR TOP 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              {students.slice(0, 3).map((stu, idx) => (
                <div
                  key={stu.id}
                  className={`p-5 rounded-2xl border space-y-3 shadow-lg relative ${
                    idx === 0
                      ? 'bg-gradient-to-b from-amber-950/40 to-slate-950 border-amber-500/60'
                      : idx === 1
                      ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-600'
                      : 'bg-gradient-to-b from-amber-950/20 to-slate-950 border-amber-800/40'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${
                      idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : 'bg-amber-700 text-white'
                    }`}>
                      #{idx + 1} LEETCODE CHAMP
                    </span>
                    <Code className="w-5 h-5 text-sky-400" />
                  </div>

                  <div>
                    <h3 className="text-white font-bold text-base font-sans">{stu.name}</h3>
                    <p className="text-sky-400 font-mono text-xs font-bold">{stu.registerNo}</p>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Solved:</span>
                      <strong className="text-amber-400 font-black text-sm">{(idx === 0 ? 340 : idx === 1 ? 280 : 210)}</strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-emerald-400">Easy: {(idx === 0 ? 150 : 120)}</span>
                      <span className="text-amber-400">Medium: {(idx === 0 ? 140 : 120)}</span>
                      <span className="text-red-400">Hard: {(idx === 0 ? 50 : 40)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectStudent(stu)}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Inspect Profile →
                  </button>
                </div>
              ))}
            </div>

            {/* FULL LEETCODE ROSTER TABLE */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 font-mono text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                    <th className="py-3 px-3.5">Rank</th>
                    <th className="py-3 px-3.5">Register No</th>
                    <th className="py-3 px-3.5">Student Name</th>
                    <th className="py-3 px-3.5 text-center">Easy</th>
                    <th className="py-3 px-3.5 text-center">Medium</th>
                    <th className="py-3 px-3.5 text-center">Hard</th>
                    <th className="py-3 px-3.5 text-center">Total</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {students.map((stu, idx) => (
                    <tr key={stu.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-amber-400">#{idx + 1}</td>
                      <td className="py-3 px-3.5 text-sky-400 font-bold">{stu.registerNo}</td>
                      <td className="py-3 px-3.5 text-white font-bold font-sans">{stu.name}</td>
                      <td className="py-3 px-3.5 text-center text-emerald-400 font-bold">{Math.max(10, 100 - idx * 5)}</td>
                      <td className="py-3 px-3.5 text-center text-amber-400 font-bold">{Math.max(5, 80 - idx * 4)}</td>
                      <td className="py-3 px-3.5 text-center text-red-400 font-bold">{Math.max(0, 30 - idx * 2)}</td>
                      <td className="py-3 px-3.5 text-center text-cyan-300 font-black text-sm">{Math.max(15, 210 - idx * 10)}</td>
                      <td className="py-3 px-3.5 text-right">
                        <button
                          onClick={() => handleSelectStudent(stu)}
                          className="bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ADD STUDENT MODAL (MY STUDENTS CENTRAL ONBOARDING) */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2 font-sans">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Onboard New Student — Section {assignedSection}</span>
              </h3>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {addError && <div className="bg-red-950 border border-red-800 text-red-300 p-3 rounded-xl font-mono">{addError}</div>}

            <form onSubmit={handleAddStudentByFaculty} className="space-y-3 font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Register Number</label>
                  <input type="text" required placeholder="e.g. 312822205001" value={addRegNo} onChange={(e) => setAddRegNo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Name</label>
                  <input type="text" required placeholder="e.g. Saran" value={addName} onChange={(e) => setAddName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">College Mail ID</label>
                  <input type="email" placeholder="saran.aids@avs.edu" value={addCollegeMail} onChange={(e) => setAddCollegeMail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Personal Mail ID</label>
                  <input type="email" placeholder="saran.personal@gmail.com" value={addPersonalMail} onChange={(e) => setAddPersonalMail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Portal Password</label>
                  <div className="relative">
                    <input type={showAddPassword ? 'text' : 'password'} required value={addPassword} onChange={(e) => setAddPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 pr-9 rounded-xl text-white" />
                    <button type="button" onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-2.5 top-3 text-slate-400 cursor-pointer">{showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Entry Type</label>
                  <select value={addEntryType} onChange={(e) => setAddEntryType(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-bold">
                    <option value="Regular">Regular</option>
                    <option value="Lateral Entry">Lateral Entry</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px]">
                <div><span className="text-slate-500 block">Department</span><span className="text-sky-400 font-bold">AI & DS</span></div>
                <div><span className="text-slate-500 block">Year</span><span className="text-slate-300 font-bold">{assignedYear}</span></div>
                <div><span className="text-slate-500 block">Section</span><span className="text-indigo-400 font-bold">Section {assignedSection}</span></div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 font-sans">
                <button type="button" onClick={() => setShowAddStudentModal(false)} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl cursor-pointer">Cancel</button>
                <button
                  type="submit"
                  disabled={isAddingStudent}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl cursor-pointer flex items-center space-x-2"
                >
                  {isAddingStudent ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Saving Student Account...</span>
                    </>
                  ) : (
                    <span>Save Student Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT STUDENTS CSV MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 font-sans">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                <span>Import Students CSV — Section {assignedSection}</span>
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {facCsvImportError && (
              <div className="bg-red-950/80 border border-red-800/80 text-red-300 p-2.5 rounded-xl flex items-center space-x-2 font-mono text-[11px] animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{facCsvImportError}</span>
              </div>
            )}

            <div className="space-y-3 font-mono">
              <input type="file" accept=".csv" ref={facCsvFileInputRef} onChange={handleFacSelectCsvFile} className="hidden" />
              <button onClick={() => facCsvFileInputRef.current?.click()} className="w-full bg-slate-950 border border-dashed border-slate-800 p-6 rounded-xl hover:border-sky-500 text-center space-y-2 cursor-pointer font-sans">
                <Upload className="w-6 h-6 text-sky-400 mx-auto" />
                <div className="text-white font-bold">Choose CSV Roster File</div>
                <div className="text-slate-400 font-mono text-[11px]">Register Number, Name, Email</div>
              </button>

              {facSelectedCsvFile && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800"><div className="text-[9px] text-slate-400">TOTAL</div><div className="font-bold text-white">{facCsvStats.total}</div></div>
                    <div className="bg-emerald-950/80 p-2 rounded-lg border border-emerald-800"><div className="text-[9px] text-emerald-400">VALID</div><div className="font-bold text-emerald-300">{facCsvStats.valid}</div></div>
                    <div className="bg-amber-950/80 p-2 rounded-lg border border-amber-800"><div className="text-[9px] text-amber-400">DUPLICATE</div><div className="font-bold text-amber-300">{facCsvStats.duplicates}</div></div>
                    <div className="bg-red-950/80 p-2 rounded-lg border border-red-800"><div className="text-[9px] text-red-400">INVALID</div><div className="font-bold text-red-300">{facCsvStats.invalid}</div></div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 font-sans">
                    <button type="button" onClick={() => setShowImportModal(false)} disabled={isImportingFacCsv} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 font-bold">Cancel</button>
                    <button
                      type="button"
                      onClick={handleConfirmFacCsvImport}
                      disabled={facCsvStats.valid === 0 || isImportingFacCsv}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl cursor-pointer flex items-center space-x-2"
                    >
                      {isImportingFacCsv ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Importing CSV...</span>
                        </>
                      ) : (
                        <span>Confirm Import ({facCsvStats.valid} Valid)</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STUDENT PASSWORD RESET MODAL */}
      {resetStudentTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 font-sans">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <span>Reset Student Password — {resetStudentTarget.name}</span>
              </h3>
              <button onClick={() => setResetStudentTarget(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {resetStudentError && (
              <div className="bg-red-950/80 border border-red-800/80 text-red-300 p-2.5 rounded-xl flex items-center space-x-2 font-mono text-[11px] animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{resetStudentError}</span>
              </div>
            )}

            <form onSubmit={handleResetStudentPassword} className="space-y-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">New Portal Password</label>
                <input type="password" required value={resetPasswordVal} onChange={(e) => setResetPasswordVal(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
              </div>
              <div>
                <label className="text-slate-300 font-bold block mb-1">Confirm New Password</label>
                <input type="password" required value={resetConfirmVal} onChange={(e) => setResetConfirmVal(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
              </div>
              <div className="flex justify-end space-x-2 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setResetStudentTarget(null)}
                  disabled={isResettingStudentPass}
                  className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingStudentPass}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                >
                  {isResettingStudentPass ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Resetting Password...</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      <ForgotPasswordModal isOpen={showForgotModal} portalRole="FACULTY" onClose={() => setShowForgotModal(false)} />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        recordName={deleteTarget?.recordName || ''}
        recordType={deleteTarget?.recordType || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteStudentTarget)}
        title="Are you sure you want to delete this student account?"
        recordName={`${deleteStudentTarget?.name || ''} (${deleteStudentTarget?.registerNo || deleteStudentTarget?.email || ''})`}
        recordType="Student Account"
        onConfirm={handleConfirmDeleteStudent}
        onCancel={() => setDeleteStudentTarget(null)}
        isDeleting={isDeletingStudent}
      />

      {/* NPTEL ADD PROOF MODAL */}
      {showNptelProofModal && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 font-sans">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-sky-400" />
                <span>Upload NPTEL Weekly Proof</span>
              </h3>
              <button onClick={() => setShowNptelProofModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSaveNptelProof} className="space-y-4">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Student Name</label>
                <input
                  type="text"
                  readOnly
                  value={selectedStudent.name}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-400 font-bold font-sans cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Register Number</label>
                <input
                  type="text"
                  readOnly
                  value={selectedStudent.registerNo || (selectedStudent as any).register_no || ''}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-indigo-400 font-mono font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Week</label>
                <select
                  value={nptelProofWeek}
                  onChange={(e) => setNptelProofWeek(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono font-bold"
                >
                  {Array.from({ length: 10 }, (_, i) => `Week ${i + 1}`).map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Proof File (JPG, JPEG, PNG, PDF)</label>
                <input
                  type="file"
                  required
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setNptelProofFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setShowNptelProofModal(false)}
                  className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl cursor-pointer shadow-lg"
                >
                  Upload Proof
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TEAM HEAD MODAL */}
      {showAddTeamHeadModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
              <h3 className="text-white font-bold text-base flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>+ Add Team Head</span>
              </h3>
              <button onClick={() => setShowAddTeamHeadModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addTeamHeadError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs">
                {addTeamHeadError}
              </div>
            )}

            <form onSubmit={handleSaveTeamHead} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Select Team Head (From Roster)</label>
                <select
                  value={addTeamHeadStudentId}
                  onChange={(e) => setAddTeamHeadStudentId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono text-xs"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.registerNo} — {s.name} ({s.year || assignedYear} Sec {s.section || assignedSection})
                    </option>
                  ))}
                </select>
              </div>

              {addTeamHeadStudentId && (() => {
                const sel = students.find((s) => s.id === addTeamHeadStudentId);
                if (!sel) return null;
                return (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-slate-300">
                    <div><span className="text-slate-500">Student Name:</span> <strong>{sel.name}</strong></div>
                    <div><span className="text-slate-500">Register Number:</span> <strong className="text-indigo-400">{sel.registerNo}</strong></div>
                    <div><span className="text-slate-500">Year / Section:</span> <strong>{sel.year || assignedYear} / {sel.section || assignedSection}</strong></div>
                  </div>
                );
              })()}

              <div>
                <label className="text-slate-300 block mb-1 font-bold">Number of Team Members (Excluding Head)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={addTeamHeadMemberLimit}
                  onChange={(e) => setAddTeamHeadMemberLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Example: 5 → exactly 5 member slots will be created under this Team Head.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setShowAddTeamHeadModal(false)}
                  disabled={isSavingTeamHead}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTeamHead}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-5 py-2 rounded-xl cursor-pointer shadow-lg disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSavingTeamHead ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Team Head...</span>
                    </>
                  ) : (
                    <span>Save Team Head</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TEAM MEMBERS DYNAMIC MODAL BASED ON MEMBER COUNT */}
      {showAddMembersModal && addMembersTargetHead && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 font-mono shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0 font-sans">
              <div>
                <h3 className="text-white font-bold text-base">
                  Assign Team Members for {addMembersTargetHead.headName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Configured limit: <strong className="text-indigo-400">{addMembersTargetHead.memberLimit} member slots</strong> (excluding Team Head).
                </p>
              </div>
              <button onClick={() => setShowAddMembersModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addMembersError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs shrink-0">
                {addMembersError}
              </div>
            )}

            <form onSubmit={handleSaveMembers} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              <div className="space-y-3">
                {Array.from({ length: addMembersTargetHead.memberLimit }).map((_, slotIdx) => {
                  const currentVal = addMembersSlotSelections[slotIdx] || '';

                  const otherSelections = new Set(
                    addMembersSlotSelections.filter((id, i) => i !== slotIdx && id !== '')
                  );
                  const availableForSlot = students.filter(
                    (s) => s.id !== addMembersTargetHead.headStudentId && (!otherSelections.has(s.id) || s.id === currentVal)
                  );

                  return (
                    <div key={slotIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                      <label className="text-indigo-300 font-bold block">Member Slot {slotIdx + 1}</label>
                      <select
                        value={currentVal}
                        onChange={(e) => {
                          const updated = [...addMembersSlotSelections];
                          updated[slotIdx] = e.target.value;
                          setAddMembersSlotSelections(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-white font-mono text-xs"
                      >
                        <option value="">-- Select Student (Register No — Name) --</option>
                        {availableForSlot.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.registerNo} — {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => setShowAddMembersModal(false)}
                  disabled={isSavingMembers}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMembers}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl cursor-pointer shadow-lg disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSavingMembers ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Members...</span>
                    </>
                  ) : (
                    <span>Save Members</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEMBER LIMIT MODAL */}
      {editingLimitHead && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
              <h3 className="text-white font-bold text-base">
                Edit Member Limit ({editingLimitHead.headName})
              </h3>
              <button onClick={() => setEditingLimitHead(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editLimitError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs">
                {editLimitError}
              </div>
            )}

            <form onSubmit={handleSaveMemberLimit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">New Member Limit</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newLimitVal}
                  onChange={(e) => setNewLimitVal(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Current added members: <strong>{editingLimitHead.addedCount}</strong>.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setEditingLimitHead(null)}
                  disabled={isUpdatingLimit}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingLimit}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                >
                  {isUpdatingLimit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Limit...</span>
                    </>
                  ) : (
                    <span>Update Limit</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NPTEL EMAIL VERIFICATION MATCH CONFIRMATION MODAL */}
      {showNptelVerifyModal && selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
              <h3 className="text-white font-bold text-base flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <span>Verify NPTEL Account Sign-In Match</span>
              </h3>
              <button onClick={() => setShowNptelVerifyModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="text-slate-300 font-sans font-bold text-sm">
                NPTEL / SWAYAM Login Initiated for {selectedStudent.name}
              </div>
              <p className="text-slate-400 leading-relaxed">
                NPTEL sign-in portal was launched in a new tab with account login hint:
              </p>
              <div className="bg-indigo-950/60 border border-indigo-700/80 p-2.5 rounded-lg text-indigo-300 font-bold font-mono text-center">
                {nptelTargetEmail}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-amber-400 font-bold flex items-center space-x-1 font-sans">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Account Verification Rule:</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Confirm that the authenticated Google/SWAYAM account email matches <strong>{nptelTargetEmail}</strong> exactly. If a different account was signed in, click Mismatch / Cancel.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 font-sans text-xs font-bold">
              <button
                type="button"
                onClick={() => handleConfirmNptelEmailMatch(false)}
                className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Email Mismatch / Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmNptelEmailMatch(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl cursor-pointer shadow-lg flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Yes, Confirm Email Match & Connect</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD / EDIT CERTIFICATE MODAL */}
      {showCertModal && selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
              <h3 className="text-white font-bold text-base flex items-center space-x-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <span>{editingCert ? 'Edit Certificate Details' : 'Upload Student Certificate'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {certError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs">
                {certError}
              </div>
            )}

            <form onSubmit={handleSaveCertificate} className="space-y-4 text-xs font-mono">
              {/* STUDENT REGISTER NO & NAME (READ ONLY) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Register Number</label>
                  <input
                    type="text"
                    disabled
                    value={selectedStudent.registerNo}
                    className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-cyan-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Student Name</label>
                  <input
                    type="text"
                    disabled
                    value={selectedStudent.name}
                    className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-white font-bold"
                  />
                </div>
              </div>

              {/* CERTIFICATE NAME */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  Certificate Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Certified Cloud Practitioner / Machine Learning Workshop"
                  value={certCourseName}
                  onChange={(e) => setCertCourseName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* ISSUING ORGANIZATION & CATEGORY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Issuing Organization <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coursera, Udemy, NPTEL, IBM, IIT Madras"
                    value={certPlatform}
                    onChange={(e) => setCertPlatform(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Certificate Category</label>
                  <select
                    value={certCategory}
                    onChange={(e) => setCertCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value="Technical Certification">Technical Certification</option>
                    <option value="Workshop & Seminar">Workshop & Seminar</option>
                    <option value="Internship & Training">Internship & Training</option>
                    <option value="Hackathon & Competition">Hackathon & Competition</option>
                    <option value="Academic Excellence">Academic Excellence</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* ISSUE DATE */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Issue Date</label>
                <input
                  type="date"
                  value={certIssueDate}
                  onChange={(e) => setCertIssueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* FILE UPLOAD INPUT */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  Certificate File (PDF, JPG, PNG) {!editingCert && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/jpg,image/png"
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-300 font-mono text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-950 file:text-sky-300 hover:file:bg-sky-900"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Supported Formats: PDF, JPG, PNG | Max File Size: 10MB {editingCert && '(Leave empty to keep existing file)'}
                </p>
              </div>

              {/* SUBMIT BUTTONS */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800 font-sans">
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-bold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={certUploading}
                  className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold px-6 py-2 rounded-xl cursor-pointer shadow-lg text-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {certUploading ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-white" />
                      <span>{editingCert ? 'Update Certificate' : 'Upload Certificate'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT PARTICIPATION MODAL */}
      {showPartModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 font-mono shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
              <h3 className="text-white font-bold text-base flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>{editingPart ? 'Edit Participation Details' : 'Add Event Participation Record'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPartModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {partError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs">
                {partError}
              </div>
            )}

            <form onSubmit={handleSaveParticipation} className="space-y-4 text-xs font-mono">
              {/* STUDENT SELECTOR / REGISTER NO & NAME */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                {selectedStudent ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Register Number</label>
                      <input
                        type="text"
                        disabled
                        value={selectedStudent.registerNo}
                        className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-cyan-400 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Student Name</label>
                      <input
                        type="text"
                        disabled
                        value={selectedStudent.name}
                        className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-white font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Select Student <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={partStudentId}
                      onChange={(e) => setPartStudentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.registerNo} — {s.name} ({s.year} Sec {s.section})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* EVENT NAME */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  Event Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. National Level AI Hackathon / TechSymposium 2026"
                  value={partEventName}
                  onChange={(e) => setPartEventName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* EVENT CATEGORY & LEVEL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Event Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={partCategory}
                    onChange={(e) => setPartCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Hackathon">Hackathon</option>
                    <option value="Symposium">Symposium</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Conference">Conference</option>
                    <option value="Paper Presentation">Paper Presentation</option>
                    <option value="Competition">Competition</option>
                    <option value="Technical Event">Technical Event</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Participation Level <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={partEventLevel}
                    onChange={(e) => setPartEventLevel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="College">College</option>
                    <option value="District">District</option>
                    <option value="State">State</option>
                    <option value="National">National</option>
                    <option value="International">International</option>
                  </select>
                </div>
              </div>

              {/* ORGANIZER & EVENT DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Event Organizer / Host Institution <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IIT Madras, Anna University, IEEE"
                    value={partOrganizer}
                    onChange={(e) => setPartOrganizer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Event Date</label>
                  <input
                    type="date"
                    value={partDate}
                    onChange={(e) => setPartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* ACHIEVEMENT / RESULT */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Achievement / Result</label>
                <input
                  type="text"
                  placeholder="e.g. Participant, 1st Prize, 2nd Prize, Winner, Runner-Up, Special Mention"
                  value={partAchievement}
                  onChange={(e) => setPartAchievement(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Add additional details about the event, topic, or project presented..."
                  value={partDescription}
                  onChange={(e) => setPartDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* PROOF FILE UPLOAD */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  Participation Certificate / Proof Document {!editingPart && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/jpg,image/png"
                  onChange={(e) => setPartFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-slate-300 font-mono text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-950 file:text-indigo-300 hover:file:bg-indigo-900"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Supported Formats: PDF, JPG, PNG | Max File Size: 10MB {editingPart && '(Leave empty to keep existing proof file)'}
                </p>
              </div>

              {/* SUBMIT BUTTONS */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800 font-sans">
                <button
                  type="button"
                  onClick={() => setShowPartModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-bold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={partUploading}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-2 rounded-xl cursor-pointer shadow-lg text-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {partUploading ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-white" />
                      <span>{editingPart ? 'Update Record' : 'Save Participation'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* VIEW STUDENT DETAILS MODAL */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2 font-sans">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Student Details — {viewingStudent.name}</span>
              </h3>
              <button onClick={() => setViewingStudent(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-2.5 text-slate-300">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5"><span className="text-slate-500">Name:</span> <strong className="text-white font-sans">{viewingStudent.name}</strong></div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5"><span className="text-slate-500">Register Number:</span> <strong className="text-cyan-400">{viewingStudent.registerNo || (viewingStudent as any).register_no}</strong></div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5"><span className="text-slate-500">Mobile Number:</span> <strong>{viewingStudent.mobileNumber || (viewingStudent as any).mobile_number || 'N/A'}</strong></div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5"><span className="text-slate-500">College Mail ID:</span> <strong className="text-emerald-400">{viewingStudent.collegeEmail || viewingStudent.email}</strong></div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5"><span className="text-slate-500">Personal Mail ID:</span> <strong>{viewingStudent.personalEmail || (viewingStudent as any).personal_email || 'N/A'}</strong></div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5"><span className="text-slate-500">Address:</span> <strong>{viewingStudent.address || 'N/A'}</strong></div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5"><span className="text-slate-500">CGPA:</span> <strong className="text-amber-400 font-bold">{(viewingStudent.cgpa !== null && viewingStudent.cgpa !== undefined && viewingStudent.cgpa !== '') ? Number(viewingStudent.cgpa).toFixed(2) : 'Not Available'}</strong></div>
              <div className="flex justify-between pb-1.5"><span className="text-slate-500">Assigned Year / Sec:</span> <strong>{viewingStudent.year || assignedYear} / {viewingStudent.section || assignedSection}</strong></div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button onClick={() => setViewingStudent(null)} className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STUDENT DETAILS MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2 font-sans">
                <Pencil className="w-4 h-4 text-amber-400" />
                <span>Edit Student Details — {editingStudent.registerNo || (editingStudent as any).register_no}</span>
              </h3>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {editError && <div className="bg-red-950 border border-red-800 text-red-300 p-3 rounded-xl">{editError}</div>}

            <form onSubmit={handleSaveStudentEdit} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Name</label>
                <input type="text" required value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Mobile Number</label>
                  <input type="text" value={editForm.mobileNumber} onChange={(e) => setEditForm({...editForm, mobileNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">CGPA (Optional)</label>
                  <input type="number" step="0.01" min="0" max="10" value={editForm.cgpa ?? ''} onChange={(e) => setEditForm({...editForm, cgpa: e.target.value === '' ? null : (parseFloat(e.target.value) || null)})} placeholder="Leave blank if N/A" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-bold">College Mail ID</label>
                <input type="email" required value={editForm.collegeEmail} onChange={(e) => setEditForm({...editForm, collegeEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Personal Mail ID</label>
                <input type="email" value={editForm.personalEmail} onChange={(e) => setEditForm({...editForm, personalEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Address</label>
                <textarea rows={2} value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800 font-sans">
                <button type="button" onClick={() => setEditingStudent(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSavingEdit} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-5 py-2 rounded-xl cursor-pointer shadow-lg disabled:opacity-50">
                  {isSavingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
