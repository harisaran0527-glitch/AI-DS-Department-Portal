import https from 'https';
import net from 'net';
import tls from 'tls';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

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

function measureTcpTls(host: string, port: number): Promise<{ tcpMs: number; tlsMs: number; totalMs: number }> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    let tTcp = 0;
    const socket = net.createConnection({ host, port }, () => {
      tTcp = performance.now() - t0;
      const tlsSocket = tls.connect({
        socket,
        servername: host,
        rejectUnauthorized: false
      }, () => {
        const totalMs = performance.now() - t0;
        const tlsMs = totalMs - tTcp;
        tlsSocket.end();
        resolve({ tcpMs: tTcp, tlsMs, totalMs });
      });
      tlsSocket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
    });
    socket.on('error', reject);
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error('TCP connection timeout'));
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
}> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const timeMs = performance.now() - start;
        const xRespTime = res.headers['x-response-time'];
        const serverTiming = res.headers['server-timing'];
        const xDbTime = res.headers['x-db-time'];
        const xDbQueries = res.headers['x-db-queries'];
        const xBcryptTime = res.headers['x-bcrypt-time'];

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
          bcryptMs
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
  console.log('====================================================================================');
  console.log('  PRODUCTION MULTI-REGION & LATENCY BENCHMARK SUITE');
  console.log('  Client Location: India (Local Terminal) | Production: https://aidsportal.vercel.app');
  console.log('====================================================================================\n');

  const dbUrl = process.env.DATABASE_URL || '';
  const hostMatch = dbUrl.match(/@([^:\/]+)/);
  const dbHost = hostMatch ? hostMatch[1] : 'aws-0-ap-southeast-2.pooler.supabase.com';

  console.log(`[TEST 1] Measuring Network RTT from India to Sydney Supabase (${dbHost}:6543)...`);
  const rttSamples: number[] = [];
  const tlsSamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    try {
      const res = await measureTcpTls(dbHost, 6543);
      rttSamples.push(res.tcpMs);
      tlsSamples.push(res.tlsMs);
      console.log(`  Probe ${i + 1}: TCP Handshake = ${res.tcpMs.toFixed(1)}ms | TLS Handshake = ${res.tlsMs.toFixed(1)}ms | Total Connect = ${res.totalMs.toFixed(1)}ms`);
    } catch (e: any) {
      console.warn(`  Probe ${i + 1} failed:`, e.message);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const tcpStats = calculateStats(rttSamples);
  console.log(`\n  -> India-to-Sydney Optical Submarine RTT (TCP): p50: ${tcpStats.p50.toFixed(1)}ms | Min: ${tcpStats.min.toFixed(1)}ms | Avg: ${tcpStats.avg.toFixed(1)}ms\n`);

  console.log('[TEST 2] Measuring Direct PostgreSQL Query RTT (India Client -> Sydney Supabase)...');
  console.log('  (Simulating the exact latency a bom1 Mumbai Serverless Function experiences when querying Sydney Supabase)');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 10000
  });

  try {
    const tConn0 = performance.now();
    const client = await pool.connect();
    const connAcqMs = performance.now() - tConn0;
    console.log(`  Initial DB Connection Acquisition (TCP + TLS + Auth): ${connAcqMs.toFixed(1)}ms`);

    const querySamples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const tQ0 = performance.now();
      await client.query('SELECT 1');
      const qMs = performance.now() - tQ0;
      querySamples.push(qMs);
      process.stdout.write(`  [Q${i + 1}]: ${qMs.toFixed(1)}ms `);
      if ((i + 1) % 5 === 0) console.log('');
      await new Promise(r => setTimeout(r, 50));
    }
    client.release();

    const qStats = calculateStats(querySamples);
    console.log(`\n  -> Direct DB Query Latency across Indian Ocean: p50: ${qStats.p50.toFixed(1)}ms | Min: ${qStats.min.toFixed(1)}ms | Avg: ${qStats.avg.toFixed(1)}ms\n`);
  } catch (err: any) {
    console.warn('  Direct DB query failed:', err.message);
  } finally {
    await pool.end();
  }

  console.log('[TEST 3] Benchmarking Live Production API Invocations (https://aidsportal.vercel.app)...');
  const endpoints = [
    { name: 'GET /api/health (Compute only)', url: 'https://aidsportal.vercel.app/api/health', method: 'GET' },
    { name: 'GET /api/subjects (In-Memory Cached)', url: 'https://aidsportal.vercel.app/api/subjects', method: 'GET' },
    { 
      name: 'POST /api/auth/login (DB Lookup + Bcrypt)', 
      url: 'https://aidsportal.vercel.app/api/auth/login', 
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin', password: 'probe_test_check', role: 'ADMIN' }),
      headers: { 'Content-Type': 'application/json' }
    }
  ];

  for (const ep of endpoints) {
    console.log(`\n  Testing: ${ep.name}...`);
    // Cold test
    const cold = await fetchTimed(ep.url, { method: ep.method, headers: ep.headers, body: ep.body });
    console.log(`  [Cold]: Total ${cold.timeMs.toFixed(0)}ms | Backend: ${cold.backendMs.toFixed(1)}ms | DB: ${cold.dbMs.toFixed(1)}ms (${cold.dbQueries}q) | Status: ${cold.status}`);

    const warmSamples: number[] = [];
    const warmBackend: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await fetchTimed(ep.url, { method: ep.method, headers: ep.headers, body: ep.body });
      warmSamples.push(res.timeMs);
      if (res.backendMs > 0) warmBackend.push(res.backendMs);
      await new Promise(r => setTimeout(r, 80));
    }
    const warmStats = calculateStats(warmSamples);
    const backendStats = calculateStats(warmBackend);
    console.log(`  [Warm (10 samples)]: Total p50: ${warmStats.p50.toFixed(0)}ms | p95: ${warmStats.p95.toFixed(0)}ms | Min: ${warmStats.min.toFixed(0)}ms | Avg: ${warmStats.avg.toFixed(0)}ms`);
    console.log(`  [Backend Compute]: p50: ${backendStats.p50.toFixed(1)}ms | Min: ${backendStats.min.toFixed(1)}ms | Avg: ${backendStats.avg.toFixed(1)}ms`);
  }
}

runBenchmark().catch(console.error);
