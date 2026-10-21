import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { API } from '../../services/api';
import type { Subject } from '../../types';
import {
  BookOpen,
  Search,
  Check,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Download,
  X
} from 'lucide-react';

interface SubjectManagementProps {
  userRole: 'FACULTY' | 'HOD' | 'ADMIN' | 'STUDENT';
  assignedYear?: string;
  assignedSection?: string;
  onSubjectsChange?: (subjects: Subject[]) => void;
}

export const SubjectManagement: React.FC<SubjectManagementProps> = ({
  userRole,
  assignedYear,
  assignedSection,
  onSubjectsChange
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(assignedYear || 'ALL');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>(assignedSection || 'ALL');

  // Excel Bulk Upload Modal State (for Faculty / Admin)
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isValidatingExcel, setIsValidatingExcel] = useState<boolean>(false);
  const [isImportingExcel, setIsImportingExcel] = useState<boolean>(false);
  const [excelPreviewSummary, setExcelPreviewSummary] = useState<any>(null);
  const [excelValidRows, setExcelValidRows] = useState<any[]>([]);
  const [excelInvalidRows, setExcelInvalidRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawUploadedRowsRef = useRef<any[] | null>(null);

  // Upload Target Defaults
  const [uploadTargetYear, setUploadTargetYear] = useState<string>(
    assignedYear && assignedYear !== 'ALL' ? assignedYear : (yearFilter !== 'ALL' ? yearFilter : '2nd Year')
  );
  const [uploadTargetSemester, setUploadTargetSemester] = useState<string>(
    semesterFilter !== 'ALL' ? semesterFilter : (uploadTargetYear === '1st Year' ? '1' : uploadTargetYear === '3rd Year' ? '5' : uploadTargetYear === '4th Year' ? '7' : '3')
  );
  const [uploadTargetSection, setUploadTargetSection] = useState<string>(
    assignedSection && assignedSection !== 'ALL' ? assignedSection : (sectionFilter !== 'ALL' ? sectionFilter : 'ALL')
  );

  // HOD and STUDENT are strictly view-only
  const isReadOnly = userRole === 'HOD' || userRole === 'STUDENT';

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const res = await API.getSubjects();
      const list = res.subjects || [];
      setSubjects(list);
      if (onSubjectsChange) {
        onSubjectsChange(list);
      }
    } catch (err: any) {
      console.error('Failed to load subjects:', err);
      setErrorMsg(err.message || 'Failed to load subjects.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const runPreviewValidation = async (rows: any[], yr: string, sec: string, sem: string) => {
    if (!rows || rows.length === 0) return;
    setIsValidatingExcel(true);
    try {
      const res = await API.previewSubjectImport(
        rows,
        yr && yr !== 'ALL' ? yr : undefined,
        sec && sec !== 'ALL' ? sec : undefined,
        sem && sem !== 'ALL' ? sem : undefined
      );

      setExcelPreviewSummary(res.summary);
      setExcelValidRows(res.validRows || []);
      setExcelInvalidRows(res.invalidRows || []);
    } catch (err: any) {
      console.error('Error parsing subject file:', err);
      alert(err.message || 'Failed to parse Subject Master file.');
    } finally {
      setIsValidatingExcel(false);
    }
  };

  // Handle Bulk Excel / CSV Upload for Subject Master
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10 MB limit. Please upload a smaller file.');
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
      alert('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setExcelFile(file);
    setExcelPreviewSummary(null);
    setExcelValidRows([]);
    setExcelInvalidRows([]);

    try {
      let rawRows: any[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('The uploaded Excel file does not contain any sheets.');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else {
        // CSV parsing
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rawRows = parsed.data as any[];
      }

      if (rawRows.length === 0) {
        throw new Error('The uploaded file is empty or contains no readable data rows.');
      }

      rawUploadedRowsRef.current = rawRows;
      await runPreviewValidation(rawRows, uploadTargetYear, uploadTargetSection, uploadTargetSemester);
    } catch (err: any) {
      console.error('Error parsing subject file:', err);
      alert(err.message || 'Failed to parse Subject Master file.');
    }
  };

  const handleConfirmSubjectImport = async () => {
    if (excelValidRows.length === 0) return;
    setIsImportingExcel(true);
    try {
      const res = await API.confirmSubjectImport(
        excelValidRows,
        uploadTargetYear,
        uploadTargetSection,
        uploadTargetSemester
      );
      const msg = res.message || `Successfully processed ${res.importedCount || excelValidRows.length} Department Subjects (${res.importedCount || 0} created, ${res.updatedCount || 0} updated, ${res.skippedCount || 0} skipped).`;
      setSuccessMsg(msg);
      if (res.failedCount && res.failedCount > 0) {
        setErrorMsg(`${res.failedCount} subjects failed to import. Reasons: ${res.failedRows?.map((f: any) => `Row #${f.rowNumber}: ${f.reason}`).join('; ')}`);
      }
      setShowExcelModal(false);
      setExcelFile(null);
      rawUploadedRowsRef.current = null;
      setExcelPreviewSummary(null);
      setExcelValidRows([]);
      setExcelInvalidRows([]);
      await fetchSubjects();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to confirm Subject Master import.');
    } finally {
      setIsImportingExcel(false);
    }
  };

  // Download official Excel template (.xlsx)
  const downloadSubjectTemplate = () => {
    const templateRows = [
      {
        'Subject Code': 'MA25C08',
        'Subject Abbreviation': 'DM',
        'Subject Title': 'Discrete Mathematics'
      },
      {
        'Subject Code': 'CS25C10',
        'Subject Abbreviation': 'OOSE',
        'Subject Title': 'Object Oriented Software Engineering'
      },
      {
        'Subject Code': 'CS25C08',
        'Subject Abbreviation': 'DS',
        'Subject Title': 'Data Structures'
      },
      {
        'Subject Code': 'CS25C09',
        'Subject Abbreviation': 'JP',
        'Subject Title': 'Java Programming'
      },
      {
        'Subject Code': 'CS25C11',
        'Subject Abbreviation': 'OS',
        'Subject Title': 'Operating Systems'
      },
      {
        'Subject Code': 'EN25C03',
        'Subject Abbreviation': 'EC LAB',
        'Subject Title': 'English Communication Skills Laboratory - I'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SubjectMaster');
    XLSX.writeFile(workbook, 'subject_master_template.xlsx');
  };

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const code = (s.subjectCode || s.subject_code || '').toLowerCase();
      const abbr = (s.subjectAbbreviation || s.subject_abbreviation || '').toLowerCase();
      const name = (s.subjectName || s.subject_name || '').toLowerCase();
      const handler = (s.facultyHandler || s.faculty_handler || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || code.includes(q) || abbr.includes(q) || name.includes(q) || handler.includes(q);
      const matchesYear = yearFilter === 'ALL' || s.year === yearFilter || s.year.replace(' Year', '') === yearFilter.replace(' Year', '');
      const matchesSem = semesterFilter === 'ALL' || String(s.semester) === semesterFilter;
      const matchesSec = sectionFilter === 'ALL' || s.section === sectionFilter || s.section === 'ALL';

      return matchesSearch && matchesYear && matchesSem && matchesSec;
    });
  }, [subjects, searchQuery, yearFilter, semesterFilter, sectionFilter]);

  return (
    <div className="space-y-6">
      {/* HEADER & CONTROLS */}
      <div className="bg-[#3039A8] border border-white/14 rounded-2xl p-6 space-y-4 shadow-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/14 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
              <BookOpen className="w-5 h-5 text-cyan-300" />
              <span>Department Subject Master & Curriculum</span>
            </h3>
            <p className="text-xs text-[#D9DEFF] font-mono mt-0.5">
              {userRole === 'HOD'
                ? 'Authoritative view of all Faculty-uploaded Department Subjects from Supabase PostgreSQL (View-Only).'
                : 'Official Department Subject Master. Subjects are managed exclusively via Excel bulk upload.'}
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={downloadSubjectTemplate}
              className="bg-[#1B205F] hover:bg-[#252B86] text-cyan-200 border border-white/14 px-3 py-2 rounded-xl text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Download Excel Template"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Template (.xlsx)</span>
            </button>

            {!isReadOnly && (
              <button
                onClick={() => setShowExcelModal(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer shrink-0 font-mono"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Subject Master (Excel)</span>
              </button>
            )}
          </div>
        </div>

        {/* ALERTS */}
        {successMsg && (
          <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl text-xs font-mono flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white font-bold">✕</button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-950/80 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-xs font-mono flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white font-bold">✕</button>
          </div>
        )}

        {/* SEARCH & FILTERS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* SEARCH */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#AEB7F5] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Code, Abbr, Subject, Faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#252B86] border border-white/14 pl-8 pr-3 py-1.5 rounded-xl text-xs text-white font-mono placeholder:text-[#AEB7F5] focus:outline-none focus:border-cyan-300"
            />
          </div>

          {/* YEAR FILTER */}
          <div>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full bg-[#252B86] border border-white/14 px-3 py-1.5 rounded-xl text-xs text-cyan-200 font-mono cursor-pointer hover:border-cyan-300"
            >
              <option value="ALL">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
            </select>
          </div>

          {/* SEMESTER FILTER */}
          <div>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full bg-[#252B86] border border-white/14 px-3 py-1.5 rounded-xl text-xs text-cyan-200 font-mono cursor-pointer hover:border-cyan-300"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={String(s)}>Semester {s}</option>
              ))}
            </select>
          </div>

          {/* SECTION FILTER */}
          <div>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full bg-[#252B86] border border-white/14 px-3 py-1.5 rounded-xl text-xs text-cyan-200 font-mono cursor-pointer hover:border-cyan-300"
            >
              <option value="ALL">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
            </select>
          </div>
        </div>

        {/* SUBJECTS MOBILE CARDS (< md) */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-[#AEB7F5] font-mono text-xs">
              Loading registered subjects...
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="py-8 text-center text-[#AEB7F5] font-mono text-xs">
              No subjects found matching current filters.
            </div>
          ) : (
            filteredSubjects.map((sub) => {
              const code = sub.subjectCode || sub.subject_code;
              const abbr = sub.subjectAbbreviation || sub.subject_abbreviation || '-';
              const name = sub.subjectName || sub.subject_name;
              const type = sub.subjectType || sub.subject_type || 'Theory';
              const handler = sub.facultyHandler || sub.faculty_handler || 'TBD';

              return (
                <div key={sub.id} className="bg-[#252B86] border border-white/14 p-4 rounded-xl space-y-2.5 shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-cyan-300 font-mono text-xs">{code}</span>
                        {abbr && abbr !== '-' && (
                          <span className="bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                            {abbr}
                          </span>
                        )}
                      </div>
                      <h4 className="text-white font-bold font-sans text-sm leading-snug mt-1">{name}</h4>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                        type === 'Practical'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : type === 'Elective'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-[#1B205F] text-cyan-300 border border-white/14'
                      }`}
                    >
                      {type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-white/10 pt-2 text-[#D9DEFF]">
                    <div>
                      <span className="text-[#AEB7F5] block text-[10px]">YEAR / SEM / SEC</span>
                      <span className="font-bold">{sub.year} • S{sub.semester} • {sub.section}</span>
                    </div>
                    <div>
                      <span className="text-[#AEB7F5] block text-[10px]">CREDITS</span>
                      <span className="font-bold text-emerald-400">{sub.credits} Credits</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[#AEB7F5] block text-[10px]">FACULTY HANDLER</span>
                      <span className="font-sans text-xs text-white">{handler}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* SUBJECTS TABLE (hidden on mobile, visible md+) */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-white/14 bg-[#3039A8] shadow-inner">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#252B86] text-[#D9DEFF] border-b border-white/14 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Code</th>
                <th className="py-3 px-3.5">Abbreviation</th>
                <th className="py-3 px-3.5">Subject Title</th>
                <th className="py-3 px-3.5">Year / Sem / Sec</th>
                <th className="py-3 px-3.5">Type</th>
                <th className="py-3 px-3.5 text-center">Credits</th>
                <th className="py-3 px-3.5">Faculty Handler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/14">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#AEB7F5]">
                    Loading registered subjects from database...
                  </td>
                </tr>
              ) : filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#AEB7F5]">
                    No subjects found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub) => {
                  const code = sub.subjectCode || sub.subject_code;
                  const abbr = sub.subjectAbbreviation || sub.subject_abbreviation || '-';
                  const name = sub.subjectName || sub.subject_name;
                  const type = sub.subjectType || sub.subject_type || 'Theory';
                  const handler = sub.facultyHandler || sub.faculty_handler || 'Class Coordinator';

                  return (
                    <tr key={sub.id} className="hover:bg-[#3F4BDA] transition-colors">
                      <td className="py-3 px-3.5 font-bold text-cyan-300 font-mono">{code}</td>
                      <td className="py-3 px-3.5 font-bold text-amber-300 font-mono">
                        {abbr !== '-' ? (
                          <span className="bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded text-[11px]">
                            {abbr}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-white font-bold font-sans text-sm">{name}</td>
                      <td className="py-3 px-3.5 text-[#D9DEFF] font-bold">
                        {sub.year} • S{sub.semester} • {sub.section}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            type === 'Practical'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : type === 'Elective'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-[#252B86] text-cyan-300 border border-white/14'
                          }`}
                        >
                          {type}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center text-emerald-400 font-bold">{sub.credits}</td>
                      <td className="py-3 px-3.5 text-cyan-100 font-sans text-xs">{handler}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXCEL BULK UPLOAD MODAL FOR FACULTY */}
      {showExcelModal && !isReadOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl space-y-0 text-white">
            {/* MODAL HEADER */}
            <div className="bg-slate-950 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold text-base">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Upload Subject Master (Excel / CSV)</span>
              </div>
              <button
                onClick={() => {
                  setShowExcelModal(false);
                  setExcelFile(null);
                  rawUploadedRowsRef.current = null;
                  setExcelPreviewSummary(null);
                  setExcelValidRows([]);
                  setExcelInvalidRows([]);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 space-y-5 text-xs font-mono">
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2 text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">Required Excel Columns:</span>
                  <button
                    type="button"
                    onClick={downloadSubjectTemplate}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 underline cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Official Template (.xlsx)</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  1. <strong>Subject Code</strong> (e.g. MA25C08)<br />
                  2. <strong>Subject Abbreviation</strong> (e.g. DM)<br />
                  3. <strong>Subject Title</strong> (e.g. Discrete Mathematics)
                </p>
                <p className="text-[11px] text-cyan-400">
                  Supported formats: <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong> | Maximum file size: <strong>10 MB</strong>
                </p>
              </div>

              {/* TARGET SCOPE SELECTORS */}
              <div className="bg-slate-950/90 border border-cyan-500/30 p-4 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-bold text-cyan-300 text-xs">Assign Uploaded Subjects To:</span>
                  <span className="text-[10px] text-slate-400">Explicit Year/Sem/Sec in file will override these defaults</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">Target Year</label>
                    <select
                      value={uploadTargetYear}
                      onChange={(e) => {
                        const newYr = e.target.value;
                        setUploadTargetYear(newYr);
                        let autoSem = '3';
                        if (newYr === '1st Year') autoSem = '1';
                        else if (newYr === '2nd Year') autoSem = '3';
                        else if (newYr === '3rd Year') autoSem = '5';
                        else if (newYr === '4th Year') autoSem = '7';
                        setUploadTargetSemester(autoSem);
                        if (rawUploadedRowsRef.current) {
                          runPreviewValidation(rawUploadedRowsRef.current, newYr, uploadTargetSection, autoSem);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-cyan-200 font-mono focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">Target Semester</label>
                    <select
                      value={uploadTargetSemester}
                      onChange={(e) => {
                        const newSem = e.target.value;
                        setUploadTargetSemester(newSem);
                        if (rawUploadedRowsRef.current) {
                          runPreviewValidation(rawUploadedRowsRef.current, uploadTargetYear, uploadTargetSection, newSem);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-cyan-200 font-mono focus:border-cyan-400 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={String(s)}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">Target Section</label>
                    <select
                      value={uploadTargetSection}
                      onChange={(e) => {
                        const newSec = e.target.value;
                        setUploadTargetSection(newSec);
                        if (rawUploadedRowsRef.current) {
                          runPreviewValidation(rawUploadedRowsRef.current, uploadTargetYear, newSec, uploadTargetSemester);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-cyan-200 font-mono focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="ALL">All Sections (Common)</option>
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* FILE UPLOAD INPUT */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="flex-1 w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-slate-950 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer text-xs font-mono text-slate-300 transition-colors">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>{excelFile ? excelFile.name : 'Select or Drop Subject Master (.xlsx, .xls, .csv)'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleExcelFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {isValidatingExcel && (
                <div className="p-4 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center space-x-2 text-cyan-300">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                  <span>Parsing and validating Subject Master records against database...</span>
                </div>
              )}

              {/* PREVIEW SUMMARY */}
              {excelPreviewSummary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase">Total Rows</span>
                      <span className="text-base font-bold text-white font-mono">{excelPreviewSummary.totalRowsProcessed}</span>
                    </div>
                    <div className="bg-emerald-950/50 p-3 rounded-xl border border-emerald-500/40 text-center">
                      <span className="text-[10px] text-emerald-300 block uppercase">Valid Subjects</span>
                      <span className="text-base font-bold text-emerald-400 font-mono">{excelPreviewSummary.validCount}</span>
                      <span className="text-[10px] text-emerald-300 block mt-0.5">
                        ({excelPreviewSummary.newCount ?? excelValidRows.filter(r => r.status === 'NEW_SUBJECT').length} New, {excelPreviewSummary.updateCount ?? excelValidRows.filter(r => r.status !== 'NEW_SUBJECT').length} Update)
                      </span>
                    </div>
                    <div className="bg-rose-950/50 p-3 rounded-xl border border-rose-500/40 text-center">
                      <span className="text-[10px] text-rose-300 block uppercase">Invalid Rows</span>
                      <span className="text-base font-bold text-rose-400 font-mono">{excelPreviewSummary.invalidCount}</span>
                    </div>
                  </div>

                  {/* INVALID ROWS WARNING */}
                  {excelInvalidRows.length > 0 && (
                    <div className="bg-rose-950/80 border border-rose-500/50 p-3 rounded-xl space-y-1">
                      <div className="flex items-center space-x-1.5 text-rose-300 font-bold">
                        <AlertCircle className="w-4 h-4" />
                        <span>Validation Warnings ({excelInvalidRows.length}):</span>
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-rose-200 pl-5">
                        {excelInvalidRows.map((inv, idx) => (
                          <div key={idx}>• Row #{inv.rowNumber}: {inv.reason}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* VALID ROWS TABLE */}
                  {excelValidRows.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-300">Ready to Import ({excelValidRows.length} Subjects):</span>
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
                            {excelValidRows.map((r, i) => (
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
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="bg-slate-950 p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setExcelFile(null);
                  rawUploadedRowsRef.current = null;
                  setExcelPreviewSummary(null);
                  setExcelValidRows([]);
                  setExcelInvalidRows([]);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isImportingExcel || excelValidRows.length === 0}
                onClick={handleConfirmSubjectImport}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-2 shadow-lg"
              >
                {isImportingExcel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Save ({excelValidRows.length} Subjects)</span>
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
