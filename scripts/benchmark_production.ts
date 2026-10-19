import https from 'https';

interface LatencyResult {
  url: string;
  samples: number[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

function fetchTimed(url: string, options: any = {}): Promise<{ timeMs: number; status: number; headers: any }> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const timeMs = performance.now() - start;
        resolve({ timeMs, status: res.statusCode || 0, headers: res.headers });
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
  console.log('========================================================');
  console.log('  CURRENT PRODUCTION BENCHMARK (https://aidsportal.vercel.app)');
  console.log('========================================================\n');

  // Check Region and Headers
  const probe = await fetchTimed('https://aidsportal.vercel.app/api/health');
  console.log(`Region / Edge Header: ${probe.headers['x-vercel-id'] || 'N/A'}`);
  console.log(`Initial Health Check: ${probe.timeMs.toFixed(1)} ms (Status: ${probe.status})\n`);

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
      name: 'GET /api/subjects (Protected API Route)', 
      url: 'https://aidsportal.vercel.app/api/subjects', 
      method: 'GET'
    }
  ];

  const results: Record<string, LatencyResult> = {};

  for (const ep of endpoints) {
    console.log(`Benchmarking: ${ep.name}...`);
    const samples: number[] = [];
    const iterations = 15;

    for (let i = 0; i < iterations; i++) {
      try {
        const res = await fetchTimed(ep.url, { 
          method: ep.method, 
          headers: ep.headers,
          body: ep.body 
        });
        samples.push(res.timeMs);
        process.stdout.write(`  [${i + 1}/${iterations}]: ${res.timeMs.toFixed(0)}ms `);
        if ((i + 1) % 5 === 0) console.log('');
      } catch (err: any) {
        console.error(`Error on sample ${i + 1}:`, err.message);
      }
      // Small delay between samples
      await new Promise(r => setTimeout(r, 100));
    }

    const stats = calculatePercentiles(samples);
    results[ep.name] = { url: ep.url, samples, ...stats };

    console.log(`\n  -> p50: ${stats.p50.toFixed(1)}ms | p95: ${stats.p95.toFixed(1)}ms | p99: ${stats.p99.toFixed(1)}ms | Avg: ${stats.avg.toFixed(1)}ms | Min: ${stats.min.toFixed(1)}ms | Max: ${stats.max.toFixed(1)}ms\n`);
  }

  console.log('\n========================================================');
  console.log('  SUMMARY TABLE (BEFORE OPTIMIZATION)');
  console.log('========================================================');
  console.log('| Endpoint | p50 | p95 | p99 | Min | Max | Avg |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const [name, r] of Object.entries(results)) {
    console.log(`| ${name} | ${r.p50.toFixed(0)}ms | ${r.p95.toFixed(0)}ms | ${r.p99.toFixed(0)}ms | ${r.min.toFixed(0)}ms | ${r.max.toFixed(0)}ms | ${r.avg.toFixed(0)}ms |`);
  }
}

benchmark().catch(console.error);
