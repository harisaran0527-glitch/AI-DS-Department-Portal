import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// PROTECTED SERVER FILE STORAGE DIRECTORY
const UPLOADS_DIR = path.resolve(process.cwd(), 'server', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ALLOWED SAFE ACADEMIC MIME TYPES AND EXTENSIONS
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/pjpeg'
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const DANGEROUS_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.js', '.sh', '.vbs', '.ps1', '.msi', '.php', '.py', '.pl', '.rb']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Strict 10 MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error('Executable or dangerous file types are strictly prohibited.'));
    }

    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
      return cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files under 10 MB are allowed.'));
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

// POST Upload Proof File (Faculty / HOD / Admin)
router.post('/upload', authenticateToken, (req: AuthRequest, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { studentId, recordType, recordId } = req.body;
    if (!studentId || !recordType || !recordId) {
      // Remove stored file if metadata is missing
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'studentId, recordType, and recordId are required.' });
    }

    if (req.user!.role === 'STUDENT') {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Unauthorized: Students are strictly 100% view-only.' });
    }

    const student = db.getStudentById(studentId);
    if (!student) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Student record not found.' });
    }

    // Faculty Section Guard
    if (req.user!.role === 'FACULTY' && !checkFilePermission(req, student)) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Unauthorized: Faculty can only upload proof for assigned section students.' });
    }

    const existingAtt = db.getAttachmentForRecord(studentId, recordType, recordId);
    const isReplace = Boolean(existingAtt);

    if (existingAtt) {
      db.softDeleteAttachment(existingAtt.id, req.user!.id);
    }

    const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newAtt = {
      id: attachmentId,
      student_id: studentId,
      record_type: recordType,
      record_id: recordId,
      original_file_name: req.file.originalname,
      stored_file_name: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      uploaded_by_user_id: req.user!.id,
      uploaded_by_role: req.user!.role,
      uploaded_at: new Date().toISOString(),
      is_deleted: 0
    };

    db.createAttachment(newAtt);

    const action = isReplace ? 'REPLACE_FILE' : 'UPLOAD_FILE';
    db.logAudit(
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
router.get('/record/:studentId/:recordType/:recordId', authenticateToken, (req: AuthRequest, res: Response) => {
  const studentId = req.params.studentId as string;
  const recordType = req.params.recordType as string;
  const recordId = req.params.recordId as string;

  const student = db.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  if (!checkFilePermission(req, student)) {
    return res.status(403).json({ error: 'Unauthorized: Access forbidden.' });
  }

  const att = db.getAttachmentForRecord(studentId, recordType, recordId);
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
router.get('/:fileId', authenticateToken, (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  const att = db.getAttachmentById(fileId);
  if (!att) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const student = db.getStudentById(att.student_id);
  if (!student || !checkFilePermission(req, student)) {
    return res.status(403).json({ error: 'Unauthorized access to requested file.' });
  }

  const filePath = path.join(UPLOADS_DIR, att.stored_file_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File content missing from server storage.' });
  }

  res.setHeader('Content-Type', att.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.original_file_name)}"`);
  return res.sendFile(filePath);
});

// GET Download File attachment
router.get('/:fileId/download', authenticateToken, (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  const att = db.getAttachmentById(fileId);
  if (!att) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const student = db.getStudentById(att.student_id);
  if (!student || !checkFilePermission(req, student)) {
    return res.status(403).json({ error: 'Unauthorized access to requested file.' });
  }

  const filePath = path.join(UPLOADS_DIR, att.stored_file_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File content missing from server storage.' });
  }

  db.logAudit(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'DOWNLOAD_FILE',
    `FILE:${att.original_file_name} (Attachment:${att.id})`
  );

  return res.download(filePath, att.original_file_name);
});

// DELETE Attachment
router.delete('/:fileId', authenticateToken, (req: AuthRequest, res: Response) => {
  const fileId = req.params.fileId as string;

  if (req.user!.role === 'STUDENT') {
    return res.status(403).json({ error: 'Unauthorized: Students are strictly 100% view-only.' });
  }

  const att = db.getAttachmentById(fileId);
  if (!att) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const student = db.getStudentById(att.student_id);
  if (!student || !checkFilePermission(req, student)) {
    return res.status(403).json({ error: 'Unauthorized access to requested file.' });
  }

  db.softDeleteAttachment(fileId, req.user!.id);
  db.logAudit(
    req.user!.id,
    req.user!.email,
    req.user!.role,
    'DELETE_FILE',
    `FILE:${att.original_file_name} (Attachment:${att.id})`
  );

  return res.json({ message: 'Attachment deleted successfully.' });
});

export default router;
