import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API } from '../../services/api';
import {
  ShieldAlert,
  Search,
  Plus,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  User,
  Calendar,
  Clock,
  DollarSign,
  Loader2,
  Trash2,
  Filter,
  RefreshCw,
  AlertTriangle,
  FileCheck
} from 'lucide-react';

export interface DisciplineRecordItem {
  id: string;
  studentId: string;
  registerNo: string;
  studentName: string;
  collegeEmail: string;
  year: string;
  section: string;
  department: string;
  date: string;
  time: string;
  issue: string;
  category?: string;
  ruleViolated: string;
  actionTaken: string;
  fineAmount: number;
  fineDetails?: string;
  remarks: string;
  recordedBy: string;
}

const ISSUE_OPTIONS = [
  'Dress Code / ID Card Violation',
  'Late Coming / Unpunctuality',
  'Mobile Phone Usage in Class/Lab',
  'Classroom Disruption / Misbehavior',
  'Lab Infrastructure Misuse',
  'Unauthorized Absence / Bunking',
  'Academic Malpractice / Copying',
  'Library / Campus Misconduct',
  'Other Violation'
];

const RULE_VIOLATED_OPTIONS = [
  'Rule 1: Mandatory Formal Dress Code & ID Card Display',
  'Rule 2: Punctuality & Timely Session Attendance',
  'Rule 3: Electronic Gadget & Mobile Usage Policy',
  'Rule 4: Classroom Discipline & Respectful Conduct',
  'Rule 5: Laboratory Safety & Equipment Handling',
  'Rule 6: Academic Integrity & Anti-Malpractice Code',
  'Rule 7: Departmental Code of Conduct & Integrity'
];

interface DisciplineIssueModuleProps {
  userRole?: string;
  onBack?: () => void;
}

