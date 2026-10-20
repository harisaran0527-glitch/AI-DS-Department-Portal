import { Router, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply authentication to all subject routes
router.use(authenticateToken);

// POST /api/subjects/import-preview - Preview and validate bulk Subject Master Excel upload
router.post('/import-preview', requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, year: targetYear, section: targetSection } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty rows provided for Subject Master import.' });
    }

    const assignment = await db.getFacultyAssignment(req.user!.id);
    const facultyAssignedYear = assignment ? assignment.year : (req.user as any)?.assignedYear;
    const facultyAssignedSection = assignment ? assignment.section : (req.user as any)?.assignedSection;

    const validRows: any[] = [];
    const invalidRows: any[] = [];
    const seenCodes = new Set<string>();

    const existingSubjects = await db.getSubjects({});
    const existingCodeSet = new Set(existingSubjects.map((s) => s.subjectCode.trim().toUpperCase()));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object') continue;

      // Clean keys in row (trim whitespace, lowercasing helper)
      const normalizedRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        normalizedRow[k.trim().toLowerCase()] = v;
      }

      const rawCode = normalizedRow['subject code'] || normalizedRow['subjectcode'] || normalizedRow['subject_code'] || normalizedRow['code'] || normalizedRow['sub code'] || row.subjectCode || '';
      const rawTitle = normalizedRow['subject title'] || normalizedRow['subjecttitle'] || normalizedRow['subject_name'] || normalizedRow['subject name'] || normalizedRow['title'] || normalizedRow['name'] || normalizedRow['course title'] || row.subjectTitle || '';
      const rawAbbr = normalizedRow['subject abbreviation'] || normalizedRow['subjectabbreviation'] || normalizedRow['subject_abbreviation'] || normalizedRow['abbreviation'] || normalizedRow['short name'] || normalizedRow['sub abbr'] || normalizedRow['abbr'] || row.subjectAbbreviation || '';
      
      const yr = targetYear || normalizedRow['year'] || row.year || facultyAssignedYear || '2nd Year';
      const semester = Number(normalizedRow['semester'] || row.semester) || 3;
      const sec = targetSection || normalizedRow['section'] || row.section || facultyAssignedSection || 'ALL';
      const subjectType = (normalizedRow['type'] || normalizedRow['subject type'] || normalizedRow['subject_type'] || row.subjectType || 'Theory').toString().trim();
      const credits = Number(normalizedRow['credits'] || row.credits) || 3;

      const cleanCode = String(rawCode).trim().toUpperCase();
      const cleanTitle = String(rawTitle).trim();
      const cleanAbbr = String(rawAbbr).trim();

      if (!cleanCode) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: 'Subject Code is required.' });
        continue;
      }

      if (!cleanTitle) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: 'Subject Title is required.' });
        continue;
      }

      if (seenCodes.has(cleanCode)) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: `Duplicate Subject Code "${cleanCode}" found in uploaded file.` });
        continue;
      }

      seenCodes.add(cleanCode);
      const isExistingInDb = existingCodeSet.has(cleanCode);

      validRows.push({
        rowNumber: i + 1,
        subjectCode: cleanCode,
        subjectTitle: cleanTitle,
        subjectAbbreviation: cleanAbbr,
        year: yr,
        semester,
        section: sec,
        subjectType,
        credits,
        facultyHandler: req.user?.name || 'Class Coordinator',
        isExistingInDb,
        status: isExistingInDb ? 'UPDATE_EXISTING' : 'NEW_SUBJECT'
      });
    }

    return res.json({
      summary: {
        totalRowsProcessed: rows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length
      },
      validRows,
      invalidRows
    });
  } catch (error: any) {
    console.error('Error in subject import preview:', error);
    return res.status(500).json({ error: error.message || 'Failed to preview Subject Master import.' });
  }
});

// POST /api/subjects/import-confirm - Confirm bulk Subject Master import
router.post('/import-confirm', requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { subjects, year: defaultYear, section: defaultSection } = req.body;
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'No valid subjects provided for confirmation.' });
    }

    const importedSubjects: any[] = [];
    const userId = req.user?.id || 'SYSTEM';
    const facultyName = req.user?.name || 'Class Coordinator';

    for (const s of subjects) {
      const code = String(s.subjectCode || s.code).trim().toUpperCase();
      const title = String(s.subjectTitle || s.title || s.subjectName).trim();
      const abbr = String(s.subjectAbbreviation || s.abbreviation || s.abbr || '').trim();
      const yr = (s.year || defaultYear || '2nd Year').toString().trim();
      const semester = Number(s.semester) || 3;
      const sec = (s.section || defaultSection || 'ALL').toString().trim();
      const subjectType = (s.subjectType || 'Theory').toString().trim();
      const credits = Number(s.credits) || 3;

      const existing = await db.findSubjectByCode(code);
      if (existing) {
        const updated = await db.updateSubject(existing.id, {
          subject_name: title,
          subject_abbreviation: abbr,
          year: yr,
          semester,
          section: sec,
          subject_type: subjectType as any,
          credits,
          faculty_handler: facultyName
        });
        importedSubjects.push(updated);
      } else {
        const added = await db.addSubject({
          subject_code: code,
          subject_name: title,
          subject_abbreviation: abbr,
          department: 'AI & Data Science',
          academic_year: '2025-2026',
          year: yr,
          semester,
          section: sec,
          subject_type: subjectType as any,
          credits,
          faculty_handler: facultyName,
          created_by_user_id: userId
        });
        importedSubjects.push(added);
      }
    }

    await db.createBulkImportAudit(
      userId,
      req.user?.role || 'FACULTY',
      'SUBJECT_MASTER_IMPORT',
      'bulk_subject_master_import.xlsx',
      importedSubjects.length,
      0,
      { importedCount: importedSubjects.length }
    );

    return res.json({
      message: 'Subject Master bulk import confirmed and saved successfully.',
      importedCount: importedSubjects.length,
      subjects: importedSubjects
    });
  } catch (error: any) {
    console.error('Error in subject import confirm:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm Subject Master import.' });
  }
});

