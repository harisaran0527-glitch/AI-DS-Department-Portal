import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcile } from '../scripts/discipline-reconcile.mjs';

const student = { id: 'source-s1', regNo: '001', name: 'Offline fixture', year: 'II', section: 'A', department: 'AI&DS' };
const incident = { id: 'source-i1', studentId: student.id, regNo: '001', year: 'II', section: 'A', department: 'AI&DS', dateString: '2026-10-01', violationType: 'Late Arrival' };
const target = { id: 'destination-s1', register_no: '001', year: '2nd Year', section: 'A', department: 'AI & DS' };
const run = (sourceStudent = student, sourceIncident = incident, targets = [target], records = []) =>
  reconcile({ students: [sourceStudent], discipline_incidents: [sourceIncident] }, { students: targets, discipline_records: records });
test('maps exact normalized register numbers and preserves leading zeros without writing', () => {
  const result = run();
  assert.equal(result.records[0].destinationStudentId, target.id);
  assert.equal(result.records[0].status, 'identity-matched-awaiting-migration');
  assert.equal(result.migrated, 0);
  assert.equal(run(student, incident, [{ ...target, register_no: '1' }]).records[0].status, 'unmatched-student');
});
test('never maps students by similar names and reports duplicates', () => {
  assert.equal(run(student, incident, [{ ...target, name: student.name, register_no: '999' }]).records[0].status, 'unmatched-student');
  assert.equal(run(student, incident, [target, { ...target, id: 'duplicate' }]).records[0].status, 'duplicate-destination-register');
});
test('blocks historical academic conflicts and missing source relationships', () => {
  assert.equal(run(student, { ...incident, year: 'III' }).records[0].status, 'year-conflict');
  assert.equal(run(student, { ...incident, studentId: 'missing' }).records[0].status, 'missing-source-student');
  assert.equal(run(student, { ...incident, regNo: '002' }).records[0].status, 'source-identity-conflict');
});
test('existing destination records require review rather than duplicate insertion', () => {
  assert.equal(run(student, incident, [target], [{ student_id: target.id, date: incident.dateString, category: incident.violationType }])
    .records[0].status, 'existing-record-review-required');
});
test('reconciliation is repeatable and preserves the original export', () => {
  const original = JSON.stringify({ student, incident, target });
  assert.deepEqual(run(), run());
  assert.equal(JSON.stringify({ student, incident, target }), original);
});
