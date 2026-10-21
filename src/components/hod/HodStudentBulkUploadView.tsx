import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { API } from '../../services/api';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users2,
  Calendar,
  Layers,
  RefreshCw,
  Download
} from 'lucide-react';

interface FacultyOption {
  id: string;
  name: string;
  email: string;
  identifier: string;
  year?: string;
  section?: string;
  department?: string;
  facultyRole?: string;
}

export const HodStudentBulkUploadView: React.FC<{
  initialFacultyId?: string;
  initialYear?: string;
  initialSection?: string;
  onImportCompleted?: () => void;
  onClose?: () => void;
}> = ({ initialFacultyId, initialYear, initialSection, onImportCompleted, onClose }) => {
  const [facultyList, setFacultyList] = useState<FacultyOption[]>([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(true);

  // Dynamic Selections
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(initialFacultyId || '');
  const [selectedYear, setSelectedYear] = useState<string>(initialYear || '1st Year');
  const [selectedSection, setSelectedSection] = useState<string>(initialSection || 'A');

  // File, Validation & Progress State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedCount: number;
    totalCount: number;
    percent: number;
  } | null>(null);

  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    validRowsCount: number;
    updateRowsCount: number;
    errorRowsCount: number;
    canImport: boolean;
    preview: any[];
    faculty?: { id: string; name: string; identifier?: string; email?: string; assignedYear?: string; assignedSection?: string };
    year?: string;
    section?: string;
  } | null>(null);

  const [importResult, setImportResult] = useState<{
    message: string;
    importedCount: number;
    students: any[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isImportingRef = useRef(false);

  // Helper to detect completely blank rows
  const isRowEmpty = (row: any): boolean => {
    if (!row || typeof row !== 'object') return true;
    return Object.values(row).every((v) => v === undefined || v === null || String(v).trim() === '');
  };

  useEffect(() => {
    fetchFacultyList();
  }, []);

  const fetchFacultyList = async () => {
    try {
      setIsLoadingFaculty(true);
      // Fetch authoritative faculty list for HOD
      const res = await API.getHodFacultyList();
      const list: FacultyOption[] = res.faculty || [];
      setFacultyList(list);

      if (initialFacultyId) {
        setSelectedFacultyId(initialFacultyId);
        const match = list.find((f) => f.id === initialFacultyId);
        if (match) {
          if (match.year) setSelectedYear(match.year);
          if (match.section) setSelectedSection(match.section);
        }
      } else if (list.length > 0) {
        const first = list[0];
        setSelectedFacultyId(first.id);
        if (first.year) setSelectedYear(first.year);
        if (first.section) setSelectedSection(first.section);
      }
    } catch (err) {
      console.error('Failed to load faculty list for HOD import:', err);
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  // Sync year and section when initial props change
  useEffect(() => {
    if (initialFacultyId) {
      setSelectedFacultyId(initialFacultyId);
    }
    if (initialYear) {
      setSelectedYear(initialYear);
    }
    if (initialSection) {
      setSelectedSection(initialSection);
    }
  }, [initialFacultyId, initialYear, initialSection]);

  // When faculty changes dynamically in dropdown, auto-sync year and section
  const handleFacultySelectionChange = (newFacultyId: string) => {
    setSelectedFacultyId(newFacultyId);
    const chosen = facultyList.find((f) => f.id === newFacultyId);
    if (chosen) {
      if (chosen.year) setSelectedYear(chosen.year);
      if (chosen.section) setSelectedSection(chosen.section);
    }
    setPreviewData(null);
    setImportResult(null);
  };

  // Download official CSV template
  const handleDownloadTemplate = () => {
    const headers = 'Name,Register Number,College Mail ID,Mobile Number,Personal Mail ID,Address,CGPA\n';
    const sample1 = 'Aravind Kumar S,620125243101,aravind.aids@avsec.edu.in,9876543210,aravind@gmail.com,"Salem, Tamil Nadu",8.45\n';
    const sample2 = 'Bhavani R,620125243102,bhavani.aids@avsec.edu.in,9876543211,bhavani@gmail.com,"Erode, Tamil Nadu",8.90\n';
    const csvContent = headers + sample1 + sample2;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aids_student_upload_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Dynamic file handler for both XLSX/XLS and CSV/TXT
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedFacultyId) {
      alert('Please select an Assigned Faculty member before uploading.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Strict 10 MB file size limit
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10 MB. Please upload a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const fileName = file.name.toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.pl', '.py', '.cgi', '.jar', '.vbs', '.js', '.ts', '.msi'];
    if (dangerousExts.some(ext => fileName.endsWith(ext))) {
      alert('Executable or script files are strictly prohibited.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      alert('Invalid file format. Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setPreviewData(null);
    setImportResult(null);

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        setIsValidating(true);
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          alert('Uploaded Excel file contains no worksheets.');
          setIsValidating(false);
          return;
        }
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const cleanRows = rawRows.filter((r: any) => !isRowEmpty(r));
        if (cleanRows.length === 0) {
          alert('Uploaded Excel file contains no student data rows.');
          setIsValidating(false);
          return;
        }
        await runValidationPreview(cleanRows);
      } catch (err: any) {
        alert(`Failed to parse Excel workbook: ${err.message || err}`);
        setIsValidating(false);
      }
    } else {
      // CSV or TXT
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rawRows = results.data as any[];
          const cleanRows = rawRows.filter((r: any) => !isRowEmpty(r));
          if (cleanRows.length === 0) {
            alert('Uploaded CSV file contains no student data rows.');
            setIsValidating(false);
            return;
          }
          await runValidationPreview(cleanRows);
        },
        error: (err) => {
          alert(`Failed to parse CSV file: ${err.message}`);
        }
      });
    }
  };

  const runValidationPreview = async (rows: any[]) => {
    if (!selectedFacultyId) {
      alert('Please select an Assigned Faculty member first.');
      return;
    }

    try {
      setIsValidating(true);
      const res = await API.previewHodStudentExcelImport(selectedFacultyId, selectedYear, selectedSection, rows);
      setPreviewData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to validate student rows.');
      setPreviewData(null);
    } finally {
      setIsValidating(false);
    }
  };

  // High-performance chunked import: chunks into batches of 10 to guarantee fast execution without gateway timeouts
  const handleConfirmImport = async () => {
    if (isImportingRef.current || isImporting) return;
    if (!previewData || !selectedFacultyId) return;

    const validStudents = previewData.preview
      .filter((r) => r.status !== 'ERROR')
      .map((r) => r.parsedData);

    if (validStudents.length === 0) {
      alert('No valid student rows found to import.');
      return;
    }

    let allImported: any[] = [];
    const BATCH_SIZE = 10;
    const totalCount = validStudents.length;
    const totalBatches = Math.ceil(totalCount / BATCH_SIZE);

    try {
      isImportingRef.current = true;
      setIsImporting(true);

      for (let i = 0; i < totalCount; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const chunk = validStudents.slice(i, i + BATCH_SIZE);

        setImportProgress({
          currentBatch: batchNum,
          totalBatches,
          processedCount: allImported.length,
          totalCount,
          percent: Math.max(5, Math.round((allImported.length / totalCount) * 100))
        });

        const res = await API.confirmHodStudentExcelImport(
          selectedFacultyId,
          selectedYear,
          selectedSection,
          chunk
        );

        if (res.students && Array.isArray(res.students)) {
          allImported = allImported.concat(res.students);
        }

        // Database-confirmed progress update
        setImportProgress({
          currentBatch: batchNum,
          totalBatches,
          processedCount: allImported.length,
          totalCount,
          percent: Math.min(100, Math.round((allImported.length / totalCount) * 100))
        });
      }

      setImportProgress({
        currentBatch: totalBatches,
        totalBatches,
        processedCount: totalCount,
        totalCount,
        percent: 100
      });

      const facultyName = previewData.faculty?.name || activeStaff?.name || 'Selected Faculty';
      setImportResult({
        message: `Successfully imported and synchronized ${allImported.length} student records assigned to ${facultyName} (${selectedYear} Section ${selectedSection}). Student logins initialized with initial password set to Register Number.`,
        importedCount: allImported.length,
        students: allImported
      });

      setPreviewData(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onImportCompleted) {
        onImportCompleted();
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to execute student bulk import.';
      if (allImported.length > 0) {
        // Safe partial resume: remove already imported students from preview so user can retry remainder
        const importedRegs = new Set(allImported.map((s: any) => (s.register_no || s.registerNo || '').toLowerCase()));
        const remainingPreview = previewData.preview.filter(
          (p: any) => !importedRegs.has((p.parsedData?.registerNo || '').toLowerCase())
        );
        const newValid = remainingPreview.filter((p: any) => p.status === 'VALID_NEW').length;
        const newUpdate = remainingPreview.filter((p: any) => p.status === 'UPDATE_EXISTING').length;
        const newError = remainingPreview.filter((p: any) => p.status === 'ERROR').length;
        setPreviewData({
          ...previewData,
          preview: remainingPreview,
          totalRows: remainingPreview.length,
          validRowsCount: newValid,
          updateRowsCount: newUpdate,
          errorRowsCount: newError,
          canImport: (newValid + newUpdate) > 0
        });
        alert(`Partial batch completed: ${allImported.length} students were successfully saved in the database. Gateway notice on remaining records: ${errorMsg}\n\nYou can click "Confirm & Import" again to safely resume importing the remaining ${remainingPreview.length} students without duplication.`);
      } else {
        alert(errorMsg);
      }
    } finally {
      setIsImporting(false);
      setImportProgress(null);
      isImportingRef.current = false;
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    setImportProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeStaff = facultyList.find((f) => f.id === selectedFacultyId);

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                <span>
                  {initialFacultyId
                    ? `Student Roster Import — ${activeStaff?.name || 'Staff Assignment'}`
                    : 'Common Student Bulk Upload — Dynamic HOD Workflow'}
                </span>
              </h2>
              <span className="bg-amber-950 border border-amber-700 text-amber-300 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                Authoritative Master Import
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Select any Faculty member, Year, and Section. Upload Excel (.xlsx, .xls) or CSV. Students are dynamically assigned and logins are synchronized.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleDownloadTemplate}
              className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/50 px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Download standard CSV template for student upload"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download Template (.csv)</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {/* STEP 1: DYNAMIC CONFIGURATION & FACULTY SELECTION */}
        {initialFacultyId ? (
          <div className="mt-5 bg-slate-950/80 border border-slate-800 p-4 sm:p-5 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Users2 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Assigned Staff / Faculty:
                  </span>
                  <span className="text-sm font-bold text-white font-mono">
                    {activeStaff?.name || 'Loading...'} {activeStaff?.identifier ? `(${activeStaff.identifier})` : ''}
                  </span>
                  {activeStaff?.email && (
                    <span className="text-xs text-slate-400 font-mono">
                      • {activeStaff.email}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono flex flex-wrap items-center gap-2 pt-1">
                  <span>
                    Class Workspace:{' '}
                    <strong className="text-cyan-400 font-bold">{selectedYear}</strong> —{' '}
                    <strong className="text-emerald-400 font-bold">Section {selectedSection}</strong>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/50 border border-amber-900/60 px-2 py-0.5 rounded">
                    ✓ Dynamically Locked to Faculty Assignment
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/80 border border-slate-800 p-4 sm:p-5 rounded-2xl">
            {/* Faculty Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-1.5 mb-2">
                <Users2 className="w-4 h-4 text-amber-400" />
                <span>1. Assigned Faculty / Staff</span>
              </label>
              <select
                value={selectedFacultyId}
                onChange={(e) => handleFacultySelectionChange(e.target.value)}
                disabled={isLoadingFaculty || isValidating || isImporting}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed"
              >
                {facultyList.length === 0 ? (
                  <option value="">No Registered Faculty Accounts Found</option>
                ) : (
                  facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.identifier} — {f.year} Sec {f.section})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Year Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-1.5 mb-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>2. Academic Year</span>
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setPreviewData(null);
                }}
                disabled={isValidating || isImporting}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            {/* Section Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-1.5 mb-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>3. Section</span>
              </label>
              <select
                value={selectedSection}
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setPreviewData(null);
                }}
                disabled={isValidating || isImporting}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
                <option value="D">Section D</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: FILE UPLOAD DROPZONE */}
        <div className="mt-5">
          <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/60 rounded-2xl p-6 text-center space-y-3 transition-colors">
            <Upload className="w-9 h-9 sm:w-10 sm:h-10 text-amber-400 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-white">Upload Student Roster Excel / CSV File</h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Accepted formats: <strong className="text-amber-300">.xlsx</strong>, <strong className="text-amber-300">.xls</strong>, <strong className="text-amber-300">.csv</strong>
              </p>
              <p className="text-xs text-cyan-400 font-mono font-semibold mt-0.5">
                Maximum file size: 10 MB
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Standard headers: Name, Register Number, College Mail ID, Mobile Number, Personal Mail ID, Address, CGPA
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={!selectedFacultyId || isValidating || isImporting}
              className="hidden"
              id="hod-student-excel-upload"
            />

            <div className="pt-2">
              <label
                htmlFor="hod-student-excel-upload"
                className={`inline-flex items-center space-x-2 px-5 py-3 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg min-h-[44px] ${
                  !selectedFacultyId || isValidating || isImporting
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Parsing & Validating Rows...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Choose Excel / CSV File</span>
                  </>
                )}
              </label>
            </div>

            {selectedFile && (
              <div className="text-xs text-cyan-400 font-mono font-bold mt-2">
                Selected File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* IMPORT PROGRESS INDICATOR (PREVENTS 413 & 504 TIMEOUTS) */}
      {isImporting && importProgress && (
        <div className="bg-slate-900 border border-indigo-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-indigo-300 font-bold flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Importing Batch {importProgress.currentBatch} of {importProgress.totalBatches}...</span>
            </span>
            <span className="text-white font-bold">
              {importProgress.processedCount} / {importProgress.totalCount} Students ({importProgress.percent}%)
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${importProgress.percent}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 font-mono">
            Chunked sequential processing active: each batch is securely committed to Supabase without gateway timeouts.
          </p>
        </div>
      )}

      {/* SUCCESS RESULT BANNER */}
      {importResult && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 rounded-2xl p-5 sm:p-6 space-y-3 text-emerald-200 shadow-xl">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <h3 className="text-base font-bold text-white">Import Complete Successfully</h3>
          </div>
          <p className="text-xs font-mono leading-relaxed">{importResult.message}</p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={resetForm}
              className="min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs font-mono cursor-pointer"
            >
              Upload Another Roster
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs font-mono cursor-pointer"
              >
                Close Window
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VALIDATION RESULTS */}
      {previewData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6 shadow-xl">
          {/* STATS SUMMARY */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-950 border border-slate-800 p-3.5 sm:p-4 rounded-xl">
              <div className="text-[11px] text-slate-400 font-mono uppercase">Total Rows</div>
              <div className="text-xl sm:text-2xl font-bold text-white mt-1">{previewData.totalRows}</div>
            </div>
            <div className="bg-slate-950 border border-emerald-800 p-3.5 sm:p-4 rounded-xl">
              <div className="text-[11px] text-emerald-400 font-mono uppercase font-bold">New Valid Records</div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-300 mt-1">{previewData.validRowsCount}</div>
            </div>
            <div className="bg-slate-950 border border-amber-800 p-3.5 sm:p-4 rounded-xl">
              <div className="text-[11px] text-amber-400 font-mono uppercase font-bold">Existing Updates</div>
              <div className="text-xl sm:text-2xl font-bold text-amber-300 mt-1">{previewData.updateRowsCount}</div>
            </div>
            <div className="bg-slate-950 border border-red-800 p-3.5 sm:p-4 rounded-xl">
              <div className="text-[11px] text-red-400 font-mono uppercase font-bold">Validation Errors</div>
              <div className="text-xl sm:text-2xl font-bold text-red-400 mt-1">{previewData.errorRowsCount}</div>
            </div>
          </div>

          {/* WARNING WHEN ERRORS EXIST */}
          {previewData.errorRowsCount > 0 && (
            <div className="bg-amber-950/70 border border-amber-800 text-amber-200 px-4 py-3 rounded-xl text-xs flex items-center space-x-2 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>{previewData.errorRowsCount} invalid rows</strong> were detected and will be skipped. Only the <strong>{previewData.validRowsCount + previewData.updateRowsCount} valid student records</strong> will be imported.
              </span>
            </div>
          )}

          {/* CONFIRMATION TOOLBAR (TOP) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs font-mono text-slate-300">
              Assigned Faculty: <strong className="text-white">{previewData.faculty?.name || activeStaff?.name || 'Assigned Faculty'}</strong> | Target: <strong className="text-cyan-400">{previewData.year || selectedYear} Sec {previewData.section || selectedSection}</strong>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => {
                  resetForm();
                  if (onClose) onClose();
                }}
                disabled={isImporting}
                className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!previewData.canImport || isImporting || (previewData.validRowsCount + previewData.updateRowsCount) === 0}
                className={`min-h-[44px] font-extrabold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg cursor-pointer ${
                  !previewData.canImport || isImporting || (previewData.validRowsCount + previewData.updateRowsCount) === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Safe Import...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Import {previewData.validRowsCount + previewData.updateRowsCount} Students</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* MOBILE SCROLL NOTICE */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 md:hidden px-1">
            <span>Swipe horizontally to inspect all columns</span>
            <span className="text-amber-400 font-bold">↔ Scroll Table</span>
          </div>

          {/* ROW BY ROW PREVIEW TABLE */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
            <table className="w-full min-w-[850px] text-xs text-left border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 font-mono uppercase text-[11px] bg-slate-950/60">
                  <th className="py-3 px-3.5 whitespace-nowrap">Row #</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Register Number</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Student Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">College Mail ID</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Mobile & Personal Email</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">CGPA</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Validation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {previewData.preview.map((row: any) => (
                  <tr key={row.rowNumber} className="hover:bg-slate-950/60 transition-colors font-mono">
                    <td className="py-3 px-3.5 font-bold text-slate-400 whitespace-nowrap">#{row.rowNumber}</td>
                    <td className="py-3 px-3.5 font-bold text-cyan-400 whitespace-nowrap">{row.parsedData.registerNo || '—'}</td>
                    <td className="py-3 px-3.5 font-bold text-white whitespace-nowrap">{row.parsedData.name || '—'}</td>
                    <td className="py-3 px-3.5 text-slate-300 whitespace-nowrap">{row.parsedData.collegeEmail || '—'}</td>
                    <td className="py-3 px-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                      <div>{row.parsedData.mobileNumber || 'No Mobile'}</div>
                      <div className="text-slate-500">{row.parsedData.personalEmail || 'No Personal Email'}</div>
                    </td>
                    <td className="py-3 px-3.5 text-center font-bold text-slate-200 whitespace-nowrap">
                      {row.parsedData.cgpa !== null && row.parsedData.cgpa !== undefined ? Number(row.parsedData.cgpa).toFixed(2) : 'N/A'}
                    </td>
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'ERROR'
                            ? 'bg-red-950 border border-red-800 text-red-300'
                            : row.status === 'UPDATE_EXISTING'
                            ? 'bg-amber-950 border border-amber-800 text-amber-300'
                            : 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                        }`}
                      >
                        {row.status === 'ERROR' ? 'Invalid Row' : row.status === 'UPDATE_EXISTING' ? 'Update Existing' : 'Valid New'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[11px] min-w-[220px]">
                      {row.errors && row.errors.length > 0 ? (
                        <div className="text-red-400 font-bold space-y-0.5">
                          {row.errors.map((e: string, i: number) => (
                            <div key={i} className="flex items-center space-x-1">
                              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span>{e}</span>
                            </div>
                          ))}
                        </div>
                      ) : row.status === 'UPDATE_EXISTING' ? (
                        <div className="text-amber-400 font-semibold flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Matching Register Number in DB (Record & login will be updated)</span>
                        </div>
                      ) : (
                        <div className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Ready for master creation & login sync</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BOTTOM CONFIRMATION TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs font-mono text-slate-300">
              Ready to import <strong className="text-emerald-400">{previewData.validRowsCount + previewData.updateRowsCount} students</strong> into <strong className="text-cyan-400">{previewData.year || selectedYear} Sec {previewData.section || selectedSection}</strong>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => {
                  resetForm();
                  if (onClose) onClose();
                }}
                disabled={isImporting}
                className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!previewData.canImport || isImporting || (previewData.validRowsCount + previewData.updateRowsCount) === 0}
                className={`min-h-[44px] font-extrabold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg cursor-pointer ${
                  !previewData.canImport || isImporting || (previewData.validRowsCount + previewData.updateRowsCount) === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Safe Import...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Import {previewData.validRowsCount + previewData.updateRowsCount} Students</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