// GET /api/subjects - List subjects with optional filters
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { year, semester, section, search } = req.query;

    const filters: {
      year?: string;
      semester?: number;
      section?: string;
      search?: string;
    } = {};

    if (year && typeof year === 'string') {
      filters.year = year;
    }
    if (semester && !isNaN(Number(semester))) {
      filters.semester = Number(semester);
    }
    if (section && typeof section === 'string') {
      filters.section = section;
    }
    if (search && typeof search === 'string') {
      filters.search = search;
    }

    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    const subjects = await db.getSubjects(filters);
    return res.json({ subjects });
  } catch (error: any) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch subjects.' });
  }
});

// POST /api/subjects - Create a new subject
router.post('/', requireRole('FACULTY', 'HOD', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      subject_code,
      subject_name,
      department,
      academic_year,
      year,
      semester,
      section,
      subject_type,
      credits,
      faculty_handler
    } = req.body;

    if (!subject_code || !subject_name || !year || !semester || !section) {
      return res.status(400).json({
        error: 'Missing required subject details (subject_code, subject_name, year, semester, section are required).'
      });
    }

    const createdByUserId = req.user?.id || 'system';

    const newSubject = await db.addSubject({
      subject_code: subject_code.toString().trim(),
      subject_name: subject_name.toString().trim(),
      department: department?.toString().trim() || 'AI & Data Science',
      academic_year: academic_year?.toString().trim() || '2025-2026',
      year: year.toString().trim(),
      semester: Number(semester),
      section: section.toString().trim(),
      subject_type: (subject_type || 'Theory') as 'Theory' | 'Practical' | 'Elective',
      credits: Number(credits) || 3,
      faculty_handler: faculty_handler?.toString().trim() || req.user?.name || 'TBD',
      created_by_user_id: createdByUserId
    });

    return res.status(201).json({
      message: 'Subject added successfully.',
      subject: newSubject
    });
  } catch (error: any) {
    console.error('Error adding subject:', error);
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to add subject.' });
  }
});

// DELETE /api/subjects/by-code/:code - Delete a subject by code
router.delete('/by-code/:code', requireRole('FACULTY', 'HOD', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const existing = await db.findSubjectByCode(code);
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const success = await db.deleteSubject(existing.id);
    return res.json({ message: 'Subject deleted successfully.', success });
  } catch (error: any) {
    console.error('Error deleting subject by code:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete subject.' });
  }
});

// PUT /api/subjects/:id - Update an existing subject
router.put('/:id', requireRole('FACULTY', 'HOD', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      subject_code,
      subject_name,
      department,
      academic_year,
      year,
      semester,
      section,
      subject_type,
      credits,
      faculty_handler
    } = req.body;

    const existing = await db.getSubjectById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const updated = await db.updateSubject(id, {
      subject_code: subject_code ? subject_code.toString().trim() : undefined,
      subject_name: subject_name ? subject_name.toString().trim() : undefined,
      department: department ? department.toString().trim() : undefined,
      academic_year: academic_year ? academic_year.toString().trim() : undefined,
      year: year ? year.toString().trim() : undefined,
      semester: semester ? Number(semester) : undefined,
      section: section ? section.toString().trim() : undefined,
      subject_type: subject_type as 'Theory' | 'Practical' | 'Elective',
      credits: credits !== undefined ? Number(credits) : undefined,
      faculty_handler: faculty_handler ? faculty_handler.toString().trim() : undefined
    });

    return res.json({
      message: 'Subject updated successfully.',
      subject: updated
    });
  } catch (error: any) {
    console.error('Error updating subject:', error);
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to update subject.' });
  }
});

// DELETE /api/subjects/:id - Delete a subject by ID
router.delete('/:id', requireRole('FACULTY', 'HOD', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.getSubjectById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const success = await db.deleteSubject(id);
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete subject.' });
    }

    return res.json({ message: 'Subject deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting subject:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete subject.' });
  }
});

export default router;
