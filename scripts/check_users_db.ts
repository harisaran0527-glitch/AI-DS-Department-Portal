import { db } from '../server/db';

async function testWithDb() {
  const facultyList = db.getFacultyList();
  console.log('Faculty accounts in DB:', facultyList.map(f => ({ email: f.email, identifier: f.identifier, role: f.role, assignedYear: f.assignedYear, assignedSection: f.assignedSection })));
}

testWithDb().catch(console.error);
