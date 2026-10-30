import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { db, normalizeYear, normalizeSection } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  MAX_FILE_SIZE_BYTES,
  MSG_FILE_TOO_LARGE,
  DANGEROUS_EXTENSIONS,
  PROJECT_ALLOWED_EXTENSIONS,
  validateUploadedFile,
  uploadFileToStorage,
  downloadFileFromStorage,
  deleteFileFromStorage,
  getMimeFromPath,
  detectMimeFromBuffer,
  fetchRemoteFormBuilderBuffer,
  safeToBuffer
} from '../storage.js';

const router = Router();

// In-Memory storage: avoids ephemeral /tmp loss on Vercel Serverless
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error('Executable or script files are strictly prohibited.'));
    }

    const recordType = (req.body?.recordType || (req.query?.recordType as string) || '').toLowerCase();
    const isProject = recordType === 'projects' || recordType === 'project' || PROJECT_ALLOWED_EXTENSIONS.has(ext);
    const moduleType = isProject ? 'project' : 'proof';

    const check = validateUploadedFile(
      { originalname: file.originalname, mimetype: file.mimetype, size: 0 },
      moduleType
    );

    if (!check.valid) {
      return cb(new Error(check.error || 'Invalid file format.'));
    }

    cb(null, true);
  }
});

// Helper permission check (supports dynamic faculty assignments and staff workspace isolation)
async function checkFilePermission(req: AuthRequest, student: any): Promise<boolean> {
  if (!req.user || !student) return false;

  if (req.user.role === 'ADMIN' || req.user.role === 'HOD') {
    return true;
  }

  if (req.user.role === 'STUDENT') {
    return (
      req.user.id === student.id ||
      req.user.studentId === student.id ||
      req.user.registerNo === student.register_no
    );
  }

  if (req.user.role === 'FACULTY') {
    if (student.created_by_faculty_id === req.user.id || student.faculty_workspace_id === req.user.id) {
      return true;
    }

    const assignment = await db.getFacultyAssignment(req.user.id, { fresh: true });
    const assignedYear = assignment?.is_active ? assignment.year : undefined;
    const assignedSection = assignment?.is_active ? assignment.section : undefined;

    const cleanAssignedYear = normalizeYear(assignedYear);
    const cleanAssignedSec = normalizeSection(assignedSection);
    const cleanStudentYear = normalizeYear(student.year);
    const cleanStudentSec = normalizeSection(student.section);

    const isYearMatch = Boolean(cleanAssignedYear && cleanAssignedYear !== 'ALL' && cleanStudentYear === cleanAssignedYear);
    const isSectionMatch = Boolean(cleanAssignedSec && cleanAssignedSec !== 'ALL' && cleanStudentSec === cleanAssignedSec);

    return isYearMatch && isSectionMatch;
  }

  return false;
}

// POST Upload Proof File (Faculty / Admin)
router.post('/upload', authenticateToken, (req: AuthRequest, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File size exceeds')) {
        return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
      }
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Double check size
    if (req.file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
    }

    const { studentId, recordType, recordId } = req.body;
    if (!studentId || !recordType || !recordId) {
      return res.status(400).json({ error: 'studentId, recordType, and recordId are required.' });
    }

    if (req.user!.role === 'STUDENT' || req.user!.role === 'HOD') {
      return res.status(403).json({ error: 'Unauthorized: Students and HOD are strictly view-only for proof attachments.' });
    }

    const student = await db.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    // Faculty Section Guard
    if (req.user!.role === 'FACULTY' && !(await checkFilePermission(req, student))) {
      return res.status(403).json({ error: 'Unauthorized: Faculty can only upload proof for assigned section students.' });
    }

    const existingAtt = await db.getAttachmentForRecord(studentId, recordType, recordId);
    const isReplace = Boolean(existingAtt);

    if (existingAtt) {
      await db.softDeleteAttachment(existingAtt.id, req.user!.id);
      if (existingAtt.stored_file_name) {
        await deleteFileFromStorage(existingAtt.stored_file_name);
      }
    }

    const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeBase = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `proofs/${recordType}/${studentId}/${attachmentId}-${safeBase}${ext}`;

    // Upload binary directly to Supabase Storage
    await uploadFileToStorage(storagePath, req.file.buffer, req.file.mimetype);

    // Save structured metadata & file data in PostgreSQL for 100% serverless resilience
    const newAtt = {
      id: attachmentId,
      student_id: studentId,
      record_type: recordType,
      record_id: recordId,
      original_file_name: req.file.originalname,
      stored_file_name: storagePath,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      uploaded_by_user_id: req.user!.id,
      uploaded_by_role: req.user!.role,
      uploaded_at: new Date().toISOString(),
      is_deleted: 0,
      file_data: req.file.buffer
    };

    await db.createAttachment(newAtt);

    const action = isReplace ? 'REPLACE_FILE' : 'UPLOAD_FILE';
    await db.logAudit(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      action,
      `FILE:${req.file.originalname} (Student:${student.register_no}, Record:${recordType})`
    );

    return res.status(201).json({
      message: isReplace ? 'Proof file replaced successfully.' : 'Proof file uploaded successfully.',
      attachment: {
        id: attachmentId,
        studentId,
        recordType,
        recordId,
        originalFileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedAt: newAtt.uploaded_at,
        downloadUrl: `/api/files/${attachmentId}/download`,
        viewUrl: `/api/files/${attachmentId}`
      }
    });
  });
});

