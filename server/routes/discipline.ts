import { db, normalizeYear, normalizeSection } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { withPrimaryDatabase } from '../databasePolicy.js';
import { createDisciplineRouter } from './disciplineRouter.js';

export const { router, resolveFacultyAssignmentForStudent } = createDisciplineRouter({
  db, authenticateToken, requireRole, normalizeYear, normalizeSection,
  primaryDatabaseOnly: (_req, _res, next) => withPrimaryDatabase(next)
});

export default router;
