import fs from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

/** Load real server handlers while blocking database bootstrap and dotenv in test workers. */
export function isolateServer(database, modules = {}, { loadRealDatabase = false } = {}) {
  globalThis.__isolatedServerDatabase = database;
  globalThis.__isolatedServerModules = modules;
  const dbUrl = new URL('../../server/db.ts', import.meta.url).href;
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'dotenv') return { url: 'isolated-test:dotenv', shortCircuit: true };
      if (Object.hasOwn(modules, specifier)) return { url: `isolated-test:module:${specifier}`, shortCircuit: true };
      if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
        const candidate = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
        if (fs.existsSync(candidate)) return next(candidate.href, context);
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url === 'isolated-test:dotenv') return { format: 'module', shortCircuit: true, source: 'export default {config() {return {parsed: {}};}};' };
      if (url.startsWith('isolated-test:module:')) return { format: 'module', shortCircuit: true,
        source: `export default globalThis.__isolatedServerModules[${JSON.stringify(url.slice('isolated-test:module:'.length))}];` };
      if (url === dbUrl && !loadRealDatabase) return { format: 'module', shortCircuit: true, source: `
        export const db = globalThis.__isolatedServerDatabase;
        export const normalizeYear = value => ({I:'1st Year',II:'2nd Year',III:'3rd Year',IV:'4th Year'}[value] || value || '');
        export const normalizeSection = value => String(value || '').trim().toUpperCase();
        export class SQLiteDB {}
      ` };
      if (url.startsWith('file:') && url.endsWith('.ts')) {
        const source = fs.readFileSync(new URL(url), 'utf8');
        return { format: 'module', shortCircuit: true, source: ts.transpileModule(source,
          { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText };
      }
      return next(url, context);
    }
  });
}
