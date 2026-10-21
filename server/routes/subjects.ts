import { Router, Response } from 'express';
import { db, normalizeYear, normalizeSection, normalizeSemester } from '../db.js';
import { authenticateToken, requireRole, AuthRequest, getRouteParam } from '../middleware/auth.js';

const router = Router();

// Apply authentication to all subject routes
router.use(authenticateToken);

function getRowValue(row: Record<string, any>, candidateKeys: string[]): any {
  if (!row || typeof row !== 'object') return undefined;

  // 1. Direct match
  for (const k of candidateKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
  }

  // 2. Normalized key match (stripping spaces, underscores, symbols)
  const normalizedKeyMap: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === null || k === undefined) continue;
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    normalizedKeyMap[cleanKey] = v;
  }

  for (const k of candidateKeys) {
    const cleanCandidate = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKeyMap[cleanCandidate] !== undefined && normalizedKeyMap[cleanCandidate] !== null && String(normalizedKeyMap[cleanCandidate]).trim() !== '') {
      return normalizedKeyMap[cleanCandidate];
    }
  }

  return undefined;
}

function normalizeSubjectType(typeInput?: any): 'Theory' | 'Practical' | 'Elective' {
  if (typeInput !== null && typeInput !== undefined) {
    const s = String(typeInput).trim().toLowerCase();
    if (s.includes('lab') || s.includes('practical') || s.includes('experiment')) return 'Practical';
    if (s.includes('elective') || s.includes('pe') || s.includes('oe') || s.includes('professional')) return 'Elective';
  }
  return 'Theory';
}

function normalizeCredits(creditsInput?: any, type: string = 'Theory'): number {
  if (creditsInput !== null && creditsInput !== undefined && String(creditsInput).trim() !== '') {
    const num = Number(creditsInput);
    if (!isNaN(num) && num > 0 && num <= 20) {
      return num;
    }
  }
  return type === 'Practical' ? 2 : 3;
}

