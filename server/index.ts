import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import facultyRoutes from './routes/faculty';
import hodRoutes from './routes/hod';
import studentRoutes from './routes/student';
import filesRoutes from './routes/files';
import subjectsRoutes from './routes/subjects';
import rankingsRoutes from './routes/rankings';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for local & production origins
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', department: 'AI & Data Science', timestamp: new Date().toISOString() });
});

// Production Static Serving if client dist exists
const DIST_PATH = path.resolve(process.cwd(), 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

import { initSkillEdgeScheduler } from './services/skilledgeSync';

app.listen(PORT, () => {
  console.log(`🚀 AI & DS Department Server listening on http://127.0.0.1:${PORT}`);
  initSkillEdgeScheduler();
});
