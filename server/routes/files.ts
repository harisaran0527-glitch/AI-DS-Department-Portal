import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { db } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  MAX_FILE_SIZE_BYTES,
  MSG_FILE_TOO_LARGE,
  DANGEROUS_EXTENSIONS,
  validateUploadedFile,
  uploadFileToStorage,
  downloadFileFromStorage,
  deleteFileFromStorage
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

    const recordType = (req.body?.recordType || '').toLowerCase();
    const moduleType = recordType === 'projects' ? 'project' : 'proof';

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

// Helper permission check
function checkFilePermission(req: AuthRequest, student: any): boolean {
  if (!req.user || !student) return false;

  if (req.user.role === 'ADMIN' || req.user.role === 'HOD') {
    return true;
  }

  if (req.user.role === 'FACULTY') {
    return (
      student.year === req.user.assignedYear &&
      student.section === req.user.assignedSection
    );
  }

  if (req.user.role === 'STUDENT') {
    return (
      req.user.id === student.id ||
      req.user.studentId === student.id ||
      req.user.registerNo === student.register_no
    );
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
    if (req.user!.role === 'FACULTY' && !checkFilePermission(req, student)) {
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

    // Save structured metadata in PostgreSQL (DO NOT store base64 binary in PostgreSQL)
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
      is_deleted: 0
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

  if (!checkFilePermission(req, student)) {
    return res.status(403).json({ error: 'Unauthorized: Access forbidden.' });
  }

  const att = await db.getAttachmentForRecord(studentId, recordType, recordId);
  if (!att) {
    return res.status(404).json({ error: 'No attachment found for this record.' });
  }

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
});

// GET View File inline
router.get('/:fileId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  const att = await db.getAttachmentById(fileId);
  if (!att) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const student = await db.getStudentById(att.student_id);
  if (!student || !checkFilePermission(req, student)) {
    return res.status(403).json({ error: 'Unauthorized access to requested file.' });
  }

  const fileData = await downloadFileFromStorage(att.stored_file_name);
  if (!fileData) {
    return res.status(404).json({ error: 'File content missing from server storage.' });
  }

  res.setHeader('Content-Type', att.mime_type || fileData.contentType);
  res.setHeader('Content-Length', fileData.buffer.length.toString());
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.original_file_name)}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.send(fileData.buffer);
});

// GET Download File attachment
router.get('/:fileId/download', authenticateToken, async (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  const att = await db.getAttachmentById(fileId);
  if (!att) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const student = await db.getStudentById(att.student_id);
  if (!student || !checkFilePermission(req, student)) {
    return res.status(403).json({ error: 'Unauthorized access to requested file.' });
  }

  const fileData = await downloadFileFromStorage(att.stored_file_name);
  if (!fileData) {
    return res.status(404).json({ error: 'File content missing from server storage.' });
  }

  await db.logAudit(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'DOWNLOAD_FILE',
    `FILE:${att.original_file_name} (Attachment:${att.id})`
  );

  res.setHeader('Content-Type', att.mime_type || fileData.contentType);
  res.setHeader('Content-Length', fileData.buffer.length.toString());
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.original_file_name)}"`);
  return res.send(fileData.buffer);
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
  if (!student || !checkFilePermission(req, student)) {
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
