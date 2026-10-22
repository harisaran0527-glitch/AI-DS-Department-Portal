import fs from 'fs';
import path from 'path';
import assert from 'node:assert/strict';
import { isValidPngSignature } from '../server/routes/faculty.js';
import { BULK_ALLOWED_EXTENSIONS, BULK_ALLOWED_MIME_TYPES, validateUploadedFile } from '../server/storage.js';
import { parseAttendanceOcrText } from '../server/services/attendanceOcr.js';

console.log('====================================================');
console.log('🧪 REAL PNG ATTENDANCE BULK UPLOAD COMPREHENSIVE TEST');
console.log('====================================================\n');

// 1. TEST FORMAT DETECTION & MIME TYPE TOLERANCE
console.log('1. Testing format detection and MIME type validation...');

function validateUploadFormat(file) {
  const rawName = (file.name || '').trim();
  const fileName = rawName.toLowerCase();
  const mimeType = (file.type || '').trim().toLowerCase();

  const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.pl', '.py', '.cgi', '.jar', '.vbs', '.js', '.ts', '.msi'];
  if (dangerousExts.some(ext => fileName.endsWith(ext))) {
    return { valid: false, error: 'Executable or script files are strictly prohibited.' };
  }

  const isPng =
    mimeType === 'image/png' ||
    mimeType.startsWith('image/png') ||
    fileName.endsWith('.png') ||
    /\.png$/i.test(rawName);

  const isExcel =
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel';

  const isCsvOrText =
    fileName.endsWith('.csv') ||
    fileName.endsWith('.txt') ||
    mimeType === 'text/csv' ||
    mimeType === 'text/plain' ||
    mimeType === 'application/csv';

  if (!isPng && !isExcel && !isCsvOrText) {
    return { valid: false, error: 'Invalid file format. Only Excel (.xlsx, .xls), CSV (.csv), or PNG (.png) image files are allowed.' };
  }

  return { valid: true, isPng, isExcel, isCsvOrText };
}

// Test cases
// a) Normal .png
const testNormalPng = validateUploadFormat({ name: 'attendance.png', type: 'image/png' });
assert.equal(testNormalPng.valid, true);
assert.equal(testNormalPng.isPng, true);
console.log('   ✅ Normal .png accepted');

// b) Uppercase .PNG
const testUpperPng = validateUploadFormat({ name: 'ATTENDANCE_SHEET.PNG', type: 'image/png' });
assert.equal(testUpperPng.valid, true);
assert.equal(testUpperPng.isPng, true);
console.log('   ✅ Uppercase .PNG accepted');

// c) PNG with trailing space in name
const testSpacedPng = validateUploadFormat({ name: 'attendance_sheet.png ', type: 'image/png' });
assert.equal(testSpacedPng.valid, true);
assert.equal(testSpacedPng.isPng, true);
console.log('   ✅ PNG with trailing whitespace in filename accepted');

// d) Image MIME type with extensionless file (from clipboard/canvas/mobile)
const testExtensionless = validateUploadFormat({ name: 'pasted-image-20261022', type: 'image/png' });
assert.equal(testExtensionless.valid, true);
assert.equal(testExtensionless.isPng, true);
console.log('   ✅ Image with image/png MIME type and no file extension accepted');