// GET Fetch Attachment Info for Record
router.get('/record/:studentId/:recordType/:recordId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const studentId = req.params.studentId as string;
  const recordType = req.params.recordType as string;
  const recordId = req.params.recordId as string;

  const student = await db.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  if (!(await checkFilePermission(req, student))) {
    return res.status(403).json({ error: 'Unauthorized: Access forbidden.' });
  }

  let att = typeof db.getAttachmentForRecord === 'function' ? await db.getAttachmentForRecord(studentId, recordType, recordId) : null;
  if (!att && typeof db.getAttachmentByRecordId === 'function') {
    att = await db.getAttachmentByRecordId(recordId);
  }

  if (att) {
    return res.json({
      attachment: {
        id: att.id,
        studentId: att.student_id,
        recordType: att.record_type,
        recordId: att.record_id,
        originalFileName: att.original_file_name,
        mimeType: att.mime_type,
        fileSize: att.file_size,
        uploadedAt: att.uploaded_at,
        uploadedByRole: att.uploaded_by_role,
        downloadUrl: `/api/files/${att.id}/download`,
        viewUrl: `/api/files/${att.id}`
      }
    });
  }

  // Synthesize attachment fallback for project records with product_photo_path
  const cleanType = (recordType || '').toLowerCase().trim();
  if (cleanType === 'projects' || cleanType === 'project') {
    const proj = typeof db.getProjectById === 'function' ? await db.getProjectById(recordId) : null;
    if (proj && (proj.product_photo_path || proj.productPhotoPath)) {
      const photoPath = proj.product_photo_path || proj.productPhotoPath;
      const ext = path.extname(photoPath || '.png');
      return res.json({
        attachment: {
          id: recordId,
          studentId: student.id,
          recordType: 'projects',
          recordId: proj.id,
          originalFileName: `${proj.title || 'Project'}_Photo${ext}`,
          mimeType: getMimeFromPath(photoPath),
          fileSize: 0,
          uploadedAt: new Date().toISOString(),
          uploadedByRole: 'FACULTY',
          downloadUrl: `/api/files/${recordId}/download`,
          viewUrl: `/api/files/${recordId}`
        }
      });
    }
  }

  // Synthesize attachment fallback for certificate records with file_path or file_data
  if (cleanType === 'certificates' || cleanType === 'certificate') {
    const cert = typeof db.getCertificateById === 'function' ? await db.getCertificateById(recordId) : null;
    if (cert && (cert.file_path || cert.file_data || cert.proof_file_path)) {
      const ext = path.extname(cert.original_file_name || cert.file_path || '.pdf');
      return res.json({
        attachment: {
          id: recordId,
          studentId: student.id,
          recordType: 'certificates',
          recordId: cert.id,
          originalFileName: cert.original_file_name || `${cert.course_name || 'Certificate'}${ext}`,
          mimeType: cert.mime_type || getMimeFromPath(cert.original_file_name || cert.file_path || '.pdf'),
          fileSize: 0,
          uploadedAt: cert.uploaded_at || new Date().toISOString(),
          uploadedByRole: 'FACULTY',
          downloadUrl: `/api/files/${recordId}/download`,
          viewUrl: `/api/files/${recordId}`
        }
      });
    }
  }

  return res.status(404).json({ error: 'No attachment found for this record.' });
});

