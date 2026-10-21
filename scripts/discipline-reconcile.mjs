import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const regNo = value => String(value ?? '').trim().toUpperCase();
const year = value => ({ I: '1', II: '2', III: '3', IV: '4', '1ST YEAR': '1', '2ND YEAR': '2', '3RD YEAR': '3', '4TH YEAR': '4' }[regNo(value)] || regNo(value));
const section = value => regNo(value).replace(/^(SECTION|SEC\.?)\s*/, '');
const department = value => regNo(value).replace(/[\s&]/g, '');
const fingerprint = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Offline reconciliation only. All unmatched/conflicting identities require owner resolution. */
export function reconcile(source, destination) {
  for (const [name, value] of Object.entries({ sourceStudents: source.students,
    sourceIncidents: source.discipline_incidents, destinationStudents: destination.students,
    destinationRecords: destination.discipline_records })) {
    if (!Array.isArray(value)) throw new Error(`${name} must be an array in the authorized export.`);
  }
  const index = new Map();
  for (const student of destination.students) {
    const key = regNo(student.registerNo ?? student.register_no ?? student.regNo);
    if (key) index.set(key, [...(index.get(key) || []), student]);
  }
  const sourceIndex = new Map();
  for (const student of source.students) {
    if (!student.id) throw new Error('Every exported source student must include its Firestore document id.');
    if (sourceIndex.has(student.id)) throw new Error('Duplicate source student document id.');
    sourceIndex.set(student.id, student);
  }
  const seenRegisters = new Map();
  for (const student of source.students) {
    const key = regNo(student.regNo);
    seenRegisters.set(key, (seenRegisters.get(key) || 0) + 1);
  }
  const seenIncidents = new Set();
  const records = source.discipline_incidents.map(incident => {
    if (!incident.id || seenIncidents.has(incident.id)) throw new Error('Missing or duplicate source incident document id.');
    seenIncidents.add(incident.id);
    const originalStudent = sourceIndex.get(incident.studentId);
    const key = regNo(incident.regNo);
    const result = { sourceIncidentId: incident.id, sourceFingerprint: fingerprint(incident) };
    if (!originalStudent) return { ...result, status: 'missing-source-student' };
    if (!key || key !== regNo(originalStudent.regNo)) return { ...result, status: 'source-identity-conflict' };
    if (seenRegisters.get(key) > 1) return { ...result, status: 'duplicate-source-register' };
    const candidates = index.get(key) || [];
    if (candidates.length !== 1) return { ...result, status: candidates.length ? 'duplicate-destination-register' : 'unmatched-student' };
    const student = candidates[0];
    for (const [field, normalize] of [['year', year], ['section', section], ['department', department]]) {
      if (!normalize(incident[field]) || !normalize(originalStudent[field]) || !normalize(student[field]) ||
          normalize(incident[field]) !== normalize(originalStudent[field]) || normalize(originalStudent[field]) !== normalize(student[field])) {
        return { ...result, status: `${field}-conflict` };
      }
    }
    // Without provenance, similar-looking rows cannot safely be classified as already migrated.
    const possibleExisting = destination.discipline_records.filter(record => record.student_id === student.id &&
      record.date === incident.dateString && record.category === incident.violationType);
    return { ...result, destinationStudentId: student.id,
      status: possibleExisting.length ? 'existing-record-review-required' : 'identity-matched-awaiting-migration' };
  });
  return { mode: 'offline-read-only', sourceFingerprint: fingerprint(source),
    counts: { sourceStudents: source.students.length, sourceIncidents: records.length,
      destinationStudents: destination.students.length, destinationRecords: destination.discipline_records.length },
    summary: records.reduce((counts, record) => ({ ...counts, [record.status]: (counts[record.status] || 0) + 1 }), {}),
    records, migrated: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [sourcePath, destinationPath, outputPath] = process.argv.slice(2);
  if (!sourcePath || !destinationPath || !outputPath) {
    console.error('Usage: node scripts/discipline-reconcile.mjs <authorized-source.json> <destination-snapshot.json> <new-report.json>');
    process.exitCode = 1;
  } else {
    const report = reconcile(JSON.parse(fs.readFileSync(sourcePath, 'utf8')), JSON.parse(fs.readFileSync(destinationPath, 'utf8')));
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ counts: report.counts, summary: report.summary, migrated: 0 }));
  }
}
