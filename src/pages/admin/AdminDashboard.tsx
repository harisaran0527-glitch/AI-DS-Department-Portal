import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { API } from '../../services/api';
import type { UserSession, AcademicYear, Section } from '../../types';
import { DashboardLayout, type MenuItem } from '../../components/layout/DashboardLayout';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import {
  ShieldCheck,
  UserPlus,
  FileSpreadsheet,
  Users,
  CheckCircle,
  AlertCircle,
  Key,
  ToggleLeft,
  ToggleRight,
  Upload,
  Search,
  Edit2,
  X,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  BarChart3,
  FileText,
  UserCheck,
  Crown,
  Code,
  Download,
  RefreshCw,
  Filter,
  Loader2
} from 'lucide-react';

import { GeminiTopRecognitionView } from '../../components/ranking/GeminiTopRecognitionView';
import { GeminiFullLeetCodeDashboard } from '../../components/ranking/GeminiFullLeetCodeDashboard';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);

  // Active Menu Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Faculty State
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Student Roster State
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentYearFilter, setStudentYearFilter] = useState('ALL');
  const [studentSectionFilter, setStudentSectionFilter] = useState('ALL');
  const [studentDeptFilter, setStudentDeptFilter] = useState('ALL');
  const [studentCoordinatorFilter, setStudentCoordinatorFilter] = useState('ALL');
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);

  // HOD State
  const [hodList, setHodList] = useState<any[]>([]);
  const [showHODModal, setShowHODModal] = useState(false);
  const [editingHOD, setEditingHOD] = useState<any | null>(null);
  const [hodIdInput, setHodIdInput] = useState('');
  const [hodNameInput, setHodNameInput] = useState('');
  const [hodEmailInput, setHodEmailInput] = useState('');
  const [hodPasswordInput, setHodPasswordInput] = useState('');
  const [showHodPassword, setShowHodPassword] = useState(false);
  const [hodConfirmPasswordInput, setHodConfirmPasswordInput] = useState('');
  const [showHodConfirmPassword, setShowHodConfirmPassword] = useState(false);
  const [hodIsActive, setHodIsActive] = useState(true);
  const [hodFormError, setHodFormError] = useState('');

  // Reset HOD Password Modal State
  const [resetTargetHOD, setResetTargetHOD] = useState<any | null>(null);
  const [newHODPasswordInput, setNewHODPasswordInput] = useState('');
  const [showResetHODPassword, setShowResetHODPassword] = useState(false);
  const [resetHODError, setResetHODError] = useState('');

  // Add / Edit Faculty Form Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [isSavingFaculty, setIsSavingFaculty] = useState(false);
  const [isSavingHOD, setIsSavingHOD] = useState(false);
  const [isResettingPass, setIsResettingPass] = useState(false);
  const [isChangingAdminPass, setIsChangingAdminPass] = useState(false);
  const [updatingHodId, setUpdatingHodId] = useState<string | null>(null);
  const [updatingFacultyId, setUpdatingFacultyId] = useState<string | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [importError, setImportError] = useState('');

  const [formFacultyId, setFormFacultyId] = useState('');
  const [formFacultyName, setFormFacultyName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDepartment, setFormDepartment] = useState('AI & DS');
  const [formYear, setFormYear] = useState<AcademicYear>('2nd Year');
  const [formSection, setFormSection] = useState<Section>('A');
  const [formRole, setFormRole] = useState('Class Coordinator');

  // Password fields state with independent visibility toggles
  const [formPassword, setFormPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [showFormConfirmPassword, setShowFormConfirmPassword] = useState(false);

  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Reset Faculty Password Modal State
  const [resetTargetFaculty, setResetTargetFaculty] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  // Admin Self Change Password Modal State
  const [showAdminChangePasswordModal, setShowAdminChangePasswordModal] = useState(false);
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [showAdminCurrentPassword, setShowAdminCurrentPassword] = useState(false);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [showAdminNewPassword, setShowAdminNewPassword] = useState(false);
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [adminPasswordSuccess, setAdminPasswordSuccess] = useState('');

  // Delete Target Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string; isHOD?: boolean; isStudent?: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Student CSV Import State
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);
  const [csvStats, setCsvStats] = useState<{ total: number; valid: number; duplicates: number; invalid: number }>({
    total: 0,
    valid: 0,
    duplicates: 0,
    invalid: 0
  });

  const [csvText, setCsvText] = useState('');
  const [defaultStudentPassword, setDefaultStudentPassword] = useState('student123');
  const [showDefaultStudentPassword, setShowDefaultStudentPassword] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const handleSelectCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.xlsx')) {
      alert('Invalid file format. Please select a valid CSV or Excel file.');
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
      return;
    }

    setSelectedCsvFile(file);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        await parseAndBuildCsvPreview(rows);
      },
      error: (err) => {
        alert(`Failed to parse CSV file: ${err.message}`);
      }
    });
  };

  const parseAndBuildCsvPreview = async (rows: any[]) => {
    try {
      const previewData = await API.previewStudentExcelImport(rows);
      
      const mappedPreview = previewData.preview.map((p) => ({
        rowIndex: p.rowNumber,
        registerNo: p.parsedData.registerNo,
        name: p.parsedData.name,
        email: p.parsedData.collegeEmail,
        mobileNumber: p.parsedData.mobileNumber,
        personalEmail: p.parsedData.personalEmail,
        address: p.parsedData.address,
        cgpa: p.parsedData.cgpa,
        status: p.status === 'ERROR' ? 'invalid' : p.status === 'UPDATE_EXISTING' ? 'duplicate' : 'valid',
        statusMsg: p.errors.length > 0 ? p.errors.join(' | ') : (p.status === 'UPDATE_EXISTING' ? 'Existing student (will update record & password)' : 'Valid new student'),
        errors: p.errors,
        parsedData: p.parsedData
      }));

      setCsvPreviewRows(mappedPreview);
      setCsvStats({
        total: previewData.totalRows,
        valid: previewData.validRowsCount,
        duplicates: previewData.updateRowsCount,
        invalid: previewData.errorRowsCount
      });
    } catch (err: any) {
      alert(err.message || 'Failed to validate Excel import preview.');
    }
  };

  const handleConfirmFileImport = async () => {
    const validStudents = csvPreviewRows
      .filter((r) => r.status !== 'invalid')
      .map((r) => r.parsedData || {
        registerNo: r.registerNo,
        name: r.name,
        collegeEmail: r.email,
        mobileNumber: r.mobileNumber,
        personalEmail: r.personalEmail,
        address: r.address,
        cgpa: r.cgpa
      });

    if (validStudents.length === 0) {
      alert('No valid student records found to import.');
      return;
    }

    try {
      const res = await API.confirmStudentExcelImport(validStudents);
      setImportResult(res);
      setSelectedCsvFile(null);
      setCsvPreviewRows([]);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to import student Excel records.');
    }
  };

  const fetchAdminData = React.useCallback(async () => {
    try {
      setIsStudentsLoading(true);
      const meRes = await API.getMe();
      if (!meRes.user || meRes.user.role !== 'ADMIN') {
        navigate('/admin');
        return;
      }
      setSession(meRes.user);

      const facRes = await API.getFacultyList();
      setFacultyList(facRes.faculty || []);

      const hodRes = await API.getHODList();
      setHodList(hodRes.hodList || []);

      const stuRes = await API.getAllStudents();
      setStudentsList(stuRes.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStudentsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchAdminData();
  }, [fetchAdminData]);

  const activeHOD = useMemo(() => hodList.find((h) => Boolean(h.isActive)), [hodList]);

  const isTestHOD = useMemo(() => {
    if (!activeHOD) return false;
    const id = (activeHOD.identifier || '').toLowerCase();
    const email = (activeHOD.email || '').toLowerCase();
    const name = (activeHOD.name || '').toLowerCase();
    return id.includes('test') || email.includes('test') || name.includes('test') || id.includes('dup') || id.includes('sys');
  }, [activeHOD]);

  // HOD CRUD Handlers
  const openAddHODModal = () => {
    setEditingHOD(null);
    setHodIdInput('');
    setHodNameInput('');
    setHodEmailInput('');
    setHodPasswordInput('');
    setShowHodPassword(false);
    setHodConfirmPasswordInput('');
    setShowHodConfirmPassword(false);
    setHodIsActive(true);
    setHodFormError('');
    setShowHODModal(true);
  };

  const openEditHODModal = (hod: any) => {
    setEditingHOD(hod);
    setHodIdInput(hod.identifier || '');
    setHodNameInput(hod.name || '');
    setHodEmailInput(hod.email || '');
    setHodIsActive(hod.isActive !== false);
    setHodPasswordInput('');
    setShowHodPassword(false);
    setHodConfirmPasswordInput('');
    setShowHodConfirmPassword(false);
    setHodFormError('');
    setShowHODModal(true);
  };

  const handleSaveHOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingHOD) return;
    setHodFormError('');
    setIsSavingHOD(true);

    if (!hodIdInput.trim() || !hodNameInput.trim() || !hodEmailInput.trim()) {
      setHodFormError('HOD ID, Name, and Email are required.');
      setIsSavingHOD(false);
      return;
    }

    if (!editingHOD) {
      if (!hodPasswordInput) {
        setHodFormError('Portal Password is required for new HOD account.');
        setIsSavingHOD(false);
        return;
      }
      if (hodPasswordInput !== hodConfirmPasswordInput) {
        setHodFormError('Portal passwords do not match.');
        setIsSavingHOD(false);
        return;
      }
      if (hodPasswordInput.length < 6) {
        setHodFormError('Portal password must be at least 6 characters long.');
        setIsSavingHOD(false);
        return;
      }
    }

    try {
      if (editingHOD) {
        await API.updateHOD(editingHOD.id, {
          hodName: hodNameInput.trim(),
          email: hodEmailInput.trim().toLowerCase(),
          isActive: hodIsActive
        });
      } else {
        await API.addHOD({
          hodId: hodIdInput.trim(),
          hodName: hodNameInput.trim(),
          email: hodEmailInput.trim().toLowerCase(),
          password: hodPasswordInput,
          isActive: hodIsActive
        });
      }

      setShowHODModal(false);
      fetchAdminData();
    } catch (err: any) {
      setHodFormError(err.message || 'Failed to save HOD account.');
    } finally {
      setIsSavingHOD(false);
    }
  };

  const handleToggleHODStatus = async (hod: any) => {
    setUpdatingHodId(hod.id);
    try {
      await API.updateHODStatus(hod.id, !hod.isActive);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update HOD account status.');
    } finally {
      setUpdatingHodId(null);
    }
  };

  const handleResetHODPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetHODError('');
    if (!resetTargetHOD || !newHODPasswordInput) return;

    if (newHODPasswordInput.length < 6) {
      setResetHODError('Password must be at least 6 characters long.');
      return;
    }

    setIsResettingPass(true);
    try {
      await API.resetHODPassword(resetTargetHOD.id, newHODPasswordInput);
      setResetTargetHOD(null);
      setNewHODPasswordInput('');
      setShowResetHODPassword(false);
      fetchAdminData();
    } catch (err: any) {
      setResetHODError(err.message || 'Failed to reset HOD portal password.');
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleConfirmDeleteGeneric = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.isHOD) {
        await API.deleteHODAccount(deleteTarget.id);
      } else if (deleteTarget.isStudent) {
        await API.deleteStudentAccount(deleteTarget.id);
      } else {
        await API.deleteFacultyAccount(deleteTarget.id);
      }
      setDeleteTarget(null);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Faculty CRUD Handlers
  const openAddFacultyModal = () => {
    setEditingFaculty(null);
    setFormFacultyId('');
    setFormFacultyName('');
    setFormEmail('');
    setFormDepartment('AI & DS');
    setFormYear('2nd Year');
    setFormSection('A');
    setFormRole('Class Coordinator');
    setFormPassword('');
    setShowFormPassword(false);
    setFormConfirmPassword('');
    setShowFormConfirmPassword(false);
    setFormIsActive(true);
    setFormError('');
    setShowAddModal(true);
  };

  const openEditFacultyModal = (fac: any) => {
    setEditingFaculty(fac);
    setFormFacultyId(fac.identifier || '');
    setFormFacultyName(fac.name || '');
    setFormEmail(fac.email || '');
    setFormDepartment(fac.department || 'AI & DS');
    setFormYear(fac.year || '2nd Year');
    setFormSection(fac.section || 'A');
    setFormRole(fac.facultyRole || 'Class Coordinator');
    setFormIsActive(fac.isActive !== false);
    setFormPassword('');
    setShowFormPassword(false);
    setFormConfirmPassword('');
    setShowFormConfirmPassword(false);
    setFormError('');
    setShowAddModal(true);
  };

  const handleSaveFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingFaculty) return;
    setFormError('');
    setIsSavingFaculty(true);

    if (!formFacultyId.trim() || !formFacultyName.trim() || !formEmail.trim()) {
      setFormError('Faculty ID, Name, and Email are required.');
      setIsSavingFaculty(false);
      return;
    }

    if (!editingFaculty) {
      if (!formPassword) {
        setFormError('Portal Password is required for new faculty accounts.');
        setIsSavingFaculty(false);
        return;
      }
      if (formPassword !== formConfirmPassword) {
        setFormError('Portal passwords do not match.');
        setIsSavingFaculty(false);
        return;
      }
      if (formPassword.length < 6) {
        setFormError('Portal password must be at least 6 characters.');
        setIsSavingFaculty(false);
        return;
      }
    }

    try {
      if (editingFaculty) {
        await API.updateFacultyAssignment(editingFaculty.id, {
          year: formYear,
          section: formSection,
          role: formRole,
          isActive: formIsActive
        });
      } else {
        await API.addFaculty({
          facultyId: formFacultyId.trim(),
          facultyName: formFacultyName.trim(),
          email: formEmail.trim().toLowerCase(),
          year: formYear,
          section: formSection,
          role: formRole,
          password: formPassword,
          department: formDepartment
        });
      }

      setShowAddModal(false);
      fetchAdminData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save faculty account.');
    } finally {
      setIsSavingFaculty(false);
    }
  };

  const handleToggleStatus = async (fac: any) => {
    setUpdatingFacultyId(fac.id);
    try {
      await API.updateFacultyStatus(fac.id, !fac.isActive);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update account status.');
    } finally {
      setUpdatingFacultyId(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetTargetFaculty || !newPasswordInput) return;

    if (newPasswordInput.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }

    setIsResettingPass(true);
    try {
      await API.resetFacultyPassword(resetTargetFaculty.id, newPasswordInput);
      setResetTargetFaculty(null);
      setNewPasswordInput('');
      setShowResetPassword(false);
      fetchAdminData();
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset portal password.');
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordError('');
    setAdminPasswordSuccess('');

    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPasswordError('New passwords do not match.');
      return;
    }

    if (adminNewPassword.length < 6) {
      setAdminPasswordError('New password must be at least 6 characters long.');
      return;
    }

    setIsChangingAdminPass(true);
    try {
      const res = await API.changeAdminPassword(adminCurrentPassword, adminNewPassword);
      setAdminPasswordSuccess(res.message || 'Password changed successfully!');
      setAdminCurrentPassword('');
      setShowAdminCurrentPassword(false);
      setAdminNewPassword('');
      setShowAdminNewPassword(false);
      setAdminConfirmPassword('');
      setShowAdminConfirmPassword(false);
      setTimeout(() => {
        setShowAdminChangePasswordModal(false);
        setAdminPasswordSuccess('');
      }, 1500);
    } catch (err: any) {
      setAdminPasswordError(err.message || 'Failed to change admin password.');
    } finally {
      setIsChangingAdminPass(false);
    }
  };

  const handleCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportResult(null);
    setImportError('');
    if (!csvText.trim()) return;

    const lines = csvText.trim().split('\n');
    const parsedStudents: any[] = [];

    lines.forEach((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        parsedStudents.push({
          registerNo: parts[0],
          name: parts[1],
          email: parts[2] || `${parts[0].toLowerCase()}@aids.edu`,
          year: parts[3] || '2nd Year',
          section: parts[4] || 'A',
          batch: parts[5] || '2023-2027',
          cgpa: parts[6] || 0
        });
      }
    });

    if (parsedStudents.length === 0) {
      setImportError('No valid student records found in CSV text.');
      return;
    }

    setIsImportingCsv(true);
    try {
      const res = await API.importStudents(parsedStudents, defaultStudentPassword);
      setImportResult(res);
      setCsvText('');
      fetchAdminData();
    } catch (err: any) {
      setImportError(err.message || 'Failed to import student CSV.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleLogout = async () => {
    try {
      await API.logout();
    } catch {}
    navigate('/admin');
  };

  const filteredFaculty = useMemo(() => {
    if (!searchQuery.trim()) return facultyList;
    const q = searchQuery.toLowerCase();
    return facultyList.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.identifier && f.identifier.toLowerCase().includes(q))
    );
  }, [facultyList, searchQuery]);

  const uniqueCoordinators = useMemo(() => {
    const set = new Set<string>();
    studentsList.forEach((s: any) => {
      const coord = s.classCoordinatorName || s.class_coordinator_name || s.classCoordinator;
      if (coord && typeof coord === 'string' && coord.trim()) {
        set.add(coord.trim());
      }
    });
    return Array.from(set).sort();
  }, [studentsList]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    studentsList.forEach((s: any) => {
      const dept = s.department || 'AI & DS';
      if (dept && typeof dept === 'string' && dept.trim()) {
        set.add(dept.trim());
      }
    });
    if (set.size === 0) set.add('AI & DS');
    return Array.from(set).sort();
  }, [studentsList]);

  const filteredStudents = useMemo(() => {
    return studentsList.filter((s: any) => {
      const q = studentSearchQuery.toLowerCase().trim();
      const regNo = (s.registerNo || s.register_no || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      const email = (s.email || '').toLowerCase();

      if (q && !regNo.includes(q) && !name.includes(q) && !email.includes(q)) {
        return false;
      }

      const year = s.year || '2nd Year';
      if (studentYearFilter !== 'ALL' && year !== studentYearFilter) {
        return false;
      }

      const sec = s.section || 'A';
      if (studentSectionFilter !== 'ALL' && sec !== studentSectionFilter) {
        return false;
      }

      const dept = s.department || 'AI & DS';
      if (studentDeptFilter !== 'ALL' && dept !== studentDeptFilter) {
        return false;
      }

      const coord = s.classCoordinatorName || s.class_coordinator_name || s.classCoordinator || '';
      if (studentCoordinatorFilter !== 'ALL' && coord !== studentCoordinatorFilter) {
        return false;
      }

      return true;
    });
  }, [studentsList, studentSearchQuery, studentYearFilter, studentSectionFilter, studentDeptFilter, studentCoordinatorFilter]);

  const handleClearStudentFilters = () => {
    setStudentSearchQuery('');
    setStudentYearFilter('ALL');
    setStudentSectionFilter('ALL');
    setStudentDeptFilter('ALL');
    setStudentCoordinatorFilter('ALL');
  };

  const exportStudentsCsv = (list: any[], filename: string) => {
    if (!list || list.length === 0) {
      alert('No student records available to export.');
      return;
    }
    const headers = ['Register Number', 'Student Name', 'Email', 'Year', 'Section', 'Department', 'Class Coordinator', 'CGPA', 'Overall Score', 'Created At'];
    const rows = list.map((s) => [
      `"${s.registerNo || s.register_no || ''}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${s.email || ''}"`,
      `"${s.year || ''}"`,
      `"${s.section || ''}"`,
      `"${s.department || 'AI & DS'}"`,
      `"${(s.classCoordinatorName || s.class_coordinator_name || '').replace(/"/g, '""')}"`,
      `"${s.cgpa ?? 0}"`,
      `"${s.overallScore ?? s.overall_score ?? 0}"`,
      `"${s.createdAt || s.created_at ? new Date(s.createdAt || s.created_at).toLocaleDateString() : ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!session) return null;

  const adminMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'faculty-management', label: 'Faculty Management', icon: Users, badge: String(facultyList.length) },
    { id: 'add-faculty', label: 'Add Faculty', icon: UserPlus },
    { id: 'hod-management', label: 'HOD Management', icon: Crown, badge: String(hodList.length) },
    { id: 'student-management', label: 'Student Management', icon: UserCheck, badge: String(studentsList.length) },
    { id: 'csv-import', label: 'CSV Import', icon: FileSpreadsheet },
    { id: 'account-status', label: 'Account Status', icon: ShieldCheck },
    { id: 'rankings', label: 'Gemini Student Recognition', icon: Crown },
    { id: 'leetcode', label: 'Gemini LeetCode Analytics', icon: Code },
    { id: 'security', label: 'Security / Password', icon: Lock },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileText }
  ];

  return (
    <DashboardLayout
      portalRole="ADMIN"
      userName={session.name}
      userRoleTitle="System Administrator"
      subtitle={`Faculty: ${facultyList.length} | HOD Accounts: ${hodList.length}`}
      menuItems={adminMenuItems}
      activeTab={activeTab}
      onSelectTab={(tabId) => {
        setActiveTab(tabId);
        if (tabId === 'add-faculty') {
          openAddFacultyModal();
        } else if (tabId === 'security') {
          setShowAdminChangePasswordModal(true);
        }
      }}
      onLogout={handleLogout}
      headerActions={
        <div className="flex items-center space-x-2">
          <button
            onClick={openAddHODModal}
            className="btn-action bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 transition-transform duration-200 transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Add HOD</span>
          </button>
          <button
            onClick={openAddFacultyModal}
            className="btn-action bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-transform duration-200 transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Faculty</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* 1. DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-xl shrink-0">
                  <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center p-1.5">
                    <img src="/images/avsec-salem-logo.png" alt="AVSEC Salem Logo" className="w-full h-full object-contain drop-shadow" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h1 className="text-xl font-bold text-white">{session.name}</h1>
                    <span className="bg-cyan-950 border border-cyan-700 text-cyan-300 text-xs px-3 py-0.5 rounded-full font-bold">
                      AVSEC Salem Admin
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    AVSEC Salem — AI & DS System Control | Faculty: <strong className="text-white">{facultyList.length}</strong> | HOD Accounts: <strong className="text-amber-400">{hodList.length}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="text-xs text-slate-400 font-mono uppercase">Registered Faculty</div>
                <div className="text-2xl font-bold text-white mt-1">{facultyList.length} Accounts</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="text-xs text-amber-400 font-mono uppercase font-bold">Department HOD Account</div>
                <div className="text-2xl font-bold text-amber-300 mt-1">{activeHOD ? `Active (${activeHOD.name})` : 'No Active HOD'}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="text-xs text-slate-400 font-mono uppercase">System Security</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">HttpOnly + Bcrypt</div>
              </div>
            </div>
          </div>
        )}

        {/* 2. FACULTY MANAGEMENT */}
        {activeTab === 'faculty-management' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Faculty Portal Accounts</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Managed via <code className="text-cyan-400 font-bold">faculty_assignments</code> relational table.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Name, ID, or Email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {filteredFaculty.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-slate-300 font-bold text-sm">No Faculty Accounts Found</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the <strong>Add Faculty</strong> button to register a faculty member.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 font-mono uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3">Faculty Name</th>
                      <th className="py-3 px-3">Faculty ID</th>
                      <th className="py-3 px-3">Official Email</th>
                      <th className="py-3 px-3">Year / Section</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredFaculty.map((fac) => (
                      <tr key={fac.id} className="hover:bg-slate-950/60 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">{fac.name}</td>
                        <td className="py-3 px-3 font-mono text-cyan-400 font-bold">{fac.identifier}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{fac.email}</td>
                        <td className="py-3 px-3 font-mono">
                          <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-200">
                            {fac.year || '2nd Year'} - {fac.section || 'A'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-300">{fac.facultyRole || 'Class Coordinator'}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              fac.isActive
                                ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                                : 'bg-red-950 border border-red-800 text-red-300'
                            }`}
                          >
                            {fac.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => openEditFacultyModal(fac)}
                            className="bg-slate-800 hover:bg-slate-700 text-cyan-400 p-1.5 rounded-lg transition-all"
                            title="Edit Faculty Assignment"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setResetTargetFaculty(fac);
                              setNewPasswordInput('');
                              setShowResetPassword(false);
                              setResetError('');
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-400 p-1.5 rounded-lg transition-all"
                            title="Reset Portal Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(fac)}
                            className={`p-1.5 rounded-lg transition-all ${
                              fac.isActive ? 'bg-amber-950/80 text-amber-300 hover:bg-amber-900' : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900'
                            }`}
                            title={fac.isActive ? 'Disable Account' : 'Enable Account'}
                          >
                            {fac.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget({
                                id: fac.id,
                                name: `${fac.name} (${fac.email})`,
                                type: 'Faculty Account'
                              });
                            }}
                            className="bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-400 p-1.5 rounded-lg transition-all"
                            title="Delete Faculty Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. ADD FACULTY TAB */}
        {activeTab === 'add-faculty' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Add Faculty Member</h2>
            <p className="text-xs text-slate-400 font-mono">Use the modal popup to register new faculty accounts.</p>
            <button onClick={openAddFacultyModal} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs">
              Launch Add Faculty Modal
            </button>
          </div>
        )}

        {/* 4. HOD MANAGEMENT TAB */}
        {activeTab === 'hod-management' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span>HOD Account Management (AI & DS Department)</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Only ONE active HOD account is allowed for the AI & DS department.
                </p>
              </div>

              <button
                onClick={openAddHODModal}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 self-start md:self-auto"
              >
                <Crown className="w-4 h-4" />
                <span>+ Add HOD Account</span>
              </button>
            </div>

            {/* ACTIVE HOD ACCOUNT CARD AT TOP */}
            {activeHOD ? (
              <div className="bg-slate-950 border border-emerald-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Crown className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Currently Active HOD Account
                    </h3>
                    <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                      Active HOD
                    </span>
                  </div>

                  {isTestHOD && (
                    <div className="flex items-center space-x-2">
                      <span className="bg-amber-950 border border-amber-800 text-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono">
                        Automated Test Account Detected
                      </span>
                      <button
                        onClick={() => {
                          setDeleteTarget({
                            id: activeHOD.id,
                            name: `${activeHOD.name} (${activeHOD.email})`,
                            type: 'Temporary Test HOD Account',
                            isHOD: true
                          });
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-xl text-xs flex items-center space-x-1 shadow-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clean Up Test Account</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[11px] block font-sans font-semibold">HOD Name</span>
                    <span className="font-bold text-white text-sm">{activeHOD.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block font-sans font-semibold">HOD ID</span>
                    <span className="font-bold text-amber-400">{activeHOD.identifier}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block font-sans font-semibold">Official Email</span>
                    <span className="text-slate-300">{activeHOD.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block font-sans font-semibold">Status</span>
                    <span className="text-emerald-400 font-bold">Active HOD</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block font-sans font-semibold">Created Date</span>
                    <span className="text-slate-400">{activeHOD.createdAt ? new Date(activeHOD.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t border-slate-800/80 gap-3">
                  <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-mono">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Single Active HOD Rule is active. Disable or delete this account before creating a new active HOD.</span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => openEditHODModal(activeHOD)}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-3 py-1 rounded-lg font-bold text-xs"
                    >
                      Edit Details
                    </button>
                    <button
                      onClick={() => {
                        setResetTargetHOD(activeHOD);
                        setNewHODPasswordInput('');
                        setShowResetHODPassword(false);
                        setResetHODError('');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-3 py-1 rounded-lg font-bold text-xs"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => handleToggleHODStatus(activeHOD)}
                      className="bg-amber-950 border border-amber-800 text-amber-300 hover:bg-amber-900 px-3 py-1 rounded-lg font-bold text-xs"
                    >
                      Disable Account
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTarget({
                          id: activeHOD.id,
                          name: `${activeHOD.name} (${activeHOD.email})`,
                          type: 'HOD Account',
                          isHOD: true
                        });
                      }}
                      className="bg-red-950 border border-red-800 text-red-400 hover:bg-red-900 px-3 py-1 rounded-lg font-bold text-xs"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3 text-xs text-slate-400 font-mono">
                <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>No active HOD account is currently configured. Click <strong>+ Add HOD Account</strong> to create the official AI & DS HOD portal account.</span>
              </div>
            )}

            {/* HOD ACCOUNTS TABLE */}
            {hodList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Crown className="w-10 h-10 text-amber-500/50 mx-auto" />
                <div className="text-slate-300 font-bold text-sm">No HOD Accounts Created Yet</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the <strong>Add HOD Account</strong> button above to register the official HOD portal account.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">All Registered HOD Accounts</h3>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 font-mono uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3">HOD Name</th>
                      <th className="py-3 px-3">HOD ID</th>
                      <th className="py-3 px-3">Official Email</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Created Date</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {hodList.map((hod) => (
                      <tr key={hod.id} className="hover:bg-slate-950/60 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">{hod.name}</td>
                        <td className="py-3 px-3 font-mono text-amber-400 font-bold">{hod.identifier}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{hod.email}</td>
                        <td className="py-3 px-3 font-mono">
                          <span className="bg-amber-950/60 border border-amber-800/80 px-2.5 py-0.5 rounded-md font-bold text-amber-300">
                            {hod.department || 'AI & DS'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{hod.createdAt ? new Date(hod.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              hod.isActive
                                ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                                : 'bg-red-950 border border-red-800 text-red-300'
                            }`}
                          >
                            {hod.isActive ? 'Active HOD' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => openEditHODModal(hod)}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-400 p-1.5 rounded-lg transition-all"
                            title="Edit HOD Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setResetTargetHOD(hod);
                              setNewHODPasswordInput('');
                              setShowResetHODPassword(false);
                              setResetHODError('');
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-cyan-400 p-1.5 rounded-lg transition-all"
                            title="Reset HOD Portal Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleHODStatus(hod)}
                            className={`p-1.5 rounded-lg transition-all ${
                              hod.isActive ? 'bg-amber-950/80 text-amber-300 hover:bg-amber-900' : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900'
                            }`}
                            title={hod.isActive ? 'Disable HOD Account' : 'Enable HOD Account'}
                          >
                            {hod.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget({
                                id: hod.id,
                                name: `${hod.name} (${hod.email})`,
                                type: 'HOD Account',
                                isHOD: true
                              });
                            }}
                            className="bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-400 p-1.5 rounded-lg transition-all"
                            title="Delete HOD Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 5. STUDENT MANAGEMENT */}
        {activeTab === 'student-management' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            {/* HEADER BAR */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                    <UserCheck className="w-5 h-5 text-cyan-400" />
                    <span>Student Roster Management</span>
                  </h2>
                  <span className="bg-cyan-950 border border-cyan-700 text-cyan-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                    {filteredStudents.length} of {studentsList.length} Students
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Central PostgreSQL Database Roster — Real-time synchronization across Faculty & Admin Portals.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportStudentsCsv(filteredStudents, `students_filtered_${Date.now()}.csv`)}
                  disabled={filteredStudents.length === 0}
                  className="bg-slate-800 hover:bg-slate-700 text-cyan-300 disabled:opacity-40 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 border border-slate-700"
                  title="Download CSV containing only currently filtered records"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Filtered ({filteredStudents.length})</span>
                </button>
                <button
                  onClick={() => exportStudentsCsv(studentsList, `students_all_${Date.now()}.csv`)}
                  disabled={studentsList.length === 0}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 disabled:opacity-40 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 border border-slate-700"
                  title="Download CSV containing all database student records"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download All ({studentsList.length})</span>
                </button>
                <button
                  onClick={fetchAdminData}
                  disabled={isStudentsLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold p-1.5 rounded-xl text-xs border border-slate-700"
                  title="Refresh latest data from database"
                >
                  <RefreshCw className={`w-4 h-4 ${isStudentsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* FILTER & SEARCH TOOLBAR */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Search & Filter Toolbar</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Search Input */}
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Name, Reg No, Email..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Year Dropdown */}
                <div>
                  <select
                    value={studentYearFilter}
                    onChange={(e) => setStudentYearFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  >
                    <option value="ALL">Year: All</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                {/* Section Dropdown */}
                <div>
                  <select
                    value={studentSectionFilter}
                    onChange={(e) => setStudentSectionFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  >
                    <option value="ALL">Section: All</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>

                {/* Department Dropdown */}
                <div>
                  <select
                    value={studentDeptFilter}
                    onChange={(e) => setStudentDeptFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  >
                    <option value="ALL">Dept: All</option>
                    {uniqueDepartments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faculty/Coordinator Dropdown */}
                <div>
                  <select
                    value={studentCoordinatorFilter}
                    onChange={(e) => setStudentCoordinatorFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
                  >
                    <option value="ALL">Faculty: All</option>
                    {uniqueCoordinators.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ACTIVE FILTER SUMMARY & CLEAR FILTERS */}
              {(studentSearchQuery ||
                studentYearFilter !== 'ALL' ||
                studentSectionFilter !== 'ALL' ||
                studentDeptFilter !== 'ALL' ||
                studentCoordinatorFilter !== 'ALL') && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <div className="text-slate-400 font-mono text-[11px]">
                    Active Filters: {studentSearchQuery && <span className="text-cyan-400 mr-2">Query: "{studentSearchQuery}"</span>}
                    {studentYearFilter !== 'ALL' && <span className="text-cyan-400 mr-2">Year: {studentYearFilter}</span>}
                    {studentSectionFilter !== 'ALL' && <span className="text-cyan-400 mr-2">Sec: {studentSectionFilter}</span>}
                    {studentDeptFilter !== 'ALL' && <span className="text-cyan-400 mr-2">Dept: {studentDeptFilter}</span>}
                    {studentCoordinatorFilter !== 'ALL' && <span className="text-cyan-400 mr-2">Coord: {studentCoordinatorFilter}</span>}
                  </div>
                  <button
                    onClick={handleClearStudentFilters}
                    className="text-amber-400 hover:text-amber-300 font-bold font-mono text-[11px] underline"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            {/* STUDENT ROSTER TABLE */}
            {isStudentsLoading ? (
              <div className="text-center py-12 space-y-3 font-mono text-slate-400 text-xs">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <div>Fetching latest student records from PostgreSQL database...</div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800">
                <UserCheck className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-slate-300 font-bold text-sm">
                  {studentsList.length === 0 ? 'No Students Stored in Database' : 'No Students Match Current Filters'}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {studentsList.length === 0
                    ? 'Faculty or Admin can add students. Use the CSV Import or Faculty Portal to populate student records.'
                    : 'Try broadening your search query or clearing filter selections.'}
                </p>
                {studentsList.length > 0 && (
                  <button
                    onClick={handleClearStudentFilters}
                    className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold px-4 py-1.5 rounded-xl text-xs mt-2"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3">Student Name</th>
                      <th className="py-3 px-3">Register Number</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">Year / Sec</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Faculty / Coordinator</th>
                      <th className="py-3 px-3">Created Date</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStudents.map((s: any) => {
                      const regNo = s.registerNo || s.register_no || s.identifier || 'N/A';
                      const name = s.name || 'N/A';
                      const email = s.email || 'N/A';
                      const year = s.year || '2nd Year';
                      const section = s.section || 'A';
                      const dept = s.department || 'AI & DS';
                      const coord = s.classCoordinatorName || s.class_coordinator_name || s.classCoordinator || 'Assigned Faculty';
                      const createdDate = s.createdAt || s.created_at ? new Date(s.createdAt || s.created_at).toLocaleDateString() : 'N/A';
                      const isActive = s.isActive !== false;

                      return (
                        <tr key={s.id || regNo} className="hover:bg-slate-950/60 transition-colors">
                          <td className="py-3 px-3 font-bold text-white">{name}</td>
                          <td className="py-3 px-3 font-mono text-cyan-400 font-bold">{regNo}</td>
                          <td className="py-3 px-3 font-mono text-slate-400">{email}</td>
                          <td className="py-3 px-3">
                            <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-200">
                              {year} - {section}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-semibold">{dept}</td>
                          <td className="py-3 px-3 text-amber-300 font-semibold">{coord}</td>
                          <td className="py-3 px-3 text-slate-400">{createdDate}</td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive
                                  ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                                  : 'bg-red-950 border border-red-800 text-red-300'
                              }`}
                            >
                              {isActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setDeleteTarget({
                                  id: s.id,
                                  name: `${name} (${regNo})`,
                                  type: 'Student Account',
                                  isStudent: true
                                });
                              }}
                              className="bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-400 p-1.5 rounded-lg transition-all"
                              title="Delete Student Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 6. CSV IMPORT */}
        {activeTab === 'csv-import' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Student Bulk Import (CSV File Upload)</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Upload a <code className="text-cyan-400 font-bold">.csv</code> file or paste CSV text in format: <code className="text-cyan-400 font-bold">RegisterNo, Name, Email, Year, Section, Batch, CGPA</code>
              </p>
            </div>

            {importResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  importResult.errors && importResult.errors.length > 0
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>{importResult.message}</span>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1 font-mono text-[11px]">
                    <div className="font-bold text-red-400">Import Warnings / Skipped Rows:</div>
                    {importResult.errors.map((err: string, i: number) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* REAL CSV FILE UPLOAD ZONE */}
            <div className="bg-slate-950/80 border-2 border-dashed border-slate-800 hover:border-cyan-500/60 rounded-2xl p-6 text-center space-y-3 transition-colors">
              <input
                type="file"
                ref={csvFileInputRef}
                onChange={handleSelectCsvFile}
                accept=".csv,.txt"
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => csvFileInputRef.current?.click()}
                  className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center space-x-2 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose CSV File</span>
                </button>
                <p className="text-[11px] text-slate-400 font-mono mt-2">
                  Select a <code className="text-white">.csv</code> file containing student records. Format: Register Number, Student Name, Email, Department, Year, Section, Batch.
                </p>
              </div>
              {selectedCsvFile && (
                <div className="text-xs text-emerald-400 font-mono font-bold">
                  Selected File: {selectedCsvFile.name} ({(selectedCsvFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {/* PREVIEW TABLE AFTER PARSING CSV FILE */}
            {csvPreviewRows.length > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">Parsed CSV Preview</h3>
                    <p className="text-slate-400 font-mono text-[11px]">Verify parsed student rows before confirming database import.</p>
                  </div>
                  <div className="flex items-center space-x-3 font-mono text-[11px]">
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-lg">Valid: {csvStats.valid}</span>
                    <span className="bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-1 rounded-lg">Duplicates: {csvStats.duplicates}</span>
                    <span className="bg-red-950 text-red-300 border border-red-800 px-2.5 py-1 rounded-lg">Invalid: {csvStats.invalid}</span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left font-mono">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-2">Reg No</th>
                        <th className="py-2 px-2">Student Name</th>
                        <th className="py-2 px-2">Email</th>
                        <th className="py-2 px-2">Year/Sec</th>
                        <th className="py-2 px-2">CGPA</th>
                        <th className="py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-[11px]">
                      {csvPreviewRows.map((r) => (
                        <tr key={r.rowIndex} className="hover:bg-slate-900">
                          <td className="py-2 px-2 text-slate-500">{r.rowIndex}</td>
                          <td className="py-2 px-2 text-white font-bold">{r.registerNo || 'N/A'}</td>
                          <td className="py-2 px-2 text-slate-200">{r.name || 'N/A'}</td>
                          <td className="py-2 px-2 text-slate-400">{r.email}</td>
                          <td className="py-2 px-2 text-slate-400">{r.year} {r.section}</td>
                          <td className="py-2 px-2 text-amber-300 font-bold font-mono font-semibold">{(r.cgpa !== null && r.cgpa !== undefined && r.cgpa !== '' && !isNaN(Number(r.cgpa))) ? Number(r.cgpa).toFixed(2) : 'Not Available'}</td>
                          <td className="py-2 px-2">
                            {r.status === 'valid' && <span className="text-emerald-400 font-bold">Valid</span>}
                            {r.status === 'duplicate' && <span className="text-amber-400 font-bold">Duplicate</span>}
                            {r.status === 'invalid' && <span className="text-red-400 font-bold">Invalid</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmFileImport}
                    disabled={csvStats.valid === 0}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Import ({csvStats.valid} Valid Students)</span>
                  </button>
                </div>
              </div>
            )}

            {importError && (
              <div className="bg-red-950/80 border border-red-800/80 text-red-300 p-2.5 rounded-xl flex items-center space-x-2 font-mono text-[11px] animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <form onSubmit={handleCSVImport} className="space-y-4 pt-4 border-t border-slate-800">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Or Paste CSV Text Input</label>
                <textarea
                  rows={4}
                  placeholder={`7376222AD101, Student One, student1@aids.edu, 2nd Year, A, 2023-2027, 8.75\n7376222AD102, Student Two, student2@aids.edu, 2nd Year, A, 2023-2027, 9.10`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span>Default Student Portal Password:</span>
                  <div className="relative inline-block">
                    <input
                      type={showDefaultStudentPassword ? 'text' : 'password'}
                      value={defaultStudentPassword}
                      onChange={(e) => setDefaultStudentPassword(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-xs text-white font-mono rounded-lg pl-2.5 pr-8 py-1 w-40 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      aria-label={showDefaultStudentPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowDefaultStudentPassword(!showDefaultStudentPassword)}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
                    >
                      {showDefaultStudentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!csvText.trim() || isImportingCsv}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  {isImportingCsv ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing Students...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Execute Bulk Import</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 7. ACCOUNT STATUS */}
        {activeTab === 'account-status' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Faculty & HOD Account Status Overview</h2>
            <p className="text-xs text-slate-400 font-mono">Overview of Active vs Disabled Portal Accounts</p>
          </div>
        )}

        {/* 8. SECURITY */}
        {activeTab === 'security' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Security & Master Password</h2>
            <button onClick={() => setShowAdminChangePasswordModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl">
              Open Master Password Change Dialog
            </button>
          </div>
        )}

        {/* 9. AUDIT LOGS */}
        {activeTab === 'audit-logs' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">System Audit Logs</h2>
            <p className="text-xs text-slate-400 font-mono">Administrative activity and audit log records.</p>
          </div>
        )}

        {/* 10. GEMINI STUDENT RECOGNITION */}
        {activeTab === 'rankings' && (
          <GeminiTopRecognitionView userRole="ADMIN" />
        )}

        {/* 11. GEMINI LEETCODE ANALYTICS */}
        {activeTab === 'leetcode' && (
          <GeminiFullLeetCodeDashboard />
        )}
      </div>

      {/* ADD / EDIT HOD FORM MODAL */}
      {showHODModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>{editingHOD ? 'Edit HOD Account' : 'Add HOD Account'}</span>
              </h3>
              <button onClick={() => setShowHODModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeHOD && !editingHOD && (
              <div className="text-xs text-amber-200 bg-amber-950/80 border border-amber-800 p-2.5 rounded-lg flex items-center space-x-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  An active HOD account (<strong className="text-white">{activeHOD.name}</strong> - <code className="text-amber-300">{activeHOD.email}</code>) currently exists. Creating a new account in "Active" status will be blocked until the existing account is disabled or deleted.
                </span>
              </div>
            )}

            {hodFormError && (
              <div className="text-xs text-red-300 bg-red-950/90 border border-red-800 p-2.5 rounded-lg flex items-center space-x-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{hodFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveHOD} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">HOD Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full HOD Name"
                    value={hodNameInput}
                    onChange={(e) => setHodNameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">HOD ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HOD01"
                    value={hodIdInput}
                    onChange={(e) => setHodIdInput(e.target.value)}
                    disabled={Boolean(editingHOD)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    placeholder="hod@aids.edu"
                    value={hodEmailInput}
                    onChange={(e) => setHodEmailInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Department</label>
                  <input
                    type="text"
                    disabled
                    value="AI & DS"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-400 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Account Status</label>
                <select
                  value={hodIsActive ? 'Active' : 'Disabled'}
                  onChange={(e) => setHodIsActive(e.target.value === 'Active')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="Active">Active HOD</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              {!editingHOD && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Portal Password</label>
                    <div className="relative">
                      <input
                        type={showHodPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={hodPasswordInput}
                        onChange={(e) => setHodPasswordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-white font-mono"
                      />
                      <button
                        type="button"
                        aria-label={showHodPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowHodPassword(!showHodPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showHodPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Confirm Portal Password</label>
                    <div className="relative">
                      <input
                        type={showHodConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={hodConfirmPasswordInput}
                        onChange={(e) => setHodConfirmPasswordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-white font-mono"
                      />
                      <button
                        type="button"
                        aria-label={showHodConfirmPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowHodConfirmPassword(!showHodConfirmPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showHodConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHODModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHOD}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-2"
                >
                  {isSavingHOD ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Saving HOD...</span>
                    </>
                  ) : (
                    <span>Save HOD Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET HOD PASSWORD MODAL */}
      {resetTargetHOD && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">Reset HOD Portal Password</h3>
            <p className="text-xs text-slate-400 font-mono">
              HOD: <strong className="text-white">{resetTargetHOD.name}</strong> ({resetTargetHOD.email})
            </p>

            {resetHODError && (
              <div className="text-xs text-red-300 bg-red-950/80 border border-red-800 p-2 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{resetHODError}</span>
              </div>
            )}

            <form onSubmit={handleResetHODPassword} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">New HOD Portal Password</label>
                <div className="relative">
                  <input
                    type={showResetHODPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={newHODPasswordInput}
                    onChange={(e) => setNewHODPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showResetHODPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowResetHODPassword(!showResetHODPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showResetHODPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetTargetHOD(null)}
                  disabled={isResettingPass}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-2 cursor-pointer"
                >
                  {isResettingPass ? (
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

      {/* ADD / EDIT FACULTY FORM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingFaculty ? 'Edit Faculty Assignment' : 'Add Faculty Account'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="text-xs text-red-300 bg-red-950/80 border border-red-800 p-2.5 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveFaculty} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Faculty Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={formFacultyName}
                    onChange={(e) => setFormFacultyName(e.target.value)}
                    disabled={Boolean(editingFaculty)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Faculty ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FAC01"
                    value={formFacultyId}
                    onChange={(e) => setFormFacultyId(e.target.value)}
                    disabled={Boolean(editingFaculty)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Official/Personal Email ID</label>
                <input
                  type="email"
                  required
                  placeholder="faculty@aids.edu"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  disabled={Boolean(editingFaculty)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Department</label>
                  <input
                    type="text"
                    disabled
                    value={formDepartment}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Assigned Year</label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Assigned Section</label>
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Faculty Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="Class Coordinator">Class Coordinator</option>
                    <option value="Subject Faculty">Subject Faculty</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Account Status</label>
                  <select
                    value={formIsActive ? 'Active' : 'Disabled'}
                    onChange={(e) => setFormIsActive(e.target.value === 'Active')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {!editingFaculty && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Portal Password</label>
                    <div className="relative">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-white font-mono"
                      />
                      <button
                        type="button"
                        aria-label={showFormPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Confirm Portal Password</label>
                    <div className="relative">
                      <input
                        type={showFormConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={formConfirmPassword}
                        onChange={(e) => setFormConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-white font-mono"
                      />
                      <button
                        type="button"
                        aria-label={showFormConfirmPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowFormConfirmPassword(!showFormConfirmPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showFormConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingFaculty}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center space-x-2"
                >
                  {isSavingFaculty ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Saving Faculty...</span>
                    </>
                  ) : (
                    <span>Save Faculty</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET FACULTY PASSWORD MODAL */}
      {resetTargetFaculty && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">Reset Portal Password</h3>
            <p className="text-xs text-slate-400 font-mono">
              Faculty: <strong className="text-white">{resetTargetFaculty.name}</strong> ({resetTargetFaculty.email})
            </p>

            {resetError && (
              <div className="text-xs text-red-300 bg-red-950/80 border border-red-800 p-2 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">New Temporary Portal Password</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetTargetFaculty(null)}
                  disabled={isResettingPass}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center space-x-2 cursor-pointer"
                >
                  {isResettingPass ? (
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

      {/* ADMIN SELF CHANGE PASSWORD MODAL */}
      {showAdminChangePasswordModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Change Admin Password</span>
              </h3>
              <button onClick={() => setShowAdminChangePasswordModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminPasswordError && (
              <div className="text-xs text-red-300 bg-red-950/80 border border-red-800 p-2 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{adminPasswordError}</span>
              </div>
            )}

            {adminPasswordSuccess && (
              <div className="text-xs text-emerald-300 bg-emerald-950/80 border border-emerald-800 p-2 rounded-lg flex items-center space-x-2">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{adminPasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdminChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Current Master Password</label>
                <div className="relative">
                  <input
                    type={showAdminCurrentPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={adminCurrentPassword}
                    onChange={(e) => setAdminCurrentPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-white font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showAdminCurrentPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowAdminCurrentPassword(!showAdminCurrentPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showAdminCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">New Master Password</label>
                <div className="relative">
                  <input
                    type={showAdminNewPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-white font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showAdminNewPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowAdminNewPassword(!showAdminNewPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showAdminNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showAdminConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={adminConfirmPassword}
                    onChange={(e) => setAdminConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-white font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showAdminConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowAdminConfirmPassword(!showAdminConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showAdminConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdminChangePasswordModal(false)}
                  disabled={isChangingAdminPass}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingAdminPass}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer"
                >
                  {isChangingAdminPass ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        recordName={deleteTarget?.name || ''}
        recordType={deleteTarget?.type || ''}
        onConfirm={handleConfirmDeleteGeneric}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </DashboardLayout>
  );
};
