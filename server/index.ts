import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import facultyRoutes from './routes/faculty.js';
import hodRoutes from './routes/hod.js';
import studentRoutes from './routes/student.js';
import filesRoutes from './routes/files.js';
import subjectsRoutes from './routes/subjects.js';
import rankingsRoutes from './routes/rankings.js';
import skilledgeRoutes from './routes/skilledge.js';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for local & production origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://aids-department-portal.vercel.app'
];

if (process.env.FRONTEND_URL) {
  const customOrigin = process.env.FRONTEND_URL.trim().replace(/\/$/, '');
  if (!allowedOrigins.includes(customOrigin)) {
    allowedOrigins.push(customOrigin);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/skilledge', skilledgeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', department: 'AI & Data Science', timestamp: new Date().toISOString() });
});

// Production & Preview Static Serving if client dist exists
const DIST_PATH = path.resolve(process.cwd(), 'dist');
if (!process.env.VERCEL && fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(DIST_PATH, 'index.html'));
    }
    next();
  });
}

import { initSkillEdgeScheduler } from './services/skilledgeSync.js';

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 AI & DS Department Server listening on http://127.0.0.1:${PORT}`);
    initSkillEdgeScheduler();
  });
}

export default app;
