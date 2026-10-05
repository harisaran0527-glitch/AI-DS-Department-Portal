import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
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
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';

interface FacultyOption {
  id: string;
  name: string;
  email: string;
  identifier: string;
  year?: string;
  section?: string;
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

  // Selections
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(initialFacultyId || '');
  const [selectedYear, setSelectedYear] = useState<string>(initialYear || '2nd Year');
  const [selectedSection, setSelectedSection] = useState<string>(initialSection || 'A');

  // File & Preview State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    validRowsCount: number;
    updateRowsCount: number;
    errorRowsCount: number;
    canImport: boolean;
    preview: any[];
  } | null>(null);

  const [importResult, setImportResult] = useState<{
    message: string;
    importedCount: number;
    students: any[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchFacultyList();
  }, []);

  const fetchFacultyList = async () => {
    try {
      setIsLoadingFaculty(true);
      const res = await API.getFacultyList();
      const list = res.faculty || [];
      setFacultyList(list);
      if (initialFacultyId) {
        setSelectedFacultyId(initialFacultyId);
      } else if (list.length > 0) {
        setSelectedFacultyId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load faculty list for HOD import:', err);
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedFacultyId) {
      alert('Please select an Assigned Faculty/Staff member before uploading.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setPreviewData(null);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        await runValidationPreview(rows);
      },
      error: (err) => {
        alert(`Failed to parse file: ${err.message}`);
      }
    });
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
      alert(err.message || 'Failed to validate Excel rows.');
      setPreviewData(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !selectedFacultyId) return;

    const validStudents = previewData.preview
      .filter((r) => r.status !== 'ERROR')
      .map((r) => r.parsedData);

    if (validStudents.length === 0) {
      alert('No valid student rows found to import.');
      return;
    }

    try {
      setIsImporting(true);
      const res = await API.confirmHodStudentExcelImport(
        selectedFacultyId,
        selectedYear,
        selectedSection,
        validStudents
      );

      setImportResult(res);
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
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  const activeStaff = facultyList.find((f) => f.id === selectedFacultyId);

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-6 h-6 text-amber-400" />
                <span>
                  {initialFacultyId
                    ? `Student Roster Import — ${activeStaff?.name || 'Staff Assignment'}`
                    : 'Student Bulk Upload — HOD Workflow'}
                </span>
              </h2>
              <span className="bg-amber-950 border border-amber-700 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                Authoritative Master Import
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              {initialFacultyId
                ? 'Upload and validate student roster for this staff member. Year and Section are automatically locked to staff assignment. Register Number is the authoritative student ID.'
                : 'HOD selects Faculty/Staff + Year + Section, validates row-by-row Excel data, and confirms individual student account creation.'}
            </p>
          </div>
        </div>

        {/* STEP 1: CONFIGURATION / LOCKED STAFF CONTEXT */}
        {initialFacultyId ? (
          <div className="mt-6 bg-slate-950/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
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
                <div className="text-xs text-slate-400 font-mono flex items-center space-x-3 pt-1">
                  <span>
                    Locked Target:{' '}
                    <strong className="text-cyan-400 font-bold">{selectedYear}</strong> —{' '}
                    <strong className="text-emerald-400 font-bold">Section {selectedSection}</strong>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/50 border border-amber-900/60 px-2 py-0.5 rounded">
                    ✓ Auto-locked from Faculty Assignment
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/80 border border-slate-800 p-5 rounded-2xl">
            {/* Faculty Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-1.5 mb-2">
                <Users2 className="w-4 h-4 text-amber-400" />
                <span>1. Assigned Staff / Faculty</span>
              </label>
              <select
                value={selectedFacultyId}
                onChange={(e) => {
                  setSelectedFacultyId(e.target.value);
                  setPreviewData(null);
                }}
                disabled={isLoadingFaculty || isValidating || isImporting}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed"
              >
                {facultyList.length === 0 ? (
                  <option value="">No Registered Faculty Accounts Found</option>
                ) : (
                  facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.identifier} — {f.email})
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
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
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
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
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
        <div className="mt-6">
          <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/60 rounded-2xl p-6 text-center space-y-3 transition-colors">
            <Upload className="w-10 h-10 text-amber-400 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-white">Upload Student Roster Excel / CSV File</h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Supported headers: <code className="text-amber-300">Name</code>, <code className="text-amber-300">Register Number</code>, <code className="text-amber-300">College Mail ID</code>, <code className="text-slate-300">Mobile Number</code>, <code className="text-slate-300">Personal Mail ID</code>, <code className="text-slate-300">Address</code>, <code className="text-slate-300">CGPA</code>
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.txt"
              onChange={handleFileChange}
              disabled={!selectedFacultyId || isValidating || isImporting}
              className="hidden"
              id="hod-student-excel-upload"
            />

            <label
              htmlFor="hod-student-excel-upload"
              className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg ${
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

            {selectedFile && (
              <div className="text-xs text-cyan-400 font-mono font-bold mt-2">
                Selected File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUCCESS RESULT BANNER */}
      {importResult && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 rounded-2xl p-6 space-y-3 text-emerald-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <h3 className="text-base font-bold text-white">Import Complete Successfully</h3>
          </div>
          <p className="text-xs font-mono">{importResult.message}</p>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={resetForm}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs font-mono"
            >
              Upload Another Roster
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VALIDATION RESULTS */}
      {previewData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          {/* STATS SUMMARY */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="text-xs text-slate-400 font-mono uppercase">Total File Rows</div>
              <div className="text-2xl font-bold text-white mt-1">{previewData.totalRows}</div>
            </div>
            <div className="bg-slate-950 border border-emerald-800 p-4 rounded-xl">
              <div className="text-xs text-emerald-400 font-mono uppercase font-bold">New Valid Records</div>
              <div className="text-2xl font-bold text-emerald-300 mt-1">{previewData.validRowsCount}</div>
            </div>
            <div className="bg-slate-950 border border-amber-800 p-4 rounded-xl">
              <div className="text-xs text-amber-400 font-mono uppercase font-bold">Existing Updates</div>
              <div className="text-2xl font-bold text-amber-300 mt-1">{previewData.updateRowsCount}</div>
            </div>
            <div className="bg-slate-950 border border-red-800 p-4 rounded-xl">
              <div className="text-xs text-red-400 font-mono uppercase font-bold">Validation Errors</div>
              <div className="text-2xl font-bold text-red-400 mt-1">{previewData.errorRowsCount}</div>
            </div>
          </div>

          {/* CONFIRMATION TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs font-mono text-slate-300">
              Target Faculty: <strong className="text-white">{previewData.faculty?.name}</strong> | Target: <strong className="text-cyan-400">{previewData.year} {previewData.section}</strong>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={resetForm}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!previewData.canImport || isImporting}
                className={`font-extrabold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg ${
                  !previewData.canImport || isImporting
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Database Import...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Create {previewData.validRowsCount + previewData.updateRowsCount} Records</span>
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
                  <th className="py-3 px-3">Row #</th>
                  <th className="py-3 px-3">Register Number</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">College Mail ID</th>
                  <th className="py-3 px-3">Mobile & Personal Email</th>
                  <th className="py-3 px-3 text-center">CGPA</th>
                  <th className="py-3 px-3 text-center">Validation Status</th>
                  <th className="py-3 px-3">Details / Validation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {previewData.preview.map((row: any) => (
                  <tr key={row.rowNumber} className="hover:bg-slate-950/60 transition-colors font-mono">
                    <td className="py-3 px-3 font-bold text-slate-400">#{row.rowNumber}</td>
                    <td className="py-3 px-3 font-bold text-cyan-400">{row.parsedData.registerNo || '—'}</td>
                    <td className="py-3 px-3 font-bold text-white">{row.parsedData.name || '—'}</td>
                    <td className="py-3 px-3 text-slate-300">{row.parsedData.collegeEmail || '—'}</td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      <div>{row.parsedData.mobileNumber || 'No Mobile'}</div>
                      <div className="text-slate-500">{row.parsedData.personalEmail || 'No Personal Email'}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-200">
                      {row.parsedData.cgpa !== null && row.parsedData.cgpa !== undefined ? Number(row.parsedData.cgpa).toFixed(2) : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-center">
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
                    <td className="py-3 px-3 text-[11px]">
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
                          <span>Matching Register Number in DB (Record will be updated)</span>
                        </div>
                      ) : (
                        <div className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Ready for master creation</span>
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
  );
};
