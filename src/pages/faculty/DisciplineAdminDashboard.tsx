import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { API } from '../../services/api';

interface DisciplineFaculty {
  id: string;
  email: string;
  name: string;
  is_active: number;
  student_count: number;
}

interface ImportPreviewRow {
  rowNumber: number;
  row: Record<string, string>;
  errors: string[];
  valid: boolean;
}

export const DisciplineAdminDashboard: React.FC = () => {
  const [faculty, setFaculty] = useState<DisciplineFaculty[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [students, setStudents] = useState<Array<{ id: string; registerNo: string; name: string }>>([]);
  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyPassword, setFacultyPassword] = useState('');
  const [registerNumbers, setRegisterNumbers] = useState('');
  const [importRows, setImportRows] = useState<unknown[]>([]);
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshFaculty = async () => {
    const response = await API.getDisciplinePortalFaculty();
    setFaculty(response.faculty);
    setSelectedFaculty(current => response.faculty.some(item => item.id === current)
      ? current
      : response.faculty.find(item => item.is_active === 1)?.id || '');
  };

  const refreshStudents = async (facultyId: string) => {
    if (!facultyId) {
      setStudents([]);
      return;
    }
    const response = await API.getDisciplinePortalFacultyStudents(facultyId);
    setStudents(response.students);
  };

  useEffect(() => {
    refreshFaculty().catch(failure => setError(failure instanceof Error ? failure.message : 'Faculty list could not be loaded.'));
  }, []);

  useEffect(() => {
    refreshStudents(selectedFaculty).catch(failure => setError(failure instanceof Error ? failure.message : 'Assigned students could not be loaded.'));
  }, [selectedFaculty]);

  const run = async (action: () => Promise<void>, successMessage: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const createFaculty = () => run(async () => {
    await API.createDisciplinePortalFaculty({
      name: facultyName.trim(),
      email: facultyEmail.trim(),
      password: facultyPassword
    });
    setFacultyName('');
    setFacultyEmail('');
    setFacultyPassword('');
    await refreshFaculty();
  }, 'Faculty account created.');

  const updateFacultyStatus = (person: DisciplineFaculty) => run(async () => {
    await API.setDisciplinePortalFacultyStatus(person.id, person.is_active !== 1);
    await refreshFaculty();
  }, `Faculty account ${person.is_active === 1 ? 'deactivated' : 'activated'}.`);

  const assignStudents = () => run(async () => {
    const registers = [...new Set(registerNumbers.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean))];
    if (!selectedFaculty || registers.length === 0) throw new Error('Select a faculty member and enter at least one Register Number.');
    const result = await API.assignDisciplinePortalStudents(selectedFaculty, registers);
    setRegisterNumbers('');
    await refreshStudents(selectedFaculty);
    setNotice(`Assigned ${result.assigned.length} student(s); ${result.skipped.length} missing or already assigned.`);
  }, 'Student assignments updated.');

  const loadWorkbook = async (file?: File) => {
    setError('');
    setNotice('');
    setPreview([]);
    setImportRows([]);
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('The workbook does not contain a worksheet.');
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
      if (rows.length === 0) throw new Error('The first worksheet has no student rows.');
      if (rows.length > 5000) throw new Error('Import is limited to 5,000 rows per workbook.');
      setImportRows(rows);
      const result = await API.previewDisciplinePortalStudentImport(selectedFaculty, rows);
      setPreview(result.preview);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The workbook could not be read.');
    }
  };

  const confirmImport = () => run(async () => {
    if (!selectedFaculty || importRows.length === 0 || !preview.some(row => row.valid)) {
      throw new Error('Choose an active faculty member and preview at least one valid student row.');
    }
    const result = await API.confirmDisciplinePortalStudentImport(selectedFaculty, importRows);
    setImportRows([]);
    setPreview([]);
    await refreshFaculty();
    await refreshStudents(selectedFaculty);
    setNotice(`Imported ${result.imported.length} student(s); skipped ${result.skipped.length} invalid row(s); failed ${result.failed.length}.`);
  }, 'Student import processed.');

  return (
    <section className="mb-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-slate-100 shadow-xl md:p-6" aria-labelledby="discipline-admin-title">
      <div className="mb-5">
        <h2 id="discipline-admin-title" className="text-xl font-semibold">Discipline Portal Administration</h2>
        <p className="mt-1 text-sm text-slate-400">Manage portal faculty accounts and assign existing students or import a validated workbook.</p>
      </div>

      {error && <p className="mb-4 rounded-lg border border-rose-700 bg-rose-950/60 p-3 text-sm text-rose-200" role="alert">{error}</p>}
      {notice && <p className="mb-4 rounded-lg border border-emerald-700 bg-emerald-950/50 p-3 text-sm text-emerald-200" role="status">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <form className="space-y-3 rounded-xl border border-slate-700 p-4" onSubmit={event => { event.preventDefault(); void createFaculty(); }}>
          <h3 className="font-medium">Create Faculty Account</h3>
          <input className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" aria-label="Faculty name" autoComplete="off" required minLength={2} maxLength={120} placeholder="Faculty name" value={facultyName} onChange={event => setFacultyName(event.target.value)} />
          <input className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" aria-label="Faculty email" type="email" autoComplete="off" required placeholder="Faculty email" value={facultyEmail} onChange={event => setFacultyEmail(event.target.value)} />
          <input className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" aria-label="Temporary password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} placeholder="Initial password (at least 12 characters)" value={facultyPassword} onChange={event => setFacultyPassword(event.target.value)} />
          <button className="rounded-lg bg-cyan-700 px-4 py-2 font-medium hover:bg-cyan-600 disabled:opacity-50" disabled={busy}>Create account</button>
        </form>

        <div className="space-y-3 rounded-xl border border-slate-700 p-4">
          <h3 className="font-medium">Faculty Accounts</h3>
          {faculty.length === 0 ? <p className="text-sm text-slate-400">No Discipline Portal faculty accounts are configured.</p> : (
            <ul className="max-h-64 space-y-2 overflow-auto">
              {faculty.map(person => (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 p-3">
                  <span className="min-w-0"><strong className="block truncate">{person.name}</strong><span className="text-xs text-slate-400">{person.email} · {person.student_count} students</span></span>
                  <button type="button" className="rounded-md border border-slate-600 px-3 py-1.5 text-sm disabled:opacity-50" disabled={busy} onClick={() => void updateFacultyStatus(person)}>
                    {person.is_active === 1 ? 'Deactivate' : 'Activate'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-700 p-4">
          <h3 className="font-medium">Assign Existing Students</h3>
          <label className="block text-sm text-slate-300" htmlFor="discipline-assignment-faculty">Faculty</label>
          <select id="discipline-assignment-faculty" className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" value={selectedFaculty} onChange={event => setSelectedFaculty(event.target.value)}>
            <option value="">Select faculty</option>
            {faculty.filter(person => person.is_active === 1).map(person => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
          </select>
          <textarea className="min-h-24 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" aria-label="Student Register Numbers" placeholder="Enter Register Numbers separated by commas or new lines" value={registerNumbers} onChange={event => setRegisterNumbers(event.target.value)} />
          <button type="button" className="rounded-lg bg-cyan-700 px-4 py-2 font-medium hover:bg-cyan-600 disabled:opacity-50" disabled={busy} onClick={() => void assignStudents()}>Assign existing students</button>
          <p className="text-sm text-slate-400">Currently assigned: {students.length}</p>
          <ul className="max-h-36 space-y-1 overflow-auto text-sm text-slate-300">{students.map(student => <li key={student.id}>{student.registerNo} · {student.name}</li>)}</ul>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-700 p-4">
          <h3 className="font-medium">Import Student Workbook</h3>
          <p className="text-xs text-slate-400">Required columns: Name, Register Number, College Mail ID, Year, Section, Department. Existing Register Numbers and email addresses are rejected.</p>
          <label className="block text-sm text-slate-300" htmlFor="discipline-import-faculty">Assign imported students to</label>
          <select id="discipline-import-faculty" className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" value={selectedFaculty} onChange={event => setSelectedFaculty(event.target.value)}>
            <option value="">Select faculty</option>
            {faculty.filter(person => person.is_active === 1).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <input className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2" type="file" accept=".xlsx,.xls,.csv" aria-label="Student Excel workbook" disabled={!selectedFaculty || busy} onChange={event => void loadWorkbook(event.target.files?.[0])} />
          {preview.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-lg border border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-800"><tr><th className="p-2">Row</th><th className="p-2">Student</th><th className="p-2">Validation</th></tr></thead>
                <tbody>{preview.map(item => <tr key={item.rowNumber} className="border-t border-slate-800">
                  <td className="p-2">{item.rowNumber}</td><td className="p-2">{item.row.name || item.row.Name || '—'} · {item.row.registerNo || item.row['Register Number'] || '—'}</td>
                  <td className={`p-2 ${item.valid ? 'text-emerald-300' : 'text-rose-300'}`}>{item.valid ? 'Ready' : item.errors.join(' ')}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
          <button type="button" className="rounded-lg bg-emerald-700 px-4 py-2 font-medium hover:bg-emerald-600 disabled:opacity-50" disabled={busy || preview.length === 0 || !preview.some(item => item.valid)} onClick={() => void confirmImport()}>Confirm valid rows</button>
        </div>
      </div>
    </section>
  );
};
