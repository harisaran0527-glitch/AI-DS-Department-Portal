import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../../services/api';
import type { Subject } from '../../types';
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Filter,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  GraduationCap
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

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDepartment, setFormDepartment] = useState<string>('AI & Data Science');
  const [formAcademicYear, setFormAcademicYear] = useState<string>('2025-2026');
  const [formYear, setFormYear] = useState<string>(assignedYear && assignedYear !== 'ALL' ? assignedYear : '2nd Year');
  const [formSemester, setFormSemester] = useState<number>(4);
  const [formSection, setFormSection] = useState<string>(assignedSection && assignedSection !== 'ALL' ? assignedSection : 'A');
  const [formType, setFormType] = useState<'Theory' | 'Practical' | 'Elective'>('Theory');
  const [formCredits, setFormCredits] = useState<number>(3);
  const [formFacultyHandler, setFormFacultyHandler] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

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

  const isReadOnly = userRole === 'STUDENT';

  const handleOpenAddModal = () => {
    setEditingSubject(null);
    setFormCode('');
    setFormName('');
    setFormDepartment('AI & Data Science');
    setFormAcademicYear('2025-2026');
    setFormYear(assignedYear && assignedYear !== 'ALL' ? assignedYear : '2nd Year');
    setFormSemester(4);
    setFormSection(assignedSection && assignedSection !== 'ALL' ? assignedSection : 'A');
    setFormType('Theory');
    setFormCredits(3);
    setFormFacultyHandler('');
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setFormCode(sub.subjectCode || sub.subject_code || '');
    setFormName(sub.subjectName || sub.subject_name || '');
    setFormDepartment(sub.department || 'AI & Data Science');
    setFormAcademicYear(sub.academicYear || sub.academic_year || '2025-2026');
    setFormYear(sub.year || '2nd Year');
    setFormSemester(sub.semester || 4);
    setFormSection(sub.section || 'A');
    setFormType(sub.subjectType || sub.subject_type || 'Theory');
    setFormCredits(sub.credits || 3);
    setFormFacultyHandler(sub.facultyHandler || sub.faculty_handler || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError('Subject Code is required.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Subject Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<Subject> = {
        subjectCode: formCode.trim().toUpperCase(),
        subjectName: formName.trim(),
        department: formDepartment.trim() || 'AI & Data Science',
        academicYear: formAcademicYear.trim() || '2025-2026',
        year: formYear,
        semester: Number(formSemester),
        section: formSection,
        subjectType: formType,
        credits: Number(formCredits) || 3,
        facultyHandler: formFacultyHandler.trim() || 'TBD'
      };

      if (editingSubject) {
        const res = await API.updateSubject(editingSubject.id, payload);
        setSuccessMsg(res.message || 'Subject updated successfully.');
      } else {
        const res = await API.addSubject(payload);
        setSuccessMsg(res.message || 'Subject added successfully.');
      }

      setShowModal(false);
      await fetchSubjects();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save subject record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await API.deleteSubject(deleteTarget.id);
      setSuccessMsg(`Subject "${deleteTarget.subjectCode || deleteTarget.subject_code}" deleted.`);
      setDeleteTarget(null);
      await fetchSubjects();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete subject.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const code = (s.subjectCode || s.subject_code || '').toLowerCase();
      const name = (s.subjectName || s.subject_name || '').toLowerCase();
      const handler = (s.facultyHandler || s.faculty_handler || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || code.includes(q) || name.includes(q) || handler.includes(q);
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
              <span>Academic Subjects & Course Curriculum</span>
            </h3>
            <p className="text-xs text-[#D9DEFF] font-mono mt-0.5">
              Manage department subject offerings, credits, faculty handlers, and academic syllabus mappings.
            </p>
          </div>

          {!isReadOnly && (
            <button
              onClick={handleOpenAddModal}
              className="btn-action bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-transform duration-200 shadow-md cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Subject</span>
            </button>
          )}
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
              placeholder="Search Code, Subject, Faculty..."
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
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
              <option value="7">Semester 7</option>
              <option value="8">Semester 8</option>
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

        {/* SUBJECTS TABLE */}
        <div className="overflow-x-auto rounded-xl border border-white/14 bg-[#3039A8] shadow-inner">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#252B86] text-[#D9DEFF] border-b border-white/14 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Code</th>
                <th className="py-3 px-3.5">Subject Name</th>
                <th className="py-3 px-3.5">Year / Sem / Sec</th>
                <th className="py-3 px-3.5">Type</th>
                <th className="py-3 px-3.5 text-center">Credits</th>
                <th className="py-3 px-3.5">Faculty Handler</th>
                <th className="py-3 px-3.5 text-[#D9DEFF]">Academic Year</th>
                {!isReadOnly && <th className="py-3 px-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/14">
              {isLoading ? (
                <tr>
                  <td colSpan={isReadOnly ? 7 : 8} className="py-8 text-center text-[#AEB7F5]">
                    Loading registered subjects...
                  </td>
                </tr>
              ) : filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 7 : 8} className="py-8 text-center text-[#AEB7F5]">
                    No subjects found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub) => {
                  const code = sub.subjectCode || sub.subject_code;
                  const name = sub.subjectName || sub.subject_name;
                  const acadYear = sub.academicYear || sub.academic_year || '2025-2026';
                  const type = sub.subjectType || sub.subject_type || 'Theory';
                  const handler = sub.facultyHandler || sub.faculty_handler || 'TBD';

                  return (
                    <tr key={sub.id} className="hover:bg-[#3F4BDA] transition-colors">
                      <td className="py-3 px-3.5 font-bold text-cyan-300">{code}</td>
                      <td className="py-3 px-3.5 text-white font-bold font-sans text-sm">{name}</td>
                      <td className="py-3 px-3.5 text-[#D9DEFF] font-bold">
                        {sub.year} • Sem {sub.semester} • Sec {sub.section}
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
                      <td className="py-3 px-3.5 text-[#D9DEFF] font-sans text-xs">{handler}</td>
                      <td className="py-3 px-3.5 text-[#AEB7F5]">{acadYear}</td>
                      {!isReadOnly && (
                        <td className="py-3 px-3.5 text-right space-x-2 font-sans">
                          <button
                            onClick={() => handleOpenEditModal(sub)}
                            className="bg-[#252B86] hover:bg-[#3F4BDA] text-cyan-200 border border-white/14 px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(sub)}
                            className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT SUBJECT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B205F]/85 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#252B86] border border-white/14 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 text-white">
            {/* MODAL HEADER */}
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-base">
                <BookOpen className="w-5 h-5" />
                <span>{editingSubject ? 'Edit Subject Details' : 'Add New Subject'}</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSaveSubject} className="p-6 space-y-4 text-xs font-mono">
              {formError && (
                <div className="bg-red-950/80 border border-red-800 text-red-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subject Code */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Subject Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AD3401"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono focus:border-indigo-500 uppercase"
                  />
                </div>

                {/* Subject Name */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Subject Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures and Algorithms"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Department */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Department</label>
                  <input
                    type="text"
                    readOnly
                    value={formDepartment}
                    className="w-full bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl text-slate-400 font-sans cursor-not-allowed"
                  />
                </div>

                {/* Academic Year */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Academic Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2025-2026"
                    value={formAcademicYear}
                    onChange={(e) => setFormAcademicYear(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Year */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Year</label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                {/* Semester */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Semester</label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Section</label>
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="ALL">ALL Sections</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Subject Type */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Subject Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                  >
                    <option value="Theory">Theory</option>
                    <option value="Practical">Practical</option>
                    <option value="Elective">Elective</option>
                  </select>
                </div>

                {/* Credits */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formCredits}
                    onChange={(e) => setFormCredits(Number(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                  />
                </div>

                {/* Faculty Handler */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Faculty / Subject Handler</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. A. Raman / Prof. Priya"
                    value={formFacultyHandler}
                    onChange={(e) => setFormFacultyHandler(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-sans"
                  />
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs font-sans cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-action bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold px-5 py-2 rounded-xl text-xs font-sans transition-transform duration-200 transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none cursor-pointer shadow-lg flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Subject...</span>
                    </>
                  ) : (
                    <span>{editingSubject ? 'Update Subject' : 'Save Subject'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <h4 className="text-base font-bold text-white">Delete Subject Confirmation</h4>
            </div>

            {deleteError && (
              <div className="bg-red-950/80 border border-red-800/80 text-red-300 p-2.5 rounded-xl flex items-center space-x-2 font-mono text-[11px] animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              Are you sure you want to delete subject <strong className="text-sky-400">{deleteTarget.subjectCode || deleteTarget.subject_code}</strong> — {deleteTarget.subjectName || deleteTarget.subject_name}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="btn-action bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl font-bold cursor-pointer transition-transform duration-200 transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubject}
                disabled={isDeleting}
                className="btn-action bg-red-600 hover:bg-red-500 text-white text-xs px-4 py-2 rounded-xl font-bold cursor-pointer transition-transform duration-200 transform-gpu hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-75 disabled:cursor-not-allowed motion-reduce:transform-none flex items-center space-x-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