// GET View File inline
router.get('/:fileId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  let att = typeof db.getAttachmentById === 'function' ? await db.getAttachmentById(fileId) : null;
  if (!att && typeof db.getAttachmentByRecordId === 'function') {
    att = await db.getAttachmentByRecordId(fileId);
  }

  let student: any = null;
  let buffer: Buffer | null = null;
  let contentType = att?.mime_type || '';
  let originalFileName = att?.original_file_name || 'attachment';

  if (att) {
    student = await db.getStudentById(att.student_id);
    if (!student || !(await checkFilePermission(req, student))) {
      return res.status(403).json({ error: 'Unauthorized access to requested file.' });
    }

    // 1. Primary: Database persistence (BYTEA)
    if (att.file_data) {
      buffer = safeToBuffer(att.file_data);
    }

    // 2. Secondary: Form Builder remote proxy fallback or Supabase Storage
    if (!buffer) {
      const remote = await fetchRemoteFormBuilderBuffer(att.stored_file_name);
      if (remote) {
        buffer = remote.buffer;
        if (remote.contentType) contentType = remote.contentType;
      }
    }
    if (!buffer) {
      const fileData = await downloadFileFromStorage(att.stored_file_name);
      if (fileData) {
        buffer = fileData.buffer;
        if (fileData.contentType) contentType = fileData.contentType;
      }
    }
  } else {
    // Fallback: Check if fileId corresponds to a certificate record
    const cert = typeof db.getCertificateById === 'function' ? await db.getCertificateById(fileId) : null;
    if (cert) {
      student = await db.getStudentById(cert.student_id);
      if (!student || !(await checkFilePermission(req, student))) {
        return res.status(403).json({ error: 'Unauthorized access to requested file.' });
      }

      const ext = path.extname(cert.original_file_name || cert.file_path || '.pdf');
      originalFileName = cert.original_file_name || `${cert.course_name || 'Certificate'}${ext}`;
      contentType = cert.mime_type || '';

      if (cert.file_data) {
        buffer = safeToBuffer(cert.file_data);
      }
      const certPath = cert.file_path || cert.proof_file_path || '';
      if (!buffer && certPath) {
        const remote = await fetchRemoteFormBuilderBuffer(certPath);
        if (remote) {
          buffer = remote.buffer;
          if (remote.contentType) contentType = remote.contentType;
        }
      }
      if (!buffer && certPath) {
        const fileData = await downloadFileFromStorage(certPath);
        if (fileData) {
          buffer = fileData.buffer;
          if (fileData.contentType) contentType = fileData.contentType;
        }
      }
    } else {
      // Fallback: Check if fileId corresponds to a project record
      const proj = typeof db.getProjectById === 'function' ? await db.getProjectById(fileId) : null;
      if (proj) {
        student = await db.getStudentById(proj.student_id);
        if (!student || !(await checkFilePermission(req, student))) {
          return res.status(403).json({ error: 'Unauthorized access to requested file.' });
        }

        const projPath = proj.product_photo_path || '';
        const ext = path.extname(projPath || '.png');
        originalFileName = `${proj.title || 'Project'}_Photo${ext}`;

        if (projPath) {
          const remote = await fetchRemoteFormBuilderBuffer(projPath);
          if (remote) {
            buffer = remote.buffer;
            if (remote.contentType) contentType = remote.contentType;
          }
        }
        if (!buffer && projPath) {
          const fileData = await downloadFileFromStorage(projPath);
          if (fileData) {
            buffer = fileData.buffer;
            if (fileData.contentType) contentType = fileData.contentType;
          }
        }
      }
    }
  }

  if (!student && !buffer) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  if (!buffer) {
    return res.status(404).json({ error: 'File content missing from server storage.' });
  }

  const detectedMime = detectMimeFromBuffer(buffer);
  const finalContentType = contentType || detectedMime || getMimeFromPath(originalFileName);

  res.setHeader('Content-Type', finalContentType);
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFileName)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buffer);
});