export const DisciplineIssueModule: React.FC<DisciplineIssueModuleProps> = ({ userRole = 'FACULTY', onBack }) => {
  // Main Data States
  const [records, setRecords] = useState<DisciplineRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [issueFilter, setIssueFilter] = useState('ALL');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form Field States
  const [regNoInput, setRegNoInput] = useState('');
  const [studentMatch, setStudentMatch] = useState<{
    id: string;
    registerNo: string;
    name: string;
    email: string;
    year: string;
    section: string;
  } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Auto-filled Date & Time
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Manual Staff Fields
  const [selectedIssue, setSelectedIssue] = useState(ISSUE_OPTIONS[0]);
  const [selectedRule, setSelectedRule] = useState(RULE_VIOLATED_OPTIONS[0]);
  const [staffActionTaken, setStaffActionTaken] = useState('');
  const [fineAmountInput, setFineAmountInput] = useState<number | ''>(0);
  const [fineDetailsInput, setFineDetailsInput] = useState('');
  const [additionalRemarks, setAdditionalRemarks] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize Default Date and Time
  const updateCurrentDateTime = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateFormatted = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeFormatted = `${hours}:${minutes}:${seconds}`;

    setCurrentDateStr(dateFormatted);
    setCurrentTimeStr(timeFormatted);
  }, []);

  // Fetch All Discipline Records
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await API.getDisciplineRecords({
        search: searchQuery,
        year: yearFilter,
        section: sectionFilter,
        issue: issueFilter
      });
      setRecords(res.records || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch discipline records.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, yearFilter, sectionFilter, issueFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Open Form Modal & Set Timestamps
  const handleOpenForm = () => {
    updateCurrentDateTime();
    setRegNoInput('');
    setStudentMatch(null);
    setLookupError('');
    setSelectedIssue(ISSUE_OPTIONS[0]);
    setSelectedRule(RULE_VIOLATED_OPTIONS[0]);
    setStaffActionTaken('');
    setFineAmountInput(0);
    setFineDetailsInput('');
    setAdditionalRemarks('');
    setFormError('');
    setIsFormOpen(true);
  };

  // Live Register Number Lookup
  const handleLookupRegNo = useCallback(async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setStudentMatch(null);
      setLookupError('');
      return;
    }

    setIsLookingUp(true);
    setLookupError('');
    try {
      const res = await API.lookupDisciplineStudent(trimmed);
      if (res.found && res.student) {
        setStudentMatch(res.student);
        setLookupError('');
      } else {
        setStudentMatch(null);
        setLookupError(`Register Number "${trimmed}" does not match any student record in database.`);
      }
    } catch (err: any) {
      setStudentMatch(null);
      setLookupError(`Register Number "${trimmed}" not found in database.`);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  // Handle Autocomplete Input Change
  const handleRegNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRegNoInput(val);

    if (val.trim().length >= 2) {
      API.searchDisciplineStudents(val.trim())
        .then((res) => {
          setSuggestions(res.students || []);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    handleLookupRegNo(val);
  };

  const selectSuggestion = (s: any) => {
    setRegNoInput(s.registerNo);
    setShowSuggestions(false);
    setStudentMatch(s);
    setLookupError('');
  };

  // Submit Discipline Record
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Requirement 8: Register Number MUST match valid student
    if (!studentMatch) {
      setFormError('Cannot save: Please enter a valid student Register Number that exists in the database.');
      return;
    }

    if (!selectedIssue) {
      setFormError('Please select a Discipline Issue.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      await API.createDisciplineRecord({
        registerNo: studentMatch.registerNo,
        issue: selectedIssue,
        ruleViolated: selectedRule,
        actionTaken: staffActionTaken,
        fineAmount: Number(fineAmountInput) || 0,
        fineDetails: fineDetailsInput,
        remarks: additionalRemarks,
        date: currentDateStr,
        time: currentTimeStr
      });

      setSuccessMessage(`Discipline issue recorded successfully for ${studentMatch.name} (${studentMatch.registerNo}).`);
      setTimeout(() => setSuccessMessage(''), 4000);
      setIsFormOpen(false);
      await fetchRecords();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save discipline issue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await API.deleteDisciplineRecord(deletingId);
      setSuccessMessage('Discipline record removed successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
      setDeletingId(null);
      await fetchRecords();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Excel Export Utility (Req 12)
  const handleExportExcel = () => {
    if (records.length === 0) {
      alert('No discipline records available to export.');
      return;
    }

    const headers = [
      'S.No',
      'Date',
      'Time',
      'Register No',
      'Student Name',
      'College Mail ID',
      'Year',
      'Section',
      'Issue Category',
      'Rule Violated',
      'Staff Action Taken',
      'Fine Amount (INR)',
      'Fine Details',
      'Additional Remarks',
      'Reported By Staff'
    ];

    const rows = records.map((r, idx) => [
      idx + 1,
      `"${r.date || ''}"`,
      `"${r.time || ''}"`,
      `"${r.registerNo || ''}"`,
      `"${(r.studentName || '').replace(/"/g, '""')}"`,
      `"${(r.collegeEmail || '').replace(/"/g, '""')}"`,
      `"${r.year || ''}"`,
      `"${r.section || ''}"`,
      `"${(r.issue || r.category || '').replace(/"/g, '""')}"`,
      `"${(r.ruleViolated || '').replace(/"/g, '""')}"`,
      `"${(r.actionTaken || '').replace(/"/g, '""')}"`,
      r.fineAmount || 0,
      `"${(r.fineDetails || '').replace(/"/g, '""')}"`,
      `"${(r.remarks || '').replace(/"/g, '""')}"`,
      `"${(r.recordedBy || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nowStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Student_Discipline_Records_Report_${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export Utility (Req 12)
  const handleExportPDF = () => {
    if (records.length === 0) {
      alert('No discipline records available to export.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('Popup window blocked. Please allow popups for this site to export PDF.');
      return;
    }

    const nowStr = new Date().toLocaleString();
    const totalFines = records.reduce((sum, r) => sum + (Number(r.fineAmount) || 0), 0);

    const tableRows = records
      .map(
        (r, idx) => `
      <tr>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${r.date}<br/><span style="font-size:10px; color:#64748b;">${r.time}</span></td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold; color:#0f172a;">${r.registerNo}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;"><strong>${r.studentName}</strong><br/><span style="font-size:10px; color:#475569;">${r.collegeEmail}</span></td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${r.year}<br/>Sec ${r.section}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; color:#dc2626; font-weight:bold;">${r.issue || r.category}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-size:11px;">${r.ruleViolated}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-size:11px;">${r.actionTaken || '-'}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold; color:#b91c1c;">₹${r.fineAmount || 0}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-size:11px;">${r.remarks || '-'}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-size:10px; color:#475569;">${r.recordedBy}</td>
      </tr>
    `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Discipline Issues Official Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; }
          .header h2 { margin: 4px 0 0 0; font-size: 14px; color: #0284c7; text-transform: uppercase; }
          .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
          .meta-table { width: 100%; margin-bottom: 16px; font-size: 12px; }
          .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 12px; }
          table.data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px; }
          table.data-table th { background: #0f172a; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #0f172a; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; padding-top: 20px; border-top: 1px solid #cbd5e1; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="text-align: right; margin-bottom: 10px;">
          <button onclick="window.print()" style="background:#0284c7; color:white; border:none; padding:8px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">Print / Save as PDF</button>
        </div>
        <div class="header">
          <h1>AVS ENGINEERING COLLEGE</h1>
          <h2>Department of Artificial Intelligence & Data Science</h2>
          <p>Official Campus Discipline Incident & Rule Enforcement Report</p>
        </div>
        <div class="summary-box">
          <div><strong>Report Date:</strong> ${nowStr}</div>
          <div><strong>Total Discipline Records:</strong> ${records.length}</div>
          <div><strong>Total Fines Levied:</strong> ₹${totalFines}</div>
          <div><strong>Generated By:</strong> ${userRole} Portal</div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 75px;">Date/Time</th>
              <th style="width: 90px;">Reg No</th>
              <th style="width: 140px;">Student Name</th>
              <th style="width: 60px;">Class</th>
              <th style="width: 110px;">Issue Category</th>
              <th>Rule Violated</th>
              <th>Action Taken</th>
              <th style="width: 60px;">Fine</th>
              <th>Remarks</th>
              <th style="width: 100px;">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          <div><strong>Discipline Coordinator</strong><br/><br/>Sign: ___________________</div>
          <div><strong>Class Coordinator / HOD</strong><br/><br/>Sign: ___________________</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Compute Quick Stats
  const totalIncidents = records.length;
  const uniqueStudents = useMemo(() => new Set(records.map((r) => r.studentId || r.registerNo)).size, [records]);
  const totalFineAmount = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.fineAmount) || 0), 0),
    [records]
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F294A] p-6 text-white shadow-xl border border-slate-700/60 overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-400 via-blue-600 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all"
                  title="Go Back"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
                    ALL-STUDENT ACCESSIBLE MODULE
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">| Department of AI & DS</span>
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
                  Campus Discipline Issue Module
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              Log, track, and manage student discipline violations across all department years and sections without restriction.
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenForm}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-rose-900/30 hover:scale-105 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Report Discipline Issue</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-semibold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Download Excel (.csv)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel Export</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3.5 py-2.5 rounded-xl bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-700/60 font-semibold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Download PDF Printable Document"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>PDF Export</span>
            </button>
          </div>
        </div>

        {/* Quick Summary Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-mono">TOTAL INCIDENTS</span>
              <span className="text-lg font-bold text-white">{totalIncidents}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-mono">STUDENTS RECORDED</span>
              <span className="text-lg font-bold text-white">{uniqueStudents}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-mono">FINES LEVIED</span>
              <span className="text-lg font-bold text-amber-400">₹{totalFineAmount}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-mono">MODULE ACCESS</span>
              <span className="text-xs font-bold text-emerald-400 uppercase">ALL STUDENTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Alert Banner */}
      {successMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 p-4 rounded-xl text-xs font-mono flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Controls Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, reg no, issue, remarks..."
              className="w-full bg-slate-950 border border-slate-800 text-white pl-10 pr-4 py-2 rounded-xl text-xs focus:border-cyan-500 focus:outline-none transition-all placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-mono text-slate-400">Year:</span>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <span className="text-[11px] font-mono text-slate-400">Sec:</span>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Sec</option>
                <option value="A">Sec A</option>
                <option value="B">Sec B</option>
                <option value="C">Sec C</option>
                <option value="D">Sec D</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <span className="text-[11px] font-mono text-slate-400">Issue:</span>
              <select
                value={issueFilter}
                onChange={(e) => setIssueFilter(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">All Issues</option>
                {ISSUE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={fetchRecords}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Discipline Records Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Loading department discipline records...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-xs font-mono">{error}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No Discipline Records Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No discipline issues logged for the selected filters. Click "+ Report Discipline Issue" to log a new incident.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Incident Date / Time</th>
                  <th className="px-4 py-3.5">Register No</th>
                  <th className="px-4 py-3.5">Student Name</th>
                  <th className="px-4 py-3.5">Year & Sec</th>
                  <th className="px-4 py-3.5">Issue Category</th>
                  <th className="px-4 py-3.5">Rule Violated</th>
                  <th className="px-4 py-3.5">Staff Action Taken</th>
                  <th className="px-4 py-3.5">Fine (₹)</th>
                  <th className="px-4 py-3.5">Remarks</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Date / Time */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">{r.date}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.time || 'N/A'}</div>
                    </td>

                    {/* Register No */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-cyan-400">
                      {r.registerNo}
                    </td>

                    {/* Student Name */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-white">{r.studentName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.collegeEmail}</div>
                    </td>

                    {/* Year & Sec */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {r.year} • Sec {r.section}
                      </span>
                    </td>

                    {/* Issue Category */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/60 font-semibold text-[11px]">
                        {r.issue || r.category}
                      </span>
                    </td>

                    {/* Rule Violated */}
                    <td className="px-4 py-3 text-slate-300 max-w-xs text-[11px] leading-relaxed">
                      {r.ruleViolated || 'N/A'}
                    </td>

                    {/* Staff Action Taken */}
                    <td className="px-4 py-3 text-slate-300 max-w-xs text-[11px] leading-relaxed">
                      {r.actionTaken || '-'}
                    </td>

                    {/* Fine Amount */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.fineAmount && r.fineAmount > 0 ? (
                        <div>
                          <span className="font-bold text-rose-400 font-mono text-sm">₹{r.fineAmount}</span>
                          {r.fineDetails && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{r.fineDetails}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Remarks */}
                    <td className="px-4 py-3 text-slate-400 max-w-xs text-[11px]">
                      {r.remarks || '-'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setDeletingId(r.id)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition-all"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REPORT DISCIPLINE ISSUE MODAL FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0B192E] border border-slate-700/80 rounded-2xl p-6 text-white shadow-2xl space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Report Student Discipline Issue</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    All-Student Access • Department Discipline System
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Validation Alert Banner */}
            {formError && (
              <div className="bg-rose-950/80 border border-rose-500 text-rose-200 p-3.5 rounded-xl text-xs font-mono flex items-center space-x-2 animate-shake">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* REQUIREMENT 3: STAFF ENTERS REGISTER NUMBER MANUALLY */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Student Register Number * (Manual Input)</span>
                  {isLookingUp && <span className="text-[10px] text-cyan-400 animate-pulse">Checking DB...</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regNoInput}
                    onChange={handleRegNoChange}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    placeholder="Enter Student Register Number (e.g., 610823243001)"
                    className={`w-full bg-slate-900 border ${
                      lookupError
                        ? 'border-rose-500'
                        : studentMatch
                        ? 'border-emerald-500'
                        : 'border-slate-700'
                    } text-white px-3.5 py-2.5 rounded-xl text-xs font-mono focus:outline-none transition-all`}
                  />
                  {studentMatch && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Autocomplete Suggestions Popup */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => selectSuggestion(s)}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-800 border-b border-slate-800/50 flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div>
                          <span className="font-mono font-bold text-cyan-400">{s.registerNo}</span>
                          <span className="text-white ml-2">{s.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {s.year} • Sec {s.section}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Requirement 8: Validation message if Register Number does not match */}
                {lookupError && (
                  <p className="text-[11px] text-rose-400 font-mono flex items-center space-x-1 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{lookupError}</span>
                  </p>
                )}
              </div>

              {/* REQUIREMENT 4 & 6: AUTO-FILLED READONLY STUDENT FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">Student Name (Auto-Fetched)</label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={studentMatch ? studentMatch.name : ''}
                    placeholder="Auto-filled from database"
                    className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs font-semibold cursor-not-allowed outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">College Mail ID (Auto-Fetched)</label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={studentMatch ? studentMatch.email : ''}
                    placeholder="Auto-filled from database"
                    className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs font-mono cursor-not-allowed outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">Year (Auto-Fetched)</label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={studentMatch ? studentMatch.year : ''}
                    placeholder="Auto-filled from database"
                    className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs font-semibold cursor-not-allowed outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">Section (Auto-Fetched)</label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={studentMatch ? studentMatch.section : ''}
                    placeholder="Auto-filled from database"
                    className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs font-semibold cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              {/* REQUIREMENT 5 & 6: AUTO-FILLED READONLY CURRENT DATE & TIME */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-cyan-400" />
                    <span>Current Date (Auto Default - Readonly)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={currentDateStr}
                    className="w-full bg-slate-900/60 border border-slate-800 text-cyan-300 px-3 py-2 rounded-lg text-xs font-mono font-bold cursor-not-allowed outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>Current Time (Auto Default - Readonly)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={currentTimeStr}
                    className="w-full bg-slate-900/60 border border-slate-800 text-cyan-300 px-3 py-2 rounded-lg text-xs font-mono font-bold cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              {/* REQUIREMENT 7: MANUAL STAFF INPUT FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Issue Category Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Issue Category *</label>
                  <select
                    value={selectedIssue}
                    onChange={(e) => setSelectedIssue(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-xs focus:border-cyan-500 focus:outline-none cursor-pointer"
                  >
                    {ISSUE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rule Violated Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Rule Violated *</label>
                  <select
                    value={selectedRule}
                    onChange={(e) => setSelectedRule(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-xs focus:border-cyan-500 focus:outline-none cursor-pointer"
                  >
                    {RULE_VIOLATED_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Staff Action Taken Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Staff Action Taken (Free Text)</label>
                <textarea
                  rows={2}
                  value={staffActionTaken}
                  onChange={(e) => setStaffActionTaken(e.target.value)}
                  placeholder="Enter action taken by staff (e.g., Warning issued, sent to HOD cabin, parent called...)"
                  className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl text-xs focus:border-cyan-500 focus:outline-none placeholder:text-slate-500"
                />
              </div>

              {/* Fine Amount & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Fine Amount (₹ Manual)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={fineAmountInput}
                    onChange={(e) => setFineAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter fine amount (0 if none)"
                    className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Fine Receipt / Details (Manual)</label>
                  <input
                    type="text"
                    value={fineDetailsInput}
                    onChange={(e) => setFineDetailsInput(e.target.value)}
                    placeholder="Receipt No / Fund details"
                    className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-xs focus:border-cyan-500 focus:outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Additional Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Additional Remarks (Free Text)</label>
                <textarea
                  rows={2}
                  value={additionalRemarks}
                  onChange={(e) => setAdditionalRemarks(e.target.value)}
                  placeholder="Enter any additional remarks or observations..."
                  className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl text-xs focus:border-cyan-500 focus:outline-none placeholder:text-slate-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>

                {/* REQUIREMENT 8: Save button disabled if valid student not matched */}
                <button
                  type="submit"
                  disabled={isSubmitting || !studentMatch}
                  className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer ${
                    !studentMatch
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/40'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Saving Discipline Record...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4" />
                      <span>Save Discipline Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0B192E] border border-rose-500/40 rounded-2xl p-6 text-white max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Discipline Record?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete this discipline issue record? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DisciplineIssueModule;
