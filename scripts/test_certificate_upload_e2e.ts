import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';

async function runCertificateE2ETests() {
  console.log('🧪 Starting Certificate Upload E2E & Persistence Audit...');

  try {
    // 1. Fetch an existing student for testing
    const students = await db.getAllStudents();
    if (!students || students.length === 0) {
      throw new Error('No students found in database to perform test on.');
    }
    const testStudent = students[0];
    console.log(`📌 Test Student: ${testStudent.name} (${testStudent.register_no || testStudent.id})`);

    // 2. Prepare sample files: PDF, JPG, PNG
    const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const testPdfName = `test-cert-${Date.now()}.pdf`;
    const testJpgName = `test-cert-${Date.now()}.jpg`;
    const testPngName = `test-cert-${Date.now()}.png`;

    const pdfPath = path.join(uploadsDir, testPdfName);
    const jpgPath = path.join(uploadsDir, testJpgName);
    const pngPath = path.join(uploadsDir, testPngName);

    fs.writeFileSync(pdfPath, '%PDF-1.4 Fake PDF Content for Certificate E2E Testing');
    fs.writeFileSync(jpgPath, 'Fake JPG Image Content');
    fs.writeFileSync(pngPath, 'Fake PNG Image Content');

    // 3. Test PDF Certificate Upload & DB Persistence
    console.log('🔹 Testing PDF Certificate Upload...');
    const pdfCertId = await db.saveCertificateUpload({
      studentId: testStudent.id,
      courseName: 'AWS Certified Solutions Architect',
      platform: 'Amazon Web Services',
      category: 'Cloud Certification',
      issueDate: '2026-03-15',
      filePath: testPdfName,
      originalFileName: 'aws_solutions_architect.pdf'
    });
    console.log(`✅ PDF Certificate created with ID: ${pdfCertId}`);

    // 4. Test JPG Certificate Upload & DB Persistence
    console.log('🔹 Testing JPG Certificate Upload...');
    const jpgCertId = await db.saveCertificateUpload({
      studentId: testStudent.id,
      courseName: 'Deep Learning Specialization',
      platform: 'Coursera',
      category: 'AI/ML Certification',
      issueDate: '2026-04-10',
      filePath: testJpgName,
      originalFileName: 'deep_learning_cert.jpg'
    });
    console.log(`✅ JPG Certificate created with ID: ${jpgCertId}`);

    // 5. Test PNG Certificate Upload & DB Persistence
    console.log('🔹 Testing PNG Certificate Upload...');
    const pngCertId = await db.saveCertificateUpload({
      studentId: testStudent.id,
      courseName: 'Full Stack Development',
      platform: 'SkillEdge',
      category: 'Web Development',
      issueDate: '2026-05-01',
      filePath: testPngName,
      originalFileName: 'fullstack_cert.png'
    });
    console.log(`✅ PNG Certificate created with ID: ${pngCertId}`);

    // 6. Verify Student Mapping & Database Record Retrieval
    console.log('🔹 Verifying Student 360 persistence...');
    const student360 = await db.getStudent360(testStudent.id);
    if (!student360 || !Array.isArray(student360.certificates)) {
      throw new Error('Failed to retrieve Student 360 certificates list.');
    }

    const foundPdf = student360.certificates.find((c: any) => c.id === pdfCertId);
    const foundJpg = student360.certificates.find((c: any) => c.id === jpgCertId);
    const foundPng = student360.certificates.find((c: any) => c.id === pngCertId);

    if (!foundPdf || foundPdf.file_path !== testPdfName) {
      throw new Error('PDF Certificate record missing or file_path mismatched in Student 360.');
    }
    if (!foundJpg || foundJpg.file_path !== testJpgName) {
      throw new Error('JPG Certificate record missing or file_path mismatched in Student 360.');
    }
    if (!foundPng || foundPng.file_path !== testPngName) {
      throw new Error('PNG Certificate record missing or file_path mismatched in Student 360.');
    }
    console.log('✅ All 3 certificates mapped and retrieved from database successfully.');

    // 7. Verify Direct Certificate Retrieval & File Existence
    console.log('🔹 Verifying direct getCertificateById and physical storage...');
    const certRecord = await db.getCertificateById(pdfCertId);
    if (!certRecord) {
      throw new Error(`getCertificateById returned null for ID: ${pdfCertId}`);
    }
    const physicalFileExists = fs.existsSync(path.join(uploadsDir, certRecord.file_path));
    if (!physicalFileExists) {
      throw new Error(`Physical certificate file missing on disk: ${certRecord.file_path}`);
    }
    console.log('✅ Direct DB record and physical file on server storage verified.');

    // 8. Test Certificate Update (File replacement)
    console.log('🔹 Testing Certificate Record Update...');
    const updatedTestJpgName = `updated-${testJpgName}`;
    fs.writeFileSync(path.join(uploadsDir, updatedTestJpgName), 'Updated JPG Content');

    await db.updateCertificateUpload(jpgCertId, testStudent.id, {
      courseName: 'Deep Learning Specialization - Advanced',
      platform: 'Coursera / Stanford',
      category: 'AI/ML Advanced',
      issueDate: '2026-04-15',
      filePath: updatedTestJpgName,
      originalFileName: 'deep_learning_cert_v2.jpg'
    });

    const updatedCertRecord = await db.getCertificateById(jpgCertId);
    if (updatedCertRecord.course_name !== 'Deep Learning Specialization - Advanced' || updatedCertRecord.file_path !== updatedTestJpgName) {
      throw new Error('Certificate update failed to persist updated metadata or file path.');
    }
    console.log('✅ Certificate record update & file path replacement verified.');

    // 9. Clean up test records and files
    console.log('🧹 Cleaning up test certificate records and test files...');
    await db.deleteStudent360Record(testStudent.id, 'certificates', pdfCertId);
    await db.deleteStudent360Record(testStudent.id, 'certificates', jpgCertId);
    await db.deleteStudent360Record(testStudent.id, 'certificates', pngCertId);

    [pdfPath, jpgPath, pngPath, path.join(uploadsDir, updatedTestJpgName)].forEach(filePath => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    console.log('🎉 ALL CERTIFICATE E2E TESTS & STORAGE AUDITS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Certificate E2E Test Failed:', err.message || err);
    process.exit(1);
  }
}

runCertificateE2ETests();
