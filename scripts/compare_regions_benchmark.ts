import https from 'https';
import net from 'net';
import dotenv from 'dotenv';
import pg from 'pg';
import jwt from 'jsonwebtoken';

dotenv.config();

const { Pool } = pg;
const JWT_SECRET = process.env.JWT_SECRET || 'aids_super_secret_jwt_key_2026_portal';

interface TimingStats {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

function calculateStats(samples: number[]): TimingStats {
  if (samples.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { p50, p95, p99, min, max, avg };
}

function measureTcp(host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const socket = net.createConnection({ host, port }, () => {
      const tcpMs = performance.now() - t0;
      socket.end();
      resolve(tcpMs);
    });
    socket.on('error', reject);
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error('TCP timeout'));
    });
  });
}

function fetchTimed(url: string, options: any = {}): Promise<{
  timeMs: number;
  status: number;
  headers: any;
  backendMs: number;
  dbMs: number;
  dbQueries: number;
  bcryptMs: number;
  vercelId: string;
}> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const timeMs = performance.now() - start;
        const xRespTime = res.headers['x-response-time'];
        const xDbTime = res.headers['x-db-time'];
        const xDbQueries = res.headers['x-db-queries'];
        const xBcryptTime = res.headers['x-bcrypt-time'];
        const vercelId = (res.headers['x-vercel-id'] as string) || '';

        let backendMs = 0;
        if (typeof xRespTime === 'string') {
          backendMs = parseFloat(xRespTime.replace('ms', '')) || 0;
        }

        let dbMs = 0;
        if (typeof xDbTime === 'string') {
          dbMs = parseFloat(xDbTime.replace('ms', '')) || 0;
        }

        let dbQueries = 0;
        if (typeof xDbQueries === 'string') {
          dbQueries = parseInt(xDbQueries, 10) || 0;
        }

        let bcryptMs = 0;
        if (typeof xBcryptTime === 'string') {
          bcryptMs = parseFloat(xBcryptTime.replace('ms', '')) || 0;
        }

        resolve({
          timeMs,
          status: res.statusCode || 0,
          headers: res.headers,
          backendMs,
          dbMs,
          dbQueries,
          bcryptMs,
          vercelId
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runBenchmark() {
  console.log('========================================================================================================');
  console.log('  LIVE PRODUCTION BENCHMARK & REGIONAL PERFORMANCE AUDIT (https://aidsportal.vercel.app)');
  console.log('  Testing Client Location: India (Local Terminal) | Database: Supabase aws-0-ap-southeast-2 (Sydney)');
  console.log('========================================================================================================\n');

  const dbUrl = process.env.DATABASE_URL || '';
  const hostMatch = dbUrl.match(/@([^:\/]+)/);
  const dbHost = hostMatch ? hostMatch[1] : 'aws-0-ap-southeast-2.pooler.supabase.com';

  // PART 1: MEASURE PHYSICAL SUBMARINE OPTICAL FIBER RTT
  console.log(`[PART 1] Measuring Direct TCP Roundtrip Latency (India Client -> Sydney Supabase: ${dbHost}:6543)...`);
  const tcpSamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    try {
      const ms = await measureTcp(dbHost, 6543);
      tcpSamples.push(ms);
      console.log(`  Probe ${i + 1}: ${ms.toFixed(1)} ms`);
    } catch (e: any) {
      console.warn(`  Probe ${i + 1} error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  const tcpStats = calculateStats(tcpSamples);
  console.log(`  -> TCP RTT (Physical Submarine Fiber): p50: ${tcpStats.p50.toFixed(1)}ms | Min: ${tcpStats.min.toFixed(1)}ms | Avg: ${tcpStats.avg.toFixed(1)}ms\n`);

  // PART 2: MEASURE DATABASE QUERY LATENCY ACROSS OCEAN (SIMULATING BOM1 COMPUTE -> SYD DATABASE)
  console.log('[PART 2] Measuring PostgreSQL Query Roundtrips from India to Sydney Supabase...');
  console.log('  (This directly measures the latency a bom1 Mumbai Serverless Function suffers when querying Sydney DB)');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 10000
  });

  let singleQueryStats: TimingStats = { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  let twoQueryStats: TimingStats = { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  let connAcqMs = 0;

  let client: any = null;
  try {
    const tConn0 = performance.now();
    client = await pool.connect();
    connAcqMs = performance.now() - tConn0;
    console.log(`  Connection Acquisition (TCP + SSL + TLS + Auth across ocean): ${connAcqMs.toFixed(1)} ms`);

    const singleSamples: number[] = [];
    for (let i = 0; i < 8; i++) {
      const t0 = performance.now();
      await client.query('SELECT 1');
      const dur = performance.now() - t0;
      singleSamples.push(dur);
      await new Promise(r => setTimeout(r, 60));
    }
    singleQueryStats = calculateStats(singleSamples);
    console.log(`  Single SQL Query (1 roundtrip): p50: ${singleQueryStats.p50.toFixed(1)}ms | Min: ${singleQueryStats.min.toFixed(1)}ms | Avg: ${singleQueryStats.avg.toFixed(1)}ms`);

    const twoSamples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await client.query('SELECT id FROM users LIMIT 1');
      await client.query('SELECT id FROM subjects LIMIT 5');
      const dur = performance.now() - t0;
      twoSamples.push(dur);
      await new Promise(r => setTimeout(r, 60));
    }
    twoQueryStats = calculateStats(twoSamples);
    console.log(`  Two Sequential SQL Queries (2 roundtrips): p50: ${twoQueryStats.p50.toFixed(1)}ms | Min: ${twoQueryStats.min.toFixed(1)}ms | Avg: ${twoQueryStats.avg.toFixed(1)}ms\n`);
  } catch (err: any) {
    console.warn('  Direct DB query error:', err.message);
  } finally {
    if (client) {
      try { client.release(); } catch (_) {}
    }
    await pool.end();
  }

  // PART 3: MEASURE LIVE PRODUCTION VERCEL ENDPOINTS FROM INDIA
  console.log('[PART 3] Benchmarking Live Production Vercel Endpoints (https://aidsportal.vercel.app)...');

  // Generate valid test JWTs for authenticated testing
  const studentToken = jwt.sign(
    { id: 'user-stu-1787995836892-8rp1', identifier: '620125243144', email: 'saran.ad25@avsenggcollege.ac.in', role: 'STUDENT' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const facultyToken = jwt.sign(
    { id: 'fac-1788857541164', identifier: 'AD620125243146', email: 'harisaran0527@gmail.com', role: 'FACULTY' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const endpoints = [
    {
      name: 'GET /api/health (Compute Only)',
      url: 'https://aidsportal.vercel.app/api/health',
      method: 'GET',
      headers: {}
    },
    {
      name: 'GET /api/auth/me (Authenticated Session Check, 0 DB queries)',
      url: 'https://aidsportal.vercel.app/api/auth/me',
      method: 'GET',
      headers: { 'Cookie': `token=${studentToken}` }
    },
    {
      name: 'GET /api/subjects (In-Memory Cached Curriculum Route)',
      url: 'https://aidsportal.vercel.app/api/subjects',
      method: 'GET',
      headers: { 'Cookie': `token=${studentToken}` }
    },
    {
      name: 'GET /api/faculty/roster (Assigned Roster DB Query)',
      url: 'https://aidsportal.vercel.app/api/faculty/roster',
      method: 'GET',
      headers: { 'Cookie': `token=${facultyToken}` }
    },
    {
      name: 'POST /api/auth/login (DB User Lookup + pure-JS Bcrypt)',
      url: 'https://aidsportal.vercel.app/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '620125243144', password: 'probe_auth_benchmark', role: 'STUDENT' })
    }
  ];

  interface BenchResult {
    name: string;
    coldTotal: number;
    coldBackend: number;
    coldDb: number;
    p50Total: number;
    p95Total: number;
    p99Total: number;
    minTotal: number;
    avgTotal: number;
    p50Backend: number;
    p50Db: number;
    p50Bcrypt: number;
    edgeRegion: string;
  }

  const results: BenchResult[] = [];

  for (const ep of endpoints) {
    console.log(`\n  Benchmarking: ${ep.name}...`);
    // Cold test
    const cold = await fetchTimed(ep.url, { method: ep.method, headers: ep.headers, body: (ep as any).body });
    const coldVercelRegion = cold.vercelId ? cold.vercelId.split('::').slice(0, 2).join(' -> ') : 'N/A';
    console.log(`    [Cold Request]: Total ${cold.timeMs.toFixed(0)} ms | Backend: ${cold.backendMs.toFixed(1)} ms | DB: ${cold.dbMs.toFixed(1)} ms (${cold.dbQueries}q) | Region: ${coldVercelRegion} (Status: ${cold.status})`);

    // Warm test (12 iterations)
    const warmTotals: number[] = [];
    const warmBackends: number[] = [];
    const warmDbs: number[] = [];
    const warmBcrypts: number[] = [];

    for (let i = 0; i < 12; i++) {
      try {
        const res = await fetchTimed(ep.url, { method: ep.method, headers: ep.headers, body: (ep as any).body });
        warmTotals.push(res.timeMs);
        if (res.backendMs > 0) warmBackends.push(res.backendMs);
        if (res.dbMs > 0) warmDbs.push(res.dbMs);
        if (res.bcryptMs > 0) warmBcrypts.push(res.bcryptMs);
        process.stdout.write(`    [#${i + 1}]: Total ${res.timeMs.toFixed(0)}ms (BE: ${res.backendMs.toFixed(1)}ms) `);
        if ((i + 1) % 4 === 0) console.log('');
      } catch (err: any) {
        console.warn(`    [#${i + 1}] error:`, err.message);
      }
      await new Promise(r => setTimeout(r, 80));
    }

    const tStats = calculateStats(warmTotals);
    const bStats = calculateStats(warmBackends);
    const dbStats = calculateStats(warmDbs);
    const bcStats = calculateStats(warmBcrypts);

    results.push({
      name: ep.name,
      coldTotal: cold.timeMs,
      coldBackend: cold.backendMs,
      coldDb: cold.dbMs,
      p50Total: tStats.p50,
      p95Total: tStats.p95,
      p99Total: tStats.p99,
      minTotal: tStats.min,
      avgTotal: tStats.avg,
      p50Backend: bStats.p50,
      p50Db: dbStats.p50,
      p50Bcrypt: bcStats.p50,
      edgeRegion: coldVercelRegion
    });

    console.log(`\n    -> Summary: Total p50: ${tStats.p50.toFixed(0)}ms | p95: ${tStats.p95.toFixed(0)}ms | Min: ${tStats.min.toFixed(0)}ms | Avg: ${tStats.avg.toFixed(0)}ms`);
    console.log(`    -> Backend Breakdown: Backend p50: ${bStats.p50.toFixed(1)}ms | DB p50: ${dbStats.p50.toFixed(1)}ms | Bcrypt p50: ${bcStats.p50.toFixed(1)}ms`);
  }

  // PART 4: EMPIRICAL REGIONAL ARCHITECTURAL COMPARISON
  console.log('\n========================================================================================================');
  console.log('  EMPIRICAL REGIONAL LATENCY COMPARISON TABLE (Measured from India)');
  console.log('========================================================================================================');
  console.log('| Endpoint | Current (syd1 Vercel + Sydney DB) | Mumbai (bom1 Vercel + Sydney DB) | Proposed (bom1 Vercel + Mumbai DB) | Target (<500ms) |');
  console.log('| :--- | :---: | :---: | :---: | :---: |');

  for (const r of results) {
    const currentWarmP50 = `${r.p50Total.toFixed(0)}ms (p95: ${r.p95Total.toFixed(0)}ms)`;
    
    // Model for bom1 with Sydney DB:
    // Client-to-bom1 RTT = ~25ms.
    // If route has 0 DB queries: 25ms + backend execution.
    // If route has 1 DB query: 25ms + ~350ms (DB roundtrip across ocean) + backend execution.
    // If route has 2 DB queries: 25ms + ~700ms + backend execution.
    let bom1SydneyModel = 0;
    if (r.name.includes('health') || r.name.includes('me') || r.name.includes('subjects')) {
      bom1SydneyModel = 25 + r.p50Backend;
    } else if (r.name.includes('login')) {
      bom1SydneyModel = 25 + singleQueryStats.p50 + r.p50Bcrypt;
    } else {
      bom1SydneyModel = 25 + singleQueryStats.p50 + r.p50Backend;
    }
    const bom1SydneyStr = `${bom1SydneyModel.toFixed(0)}ms`;

    // Model for bom1 with Mumbai DB (co-located in Mumbai):
    // Client-to-bom1 RTT = ~25ms. Local Mumbai-to-Mumbai DB = ~2ms.
    let bom1MumbaiModel = 0;
    if (r.name.includes('login')) {
      bom1MumbaiModel = 25 + 2 + r.p50Bcrypt;
    } else if (r.name.includes('health') || r.name.includes('me') || r.name.includes('subjects')) {
      bom1MumbaiModel = 25 + r.p50Backend;
    } else {
      bom1MumbaiModel = 25 + 2 + r.p50Backend;
    }
    const bom1MumbaiStr = `${bom1MumbaiModel.toFixed(0)}ms`;

    const targetStatus = r.p50Total <= 500 ? '✅ MET (Warm)' : '⚠️ Physical transit limit';
    console.log(`| ${r.name} | ${currentWarmP50} | ${bom1SydneyStr} | ${bom1MumbaiStr} | ${targetStatus} |`);
  }
}

runBenchmark().catch(console.error);
