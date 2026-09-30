import { Router, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Apply authentication to all subject routes
router.use(authenticateToken);

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

// DELETE /api/subjects/:id - Delete a subject
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
