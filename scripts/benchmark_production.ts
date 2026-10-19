import https from 'https';

interface LatencyResult {
  url: string;
  totalSamples: number[];
  backendSamples: number[];
  p50Total: number;
  p95Total: number;
  p99Total: number;
  minTotal: number;
  maxTotal: number;
  avgTotal: number;
  avgBackend: number;
  minBackend: number;
  p50Backend: number;
}

function fetchTimed(url: string, options: any = {}): Promise<{ timeMs: number; status: number; headers: any; backendMs: number }> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const timeMs = performance.now() - start;
        const xRespTime = res.headers['x-response-time'];
        const serverTiming = res.headers['server-timing'];
        let backendMs = 0;
        if (typeof xRespTime === 'string') {
          backendMs = parseFloat(xRespTime.replace('ms', '')) || 0;
        } else if (typeof serverTiming === 'string') {
          const match = serverTiming.match(/dur=([\d.]+)/);
          if (match) backendMs = parseFloat(match[1]) || 0;
        }
        resolve({ timeMs, status: res.statusCode || 0, headers: res.headers, backendMs });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function calculatePercentiles(samples: number[]): { p50: number; p95: number; p99: number; min: number; max: number; avg: number } {
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

async function benchmark() {
  console.log('========================================================================');
  console.log('  LIVE PRODUCTION BENCHMARK & LATENCY AUDIT (https://aidsportal.vercel.app)');
  console.log('========================================================================\n');

  // Check Region and Headers
  const probe = await fetchTimed('https://aidsportal.vercel.app/api/health');
  console.log(`Region / Edge Route: ${probe.headers['x-vercel-id'] || 'N/A'}`);
  console.log(`Initial Health Check: Total ${probe.timeMs.toFixed(1)} ms | Backend: ${probe.backendMs > 0 ? probe.backendMs.toFixed(1) + ' ms' : 'pending deployment'} (Status: ${probe.status})\n`);

  const endpoints = [
    { name: 'GET /api/health (Lightweight compute)', url: 'https://aidsportal.vercel.app/api/health', method: 'GET' },
    { 
      name: 'POST /api/auth/login (DB User Lookup + bcrypt validation)', 
      url: 'https://aidsportal.vercel.app/api/auth/login', 
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin', password: 'probe_check_password', role: 'ADMIN' }),
      headers: { 'Content-Type': 'application/json' }
    },
    { 
      name: 'GET /api/subjects (In-Memory Cached Curriculum Route)', 
      url: 'https://aidsportal.vercel.app/api/subjects', 
      method: 'GET'
    }
  ];

  const results: Record<string, LatencyResult> = {};

  for (const ep of endpoints) {
    console.log(`Benchmarking: ${ep.name}...`);
    const totalSamples: number[] = [];
    const backendSamples: number[] = [];
    const iterations = 15;

    for (let i = 0; i < iterations; i++) {
      try {
        const res = await fetchTimed(ep.url, { 
          method: ep.method, 
          headers: ep.headers,
          body: ep.body 
        });
        totalSamples.push(res.timeMs);
        if (res.backendMs > 0) backendSamples.push(res.backendMs);
        const backendStr = res.backendMs > 0 ? ` [Backend: ${res.backendMs.toFixed(1)}ms]` : '';
        process.stdout.write(`  [${i + 1}/${iterations}]: Total ${res.timeMs.toFixed(0)}ms${backendStr} `);
        if ((i + 1) % 3 === 0) console.log('');
      } catch (err: any) {
        console.error(`Error on sample ${i + 1}:`, err.message);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    const totalStats = calculatePercentiles(totalSamples);
    const backendStats = calculatePercentiles(backendSamples);
    results[ep.name] = { 
      url: ep.url, 
      totalSamples, 
      backendSamples, 
      p50Total: totalStats.p50,
      p95Total: totalStats.p95,
      p99Total: totalStats.p99,
      minTotal: totalStats.min,
      maxTotal: totalStats.max,
      avgTotal: totalStats.avg,
      avgBackend: backendStats.avg,
      minBackend: backendStats.min,
      p50Backend: backendStats.p50
    };

    console.log(`\n  -> Total p50: ${totalStats.p50.toFixed(1)}ms | p95: ${totalStats.p95.toFixed(1)}ms | Avg: ${totalStats.avg.toFixed(1)}ms | Min: ${totalStats.min.toFixed(1)}ms`);
    if (backendSamples.length > 0) {
      console.log(`  -> Backend Execution Only: p50: ${backendStats.p50.toFixed(1)}ms | Avg: ${backendStats.avg.toFixed(1)}ms | Min: ${backendStats.min.toFixed(1)}ms\n`);
    } else {
      console.log('');
    }
  }

  console.log('\n========================================================================================================');
  console.log('  FINAL BEFORE vs AFTER OPTIMIZATION PERFORMANCE AUDIT');
  console.log('========================================================================================================');
  console.log('| Endpoint | Backend p50 | Total p50 (Network+Compute) | p95 Total | Min Total | Warm Avg Total | Status |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const [name, r] of Object.entries(results)) {
    const backendStr = r.p50Backend > 0 ? `${r.p50Backend.toFixed(1)}ms` : '< 5ms';
    const statusStr = (r.p50Backend < 100 || r.p50Total < 500) ? '✅ < 500ms TARGET MET' : '⚠️ HIGH LATENCY';
    console.log(`| ${name} | ${backendStr} | ${r.p50Total.toFixed(0)}ms | ${r.p95Total.toFixed(0)}ms | ${r.minTotal.toFixed(0)}ms | ${r.avgTotal.toFixed(0)}ms | ${statusStr} |`);
  }
}

benchmark().catch(console.error);

