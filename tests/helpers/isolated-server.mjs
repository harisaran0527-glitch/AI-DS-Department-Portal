import fs from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

/** Load real server handlers while blocking database bootstrap and dotenv in test workers. */
export function isolateServer(database, modules = {}, { loadRealDatabase = false, namedModules = {} } = {}) {
  globalThis.__isolatedServerDatabase = database;
  globalThis.__isolatedServerModules = modules;
  globalThis.__isolatedNamedModules = namedModules;
  const dbUrl = new URL('../../server/db.ts', import.meta.url).href;
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'dotenv') return { url: 'isolated-test:dotenv', shortCircuit: true };
      if (Object.hasOwn(modules, specifier)) return { url: `isolated-test:module:${specifier}`, shortCircuit: true };
      if (Object.hasOwn(namedModules, specifier)) return { url: `isolated-test:named:${specifier}`, shortCircuit: true };
      if (specifier.startsWith('.') && (specifier.endsWith('.js') || !/\.[^/]+$/.test(specifier)) && context.parentURL?.startsWith('file:')) {
        const candidate = new URL((specifier.endsWith('.js') ? specifier.slice(0, -3) : specifier) + '.ts', context.parentURL);
        if (fs.existsSync(candidate)) return next(candidate.href, context);
        const tsxCandidate = new URL(candidate.href + 'x');
        if (fs.existsSync(tsxCandidate)) return next(tsxCandidate.href, context);
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
      if (url === 'isolated-test:dotenv') return { format: 'module', shortCircuit: true, source: 'export default {config() {return {parsed: {}};}};' };
      if (url.startsWith('isolated-test:module:')) return { format: 'module', shortCircuit: true,
        source: `export default globalThis.__isolatedServerModules[${JSON.stringify(url.slice('isolated-test:module:'.length))}];` };
      if (url.startsWith('isolated-test:named:')) {
        const specifier = url.slice('isolated-test:named:'.length);
        return { format: 'module', shortCircuit: true, source: Object.keys(namedModules[specifier]).map(key =>
          `export const ${key} = globalThis.__isolatedNamedModules[${JSON.stringify(specifier)}][${JSON.stringify(key)}];`).join('\n') };
      }
      if (url === dbUrl && !loadRealDatabase) return { format: 'module', shortCircuit: true, source: `
        export const db = globalThis.__isolatedServerDatabase;
        export const normalizeYear = y => {
          if (!y) return '';
          const str = String(y).trim();
          const lower = str.toLowerCase();
          if (lower === '1' || lower === '1st' || lower === 'i' || lower.includes('first') || lower === 'year 1' || lower === '1st year') return '1st Year';
          if (lower === '2' || lower === '2nd' || lower === 'ii' || lower.includes('second') || lower === 'year 2' || lower === '2nd year') return '2nd Year';
          if (lower === '3' || lower === '3rd' || lower === 'iii' || lower.includes('third') || lower === 'year 3' || lower === '3rd year') return '3rd Year';
          if (lower === '4' || lower === '4th' || lower === 'iv' || lower.includes('fourth') || lower.includes('final') || lower === 'year 4' || lower === '4th year') return '4th Year';
          return str;
        };
        export const normalizeSection = s => {
          if (!s) return '';
          const str = String(s).trim().toUpperCase();
          if (str === 'ALL' || str === 'COMMON' || str === 'ALL SECTIONS') return 'ALL';
          if (str.startsWith('SECTION ')) return str.replace('SECTION ', '').trim();
          if (str.startsWith('SEC ')) return str.replace('SEC ', '').trim();
          if (str.startsWith('SEC.')) return str.replace('SEC.', '').trim();
          return str;
        };
        export const normalizeSemester = (sem, yr, fallbackSem) => {
          if (sem !== undefined && sem !== null && String(sem).trim() !== '') {
            const parsed = parseInt(String(sem).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) return parsed;
          }
          if (fallbackSem !== undefined && fallbackSem !== null && String(fallbackSem).trim() !== '') {
            const parsed = parseInt(String(fallbackSem).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) return parsed;
          }
          const cleanYr = normalizeYear(yr);
          if (cleanYr === '1st Year') return 1;
          if (cleanYr === '2nd Year') return 3;
          if (cleanYr === '3rd Year') return 5;
          if (cleanYr === '4th Year') return 7;
          return 3;
        };
        export const normalizePersonName = name => String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        export const verifyStudentNameMatch = (input, dbName) => {
          if (!input || !input.trim()) return true;
          const n1 = normalizePersonName(input);
          const n2 = normalizePersonName(dbName);
          if (!n1 || !n2) return true;
          if (n1 === n2) return true;
          const w1 = n1.split(' ').filter(Boolean).sort().join(' ');
          const w2 = n2.split(' ').filter(Boolean).sort().join(' ');
          return w1 === w2;
        };
        export const normalizeStudentRecord = stu => stu ? ({
          ...stu,
          registerNo: (stu.register_no || stu.registerNo || '').trim(),
          register_no: (stu.register_no || stu.registerNo || '').trim(),
          collegeEmail: (stu.email || stu.collegeEmail || stu.college_email || '').trim(),
          college_email: (stu.email || stu.collegeEmail || stu.college_email || '').trim(),
          classCoordinatorName: stu.class_coordinator_name || stu.classCoordinatorName || 'Assigned Faculty',
          class_coordinator_name: stu.class_coordinator_name || stu.classCoordinatorName || 'Assigned Faculty',
          overallScore: stu.overall_score !== undefined ? stu.overall_score : (stu.overallScore || 0),
          overall_score: stu.overall_score !== undefined ? stu.overall_score : (stu.overallScore || 0),
          currentRank: stu.current_rank !== undefined ? stu.current_rank : (stu.currentRank || 99),
          current_rank: stu.current_rank !== undefined ? stu.current_rank : (stu.currentRank || 99),
        }) : null;
        export const safeParseJson = (val, fallback) => (val === null || val === undefined) ? fallback : (typeof val === 'object' ? val : (() => { try { return JSON.parse(val); } catch { return fallback; } })());
        export class SQLiteDB {}
      ` };
      if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
        const source = fs.readFileSync(new URL(url), 'utf8');
        return { format: 'module', shortCircuit: true, source: ts.transpileModule(source,
          { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText };
      }
      return next(url, context);
    }
  });
}
