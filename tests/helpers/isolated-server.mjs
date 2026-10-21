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
        export const normalizeYear = value => ({I:'1st Year',II:'2nd Year',III:'3rd Year',IV:'4th Year'}[value] || value || '');
        export const normalizeSection = value => String(value || '').trim().toUpperCase();
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