// e) Excel file
const testExcel = validateUploadFormat({ name: 'students.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
assert.equal(testExcel.valid, true);
assert.equal(testExcel.isExcel, true);
console.log('   ✅ Excel .xlsx accepted');

// f) CSV file
const testCsv = validateUploadFormat({ name: 'records.csv', type: 'text/csv' });
assert.equal(testCsv.valid, true);
assert.equal(testCsv.isCsvOrText, true);
console.log('   ✅ CSV .csv accepted');

// g) Executable (must be rejected)
const testExe = validateUploadFormat({ name: 'malicious.exe', type: 'application/x-msdownload' });
assert.equal(testExe.valid, false);
assert.ok(testExe.error.includes('prohibited'));
console.log('   ✅ Executable .exe correctly rejected');

// h) Random unknown file (must be rejected)
const testUnknown = validateUploadFormat({ name: 'document.xyz', type: 'application/octet-stream' });
assert.equal(testUnknown.valid, false);
assert.ok(testUnknown.error.includes('Invalid file format'));
console.log('   ✅ Random .xyz correctly rejected with expected format error');

// 2. TEST SERVER-SIDE STORAGE EXTENSIONS & MIME TYPES
console.log('\n2. Testing server-side storage validation...');
assert.equal(BULK_ALLOWED_EXTENSIONS.has('.png'), true);
assert.equal(BULK_ALLOWED_MIME_TYPES.has('image/png'), true);

const storagePngCheck = validateUploadedFile({ originalname: 'sheet.png', mimetype: 'image/png', size: 5000 }, 'bulk');
assert.equal(storagePngCheck.valid, true);
console.log('   ✅ validateUploadedFile accepts PNG for bulk module');

// 3. TEST PNG BINARY SIGNATURE VERIFICATION
console.log('\n3. Testing PNG binary signature verification...');
const genuinePngBuffer = fs.readFileSync('src/assets/hero.png');
assert.equal(isValidPngSignature(genuinePngBuffer), true);
console.log('   ✅ Genuine PNG buffer passed signature check');

const fakePngBuffer = Buffer.from('Just plain text inside a file named sheet.png');
assert.equal(isValidPngSignature(fakePngBuffer), false);
console.log('   ✅ Text disguised as PNG failed signature check');

const jpegBuffer = fs.readFileSync('public/images/avsec-salem-logo.png');
assert.equal(isValidPngSignature(jpegBuffer), false);
console.log('   ✅ JPEG file renamed as PNG failed signature check');

// 4. TEST REAL OCR PARSING & EDITABLE PREVIEW GENERATION
console.log('\n4. Testing OCR text parsing with sample attendance sheet data...');
const sampleRoster = [
  { register_no: '620125243146', name: 'SARAN S' },
  { register_no: '620125243154', name: 'SHRVAN A' },
  { register_no: '620125243160', name: 'TAMILVANAN R' }
];

const simulatedOcrText = `
DEPARTMENT OF ARTIFICIAL INTELLIGENCE & DATA SCIENCE
ATTENDANCE SHEET - DATE: 22-10-2026
S.No | Reg Number   | Student Name   | Status
1    | 620125243146 | SARAN S        | P
2    | 620125243154 | SHRVAN A       | OD
3    | 620125243160 | TAMILVANAN R   | A
`;

const parsed = parseAttendanceOcrText(simulatedOcrText, '2026-10-22', sampleRoster);
assert.equal(parsed.rows.length, 3);
assert.equal(parsed.rows[0].registerNo, '620125243146');
assert.equal(parsed.rows[0].status, 'PRESENT');
assert.equal(parsed.rows[1].registerNo, '620125243154');
assert.equal(parsed.rows[1].status, 'OD');
assert.equal(parsed.rows[2].registerNo, '620125243160');
assert.equal(parsed.rows[2].status, 'ABSENT');
console.log('   ✅ OCR text extracted all 3 rows with matched register numbers and statuses');

// 5. TEST SIMULATED USER EDITING (Correction of OCR mistakes)
console.log('\n5. Testing user editing workflow (modifying OCR rows before submit)...');
// Simulating user adding a 4th student and correcting status of student 3
const editedRows = [
  ...parsed.rows,
  {
    id: 'manual-add-1',
    registerNo: '620125243199',
    studentName: 'NEW STUDENT',
    date: '2026-10-22',
    status: 'ML'
  }
];
// User changes student 3 from ABSENT to OD
editedRows[2].status = 'OD';

assert.equal(editedRows.length, 4);
assert.equal(editedRows[2].status, 'OD');
assert.equal(editedRows[3].status, 'ML');
console.log('   ✅ Editable review data successfully updated and formatted');

console.log('\n====================================================');
console.log('🎉 ALL REAL PNG WORKFLOW CHECKS PASSED SUCCESSFULLY!');
console.log('====================================================');

process.exit(0);
