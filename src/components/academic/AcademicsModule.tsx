import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { API } from '../../services/api';
import type { Student } from '../../types';
import { SubjectManagement } from './SubjectManagement';
import {
  BookOpen,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Search,
  RefreshCw,
  GraduationCap,
  Download,
  ListOrdered,
  ChevronRight
} from 'lucide-react';

interface AcademicsModuleProps {
  userRole?: 'FACULTY' | 'HOD' | 'ADMIN' | 'STUDENT';
  assignedYear?: string;
  assignedSection?: string;
  students?: Student[];
  onStudentsChange?: () => void;
}

export const AcademicsModule: React.FC<AcademicsModuleProps> = ({
  userRole = 'FACULTY',
  assignedYear = '2nd Year',
  assignedSection = 'A',
  students: propStudents = [],
  onStudentsChange
}) => {
  // Four Dedicated Academics Tabs
  const [activeSubTab, setActiveSubTab] = useState<'subject-master' | 'bulk-marks' | 'saved-records' | 'student-roster'>('subject-master');

  // Year & Section controls
  const [currentYear, setCurrentYear] = useState<string>(assignedYear && assignedYear !== 'ALL' ? assignedYear : '2nd Year');
  const [currentSection, setCurrentSection] = useState<string>(assignedSection && assignedSection !== 'ALL' ? assignedSection : 'A');

  // ----------------------------------------------------
  // TAB 1: SUBJECT MASTER STATE
  // ----------------------------------------------------
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [subjectParsing, setSubjectParsing] = useState<boolean>(false);
  const [subjectPreviewResult, setSubjectPreviewResult] = useState<{
    summary: { totalRowsProcessed: number; validCount: number; invalidCount: number };
    validRows: any[];
    invalidRows: any[];
  } | null>(null);
  const [subjectConfirming, setSubjectConfirming] = useState<boolean>(false);
  const [subjectSuccessMsg, setSubjectSuccessMsg] = useState<string>('');
  const [subjectErrMsg, setSubjectErrMsg] = useState<string>('');
  const subjectFileInputRef = useRef<HTMLInputElement | null>(null);

  // ----------------------------------------------------
  // TAB 2: BULK MARKS UPLOAD STATE
  // ----------------------------------------------------
  const [selectedExamType, setSelectedExamType] = useState<string>('Unit Test 1');
  const [marksFile, setMarksFile] = useState<File | null>(null);
  const [marksParsing, setMarksParsing] = useState<boolean>(false);
  const [marksPreviewResult, setMarksPreviewResult] = useState<{
    summary: { totalRowsProcessed: number; validCount: number; invalidCount: number };
    validRows: any[];
    invalidRows: any[];
  } | null>(null);
  const [marksConfirming, setMarksConfirming] = useState<boolean>(false);
  const [marksSuccessMsg, setMarksSuccessMsg] = useState<string>('');
  const [marksErrMsg, setMarksErrMsg] = useState<string>('');
  const marksFileInputRef = useRef<HTMLInputElement | null>(null);

  // ----------------------------------------------------
  // TAB 3: SAVED EXAM RECORDS STATE
  // ----------------------------------------------------
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [recordsErrMsg, setRecordsErrMsg] = useState<string>('');
  const [recordSearchQuery, setRecordSearchQuery] = useState<string>('');
  const [recordExamFilter, setRecordExamFilter] = useState<string>('ALL');
  const [recordSubjectFilter, setRecordSubjectFilter] = useState<string>('ALL');

  // ----------------------------------------------------
  // TAB 4: STUDENT ROSTER STATE
  // ----------------------------------------------------
  const [rosterStudents, setRosterStudents] = useState<Student[]>(propStudents);
  const [loadingRoster, setLoadingRoster] = useState<boolean>(false);
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>('');
  const [selectedRosterStudent, setSelectedRosterStudent] = useState<Student | null>(null);
  const [student360Academics, setStudent360Academics] = useState<any | null>(null);
  const [loadingStudent360, setLoadingStudent360] = useState<boolean>(false);

  const isReadOnly = userRole === 'STUDENT' || userRole === 'HOD';

  // Synchronize assigned year and section if props change
  useEffect(() => {
    if (assignedYear && assignedYear !== 'ALL') setCurrentYear(assignedYear);
    if (assignedSection && assignedSection !== 'ALL') setCurrentSection(assignedSection);
  }, [assignedYear, assignedSection]);

  // Load Saved Exam Records
  const loadSavedRecords = async () => {
    setLoadingRecords(true);
    setRecordsErrMsg('');
    try {
      const res = await API.getAcademicRecords({
        year: currentYear,
        section: currentSection
      });
      setSavedRecords(res.records || []);
    } catch (err: any) {
      console.error('Error loading academic records:', err);
      setRecordsErrMsg(err.message || 'Failed to fetch saved exam records.');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Load Roster Students if not provided
  const loadRosterStudents = async () => {
    if (propStudents.length > 0) {
      setRosterStudents(propStudents);
      return;
    }
    setLoadingRoster(true);
    try {
      const res = await API.getDepartmentStudents(
        currentYear === 'ALL' ? undefined : currentYear,
        currentSection === 'ALL' ? undefined : currentSection
      );
      setRosterStudents(res.students || []);
    } catch (err: any) {
      console.error('Error fetching roster students:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'saved-records') {
      loadSavedRecords();
    } else if (activeSubTab === 'student-roster') {
      loadRosterStudents();
    }
  }, [activeSubTab, currentYear, currentSection, propStudents]);

  // Load 360 Academics when a roster student is clicked
  const handleSelectRosterStudent = async (student: Student) => {
    setSelectedRosterStudent(student);
    setLoadingStudent360(true);
    try {
      const data = await API.getStudent360ForFaculty(student.id);
      setStudent360Academics(data?.academics || []);
    } catch (err: any) {
      console.error('Failed to load student 360 academics:', err);
      setStudent360Academics([]);
    } finally {
      setLoadingStudent360(false);
    }
  };

  // ----------------------------------------------------
  // SUBJECT MASTER BULK UPLOAD HANDLERS
  // ----------------------------------------------------
  const handleSubjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setSubjectErrMsg('File size exceeds 10 MB limit. Please upload a smaller file.');
      if (subjectFileInputRef.current) subjectFileInputRef.current.value = '';
      return;
    }

    const fileName = file.name.toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.pl', '.py', '.cgi', '.jar', '.vbs', '.js', '.ts', '.msi'];
    if (dangerousExts.some(ext => fileName.endsWith(ext))) {
      setSubjectErrMsg('Executable or script files are strictly prohibited.');
      if (subjectFileInputRef.current) subjectFileInputRef.current.value = '';
      return;
    }

    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      setSubjectErrMsg('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      if (subjectFileInputRef.current) subjectFileInputRef.current.value = '';
      return;
    }

    setSubjectFile(file);
    setSubjectPreviewResult(null);
    setSubjectErrMsg('');
    setSubjectSuccessMsg('');
    setSubjectParsing(true);

    try {
      let rawRows: any[] = [];
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error('Uploaded Excel workbook contains no worksheets.');
        const worksheet = workbook.Sheets[firstSheetName];
        rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rawRows = parsed.data as any[];
      }

      if (rawRows.length === 0) {
        throw new Error('Uploaded file contains no data rows.');
      }

      const res = await API.previewSubjectImport(rawRows, currentYear, currentSection);
      setSubjectPreviewResult(res);
    } catch (err: any) {
      setSubjectErrMsg(err.message || 'Failed to preview Subject Master import.');
    } finally {
      setSubjectParsing(false);
    }
  };

  const handleConfirmSubjectImport = async () => {
    if (!subjectPreviewResult || subjectPreviewResult.validRows.length === 0) return;
    setSubjectConfirming(true);
    setSubjectErrMsg('');
    try {
      const res = await API.confirmSubjectImport(subjectPreviewResult.validRows, currentYear, currentSection);
      setSubjectSuccessMsg(`Subject Master import confirmed! ${res.importedCount} subjects updated/saved successfully.`);
      setSubjectPreviewResult(null);
      setSubjectFile(null);
      if (subjectFileInputRef.current) subjectFileInputRef.current.value = '';
      setTimeout(() => setSubjectSuccessMsg(''), 5000);
    } catch (err: any) {
      setSubjectErrMsg(err.message || 'Failed to confirm Subject Master import.');
    } finally {
      setSubjectConfirming(false);
    }
  };

  // Download official Subject Master Excel template (.xlsx)
  const downloadSubjectTemplate = () => {
    const templateRows = [
      { 'Subject Code': 'MA25C08', 'Subject Abbreviation': 'DM', 'Subject Title': 'Discrete Mathematics' },
      { 'Subject Code': 'CS25C10', 'Subject Abbreviation': 'OOSE', 'Subject Title': 'Object Oriented Software Engineering' },
      { 'Subject Code': 'CS25C08', 'Subject Abbreviation': 'DS', 'Subject Title': 'Data Structures' },
      { 'Subject Code': 'CS25C09', 'Subject Abbreviation': 'JP', 'Subject Title': 'Java Programming' },
      { 'Subject Code': 'CS25C11', 'Subject Abbreviation': 'OS', 'Subject Title': 'Operating Systems' },
      { 'Subject Code': 'EN25C03', 'Subject Abbreviation': 'EC LAB', 'Subject Title': 'English Communication Skills Laboratory - I' }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SubjectMaster');
    XLSX.writeFile(workbook, `subject_master_template_${currentYear.replace(/\s+/g, '_')}_Sec_${currentSection}.xlsx`);
  };

  // ----------------------------------------------------
  // BULK MARKS EXCEL UPLOAD HANDLERS
  // ----------------------------------------------------
  const handleMarksFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMarksErrMsg('File size exceeds 10 MB limit. Please upload a smaller file.');
      if (marksFileInputRef.current) marksFileInputRef.current.value = '';
      return;
    }

    const fileName = file.name.toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.pl', '.py', '.cgi', '.jar', '.vbs', '.js', '.ts', '.msi'];
    if (dangerousExts.some(ext => fileName.endsWith(ext))) {
      setMarksErrMsg('Executable or script files are strictly prohibited.');
      if (marksFileInputRef.current) marksFileInputRef.current.value = '';
      return;
    }

    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      setMarksErrMsg('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      if (marksFileInputRef.current) marksFileInputRef.current.value = '';
      return;
    }

    setMarksFile(file);
    setMarksPreviewResult(null);
    setMarksErrMsg('');
    setMarksSuccessMsg('');
    setMarksParsing(true);

    try {
      let rawRows: any[] = [];
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error('Uploaded Excel workbook contains no worksheets.');
        const worksheet = workbook.Sheets[firstSheetName];
        rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rawRows = parsed.data as any[];
      }

      if (rawRows.length === 0) {
        throw new Error('Uploaded file contains no data rows.');
      }

      const res = await API.previewAcademicMarksImport(rawRows, selectedExamType, currentYear, currentSection);
      setMarksPreviewResult(res);
    } catch (err: any) {
      setMarksErrMsg(err.message || 'Failed to preview Bulk Marks Upload.');
    } finally {
      setMarksParsing(false);
    }
  };

  const handleConfirmMarksImport = async () => {
    if (!marksPreviewResult || marksPreviewResult.validRows.length === 0) return;
    setMarksConfirming(true);
    setMarksErrMsg('');
    try {
      const res = await API.confirmAcademicMarksImport(marksPreviewResult.validRows, selectedExamType, currentYear, currentSection);
      const parts = [];
      if (res.importedCount > 0) parts.push(`${res.importedCount} created`);
      if (res.updatedCount > 0) parts.push(`${res.updatedCount} updated`);
      if (res.skippedCount > 0) parts.push(`${res.skippedCount} unchanged`);
      const details = parts.length > 0 ? parts.join(', ') : `${res.importedCount} saved`;
      setMarksSuccessMsg(`Academic marks saved successfully! ${details} across ${res.updatedStudentsCount} students into PostgreSQL.`);
      setMarksPreviewResult(null);
      setMarksFile(null);
      if (marksFileInputRef.current) marksFileInputRef.current.value = '';
      if (onStudentsChange) onStudentsChange();
      // Automatically switch to Saved Exam Records after confirmation
      setTimeout(() => {
        setActiveSubTab('saved-records');
        loadSavedRecords();
      }, 1500);
    } catch (err: any) {
      setMarksErrMsg(err.message || 'Failed to confirm Academic Marks import.');
    } finally {
      setMarksConfirming(false);
    }
  };

  // Download official Marks Excel template (.xlsx)
  const downloadMarksTemplate = () => {
    const templateRows = [
      { 'Register Number': '620125243146', 'Student Name': 'SARAN S', 'Subject Code': 'CS25C08', 'Subject Title': 'Data structures', 'Marks': 88 },
      { 'Register Number': '620125243146', 'Student Name': 'SARAN S', 'Subject Code': 'CS25C09', 'Subject Title': 'Database Management', 'Marks': 92 },
      { 'Register Number': '620125243147', 'Student Name': 'PRIYA R', 'Subject Code': 'CS25C08', 'Subject Title': 'Data structures', 'Marks': 75 },
      { 'Register Number': '620125243147', 'Student Name': 'PRIYA R', 'Subject Code': 'CS25C09', 'Subject Title': 'Database Management', 'Marks': 84 }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BulkMarks');
    XLSX.writeFile(workbook, `bulk_marks_template_${selectedExamType.replace(/\s+/g, '_')}_${currentYear.replace(/\s+/g, '_')}_Sec_${currentSection}.xlsx`);
  };

  // Flatten saved records for table display
  const flattenedSavedRecords = useMemo(() => {
    const flat: Array<{
      id: string;
      studentName: string;
      registerNo: string;
      examType: string;
      subjectCode: string;
      subjectTitle: string;
      marks: number;
      grade?: string;
      year: string;
      section: string;
      createdAt?: string;
    }> = [];

    for (const rec of savedRecords) {
      const subjects = rec.subjects || [];
      for (const sub of subjects) {
        flat.push({
          id: `${rec.id}-${sub.subjectCode || sub.code}`,
          studentName: rec.studentName || 'Student',
          registerNo: rec.registerNo || '',
          examType: rec.examType || 'Exam',
          subjectCode: sub.subjectCode || sub.code || 'SUB',
          subjectTitle: sub.subjectTitle || sub.title || 'Subject',
          marks: Number(sub.marks) || 0,
          grade: sub.grade,
          year: rec.year || currentYear,
          section: rec.section || currentSection,
          createdAt: rec.createdAt
        });
      }
    }

    return flat.filter((item) => {
      const q = recordSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || item.studentName.toLowerCase().includes(q) || item.registerNo.toLowerCase().includes(q) || item.subjectCode.toLowerCase().includes(q) || item.subjectTitle.toLowerCase().includes(q);
      const matchesExam = recordExamFilter === 'ALL' || item.examType.toLowerCase() === recordExamFilter.toLowerCase();
      const matchesSubject = recordSubjectFilter === 'ALL' || item.subjectCode.toUpperCase() === recordSubjectFilter.toUpperCase();
      return matchesSearch && matchesExam && matchesSubject;
    });
  }, [savedRecords, recordSearchQuery, recordExamFilter, recordSubjectFilter, currentYear, currentSection]);

  // Unique subject codes in saved records for filter
  const uniqueSubjectsInRecords = useMemo(() => {
    const set = new Set<string>();
    for (const r of savedRecords) {
      for (const s of r.subjects || []) {
        if (s.subjectCode || s.code) set.add(String(s.subjectCode || s.code).trim().toUpperCase());
      }
    }
    return Array.from(set);
  }, [savedRecords]);

  // Filtered Roster Students
  const filteredRoster = useMemo(() => {
    return rosterStudents.filter((s) => {
      const q = rosterSearchQuery.toLowerCase().trim();
      const name = (s.name || '').toLowerCase();
      const regNo = (s.register_no || s.registerNo || '').toLowerCase();
      return !q || name.includes(q) || regNo.includes(q);
    });
  }, [rosterStudents, rosterSearchQuery]);

  return (
    <div className="space-y-6">
      {/* MODULE HEADER & FOUR DEDICATED TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Academics Management</h2>
            <p className="text-xs text-slate-400 font-mono">
              Exclusive Excel Bulk Upload for Subjects & Marks • View Saved Records & Student Roster
            </p>
          </div>
        </div>

        {/* 4 DEDICATED SECTIONS */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('subject-master')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'subject-master'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>1. Subject Master</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => setActiveSubTab('bulk-marks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeSubTab === 'bulk-marks'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>2. Bulk Marks Upload</span>
            </button>
          )}

          <button
            onClick={() => setActiveSubTab('saved-records')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'saved-records'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>3. Saved Exam Records</span>
          </button>

          <button
            onClick={() => setActiveSubTab('student-roster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'student-roster'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>4. Student Roster</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SECTION 1: SUBJECT MASTER (BULK EXCEL UPLOAD)       */}
      {/* ==================================================== */}
      {activeSubTab === 'subject-master' && (
        <div className="space-y-6">
          {!isReadOnly && (
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Bulk Excel Upload — Subject Master
                  </h3>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={downloadSubjectTemplate}
                    className="bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Template (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Scope Selector: Year & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Target Year</label>
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-bold"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target Section</label>
                  <select
                    value={currentSection}
                    onChange={(e) => setCurrentSection(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-bold"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="ALL">ALL Sections</option>
                  </select>
                </div>
              </div>

              {/* Feedback messages */}
              {subjectSuccessMsg && (
                <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 p-3.5 rounded-xl text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{subjectSuccessMsg}</span>
                </div>
              )}

              {subjectErrMsg && (
                <div className="bg-rose-950/80 border border-rose-500 text-rose-200 p-3.5 rounded-xl text-xs font-mono flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{subjectErrMsg}</span>
                </div>
              )}

              {/* File Upload Drop Zone */}
              <div className="space-y-1">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="flex-1 w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-slate-950 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer text-xs font-mono text-slate-300 transition-colors">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>{subjectFile ? subjectFile.name : 'Select or Drop Subject Master (.xlsx, .xls, .csv)'}</span>
                    <input
                      ref={subjectFileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleSubjectFileChange}
                      className="hidden"
                    />
                  </label>

                  {subjectParsing && (
                    <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 px-4 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating Subject Master against database...</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Required Columns: <strong>Subject Code</strong> | <strong>Subject Abbreviation</strong> | <strong>Subject Title</strong></span>
                  <span className="text-cyan-400">Max size: 10 MB</span>
                </div>
              </div>

              {/* Subject Master Preview & Validation Report */}
              {subjectPreviewResult && (
                <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in duration-200">
                  <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">TOTAL ROWS</span>
                      <span className="text-white font-bold text-base">{subjectPreviewResult.summary.totalRowsProcessed}</span>
                    </div>
                    <div className="bg-emerald-950/50 p-3 rounded-xl border border-emerald-500/40">
                      <span className="text-emerald-400 block text-[10px]">VALID SUBJECTS</span>
                      <span className="text-emerald-200 font-bold text-base">{subjectPreviewResult.summary.validCount}</span>
                    </div>
                    <div className="bg-rose-950/50 p-3 rounded-xl border border-rose-500/40">
                      <span className="text-rose-400 block text-[10px]">INVALID / REJECTED</span>
                      <span className="text-rose-200 font-bold text-base">{subjectPreviewResult.summary.invalidCount}</span>
                    </div>
                  </div>

                  {/* Rejected Rows Table */}
                  {subjectPreviewResult.invalidRows.length > 0 && (
                    <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3.5 space-y-1.5 text-xs font-mono">
                      <h4 className="font-bold text-rose-300 uppercase">
                        Validation Warnings ({subjectPreviewResult.invalidRows.length})
                      </h4>
                      <div className="max-h-32 overflow-y-auto space-y-1 text-[11px]">
                        {subjectPreviewResult.invalidRows.map((inv, idx) => (
                          <div key={idx} className="text-rose-200 bg-rose-900/30 px-2.5 py-1 rounded">
                            • Row {inv.rowNumber}: {inv.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Valid Rows Preview Table */}
                  {subjectPreviewResult.validRows.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-300 font-mono">Ready to Save ({subjectPreviewResult.validRows.length} Subjects):</span>
                      <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
                        <table className="w-full text-left border-collapse text-[11px] font-mono">
                          <thead>
                            <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                              <th className="p-2">#</th>
                              <th className="p-2">Code</th>
                              <th className="p-2">Abbr</th>
                              <th className="p-2">Subject Title</th>
                              <th className="p-2">Year / Sec</th>
                              <th className="p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-slate-300">
                            {subjectPreviewResult.validRows.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-900/50">
                                <td className="p-2 text-slate-500">{r.rowNumber}</td>
                                <td className="p-2 font-bold text-cyan-300">{r.subjectCode}</td>
                                <td className="p-2 font-bold text-amber-300">{r.subjectAbbreviation || '-'}</td>
                                <td className="p-2 text-white font-sans">{r.subjectTitle}</td>
                                <td className="p-2">{r.year} • {r.section}</td>
                                <td className="p-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    r.status === 'NEW_SUBJECT'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'bg-blue-950 text-blue-300 border border-blue-800'
                                  }`}>
                                    {r.status === 'NEW_SUBJECT' ? 'New' : 'Update'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Confirm and Save Button */}
                  {subjectPreviewResult.validRows.length > 0 && (
                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        onClick={() => setSubjectPreviewResult(null)}
                        className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmSubjectImport}
                        disabled={subjectConfirming}
                        className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        {subjectConfirming ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving Subjects to Database...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm & Save {subjectPreviewResult.validRows.length} Subjects</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Subject Master Live Database Table */}
          <SubjectManagement
            userRole={userRole}
            assignedYear={currentYear}
            assignedSection={currentSection}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* SECTION 2: BULK MARKS UPLOAD                         */}
      {/* ==================================================== */}
      {activeSubTab === 'bulk-marks' && !isReadOnly && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-cyan-400" />
                  <span>Bulk Examination Marks Upload</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Excel Bulk Upload for Unit Tests, Model Exams, and End-Semester Assessments
                </p>
              </div>

              <button
                type="button"
                onClick={downloadMarksTemplate}
                className="bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 px-3.5 py-2 rounded-xl text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Marks Template (.xlsx)</span>
              </button>
            </div>

            {/* Scope Selection: Examination Type, Year, Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Examination Type <span className="text-cyan-400">*</span></label>
                <select
                  value={selectedExamType}
                  onChange={(e) => setSelectedExamType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white font-bold"
                >
                  <option value="Unit Test 1">Unit Test 1</option>
                  <option value="Unit Test 2">Unit Test 2</option>
                  <option value="Model Exam">Model Examination</option>
                  <option value="Semester Exam">Semester Examination</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Authorized Year</label>
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white font-bold"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Authorized Section</label>
                <select
                  value={currentSection}
                  onChange={(e) => setCurrentSection(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white font-bold"
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </div>
            </div>

            {/* Feedback Banners */}
            {marksSuccessMsg && (
              <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 p-3.5 rounded-xl text-xs font-mono flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{marksSuccessMsg}</span>
              </div>
            )}

            {marksErrMsg && (
              <div className="bg-rose-950/80 border border-rose-500 text-rose-200 p-3.5 rounded-xl text-xs font-mono flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{marksErrMsg}</span>
              </div>
            )}

            {/* Upload File Zone */}
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="flex-1 w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-slate-950 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer text-xs font-mono text-slate-300 transition-colors">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>{marksFile ? marksFile.name : `Select or Drop Marks Excel for ${selectedExamType}`}</span>
                  <input
                    ref={marksFileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleMarksFileChange}
                    className="hidden"
                  />
                </label>

                {marksParsing && (
                  <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating Student Register Numbers & Subject Codes...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Required Columns: <strong>Register Number</strong> | <strong>Subject Code</strong> | <strong>Marks</strong> (0-100)</span>
                <span className="text-cyan-400">Max size: 10 MB</span>
              </div>
            </div>

            {/* Validation & Preview Report */}
            {marksPreviewResult && (
              <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">TOTAL ROWS</span>
                    <span className="text-white font-bold text-base">{marksPreviewResult.summary.totalRowsProcessed}</span>
                  </div>
                  <div className="bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-500/40">
                    <span className="text-emerald-400 block text-[10px]">VALID ROWS</span>
                    <span className="text-emerald-200 font-bold text-base">{marksPreviewResult.summary.validCount}</span>
                  </div>
                  <div className="bg-rose-950/50 p-2.5 rounded-xl border border-rose-500/40">
                    <span className="text-rose-400 block text-[10px]">REJECTED ROWS</span>
                    <span className="text-rose-200 font-bold text-base">{marksPreviewResult.summary.invalidCount}</span>
                  </div>
                  <div className="bg-cyan-950/50 p-2.5 rounded-xl border border-cyan-500/40">
                    <span className="text-cyan-400 block text-[10px]">NEW MARKS</span>
                    <span className="text-cyan-200 font-bold text-base">{marksPreviewResult.summary.newCount || 0}</span>
                  </div>
                  <div className="bg-amber-950/50 p-2.5 rounded-xl border border-amber-500/40">
                    <span className="text-amber-400 block text-[10px]">UPDATES</span>
                    <span className="text-amber-200 font-bold text-base">{marksPreviewResult.summary.updateCount || 0}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">UNCHANGED</span>
                    <span className="text-slate-300 font-bold text-base">{marksPreviewResult.summary.identicalCount || 0}</span>
                  </div>
                </div>

                {/* Valid Marks Preview Table */}
                {marksPreviewResult.validRows.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 font-mono uppercase flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valid Marks Preview for {selectedExamType} ({marksPreviewResult.validRows.length})</span>
                    </h4>
                    <div className="max-h-56 overflow-y-auto border border-emerald-500/30 rounded-xl bg-slate-950">
                      <table className="w-full text-[11px] font-mono text-left text-slate-300">
                        <thead className="bg-slate-900 text-emerald-400 sticky top-0">
                          <tr>
                            <th className="p-2 border-b border-slate-800">Row</th>
                            <th className="p-2 border-b border-slate-800">Reg No</th>
                            <th className="p-2 border-b border-slate-800">Student Name</th>
                            <th className="p-2 border-b border-slate-800">Subject Code</th>
                            <th className="p-2 border-b border-slate-800">Subject Title</th>
                            <th className="p-2 border-b border-slate-800 text-right">Marks</th>
                            <th className="p-2 border-b border-slate-800 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {marksPreviewResult.validRows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-800/40">
                              <td className="p-2 text-slate-500">{r.rowNumber}</td>
                              <td className="p-2 font-bold text-cyan-300">{r.registerNo}</td>
                              <td className="p-2 text-white font-sans">{r.studentName}</td>
                              <td className="p-2 text-amber-300">{r.subjectCode}</td>
                              <td className="p-2 text-slate-300">{r.subjectTitle}</td>
                              <td className="p-2 font-bold text-emerald-400 text-right">{r.marks} / 100</td>
                              <td className="p-2 text-center">
                                {r.status === 'NEW_MARK' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    NEW
                                  </span>
                                )}
                                {r.status === 'UPDATE_MARK' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    UPDATE ({r.previousMarks} → {r.marks})
                                  </span>
                                )}
                                {r.status === 'IDENTICAL_MARK' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                    UNCHANGED
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Rejected Rows Table */}
                {marksPreviewResult.invalidRows.length > 0 && (
                  <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3.5 space-y-2">
                    <h4 className="text-xs font-bold text-rose-300 font-mono uppercase flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>Rejected Rows & Failure Reasons ({marksPreviewResult.invalidRows.length})</span>
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 text-[11px] font-mono">
                      {marksPreviewResult.invalidRows.map((inv, idx) => (
                        <div key={idx} className="flex items-center justify-between text-rose-200 bg-rose-900/30 px-3 py-1.5 rounded-lg border border-rose-500/20">
                          <span className="font-bold shrink-0 mr-2">Row {inv.rowNumber}</span>
                          <span className="truncate text-rose-300">{inv.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirm and Save to Supabase */}
                {marksPreviewResult.validRows.length > 0 && (
                  <div className="flex items-center justify-end space-x-3 pt-3">
                    <button
                      onClick={() => setMarksPreviewResult(null)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmMarksImport}
                      disabled={marksConfirming}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      {marksConfirming ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving to Supabase PostgreSQL & Updating Scores...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm & Save {marksPreviewResult.validRows.length} Marks to PostgreSQL</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* SECTION 3: SAVED EXAM RECORDS                        */}
      {/* ==================================================== */}
      {activeSubTab === 'saved-records' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <ListOrdered className="w-5 h-5 text-cyan-400" />
                  <span>Saved Examination Records (Supabase PostgreSQL)</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Official persisted examination marks for {currentYear} Section {currentSection}
                </p>
              </div>

              <button
                onClick={loadSavedRecords}
                className="bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin' : ''}`} />
                <span>Refresh Records</span>
              </button>
            </div>

            {/* FILTERS BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filter Student Name, Reg No, Subject..."
                  value={recordSearchQuery}
                  onChange={(e) => setRecordSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-2 rounded-xl text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Exam Filter */}
              <div>
                <select
                  value={recordExamFilter}
                  onChange={(e) => setRecordExamFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-cyan-300 font-mono"
                >
                  <option value="ALL">All Examinations</option>
                  <option value="Unit Test 1">Unit Test 1</option>
                  <option value="Unit Test 2">Unit Test 2</option>
                  <option value="Model Exam">Model Exam</option>
                  <option value="Semester Exam">Semester Exam</option>
                </select>
              </div>

              {/* Subject Filter */}
              <div>
                <select
                  value={recordSubjectFilter}
                  onChange={(e) => setRecordSubjectFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-cyan-300 font-mono"
                >
                  <option value="ALL">All Subjects</option>
                  {uniqueSubjectsInRecords.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error Message */}
            {recordsErrMsg && (
              <div className="bg-rose-950/80 border border-rose-500 text-rose-200 p-3 rounded-xl text-xs font-mono flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{recordsErrMsg}</span>
              </div>
            )}

            {/* TABLE OF SAVED MARKS */}
            {loadingRecords ? (
              <div className="py-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span>Querying saved examination records from Supabase PostgreSQL...</span>
              </div>
            ) : flattenedSavedRecords.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-mono text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                No saved examination records found. Use Bulk Marks Upload to import student marks.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Displaying <strong>{flattenedSavedRecords.length}</strong> examination record entries</span>
                </div>

                {/* Desktop Table (hidden on mobile, visible md+) */}
                <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                        <th className="py-3 px-3.5">Student Name</th>
                        <th className="py-3 px-3.5">Reg Number</th>
                        <th className="py-3 px-3.5">Examination</th>
                        <th className="py-3 px-3.5">Subject Code</th>
                        <th className="py-3 px-3.5">Subject Title</th>
                        <th className="py-3 px-3.5 text-center">Marks</th>
                        <th className="py-3 px-3.5 text-center">Grade</th>
                        <th className="py-3 px-3.5">Year / Sec</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {flattenedSavedRecords.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-white font-sans">{r.studentName}</td>
                          <td className="py-3 px-3.5 font-bold text-cyan-300">{r.registerNo}</td>
                          <td className="py-3 px-3.5">
                            <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              {r.examType}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-bold text-amber-300">{r.subjectCode}</td>
                          <td className="py-3 px-3.5 text-slate-300 font-sans">{r.subjectTitle}</td>
                          <td className="py-3 px-3.5 text-center font-bold">
                            <span className={r.marks >= 80 ? 'text-emerald-400' : (r.marks >= 50 ? 'text-cyan-300' : 'text-rose-400')}>
                              {r.marks} / 100
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-bold text-slate-300">
                              {r.grade || (r.marks >= 90 ? 'O' : (r.marks >= 80 ? 'A+' : (r.marks >= 70 ? 'A' : (r.marks >= 60 ? 'B+' : (r.marks >= 50 ? 'B' : 'U')))))}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-400">{r.year} • Sec {r.section}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards (< md) */}
                <div className="md:hidden space-y-3 font-mono">
                  {flattenedSavedRecords.map((r, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-cyan-300 font-bold text-xs">{r.registerNo}</span>
                          <h4 className="text-white font-bold font-sans text-sm">{r.studentName}</h4>
                        </div>
                        <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] px-2 py-0.5 rounded font-bold">
                          {r.examType}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-slate-400 text-[10px] block">SUBJECT</span>
                          <span className="text-amber-300 font-bold">{r.subjectCode}</span>
                          <span className="block text-[11px] text-slate-300 truncate font-sans">{r.subjectTitle}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 text-[10px] block">MARKS OBTAINED</span>
                          <span className={`text-base font-bold ${r.marks >= 80 ? 'text-emerald-400' : (r.marks >= 50 ? 'text-cyan-300' : 'text-rose-400')}`}>
                            {r.marks} / 100
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* SECTION 4: STUDENT ROSTER                            */}
      {/* ==================================================== */}
      {activeSubTab === 'student-roster' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5 text-cyan-400" />
                  <span>Student Academic Roster</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Official roster of students assigned by HOD for {currentYear} Section {currentSection}. Click a student to inspect academic details.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search Name or Reg No..."
                  value={rosterSearchQuery}
                  onChange={(e) => setRosterSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-2 rounded-xl text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {loadingRoster ? (
              <div className="py-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span>Loading student roster from database...</span>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-mono text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                No students found in current assignment roster.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop Table (hidden on mobile, visible md+) */}
                <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                        <th className="py-3 px-3.5">Register Number</th>
                        <th className="py-3 px-3.5">Student Name</th>
                        <th className="py-3 px-3.5">Year / Section</th>
                        <th className="py-3 px-3.5 text-center">CGPA</th>
                        <th className="py-3 px-3.5 text-center">Dept Score</th>
                        <th className="py-3 px-3.5 text-right">Academic Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredRoster.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-cyan-300">{s.register_no || s.registerNo}</td>
                          <td className="py-3 px-3.5 text-white font-bold font-sans">{s.name}</td>
                          <td className="py-3 px-3.5 text-slate-400">{s.year} • Sec {s.section}</td>
                          <td className="py-3 px-3.5 text-center font-bold text-amber-300">
                            {s.cgpa !== null && s.cgpa !== undefined ? Number(s.cgpa).toFixed(2) : 'N/A'}
                          </td>
                          <td className="py-3 px-3.5 text-center font-bold text-emerald-400">
                            {s.overall_score || s.overallScore || 0}/100
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <button
                              onClick={() => handleSelectRosterStudent(s)}
                              className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-mono inline-flex items-center space-x-1.5 cursor-pointer"
                            >
                              <span>View Marks</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards (< md) */}
                <div className="md:hidden space-y-3 font-mono">
                  {filteredRoster.map((s) => (
                    <div key={s.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-cyan-300 font-bold text-xs">{s.register_no || s.registerNo}</span>
                          <h4 className="text-white font-bold font-sans text-sm">{s.name}</h4>
                        </div>
                        <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-bold">
                          {s.year} • Sec {s.section}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">CGPA</span>
                          <span className="text-amber-300 font-bold text-sm">
                            {s.cgpa !== null && s.cgpa !== undefined ? Number(s.cgpa).toFixed(2) : 'N/A'}
                          </span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">DEPT SCORE</span>
                          <span className="text-emerald-400 font-bold text-sm">
                            {s.overall_score || s.overallScore || 0}/100
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectRosterStudent(s)}
                        className="w-full mt-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 py-2 rounded-xl text-xs font-mono flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <span>View Academic Profile & Marks</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STUDENT ACADEMIC PROFILE DETAILS MODAL */}
          {selectedRosterStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in font-sans">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl text-white">
                {/* Header */}
                <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{selectedRosterStudent.name}</h3>
                      <p className="text-xs text-cyan-300 font-mono">
                        {selectedRosterStudent.register_no || selectedRosterStudent.registerNo} • {selectedRosterStudent.year} • Sec {selectedRosterStudent.section}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRosterStudent(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                  {/* Summary Badges */}
                  <div className="grid grid-cols-3 gap-3 font-mono text-center">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">CGPA</span>
                      <span className="text-base font-bold text-amber-300">
                        {selectedRosterStudent.cgpa !== null && selectedRosterStudent.cgpa !== undefined ? Number(selectedRosterStudent.cgpa).toFixed(2) : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">DEPT SCORE</span>
                      <span className="text-base font-bold text-emerald-400">
                        {selectedRosterStudent.overall_score || selectedRosterStudent.overallScore || 0}/100
                      </span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">CLASS COORDINATOR</span>
                      <span className="text-xs font-bold text-slate-300 truncate block">
                        {selectedRosterStudent.class_coordinator_name || selectedRosterStudent.classCoordinatorName || 'Assigned Faculty'}
                      </span>
                    </div>
                  </div>

                  {/* Saved Exam Records for this Student */}
                  <div className="space-y-3 font-mono">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <ListOrdered className="w-4 h-4" />
                      <span>Saved Examination Marks & Assessments</span>
                    </h4>

                    {loadingStudent360 ? (
                      <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        <span>Loading saved marks...</span>
                      </div>
                    ) : !student360Academics || student360Academics.length === 0 ? (
                      <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                        No examination marks saved yet for this student.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {student360Academics.map((rec: any, idx: number) => {
                          const subjects = rec.subjects || [];
                          const examLbl = rec.examType || rec.exam_type || 'Examination';
                          const totalMarks = subjects.reduce((sum: number, s: any) => sum + (Number(s.marks) || 0), 0);
                          const maxMarks = subjects.length * 100;

                          return (
                            <div key={rec.id || idx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
                                <span className="font-bold text-cyan-300">{examLbl} (Semester {rec.semesterNo || rec.semester_no || 3})</span>
                                <span className="text-slate-400">Total: <strong className="text-white">{totalMarks} / {maxMarks}</strong></span>
                              </div>
                              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {subjects.map((sub: any, sIdx: number) => (
                                  <div key={sIdx} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                                    <div>
                                      <span className="font-bold text-amber-300">{sub.subjectCode || sub.code}</span>
                                      <span className="block text-[11px] text-slate-300 font-sans truncate max-w-[180px]">{sub.subjectTitle || sub.title}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-emerald-400">{sub.marks} / 100</span>
                                      {sub.grade && (
                                        <span className="block text-[10px] text-slate-400">Grade: {sub.grade}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setSelectedRosterStudent(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-mono px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
