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
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
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
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow flexible cross-origin authentication
      }
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

const listenPort = Number(PORT) || 5000;
app.listen(listenPort, '0.0.0.0', () => {
  console.log(`🚀 AI & DS Department Server listening on 0.0.0.0:${listenPort}`);
  initSkillEdgeScheduler();
});
