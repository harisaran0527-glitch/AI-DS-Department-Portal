import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { executeRun, queryOne } from '../postgresAdapter.js';
import { recalculateAffectedStudentScore } from './faculty.js';

const router = Router();

/**
 * Timing-safe integration key validation middleware
 */
function verifyIntegrationKey(req: Request, res: Response, next: () => void) {
  const syncSecret = process.env.HOD_INTEGRATION_KEY;
  const authHeader = req.headers['authorization'];
  const headerKey = req.headers['x-hod-integration-key'];
  const clientKey = (typeof headerKey === 'string' ? headerKey : authHeader?.replace(/^Bearer\s+/i, '')) || '';

  if (!syncSecret || Buffer.byteLength(syncSecret.trim()) < 32 || /^your_/i.test(syncSecret)) {
    return res.status(503).json({ error: 'HOD integration service authentication is not configured.' });
  }

  const syncSecretBuf = Buffer.from(syncSecret.trim());
  const clientKeyBuf = Buffer.from(clientKey.trim());

  if (syncSecretBuf.length !== clientKeyBuf.length || !crypto.timingSafeEqual(syncSecretBuf, clientKeyBuf)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing HOD integration key.' });
  }

  next();
}

/**
 * GET /api/integration/health
 * Integration service health check
 */
