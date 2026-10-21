import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const filters = process.argv.slice(2);
const files = fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.test.mjs') &&
  (!filters.length || filters.some(filter => file.includes(filter))));
if (!files.length) throw new Error('No matching isolated tests.');

// Do not inherit live credentials, endpoints, dotenv overrides, or preload hooks.
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/^(?:DATABASE|NEON|SUPABASE|PG|JWT|GEMINI|GOOGLE_|ADMIN_|SKILLEDGE|FRONTEND_URL|VERCEL|VITE_|NODE_OPTIONS|DOTENV_CONFIG)/i.test(name)) delete env[name];
}
Object.assign(env, {
  NODE_ENV: 'test', VERCEL: '1', USE_SQLITE: 'false', DATABASE_PATH: ':memory:',
  JWT_SECRET: 'isolated-test-runner-only-never-use-for-deployment'
});
const result = spawnSync(process.execPath, ['--import', 'tsx/esm', '--test', ...files.map(file => path.join(root, 'tests', file))], {
  cwd: root, env, stdio: 'inherit'
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
