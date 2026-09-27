import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import {
  getTopRecognitionRankings,
  getAllCategoryRankings,
  getLeetCodeFullAnalytics
} from '../services/geminiRankingService';

const router = Router();

router.use(authenticateToken, requireRole('STUDENT', 'FACULTY', 'HOD', 'ADMIN'));

// GET Top Recognition Rankings (1st Place & 2nd Place only for 4 Categories with Gemini AI Explanations)
router.get('/top-recognition', async (req: AuthRequest, res: Response) => {
  try {
    const yearFilter = (req.query.year as string) || (req.user?.role === 'FACULTY' ? req.user.assignedYear : undefined);
    const sectionFilter = (req.query.section as string) || (req.user?.role === 'FACULTY' ? req.user.assignedSection : undefined);
    const includeTest = req.query.includeTest === 'true';

    const rankings = await getTopRecognitionRankings(
      yearFilter === 'ALL' ? undefined : yearFilter,
      sectionFilter === 'ALL' ? undefined : sectionFilter,
      includeTest
    );

    return res.json(rankings);
  } catch (err: any) {
    console.error('Error fetching Top Recognition Rankings:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate Top Recognition Rankings.' });
  }
});

// GET Top Performers across ALL 14 department categories
router.get('/all-categories', async (req: AuthRequest, res: Response) => {
  try {
    const yearFilter = (req.query.year as string) || (req.user?.role === 'FACULTY' ? req.user.assignedYear : undefined);
    const sectionFilter = (req.query.section as string) || (req.user?.role === 'FACULTY' ? req.user.assignedSection : undefined);
    const includeTest = req.query.includeTest === 'true';

    const rankings = await getAllCategoryRankings(
      yearFilter === 'ALL' ? undefined : yearFilter,
      sectionFilter === 'ALL' ? undefined : sectionFilter,
      includeTest
    );

    return res.json(rankings);
  } catch (err: any) {
    console.error('Error fetching All Categories Rankings:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate All Categories Rankings.' });
  }
});

// GET Full-Page Gemini AI LeetCode Analytics Dashboard Data
router.get('/leetcode-full', async (req: AuthRequest, res: Response) => {
  try {
    const yearFilter = (req.query.year as string) || (req.user?.role === 'FACULTY' ? req.user.assignedYear : undefined);
    const sectionFilter = (req.query.section as string) || (req.user?.role === 'FACULTY' ? req.user.assignedSection : undefined);
    const includeTest = req.query.includeTest === 'true';

    const analytics = await getLeetCodeFullAnalytics(
      yearFilter === 'ALL' ? undefined : yearFilter,
      sectionFilter === 'ALL' ? undefined : sectionFilter,
      includeTest
    );

    return res.json(analytics);
  } catch (err: any) {
    console.error('Error fetching LeetCode Full Analytics:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate LeetCode Full Analytics.' });
  }
});

export default router;