// POST /api/subjects/import-preview - Preview and validate bulk Subject Master Excel upload
router.post('/import-preview', requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, year: targetYear, section: targetSection, semester: targetSemester } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty rows provided for Subject Master import.' });
    }

    const assignment = await db.getFacultyAssignment(req.user!.id);
    const facultyAssignedYear = assignment ? assignment.year : (req.user as any)?.assignedYear;
    const facultyAssignedSection = assignment ? assignment.section : (req.user as any)?.assignedSection;

    const defaultYear = normalizeYear(targetYear && targetYear !== 'ALL' ? targetYear : facultyAssignedYear) || '2nd Year';
    const defaultSemester = normalizeSemester(targetSemester, defaultYear);
    const defaultSection = normalizeSection(targetSection && targetSection !== 'ALL' ? targetSection : facultyAssignedSection) || 'ALL';

    const validRows: any[] = [];
    const invalidRows: any[] = [];
    const seenFileEntries = new Map<string, number>();

    const existingSubjects = await db.getSubjects({});

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object') {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: 'Empty row.' });
        continue;
      }

      // 1. Subject Code
      const rawCode = getRowValue(row, [
        'Subject Code', 'subject_code', 'subjectCode', 'code', 'sub code', 'course code',
        'course_code', 'courseCode', 'subcode', 'course no', 'subject no', 'sub no'
      ]);
      const cleanCode = rawCode ? String(rawCode).trim().toUpperCase() : '';

      // 2. Subject Title
      const rawTitle = getRowValue(row, [
        'Subject Title', 'subject_title', 'subjectTitle', 'subject_name', 'subjectName',
        'subject name', 'course title', 'course_title', 'courseTitle', 'title', 'name', 'course name'
      ]);
      const cleanTitle = rawTitle ? String(rawTitle).trim() : '';

      // 3. Subject Abbreviation
      const rawAbbr = getRowValue(row, [
        'Subject Abbreviation', 'subject_abbreviation', 'subjectAbbreviation', 'abbreviation',
        'abbr', 'sub abbr', 'short name', 'shortName', 'acronym'
      ]);
      const cleanAbbr = rawAbbr ? String(rawAbbr).trim().toUpperCase() : '';

      // 4. Year, Semester, Section
      const rawYear = getRowValue(row, ['Year', 'year', 'class_year', 'academic_year_class', 'target_year', 'yr']);
      const rawSemester = getRowValue(row, ['Semester', 'semester', 'sem', 'target_semester', 'term']);
      const rawSection = getRowValue(row, ['Section', 'section', 'sec', 'target_section']);

      // 5. Type & Credits
      const rawType = getRowValue(row, ['Subject Type', 'subject_type', 'subjectType', 'type', 'course_type', 'category']);
      const rawCredits = getRowValue(row, ['Credits', 'credits', 'credit', 'cr']);
      const rawFacultyHandler = getRowValue(row, ['Faculty Handler', 'faculty_handler', 'facultyHandler', 'faculty', 'handler', 'instructor']);

      // Validation
      if (!cleanCode) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: 'Subject Code is required.' });
        continue;
      }

      if (cleanCode.length < 2 || cleanCode.length > 20) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: `Subject Code "${cleanCode}" must be between 2 and 20 characters.` });
        continue;
      }

      if (!cleanTitle) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: 'Subject Title is required.' });
        continue;
      }

      if (cleanTitle.length < 2) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: `Subject Title "${cleanTitle}" is too short (minimum 2 characters).` });
        continue;
      }

      // Check semester validity if row specified one
      if (rawSemester !== undefined && rawSemester !== null && String(rawSemester).trim() !== '') {
        const num = parseInt(String(rawSemester).replace(/[^0-9]/g, ''), 10);
        if (isNaN(num) || num < 1 || num > 8) {
          invalidRows.push({ rowNumber: i + 1, rawData: row, reason: `Semester must be a number between 1 and 8 (received "${rawSemester}").` });
          continue;
        }
      }

      // Check credits validity if row specified one
      if (rawCredits !== undefined && rawCredits !== null && String(rawCredits).trim() !== '') {
        const cNum = Number(rawCredits);
        if (isNaN(cNum) || cNum <= 0 || cNum > 20) {
          invalidRows.push({ rowNumber: i + 1, rawData: row, reason: `Credits must be a positive number between 1 and 20 (received "${rawCredits}").` });
          continue;
        }
      }

      const yr = rawYear ? normalizeYear(rawYear) : defaultYear;
      const sem = normalizeSemester(rawSemester, yr, defaultSemester);
      const sec = rawSection ? normalizeSection(rawSection) : defaultSection;

      const subjectType = normalizeSubjectType(rawType);
      const credits = normalizeCredits(rawCredits, subjectType);
      const facultyHandler = rawFacultyHandler ? String(rawFacultyHandler).trim() : (req.user?.name || 'Class Coordinator');

      // Duplicate check within uploaded file
      const fileScopeKey = `${cleanCode}__${yr}__${sem}__${sec}`;
      if (seenFileEntries.has(fileScopeKey)) {
        const prevRow = seenFileEntries.get(fileScopeKey);
        invalidRows.push({
          rowNumber: i + 1,
          rawData: row,
          reason: `Duplicate Subject Code "${cleanCode}" for ${yr} Semester ${sem} Section ${sec} found in uploaded file (conflicts with Row #${prevRow}).`
        });
        continue;
      }
      seenFileEntries.set(fileScopeKey, i + 1);

      // Check against database matching scope
      const existingInDb = existingSubjects.find(s =>
        s.subjectCode.trim().toUpperCase() === cleanCode &&
        s.year === yr &&
        Number(s.semester) === sem &&
        (s.section === sec || s.section === 'ALL' || sec === 'ALL')
      );

      const isExistingInDb = !!existingInDb;

      validRows.push({
        rowNumber: i + 1,
        subjectCode: cleanCode,
        subjectTitle: cleanTitle,
        subjectAbbreviation: cleanAbbr,
        year: yr,
        semester: sem,
        section: sec,
        subjectType,
        credits,
        facultyHandler,
        isExistingInDb,
        existingId: existingInDb?.id,
        status: isExistingInDb ? 'UPDATE_EXISTING' : 'NEW_SUBJECT'
      });
    }

    const newCount = validRows.filter(r => r.status === 'NEW_SUBJECT').length;
    const updateCount = validRows.filter(r => r.status === 'UPDATE_EXISTING').length;

    return res.json({
      summary: {
        totalRowsProcessed: rows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        newCount,
        updateCount
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
    const { subjects, year: defaultYearInput, section: defaultSectionInput, semester: defaultSemesterInput } = req.body;
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'No valid subjects provided for confirmation.' });
    }

    const defaultYear = normalizeYear(defaultYearInput) || '2nd Year';
    const defaultSemester = normalizeSemester(defaultSemesterInput, defaultYear);
    const defaultSection = normalizeSection(defaultSectionInput) || 'ALL';

    const userId = req.user?.id || 'SYSTEM';
    const facultyName = req.user?.name || 'Class Coordinator';

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failedRows: any[] = [];
    const importedSubjects: any[] = [];

    for (const s of subjects) {
      try {
        const code = String(s.subjectCode || s.code || '').trim().toUpperCase();
        const title = String(s.subjectTitle || s.title || s.subjectName || '').trim();
        const abbr = String(s.subjectAbbreviation || s.abbreviation || s.abbr || '').trim().toUpperCase();
        const yr = normalizeYear(s.year || defaultYear);
        const sem = normalizeSemester(s.semester, yr, defaultSemester);
        const sec = normalizeSection(s.section || defaultSection);
        const subjectType = normalizeSubjectType(s.subjectType || s.type);
        const credits = normalizeCredits(s.credits, subjectType);
        const handler = (s.facultyHandler || facultyName).toString().trim();

        if (!code || !title) {
          failedCount++;
          failedRows.push({
            rowNumber: s.rowNumber || 0,
            subjectCode: code || 'UNKNOWN',
            reason: 'Subject Code and Subject Title are required.'
          });
          continue;
        }

        // Scope-based lookup to prevent duplicate records
        const existing = await db.findSubjectByScope(code, yr, sem, sec);
        if (existing) {
          // Check if identical to avoid unnecessary updates
          const isIdentical =
            existing.subjectName === title &&
            (existing.subjectAbbreviation || '') === abbr &&
            existing.year === yr &&
            Number(existing.semester) === sem &&
            existing.section === sec &&
            existing.subjectType === subjectType &&
            Number(existing.credits) === credits;

          if (isIdentical) {
            skippedCount++;
            importedSubjects.push(existing);
          } else {
            const updated = await db.updateSubject(existing.id, {
              subject_name: title,
              subject_abbreviation: abbr,
              year: yr,
              semester: sem,
              section: sec,
              subject_type: subjectType as any,
              credits,
              faculty_handler: handler
            });
            updatedCount++;
            importedSubjects.push(updated);
          }
        } else {
          const added = await db.addSubject({
            subject_code: code,
            subject_name: title,
            subject_abbreviation: abbr,
            department: 'AI & Data Science',
            academic_year: '2025-2026',
            year: yr,
            semester: sem,
            section: sec,
            subject_type: subjectType as any,
            credits,
            faculty_handler: handler,
            created_by_user_id: userId
          });
          importedCount++;
          importedSubjects.push(added);
        }
      } catch (rowErr: any) {
        console.error('Error importing subject record:', rowErr);
        failedCount++;
        failedRows.push({
          rowNumber: s.rowNumber || 0,
          subjectCode: s.subjectCode || 'UNKNOWN',
          reason: rowErr.message || 'Database error occurred while saving subject.'
        });
      }
    }

    await db.createBulkImportAudit(
      userId,
      req.user?.role || 'FACULTY',
      'SUBJECT_MASTER_IMPORT',
      'bulk_subject_master_import.xlsx',
      importedCount + updatedCount,
      failedCount,
      { importedCount, updatedCount, skippedCount, failedCount }
    );

    const message = `Subject Master import complete: ${importedCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} failed.`;

    return res.json({
      message,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount,
      failedRows,
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
    const code = getRouteParam(req, 'code');
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
    const id = getRouteParam(req, 'id');
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
    const id = getRouteParam(req, 'id');
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
