// Read-only configuration audit. Never emits secret values, token contents, or fingerprints.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import ts from 'typescript';

const roles = ['STUDENT', 'FACULTY', 'HOD', 'ADMIN'];
const deployedCommit = '51b7fb5c489dbcc935e97623fee77fc2a4d355cd';
const deployedMiddleware = execFileSync('git', ['show', `${deployedCommit}:server/middleware/auth.ts`], { encoding: 'utf8' });
function fallbackValue(source) {
  const file = ts.createSourceFile('auth.ts', source, ts.ScriptTarget.Latest, true);
  let fallback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'JWT_SECRET' &&
        node.initializer && ts.isBinaryExpression(node.initializer) && ts.isStringLiteral(node.initializer.right)) {
      fallback = node.initializer.right.text;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return fallback;
}
const publicFallback = fallbackValue(deployedMiddleware);
const envSources = ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '../.env'];
const credentialKeyPatterns = role => [
  new RegExp(`^(?:AUTH_|LIVE_|E2E_)?TEST_${role}_(?:PASSWORD|TOKEN|SESSION)$`),
  new RegExp(`^(?:AUTH_|LIVE_|E2E_)?${role}_TEST_(?:PASSWORD|TOKEN|SESSION)$`)
];
const sources = envSources.filter(file => fs.existsSync(file)).map(file => {
  const values = dotenv.parse(fs.readFileSync(file));
  const secret = values.JWT_SECRET;
  return { file: path.resolve(file), jwtPresent: Boolean(secret?.trim()),
    matchesPublicSourceFallback: Boolean(secret && publicFallback && secret === publicFallback),
    obviousPlaceholder: Boolean(secret && /your_.*secret|change_in_production|placeholder/i.test(secret)),
    testRolesWithCredentialVariableNames: roles.filter(role => Object.keys(values).some(key =>
      credentialKeyPatterns(role).some(pattern => pattern.test(key)) && Boolean(values[key]))),
    approvalEstablished: false };
});
const scripts = fs.readdirSync('scripts').filter(name => /auth|login|credential|session/i.test(name) && /\.[cm]?[jt]s$/.test(name))
  .map(name => {
    const source = fs.readFileSync(path.join('scripts', name), 'utf8');
    return { file: path.join('scripts', name),
      liveTargetMentioned: source.includes('aidsportal.vercel.app'),
      roleLabelsPresent: roles.filter(role => new RegExp(`['"]${role}['"]`, 'i').test(source)),
      environmentVariableNames: [...new Set([...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(match => match[1]))],
      containsCredentialLiterals: /(?:password|token|secret)\s*[:=]\s*['"`]/i.test(source),
      containsPotentialAccountMutationCode: /INSERT\s+INTO\s+users|UPDATE\s+users\s+SET\s+password|reset.?password|change-password|\.createUser\(/i.test(source),
      approvalEstablished: false };
  });
const localMiddleware = fs.readFileSync('server/middleware/auth.ts', 'utf8');
const report = { mode: 'read-only-no-secret-output', deployedCommit,
  configuredProcessKeyPresent: Boolean(process.env.JWT_SECRET?.trim()), sources, scriptCandidates: scripts,
  signingMechanism: {
    deployedSignsWithJwtSecret: /jwt\.sign\(tokenPayload, JWT_SECRET/.test(execFileSync('git', ['show', `${deployedCommit}:server/routes/auth.ts`], { encoding: 'utf8' })),
    deployedVerifiesWithJwtSecret: /jwt\.verify\(token, JWT_SECRET/.test(deployedMiddleware),
    localVerifiesWithSameMechanism: /jwt\.verify\(token, JWT_SECRET/.test(localMiddleware),
    localSourceFallbackMatchesDeployed: fallbackValue(localMiddleware) === publicFallback,
    disciplineImportsSharedMiddleware: /authenticateToken, requireRole.*from ['"]\.\.\/middleware\/auth\.js/.test(fs.readFileSync('server/routes/discipline.ts', 'utf8')),
    localProductionRejectsMissingConfiguration: /isJwtConfiguredForRuntime/.test(localMiddleware)
  }, approvedProductionKeyEstablished: false, approvedFourRoleLiveAccessEstablished: false };
console.log(JSON.stringify(report, null, 2));
