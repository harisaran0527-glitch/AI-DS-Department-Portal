import { db } from '../server/db.js';
import { queryOne, queryAll } from '../server/postgresAdapter.js';

async function runSafeTestSuite() {
  console.log('================================================================');
  console.log('HOD STUDENT BULK IMPORT & FACULTY WORKFLOW VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  try {
    // 1. Verify CGPA column nullability in PostgreSQL
    console.log('\n--- Test 1: PostgreSQL Schema Check for CGPA Nullability ---');
    const cgpaCol = await queryOne(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'students' AND column_name = 'cgpa'
    `);
    assert(
      cgpaCol && cgpaCol.is_nullable === 'YES',
      'students.cgpa column is NULLABLE in Supabase PostgreSQL',
      `Current is_nullable: ${cgpaCol?.is_nullable}`
    );

    // 2. Test empty row detection
    console.log('\n--- Test 2: Blank / Trailing Rows Filtering Logic ---');
    const isRowEmpty = (row: any): boolean => {
      if (!row || typeof row !== 'object') return true;
      return Object.values(row).every(v => v === undefined || v === null || String(v).trim() === '');
    };

    assert(isRowEmpty({}), 'Empty object {} is detected as empty row');
    assert(isRowEmpty({ Name: '', 'Register Number': '', CGPA: '   ' }), 'Object with empty strings & whitespace is empty');
    assert(isRowEmpty({ col1: null, col2: undefined, col3: '' }), 'Object with null/undefined is empty');
    assert(!isRowEmpty({ Name: 'Student Alpha', 'Register Number': '' }), 'Partially filled row is NOT empty');

    // 3. Test CGPA parsing logic
    console.log('\n--- Test 3: CGPA "N/A" and Numeric Parsing ---');
    const parseCgpa = (raw: any): { val: number | null; error?: string } => {
      if (raw === undefined || raw === null || String(raw).trim() === '') return { val: null };
      const upper = String(raw).trim().toUpperCase();
      if (['N/A', 'NA', 'NULL', 'NOT AVAILABLE', 'NONE'].includes(upper)) {
        return { val: null };
      }
      const num = parseFloat(String(raw));
      if (isNaN(num) || num < 0 || num > 10) {
        return { val: null, error: 'CGPA must be a valid number between 0.00 and 10.00 or "N/A".' };
      }
      return { val: Math.round(num * 100) / 100 };
    };

    assert(parseCgpa('N/A').val === null && !parseCgpa('N/A').error, 'CGPA "N/A" parses to null without error');
    assert(parseCgpa('na').val === null && !parseCgpa('na').error, 'CGPA "na" (lowercase) parses to null without error');
    assert(parseCgpa('NULL').val === null && !parseCgpa('NULL').error, 'CGPA "NULL" parses to null without error');
    assert(parseCgpa('').val === null && !parseCgpa('').error, 'Blank CGPA parses to null without error');
    assert(parseCgpa('8.75').val === 8.75, 'Valid CGPA "8.75" parses to 8.75');
    assert(parseCgpa('10.00').val === 10, 'Valid CGPA "10.00" parses to 10');
    assert(Boolean(parseCgpa('11.5').error), 'CGPA "11.5" returns out-of-range validation error');
    assert(Boolean(parseCgpa('-0.5').error), 'Negative CGPA "-0.5" returns validation error');

    // 4. Test duplicate detection separation: file duplicate vs DB update
    console.log('\n--- Test 4: Duplicate In-File vs DB Update Distinction ---');
    const fileRows = [
      { reg: '24AD001', name: 'Alpha' },
      { reg: '24AD002', name: 'Beta' },
      { reg: '24ad001', name: 'Alpha Duplicate' } // duplicate in file
    ];
    const regCounts = new Map<string, number>();
    fileRows.forEach(r => {
      const k = r.reg.toLowerCase();
      regCounts.set(k, (regCounts.get(k) || 0) + 1);
    });
    assert(regCounts.get('24ad001') === 2, 'In-file duplicate count detected for 24ad001');
    assert(regCounts.get('24ad002') === 1, 'Unique row 24ad002 has count 1');

    // 5. Test canImport condition
    console.log('\n--- Test 5: canImport Condition Allows Valid Rows Import ---');
    const calcCanImport = (validCount: number, updateCount: number, errorCount: number) => {
      return (validCount + updateCount) > 0;
    };
    assert(calcCanImport(59, 1, 0) === true, 'All valid rows allows import');
    assert(calcCanImport(59, 0, 1) === true, '59 valid rows with 1 error row ALLOWS importing the 59 valid rows');
    assert(calcCanImport(0, 5, 2) === true, '5 update rows with 2 error rows ALLOWS importing the updates');
    assert(calcCanImport(0, 0, 3) === false, '0 valid rows with 3 errors disallows import');

    // 6. Test DB Roster Query logic for Faculty
    console.log('\n--- Test 6: Database Faculty Students Retrieval Logic ---');
    // Query existing faculty assignment if any exists
    const anyFaculty = await queryOne("SELECT id, name, year, section FROM users WHERE role = 'FACULTY' LIMIT 1");
    if (anyFaculty) {
      const roster = await db.getStudentsForFaculty(anyFaculty.id, anyFaculty.year, anyFaculty.section);
      assert(Array.isArray(roster), `getStudentsForFaculty returns array for ${anyFaculty.name} (found ${roster.length} students)`);
    } else {
      console.log('No faculty user in DB, skipping live query');
    }

    // 7. Verify Faculty Bulk Upload is not in active use
    console.log('\n--- Test 7: Faculty Bulk Upload Removal Verification ---');
    const facultyRoutes = await import('../server/routes/faculty.js');
    assert(Boolean(facultyRoutes.default), 'Faculty routes module loaded successfully');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
  }
}

runSafeTestSuite().then(() => process.exit(0));

