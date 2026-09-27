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
  Code
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string; isHOD?: boolean } | null>(null);
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

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      alert('Invalid file format. Please select a valid .csv file.');
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
      return;
    }

    setSelectedCsvFile(file);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        parseAndBuildCsvPreview(rows);
      },
      error: (err) => {
        alert(`Failed to parse CSV file: ${err.message}`);
      }
    });
  };

  const parseAndBuildCsvPreview = (rows: any[]) => {
    let validCount = 0;
    let dupCount = 0;
    let invCount = 0;
    const seenRegs = new Set<string>();

    const previewList = rows.map((r, index) => {
      const regNo = (r['Register Number'] || r['registerNo'] || r['regNo'] || r['RegisterNo'] || Object.values(r)[0] || '').toString().trim();
      const name = (r['Student Name'] || r['Name'] || r['name'] || r['StudentName'] || Object.values(r)[1] || '').toString().trim();
      const email = (r['Email'] || r['email'] || (regNo ? `${regNo.toLowerCase()}@aids.edu` : '')).toString().trim();
      const dept = (r['Department'] || r['department'] || 'AI & DS').toString().trim();
      const year = (r['Year'] || r['year'] || '2nd Year').toString().trim();
      const section = (r['Section'] || r['section'] || 'A').toString().trim();
      const batch = (r['Batch'] || r['batch'] || '2023-2027').toString().trim();
      const cgpa = parseFloat(r['CGPA'] || r['cgpa'] || 0) || 0;

      let status = 'valid';
      let statusMsg = 'Valid Student Record';

      if (!regNo || !name) {
        status = 'invalid';
        statusMsg = 'Missing Register No or Name';
        invCount++;
      } else if (seenRegs.has(regNo.toLowerCase())) {
        status = 'duplicate';
        statusMsg = 'Duplicate Reg No in file';
        dupCount++;
      } else {
        seenRegs.add(regNo.toLowerCase());
        validCount++;
      }

      return {
        rowIndex: index + 1,
        registerNo: regNo,
        name,
        email,
        department: dept,
        year,
        section,
        batch,
        cgpa,
        status,
        statusMsg
      };
    });

    setCsvPreviewRows(previewList);
    setCsvStats({
      total: rows.length,
      valid: validCount,
      duplicates: dupCount,
      invalid: invCount
    });
  };

  const handleConfirmFileImport = async () => {
    const validStudents = csvPreviewRows
      .filter((r) => r.status === 'valid')
      .map((r) => ({
        registerNo: r.registerNo,
        name: r.name,
        email: r.email,
        year: r.year,
        section: r.section,
        batch: r.batch,
        cgpa: r.cgpa
      }));

    if (validStudents.length === 0) {
      alert('No valid student records found to import.');
      return;
    }

    try {
      const res = await API.importStudents(validStudents, defaultStudentPassword);
      setImportResult(res);
      setSelectedCsvFile(null);
      setCsvPreviewRows([]);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    } catch (err: any) {
      alert(err.message || 'Failed to import CSV student records.');
    }
  };

  const fetchAdminData = React.useCallback(async () => {
    try {
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
    } catch (err) {
      console.error(err);
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
    setHodFormError('');

    if (!hodIdInput.trim() || !hodNameInput.trim() || !hodEmailInput.trim()) {
      setHodFormError('HOD ID, Name, and Email are required.');
      return;
    }

    if (!editingHOD) {
      if (!hodPasswordInput) {
        setHodFormError('Portal Password is required for new HOD account.');
        return;
      }
      if (hodPasswordInput !== hodConfirmPasswordInput) {
        setHodFormError('Portal passwords do not match.');
        return;
      }
      if (hodPasswordInput.length < 6) {
        setHodFormError('Portal password must be at least 6 characters long.');
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
    }
  };

  const handleToggleHODStatus = async (hod: any) => {
    try {
      await API.updateHODStatus(hod.id, !hod.isActive);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update HOD account status.');
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

    try {
      await API.resetHODPassword(resetTargetHOD.id, newHODPasswordInput);
      setResetTargetHOD(null);
      setNewHODPasswordInput('');
      setShowResetHODPassword(false);
      alert(`Portal password reset successfully for HOD ${resetTargetHOD.name}.`);
    } catch (err: any) {
      setResetHODError(err.message || 'Failed to reset HOD portal password.');
    }
  };

  const handleConfirmDeleteGeneric = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.isHOD) {
        await API.deleteHODAccount(deleteTarget.id);
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
    setFormError('');

    if (!formFacultyId.trim() || !formFacultyName.trim() || !formEmail.trim()) {
      setFormError('Faculty ID, Name, and Email are required.');
      return;
    }

    if (!editingFaculty) {
      if (!formPassword) {
        setFormError('Portal Password is required for new faculty accounts.');
        return;
      }
      if (formPassword !== formConfirmPassword) {
        setFormError('Portal passwords do not match.');
        return;
      }
      if (formPassword.length < 6) {
        setFormError('Portal password must be at least 6 characters.');
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
    }
  };

  const handleToggleStatus = async (fac: any) => {
    try {
      await API.updateFacultyStatus(fac.id, !fac.isActive);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update account status.');
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

    try {
      await API.resetFacultyPassword(resetTargetFaculty.id, newPasswordInput);
      setResetTargetFaculty(null);
      setNewPasswordInput('');
      setShowResetPassword(false);
      alert(`Portal password reset successfully for ${resetTargetFaculty.name}.`);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset portal password.');
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
    }
  };

  const handleCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportResult(null);
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
      alert('No valid student records found in CSV text.');
      return;
    }

    try {
      const res = await API.importStudents(parsedStudents, defaultStudentPassword);
      setImportResult(res);
      setCsvText('');
    } catch (err: any) {
      alert(err.message || 'Failed to import student CSV.');
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

  if (!session) return null;

  const adminMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'faculty-management', label: 'Faculty Management', icon: Users, badge: String(facultyList.length) },
    { id: 'add-faculty', label: 'Add Faculty', icon: UserPlus },
    { id: 'hod-management', label: 'HOD Management', icon: Crown, badge: String(hodList.length) },
    { id: 'student-management', label: 'Student Management', icon: UserCheck },
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
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-amber-500/20"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Add HOD</span>
          </button>
          <button
            onClick={openAddFacultyModal}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20"
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
                  <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center text-cyan-400">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h1 className="text-xl font-bold text-white">{session.name}</h1>
                    <span className="bg-cyan-950 border border-cyan-700 text-cyan-300 text-xs px-3 py-0.5 rounded-full font-bold">
                      System Administrator
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    AI & DS Department System Control | Faculty: <strong className="text-white">{facultyList.length}</strong> | HOD Accounts: <strong className="text-amber-400">{hodList.length}</strong>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Student Account Roster Management</h2>
            <p className="text-xs text-slate-400 font-mono">View and manage imported student accounts across all sections.</p>
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
                  disabled={!csvText.trim()}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>Execute Bulk Import</span>
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
                <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20">
                  Save HOD Account
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
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20">
                  Reset Password
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
                <button type="submit" className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20">
                  Save Faculty
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
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20">
                  Reset Password
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
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30">
                  Update Password
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
