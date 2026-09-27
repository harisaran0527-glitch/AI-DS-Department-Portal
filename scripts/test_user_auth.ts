import { db } from '../server/db';

async function testAuth() {
  const users = db.getFacultyList ? [] : [];
  console.log('Testing findUserByIdentifier:');
  const fac1 = db.findUserByIdentifier('ad620125243146', 'FACULTY');
  console.log('fac1:', fac1 ? { id: fac1.id, email: fac1.email, role: fac1.role } : null);

  const fac2 = db.findUserByIdentifier('cc_a_90555', 'FACULTY');
  console.log('fac2:', fac2 ? { id: fac2.id, email: fac2.email, role: fac2.role } : null);

  const hod = db.findUserByIdentifier('departmentai&ds@gmail.com', 'HOD');
  console.log('hod:', hod ? { id: hod.id, email: hod.email, role: hod.role } : null);

  const admin = db.findUserByIdentifier('admin', 'ADMIN');
  console.log('admin:', admin ? { id: admin.id, email: admin.email, role: admin.role } : null);
}

testAuth().catch(console.error);
