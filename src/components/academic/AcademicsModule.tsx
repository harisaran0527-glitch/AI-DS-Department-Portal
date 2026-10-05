import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { API } from '../../services/api';
import type { Subject, Student } from '../../types';
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
  Filter,
  RefreshCw,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  Award,
  ChevronRight,
  UserCheck
} from 'lucide-react';

interface AcademicsModuleProps {
  userRole: 'FACULTY' | 'HOD' | 'ADMIN' | 'STUDENT';
  assignedYear?: string;
  assignedSection?: string;
  students?: Student[];
}

export const AcademicsModule: React.FC<AcademicsModuleProps> = ({
  userRole,
  assignedYear,
  assignedSection,
  students = []
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'subject-master' | 'bulk-marks' | 'academic-roster'>('subject-master');

  // Bulk Marks Upload State
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

  // Bulk Subject Import State
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

  // Student Marks View State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentAcademicData, setStudentAcademicData] = useState<any | null>(null);
  const [loadingAcademicData, setLoadingAcademicData] = useState<boolean>(false);

  const isReadOnly = userRole === 'STUDENT';

  // Parse Bulk Subject Master Excel / CSV File
  const handleSubjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubjectFile(file);
    setSubjectPreviewResult(null);
    setSubjectErrMsg('');
    setSubjectSuccessMsg('');

    setSubjectParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await API.previewSubjectImport(results.data);
          setSubjectPreviewResult(res);
        } catch (err: any) {
          setSubjectErrMsg(err.message || 'Failed to preview Subject Master import.');
        } finally {
          setSubjectParsing(false);
        }
      },
      error: (error) => {
        setSubjectErrMsg(`CSV Parsing Error: ${error.message}`);
        setSubjectParsing(false);
      }
    });
  };

  const handleConfirmSubjectImport = async () => {
    if (!subjectPreviewResult || subjectPreviewResult.validRows.length === 0) return;
    setSubjectConfirming(true);
    setSubjectErrMsg('');
    try {
      const res = await API.confirmSubjectImport(subjectPreviewResult.validRows);
      setSubjectSuccessMsg(`Subject Master import confirmed! ${res.importedCount} subjects updated/saved successfully.`);
      setSubjectPreviewResult(null);
      setSubjectFile(null);
    } catch (err: any) {
      setSubjectErrMsg(err.message || 'Failed to confirm Subject Master import.');
    } finally {
      setSubjectConfirming(false);
    }
  };

  // Parse Bulk Marks Excel / CSV File
  const handleMarksFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMarksFile(file);
    setMarksPreviewResult(null);
    setMarksErrMsg('');
    setMarksSuccessMsg('');

    setMarksParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await API.previewAcademicMarksImport(results.data);
          setMarksPreviewResult(res);
        } catch (err: any) {
          setMarksErrMsg(err.message || 'Failed to preview Bulk Marks Upload.');
        } finally {
          setMarksParsing(false);
        }
      },
      error: (error) => {
        setMarksErrMsg(`CSV Parsing Error: ${error.message}`);
        setMarksParsing(false);
      }
    });
  };

  const handleConfirmMarksImport = async () => {
    if (!marksPreviewResult || marksPreviewResult.validRows.length === 0) return;
    setMarksConfirming(true);
    setMarksErrMsg('');
    try {
      const res = await API.confirmAcademicMarksImport(marksPreviewResult.validRows);
      setMarksSuccessMsg(`Academic Marks imported successfully! ${res.importedCount} marks saved across ${res.updatedStudentsCount} students. Gemini AI Reward Engine scores updated.`);
      setMarksPreviewResult(null);
      setMarksFile(null);
    } catch (err: any) {
      setMarksErrMsg(err.message || 'Failed to confirm Academic Marks import.');
    } finally {
      setMarksConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & SUB-TAB NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Academics Management</h2>
            <p className="text-xs text-slate-400 font-mono">
              Official Subject Master & Authoritative Bulk Marks Upload Module
            </p>
          </div>
        </div>

        {/* SUB-TABS */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('subject-master')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 ${
              activeSubTab === 'subject-master'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Subject Master</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => setActiveSubTab('bulk-marks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 ${
                activeSubTab === 'bulk-marks'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk Marks Upload</span>
            </button>
          )}

          <button
            onClick={() => setActiveSubTab('academic-roster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center space-x-1.5 ${
              activeSubTab === 'academic-roster'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student Roster</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: SUBJECT MASTER */}
      {activeSubTab === 'subject-master' && (
        <div className="space-y-6">
          {/* BULK SUBJECT IMPORT BAR (FACULTY / HOD / ADMIN ONLY) */}
          {!isReadOnly && (
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Bulk Upload Subject Master (Excel / CSV)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-500/40">
                  Required Columns: Subject Code | Subject Title
                </span>
              </div>

              {subjectSuccessMsg && (
                <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 p-3 rounded-xl text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{subjectSuccessMsg}</span>
                </div>
              )}

              {subjectErrMsg && (
                <div className="bg-rose-950/80 border border-rose-500 text-rose-200 p-3 rounded-xl text-xs font-mono flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{subjectErrMsg}</span>
                </div>
              )}

              {/* Upload Input & Button */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="flex-1 w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-950 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer text-xs font-mono text-slate-300 transition-colors">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>{subjectFile ? subjectFile.name : 'Select or Drop Subject Master Excel/CSV File'}</span>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleSubjectFileChange}
                    className="hidden"
                  />
                </label>

                {subjectParsing && (
                  <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating Subject Master...</span>
                  </div>
                )}
              </div>

              {/* Subject Master Preview & Validation Report */}
              {subjectPreviewResult && (
                <div className="space-y-4 pt-2 border-t border-slate-800 animate-in fade-in duration-200">
                  <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">TOTAL ROWS</span>
                      <span className="text-white font-bold text-base">{subjectPreviewResult.summary.totalRowsProcessed}</span>
                    </div>
                    <div className="bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-500/40">
                      <span className="text-emerald-400 block text-[10px]">VALID SUBJECTS</span>
                      <span className="text-emerald-200 font-bold text-base">{subjectPreviewResult.summary.validCount}</span>
                    </div>
                    <div className="bg-rose-950/50 p-2.5 rounded-xl border border-rose-500/40">
                      <span className="text-rose-400 block text-[10px]">INVALID / REJECTED</span>
                      <span className="text-rose-200 font-bold text-base">{subjectPreviewResult.summary.invalidCount}</span>
                    </div>
                  </div>

                  {/* Rejected Rows Table */}
                  {subjectPreviewResult.invalidRows.length > 0 && (
                    <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3 space-y-2">
                      <h4 className="text-xs font-bold text-rose-300 font-mono uppercase">
                        Rejected Rows ({subjectPreviewResult.invalidRows.length})
                      </h4>
                      <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono">
                        {subjectPreviewResult.invalidRows.map((inv, idx) => (
                          <div key={idx} className="flex items-center justify-between text-rose-200 bg-rose-900/20 px-2.5 py-1 rounded">
                            <span>Row {inv.rowNumber}</span>
                            <span className="truncate max-w-md text-rose-300">{inv.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirm Button */}
                  {subjectPreviewResult.validRows.length > 0 && (
                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        onClick={() => setSubjectPreviewResult(null)}
                        className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-mono text-slate-300 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmSubjectImport}
                        disabled={subjectConfirming}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2"
                      >
                        {subjectConfirming ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Confirming Import...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm & Save {subjectPreviewResult.validRows.length} Valid Subjects</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Subject Master Management Table Component */}
          <SubjectManagement
            userRole={userRole}
            assignedYear={assignedYear}
            assignedSection={assignedSection}
          />
        </div>
      )}

      {/* SUB-TAB 2: BULK MARKS UPLOAD */}
      {activeSubTab === 'bulk-marks' && !isReadOnly && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-cyan-400" />
                  <span>Bulk Marks Upload via Excel / CSV</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Authoritative Register Number matching with Subject Master validation & Section isolation check
                </p>
              </div>
              <div className="text-right font-mono text-[10px] text-cyan-300 bg-cyan-950/80 px-3 py-1.5 rounded-xl border border-cyan-500/40">
                Format: Register Number | Subject Code | Subject Title | Marks
              </div>
            </div>

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

            {/* Upload File Box */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <label className="flex-1 w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-slate-950 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer text-xs font-mono text-slate-300 transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <span>{marksFile ? marksFile.name : 'Select or Drop Academic Marks Excel/CSV File'}</span>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleMarksFileChange}
                  className="hidden"
                />
              </label>

              {marksParsing && (
                <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating Register Numbers & Subject Master...</span>
                </div>
              )}
            </div>

            {/* Validation & Preview Report */}
            {marksPreviewResult && (
              <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in duration-200">
                <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">TOTAL ROWS PROCESSED</span>
                    <span className="text-white font-bold text-lg">{marksPreviewResult.summary.totalRowsProcessed}</span>
                  </div>
                  <div className="bg-emerald-950/50 p-3 rounded-xl border border-emerald-500/40">
                    <span className="text-emerald-400 block text-[10px]">VALID MARKS (READY TO IMPORT)</span>
                    <span className="text-emerald-200 font-bold text-lg">{marksPreviewResult.summary.validCount}</span>
                  </div>
                  <div className="bg-rose-950/50 p-3 rounded-xl border border-rose-500/40">
                    <span className="text-rose-400 block text-[10px]">REJECTED ROWS (ERRORS)</span>
                    <span className="text-rose-200 font-bold text-lg">{marksPreviewResult.summary.invalidCount}</span>
                  </div>
                </div>

                {/* Valid Rows Preview */}
                {marksPreviewResult.validRows.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 font-mono uppercase flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valid Marks Preview ({marksPreviewResult.validRows.length})</span>
                    </h4>
                    <div className="max-h-48 overflow-y-auto border border-emerald-500/30 rounded-xl">
                      <table className="w-full text-[11px] font-mono text-left text-slate-300">
                        <thead className="bg-slate-950 text-emerald-400 sticky top-0">
                          <tr>
                            <th className="p-2 border-b border-slate-800">Row</th>
                            <th className="p-2 border-b border-slate-800">Reg No</th>
                            <th className="p-2 border-b border-slate-800">Student Name</th>
                            <th className="p-2 border-b border-slate-800">Subject Code</th>
                            <th className="p-2 border-b border-slate-800">Subject Title</th>
                            <th className="p-2 border-b border-slate-800">Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {marksPreviewResult.validRows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-800/40">
                              <td className="p-2">{r.rowNumber}</td>
                              <td className="p-2 text-cyan-300">{r.registerNo}</td>
                              <td className="p-2 text-white">{r.studentName}</td>
                              <td className="p-2 text-amber-300">{r.subjectCode}</td>
                              <td className="p-2">{r.subjectTitle}</td>
                              <td className="p-2 font-bold text-emerald-400">{r.marks}</td>
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
                      <span>Rejected Rows & Exact Failure Reasons ({marksPreviewResult.invalidRows.length})</span>
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

                {/* Action Buttons */}
                {marksPreviewResult.validRows.length > 0 && (
                  <div className="flex items-center justify-end space-x-3 pt-3">
                    <button
                      onClick={() => setMarksPreviewResult(null)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-mono text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmMarksImport}
                      disabled={marksConfirming}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2"
                    >
                      {marksConfirming ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Importing & Recalculating Scores...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm & Save {marksPreviewResult.validRows.length} Valid Marks</span>
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

      {/* SUB-TAB 3: STUDENT ACADEMIC ROSTER */}
      {activeSubTab === 'academic-roster' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-cyan-400" />
              <span>Student Academic Marks Roster</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {students.length} Students in Assignment
            </span>
          </div>

          {students.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              No students found in current assignment roster.
            </div>
          ) : (
            <>
              {/* MOBILE CARDS (< md) */}
              <div className="md:hidden space-y-3 font-mono">
                {students.map((s) => (
                  <div key={s.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
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
                          {s.cgpa ? Number(s.cgpa).toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">DEPT SCORE</span>
                        <span className="text-emerald-400 font-bold text-sm">
                          {s.overall_score || s.overallScore || 0}/100
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* TABLE (hidden on mobile, visible md+) */}
              <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left text-slate-300 font-mono">
                  <thead className="bg-slate-950 text-cyan-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Register No</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Year / Section</th>
                      <th className="p-3">CGPA</th>
                      <th className="p-3">Overall Department Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/50">
                        <td className="p-3 font-bold text-cyan-300">{s.register_no || s.registerNo}</td>
                        <td className="p-3 text-white">{s.name}</td>
                        <td className="p-3">{s.year} - Sec {s.section}</td>
                        <td className="p-3 font-bold text-amber-300">{s.cgpa ? Number(s.cgpa).toFixed(2) : 'N/A'}</td>
                        <td className="p-3 font-bold text-emerald-400">{s.overall_score || s.overallScore || 0}/100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