router.get('/health', verifyIntegrationKey, (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'hod-student360-integration',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/integration/sync-submission
 * Idempotent server-to-server synchronization endpoint for Form Builder submissions.
 * Appends certificate or project records to the correct student profile without overwriting existing records.
 */
router.post('/sync-submission', verifyIntegrationKey, async (req: Request, res: Response) => {
  try {
    const { submissionId, templateKey, registerNo, record, proofFiles } = req.body || {};

    if (!submissionId || typeof submissionId !== 'string') {
      return res.status(400).json({ error: 'Missing required field: submissionId.' });
    }

    // 1. Strict Template Whitelist: Only official system templates are eligible
    if (templateKey !== 'DEFAULT_CERTIFICATE' && templateKey !== 'DEFAULT_PROJECT') {
      return res.status(400).json({
        error: `Invalid templateKey '${templateKey}'. Only DEFAULT_CERTIFICATE and DEFAULT_PROJECT are permitted.`
      });
    }

    // 2. Normalize Register Number
    const cleanRegNo = (registerNo || '').trim();
    if (!cleanRegNo) {
      return res.status(400).json({
        status: 'NEEDS_REVIEW',
        error: 'Missing required student register number.'
      });
    }

    // 3. Resolve Student in HOD Database (Exact normalized match)
    const student = await db.getStudentByRegisterNo(cleanRegNo);
    if (!student) {
      return res.status(404).json({
        status: 'NEEDS_REVIEW',
        error: `Student with Register Number '${cleanRegNo}' was not found in HOD records.`
      });
    }

    const now = new Date().toISOString();
    const targetEntityId = `sync-${submissionId.trim()}`;
    const safeRecord = record || {};
    const safeProofs = Array.isArray(proofFiles) ? proofFiles : [];
    const primaryProof = safeProofs[0] || null;

    // 4. Synchronize based on templateKey
    if (templateKey === 'DEFAULT_CERTIFICATE') {
      const courseName = safeRecord.courseName || safeRecord.course_name || 'Certificate';
      const platform = safeRecord.platform || 'Online Platform';
      const category = safeRecord.category || 'Technical Certification';
      const issueDate = safeRecord.issueDate || safeRecord.issue_date || now.split('T')[0];
      const certId = safeRecord.certificateId ? String(safeRecord.certificateId).trim() : null;
      const filePath = primaryProof?.viewUrl || safeRecord.filePath || '';
      const originalFileName = primaryProof?.originalName || safeRecord.originalFileName || '';
      const mimeType = primaryProof?.mimeType || safeRecord.mimeType || '';

      const existingCert = await queryOne('SELECT id FROM certificate_records WHERE id = ?', [targetEntityId]);

      if (existingCert) {
        await executeRun(`
          UPDATE certificate_records
          SET course_name = ?, platform = ?, category = ?, issue_date = ?, certificate_id = ?, file_path = ?, original_file_name = ?, mime_type = ?
          WHERE id = ? AND student_id = ?
        `, [courseName, platform, category, issueDate, certId, filePath, originalFileName, mimeType, targetEntityId, student.id]);
      } else {
        await executeRun(`
          INSERT INTO certificate_records
            (id, student_id, course_name, platform, category, issue_date, certificate_id, file_path, original_file_name, uploaded_at, created_at, mime_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          targetEntityId,
          student.id,
          courseName,
          platform,
          category,
          issueDate,
          certId,
          filePath,
          originalFileName,
          now,
          now,
          mimeType
        ]);
      }
    } else if (templateKey === 'DEFAULT_PROJECT') {
      const title = safeRecord.title || safeRecord.project_name || 'Student Engineering Project';
      const description = safeRecord.description || '';
      const domain = safeRecord.domain || 'Engineering';
      const techStackJson = JSON.stringify(
        Array.isArray(safeRecord.techStack)
          ? safeRecord.techStack
          : typeof safeRecord.techStack === 'string'
            ? safeRecord.techStack.split(',').map((s: string) => s.trim()).filter(Boolean)
            : ['Engineering']
      );
      const isTeam = safeRecord.isTeam || safeRecord.project_nature === 'Team Project' ? 1 : 0;
      const studentRole = safeRecord.studentRole || safeRecord.student_role || 'Developer';
      const category = safeRecord.category || safeRecord.project_type || 'Software';
      const status = safeRecord.status || safeRecord.project_status || 'Completed';
      const githubUrl = safeRecord.githubUrl ? String(safeRecord.githubUrl).trim() : null;
      const liveUrl = safeRecord.liveUrl || safeRecord.demoUrl ? String(safeRecord.liveUrl || safeRecord.demoUrl).trim() : null;
      const productPhotoPath = primaryProof?.viewUrl || safeRecord.productPhotoPath || safeRecord.hardware_image || '';

      const existingProj = await queryOne('SELECT id FROM project_records WHERE id = ?', [targetEntityId]);

      if (existingProj) {
        await executeRun(`
          UPDATE project_records
          SET title = ?, description = ?, domain = ?, tech_stack_json = ?, is_team = ?, student_role = ?, github_url = ?, live_url = ?, category = ?, status = ?, product_photo_path = ?
          WHERE id = ? AND student_id = ?
        `, [
          title,
          description,
          domain,
          techStackJson,
          isTeam,
          studentRole,
          githubUrl,
          liveUrl,
          category,
          status,
          productPhotoPath,
          targetEntityId,
          student.id
        ]);
      } else {
        await executeRun(`
          INSERT INTO project_records
            (id, student_id, title, description, domain, tech_stack_json, is_team, student_role, github_url, live_url, category, status, product_photo_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          targetEntityId,
          student.id,
          title,
          description,
          domain,
          techStackJson,
          isTeam,
          studentRole,
          githubUrl,
          liveUrl,
          category,
          status,
          productPhotoPath
        ]);
      }
    }

    // 5. Store Proof Attachments in HOD Attachments Table
    if (safeProofs.length > 0) {
      const recordType = templateKey === 'DEFAULT_CERTIFICATE' ? 'certificates' : 'projects';
      for (const pf of safeProofs) {
        if (!pf.viewUrl) continue;
        const attId = `att-sync-${submissionId}-${pf.fieldKey || 'proof'}`;
        const existingAtt = await queryOne('SELECT id FROM attachments WHERE id = ?', [attId]);
        if (!existingAtt) {
          await executeRun(`
            INSERT INTO attachments
              (id, student_id, record_type, record_id, original_file_name, stored_file_name, mime_type, file_size, uploaded_by_user_id, uploaded_by_role, uploaded_at, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'form-builder-sync', 'INTEGRATION', ?, 0)
          `, [
            attId,
            student.id,
            recordType,
            targetEntityId,
            pf.originalName || 'proof',
            pf.viewUrl,
            pf.mimeType || 'application/octet-stream',
            pf.fileSize || 0,
            now
          ]);
        }
      }
    }

    // 6. Recalculate Student Overall Score and Section Rank
    const { overallScore } = await recalculateAffectedStudentScore(student.id);

    // 7. Write Audit Log
    try {
      await db.logAudit(
        'integration-form-builder',
        'integration@formbuilder.local',
        'INTEGRATION',
        'SYNC_SUBMISSION',
        `STUDENT:${student.id}:${templateKey}:${targetEntityId}`
      );
    } catch (auditErr) {
      console.warn('[HOD Integration] Non-critical audit log failure:', auditErr);
    }

    return res.status(200).json({
      status: 'SYNCED',
      studentId: student.id,
      studentName: student.name,
      targetEntityId,
      overallScore
    });
  } catch (err: any) {
    console.error('[HOD Integration] Processing error:', err);
    return res.status(500).json({
      status: 'FAILED',
      error: err.message || 'Internal server error during HOD submission sync.'
    });
  }
});

export default router;

