import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { API } from '../../services/api';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  X,
  ShieldCheck
} from 'lucide-react';

interface FacultyStudentBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignedYear: string;
  assignedSection: string;
  facultyName?: string;
  onImportCompleted?: () => void;
}

export const FacultyStudentBulkUploadModal: React.FC<FacultyStudentBulkUploadModalProps> = ({
  isOpen,
  onClose,
  assignedYear,
  assignedSection,
  facultyName,
  onImportCompleted
}) => {
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
    assignedYear?: string;
    assignedSection?: string;
  } | null>(null);

  const [importResult, setImportResult] = useState<{
    message: string;
    importedCount: number;
    students: any[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Download official CSV template
  const handleDownloadCsvTemplate = () => {
    const headers = 'Name,Register Number,College Mail ID,Mobile Number,Personal Mail ID,Address,CGPA\n';
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `faculty_student_upload_template_${assignedYear.replace(/\s+/g, '_')}_Sec_${assignedSection}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download official Excel template (.xlsx)
  const handleDownloadExcelTemplate = () => {
    const headers = ['Name', 'Register Number', 'College Mail ID', 'Mobile Number', 'Personal Mail ID', 'Address', 'CGPA'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(
      workbook,
      `faculty_student_upload_template_${assignedYear.replace(/\s+/g, '_')}_Sec_${assignedSection}.xlsx`
    );
  };

  // Dynamic file handler for both XLSX/XLS and CSV/TXT
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        await runValidationPreview(rows);
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
          const rows = results.data as any[];
          await runValidationPreview(rows);
        },
        error: (err) => {
          alert(`Failed to parse CSV file: ${err.message}`);
        }
      });
    }
  };

  const runValidationPreview = async (rows: any[]) => {
    try {
      setIsValidating(true);
      const res = await API.previewFacultyStudentExcelImport(rows);
      setPreviewData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to validate student rows.');
      setPreviewData(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Safe chunked import: chunks into batches of 25 to prevent 413 & 504 timeouts
  const handleConfirmImport = async () => {
    if (!previewData) return;

    const validStudents = previewData.preview
      .filter((r) => r.status !== 'ERROR')
      .map((r) => r.parsedData);

    if (validStudents.length === 0) {
      alert('No valid student rows found to import.');
      return;
    }

    try {
      setIsImporting(true);
      const BATCH_SIZE = 25;
      const totalCount = validStudents.length;
      const totalBatches = Math.ceil(totalCount / BATCH_SIZE);
      let allImported: any[] = [];

      for (let i = 0; i < totalCount; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const chunk = validStudents.slice(i, i + BATCH_SIZE);
        setImportProgress({
          currentBatch: batchNum,
          totalBatches,
          processedCount: i,
          totalCount,
          percent: Math.round((i / totalCount) * 100)
        });

        const res = await API.confirmFacultyStudentExcelImport(chunk);

        if (res.students && Array.isArray(res.students)) {
          allImported = allImported.concat(res.students);
        }
      }

      setImportProgress({
        currentBatch: totalBatches,
        totalBatches,
        processedCount: totalCount,
        totalCount,
        percent: 100
      });

      setImportResult({
        message: `Successfully imported and synchronized ${allImported.length} student records into ${assignedYear} Section ${assignedSection}. Student logins initialized with password = Register Number.`,
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
      alert(err.message || 'Failed to execute student bulk import.');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    setImportProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto text-xs font-sans">
        {/* HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-400" />
                <span>Student Roster Bulk Upload — Section {assignedSection}</span>
              </h2>
              <span className="bg-sky-950 border border-sky-700 text-sky-300 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                Class Coordinator Roster
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Upload Excel (.xlsx, .xls) or CSV (.csv) student roster. Students are securely locked to your assigned workspace.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Download Templates */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadExcelTemplate}
                className="min-h-[40px] bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/50 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Download standard Excel spreadsheet template"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Template (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="min-h-[40px] bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 hover:border-sky-500/50 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Download standard CSV text template"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Template (.csv)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="min-h-[40px] text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* LOCKED WORKSPACE AUTHORIZATION BANNER */}
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 font-mono">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Assigned Workspace:</span>
              <strong className="text-cyan-400">{assignedYear}</strong>
              <span className="text-slate-600">—</span>
              <strong className="text-emerald-400">Section {assignedSection}</strong>
              {facultyName && <span className="text-slate-400">({facultyName})</span>}
            </div>
            <p className="text-[11px] text-slate-500">
              Department policy: Student records are strictly registered exclusively into your assigned Class Coordinator section.
            </p>
          </div>

          <span className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[10px] font-mono px-2.5 py-1 rounded-lg font-bold shrink-0 self-start sm:self-auto">
            ✓ Section Access Verified
          </span>
        </div>

        {/* STEP 2: FILE UPLOAD DROPZONE */}
        <div className="border-2 border-dashed border-slate-700 hover:border-sky-500/60 bg-slate-950/60 rounded-2xl p-6 text-center space-y-3 transition-colors">
          <Upload className="w-9 h-9 sm:w-10 sm:h-10 text-sky-400 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-white">Upload Student Roster Excel / CSV File</h3>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Accepted formats: <strong className="text-emerald-300">.xlsx</strong>, <strong className="text-emerald-300">.xls</strong>, <strong className="text-sky-300">.csv</strong>
            </p>
            <p className="text-xs text-cyan-400 font-mono font-semibold mt-0.5">
              Maximum file size: 10 MB
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Supported headers: Name, Register Number, College Mail ID, Mobile Number, Personal Mail ID, Address, CGPA
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={isValidating || isImporting}
            className="hidden"
            id="faculty-student-excel-upload"
          />

          <div className="pt-2">
            <label
              htmlFor="faculty-student-excel-upload"
              className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg min-h-[44px] ${
                isValidating || isImporting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
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

        {/* IMPORT PROGRESS INDICATOR (PREVENTS 413 & 504 TIMEOUTS) */}
        {isImporting && importProgress && (
          <div className="bg-slate-950 border border-sky-700/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-sky-300 font-bold flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Importing Batch {importProgress.currentBatch} of {importProgress.totalBatches}...</span>
              </span>
              <span className="text-white font-bold">
                {importProgress.processedCount} / {importProgress.totalCount} Students ({importProgress.percent}%)
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-800 overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 h-full transition-all duration-300 ease-out"
                style={{ width: `${importProgress.percent}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 font-mono">
              Chunked sequential processing active: batches of 25 records are committed directly to Supabase to guarantee 0 timeouts.
            </p>
          </div>
        )}

        {/* SUCCESS RESULT BANNER */}
        {importResult && (
          <div className="bg-emerald-950/80 border border-emerald-700/80 rounded-2xl p-4 sm:p-5 space-y-3 text-emerald-200 shadow-xl">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              <h3 className="text-base font-bold text-white">Import Completed Successfully</h3>
            </div>
            <p className="text-xs font-mono leading-relaxed">{importResult.message}</p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs font-mono cursor-pointer"
              >
                Upload Another Roster
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs font-mono cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW & VALIDATION RESULTS */}
        {previewData && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xl">
            {/* STATS SUMMARY */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <div className="text-[11px] text-slate-400 font-mono uppercase">Total Rows</div>
                <div className="text-xl font-bold text-white mt-1">{previewData.totalRows}</div>
              </div>
              <div className="bg-slate-900 border border-emerald-800 p-3.5 rounded-xl">
                <div className="text-[11px] text-emerald-400 font-mono uppercase font-bold">New Records</div>
                <div className="text-xl font-bold text-emerald-300 mt-1">{previewData.validRowsCount}</div>
              </div>
              <div className="bg-slate-900 border border-amber-800 p-3.5 rounded-xl">
                <div className="text-[11px] text-amber-400 font-mono uppercase font-bold">Existing Updates</div>
                <div className="text-xl font-bold text-amber-300 mt-1">{previewData.updateRowsCount}</div>
              </div>
              <div className="bg-slate-900 border border-red-800 p-3.5 rounded-xl">
                <div className="text-[11px] text-red-400 font-mono uppercase font-bold">Errors</div>
                <div className="text-xl font-bold text-red-400 mt-1">{previewData.errorRowsCount}</div>
              </div>
            </div>

            {/* EXISTING STUDENT UPDATE NOTICE */}
            {previewData.updateRowsCount > 0 && (
              <div className="bg-amber-950/60 border border-amber-800/80 p-3.5 rounded-xl flex items-start space-x-2.5 text-amber-200 text-xs font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300">Notice on Existing Records: </strong>
                  <span>
                    {previewData.updateRowsCount} student record(s) with matching Register Numbers already exist in the system. Confirming will update their academic profile and lock them to Section {assignedSection}, while strictly preserving their existing login credentials.
                  </span>
                </div>
              </div>
            )}

            {/* CONFIRMATION TOOLBAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-xs font-mono text-slate-300">
                Target Section: <strong className="text-cyan-400">{assignedYear} Section {assignedSection}</strong> | Valid: <strong className="text-emerald-400">{previewData.validRowsCount + previewData.updateRowsCount} Students</strong>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isImporting}
                  className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!previewData.canImport || isImporting}
                  className={`min-h-[44px] font-extrabold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg cursor-pointer ${
                    !previewData.canImport || isImporting
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

            {/* ROW BY ROW PREVIEW TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 font-mono uppercase text-[11px]">
                    <th className="py-2.5 px-3">Row #</th>
                    <th className="py-2.5 px-3">Register Number</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">College Mail ID</th>
                    <th className="py-2.5 px-3">Mobile & Personal Email</th>
                    <th className="py-2.5 px-3 text-center">CGPA</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {previewData.preview.map((row: any) => (
                    <tr key={row.rowNumber} className="hover:bg-slate-900/60 transition-colors font-mono">
                      <td className="py-2.5 px-3 font-bold text-slate-400">#{row.rowNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-cyan-400">{row.parsedData.registerNo || '—'}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{row.parsedData.name || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-300">{row.parsedData.collegeEmail || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        <div>{row.parsedData.mobileNumber || 'No Mobile'}</div>
                        <div className="text-slate-500">{row.parsedData.personalEmail || 'No Personal Email'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-200">
                        {row.parsedData.cgpa !== null && row.parsedData.cgpa !== undefined ? Number(row.parsedData.cgpa).toFixed(2) : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                      <td className="py-2.5 px-3 text-[11px]">
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
                            <span>Existing Register No in DB (Profile will be updated)</span>
                          </div>
                        ) : (
                          <div className="text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Ready to import into Section {assignedSection}</span>
                          </div>
                        )}
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
  );
};