// GET Download File attachment
router.get('/:fileId/download', authenticateToken, async (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  let att = typeof db.getAttachmentById === 'function' ? await db.getAttachmentById(fileId) : null;
  if (!att && typeof db.getAttachmentByRecordId === 'function') {
    att = await db.getAttachmentByRecordId(fileId);
  }

  let student: any = null;
  let buffer: Buffer | null = null;
  let contentType = att?.mime_type || '';
  let originalFileName = att?.original_file_name || 'attachment';

  if (att) {
    student = await db.getStudentById(att.student_id);
    if (!student || !(await checkFilePermission(req, student))) {
      return res.status(403).json({ error: 'Unauthorized access to requested file.' });
    }

    // 1. Primary: Database persistence (BYTEA)
    if (att.file_data) {
      buffer = safeToBuffer(att.file_data);
    }

    // 2. Secondary: Form Builder remote proxy fallback or Supabase Storage
    if (!buffer) {
      const remote = await fetchRemoteFormBuilderBuffer(att.stored_file_name);
      if (remote) {
        buffer = remote.buffer;
        if (remote.contentType) contentType = remote.contentType;
      }
    }
    if (!buffer) {
      const fileData = await downloadFileFromStorage(att.stored_file_name);
      if (fileData) {
        buffer = fileData.buffer;
        if (fileData.contentType) contentType = fileData.contentType;
      }
    }
  } else {
    // Fallback: Check if fileId corresponds to a certificate record
    const cert = typeof db.getCertificateById === 'function' ? await db.getCertificateById(fileId) : null;
    if (cert) {
      student = await db.getStudentById(cert.student_id);
      if (!student || !(await checkFilePermission(req, student))) {
        return res.status(403).json({ error: 'Unauthorized access to requested file.' });
      }

      const ext = path.extname(cert.original_file_name || cert.file_path || '.pdf');
      originalFileName = cert.original_file_name || `${cert.course_name || 'Certificate'}${ext}`;
      contentType = cert.mime_type || '';

      if (cert.file_data) {
        buffer = safeToBuffer(cert.file_data);
      }
      const certPath = cert.file_path || cert.proof_file_path || '';
      if (!buffer && certPath) {
        const remote = await fetchRemoteFormBuilderBuffer(certPath);
        if (remote) {
          buffer = remote.buffer;
          if (remote.contentType) contentType = remote.contentType;
        }
      }
      if (!buffer && certPath) {
        const fileData = await downloadFileFromStorage(certPath);
        if (fileData) {
          buffer = fileData.buffer;
          if (fileData.contentType) contentType = fileData.contentType;
        }
      }
    } else {
      // Fallback: Check if fileId corresponds to a project record
      const proj = typeof db.getProjectById === 'function' ? await db.getProjectById(fileId) : null;
      if (proj) {
        student = await db.getStudentById(proj.student_id);
        if (!student || !(await checkFilePermission(req, student))) {
          return res.status(403).json({ error: 'Unauthorized access to requested file.' });
        }

        const projPath = proj.product_photo_path || '';
        const ext = path.extname(projPath || '.png');
        originalFileName = `${proj.title || 'Project'}_Photo${ext}`;

        if (projPath) {
          const remote = await fetchRemoteFormBuilderBuffer(projPath);
          if (remote) {
            buffer = remote.buffer;
            if (remote.contentType) contentType = remote.contentType;
          }
        }
        if (!buffer && projPath) {
          const fileData = await downloadFileFromStorage(projPath);
          if (fileData) {
            buffer = fileData.buffer;
            if (fileData.contentType) contentType = fileData.contentType;
          }
        }
      }
    }
  }

  if (!student && !buffer) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  if (!buffer) {
    return res.status(404).json({ error: 'File content missing from server storage.' });
  }

  await db.logAudit(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'DOWNLOAD_FILE',
    `FILE:${originalFileName} (Attachment:${fileId})`
  );

  const detectedMime = detectMimeFromBuffer(buffer);
  const finalContentType = contentType || detectedMime || getMimeFromPath(originalFileName);

  res.setHeader('Content-Type', finalContentType);
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);
  return res.send(buffer);
});

// DELETE Attachment
router.delete('/:fileId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  if (req.user!.role === 'STUDENT') {
    return res.status(403).json({ error: 'Unauthorized: Students are strictly 100% view-only.' });
  }

  const att = await db.getAttachmentById(fileId);
  if (!att) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const student = await db.getStudentById(att.student_id);
  if (!student || !(await checkFilePermission(req, student))) {
    return res.status(403).json({ error: 'Unauthorized access to requested file.' });
  }

  await deleteFileFromStorage(att.stored_file_name);
  await db.softDeleteAttachment(fileId, req.user!.id);
  await db.logAudit(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'DELETE_FILE',
    `FILE:${att.original_file_name} (Attachment:${att.id})`
  );

  return res.json({ message: 'Attachment deleted successfully.' });
});

export default router;
