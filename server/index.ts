import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { metricsStorage, RequestMetrics } from './metrics.js';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import facultyRoutes from './routes/faculty.js';
import hodRoutes from './routes/hod.js';
import studentRoutes from './routes/student.js';
import filesRoutes from './routes/files.js';
import subjectsRoutes from './routes/subjects.js';
import rankingsRoutes from './routes/rankings.js';
import skilledgeRoutes from './routes/skilledge.js';
import disciplineRoutes from './routes/discipline.js';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for local & production origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://aidsportal.vercel.app',
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

// Performance & APM Timing Middleware
app.use((req, res, next) => {
  const start = performance.now();
  const metrics: RequestMetrics = {
    startTime: start,
    dbTimeMs: 0,
    dbQueries: 0,
    dbConnTimeMs: 0,
    bcryptTimeMs: 0
  };

  metricsStorage.run(metrics, () => {
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const durationMs = performance.now() - start;
      const durationStr = durationMs.toFixed(2);
      if (!res.headersSent) {
        let serverTiming = `app;dur=${durationStr};desc="Backend Total"`;
        if (metrics.dbQueries > 0) {
          const dbTimeStr = metrics.dbTimeMs.toFixed(2);
          serverTiming += `, db;dur=${dbTimeStr};desc="PostgreSQL (${metrics.dbQueries}q)"`;
          res.setHeader('X-DB-Time', `${dbTimeStr}ms`);
          res.setHeader('X-DB-Queries', String(metrics.dbQueries));
        }
        if (metrics.dbConnTimeMs > 0) {
          const connTimeStr = metrics.dbConnTimeMs.toFixed(2);
          serverTiming += `, conn;dur=${connTimeStr};desc="DB Pool Connect"`;
          res.setHeader('X-DB-Conn-Time', `${connTimeStr}ms`);
        }
        if (metrics.bcryptTimeMs > 0) {
          const bcryptStr = metrics.bcryptTimeMs.toFixed(2);
          serverTiming += `, bcrypt;dur=${bcryptStr};desc="Bcrypt Verify"`;
          res.setHeader('X-Bcrypt-Time', `${bcryptStr}ms`);
        }
        res.setHeader('Server-Timing', serverTiming);
        res.setHeader('X-Response-Time', `${durationStr}ms`);
      }
      return (originalEnd as any).apply(this, args);
    };
    next();
  });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// API Routes (Mounted on both /api and direct root for Vercel Serverless Function compatibility)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/faculty', facultyRoutes);
app.use('/api/hod', hodRoutes);
app.use('/hod', hodRoutes);
app.use('/api/student', studentRoutes);
app.use('/student', studentRoutes);
app.use('/api/files', filesRoutes);
app.use('/files', filesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/subjects', subjectsRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/rankings', rankingsRoutes);
app.use('/api/skilledge', skilledgeRoutes);
app.use('/skilledge', skilledgeRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use('/discipline', disciplineRoutes);

// Health check endpoint (Responds to /api/health, /health, and root /api)
app.get(['/api/health', '/health', '/api', '/'], (req, res) => {
  res.json({ status: 'ok', department: 'AI & Data Science', timestamp: new Date().toISOString() });
});

// Global API JSON Error Handler — guarantees all failures return JSON, preventing "Unexpected token 'A'"
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error Caught]', err);
  if (res.headersSent) {
    return next(err);
  }
  const status = typeof err.status === 'number' && err.status >= 400 && err.status <= 599 ? err.status : 500;
  return res.status(status).json({
    success: false,
    error: err.message || 'An internal server error occurred.',
    timestamp: new Date().toISOString()
  });
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
import { pgPool } from './postgresAdapter.js';

if (!process.env.VERCEL) {
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 AI & DS Department Server listening on 0.0.0.0:${PORT}`);
    initSkillEdgeScheduler();
  });

  const handleShutdown = (signal: string) => {
    console.log(`🛑 [Graceful Shutdown] ${signal} signal received. Closing HTTP server and database pool...`);
    server.close(async () => {
      console.log('✅ [Graceful Shutdown] HTTP server closed.');
      if (pgPool) {
        try {
          await pgPool.end();
          console.log('✅ [Graceful Shutdown] PostgreSQL connection pool drained.');
        } catch (err: any) {
          console.warn('⚠️ [Graceful Shutdown] Error draining PostgreSQL pool:', err.message);
        }
      }
      process.exit(0);
    });

    // Enforce termination if connections take longer than 10 seconds to close
    setTimeout(() => {
      console.error('⚠️ [Graceful Shutdown] Could not close connections in time, forcefully terminating.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

export default app;
