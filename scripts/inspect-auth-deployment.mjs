// Public repository evidence only; prints commit metadata and syntax counts, never source or secrets.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const repository = 'harisaran0527-glitch/AI-DS-Department-Portal';
const response = await fetch(`https://api.github.com/repos/${repository}/commits/main`, {
  headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20000)
});
if (!response.ok) throw new Error(`Public commit inspection returned HTTP ${response.status}`);
const commit = await response.json();
console.log(JSON.stringify({ remoteMain: commit.sha, committedAt: commit.commit.committer.date,
  subject: commit.commit.message.split('\n')[0], parents: commit.parents.map(parent => parent.sha),
  files: commit.files.map(file => ({ name: file.filename, status: file.status, additions: file.additions, deletions: file.deletions })) }));
const sourceResponse = await fetch(`https://raw.githubusercontent.com/${repository}/${commit.sha}/server/db.ts`, { signal: AbortSignal.timeout(20000) });
if (!sourceResponse.ok) throw new Error(`Public source inspection returned HTTP ${sourceResponse.status}`);
const remoteSource = await sourceResponse.text();
for (const [label, source] of [
  ['local-HEAD', execFileSync('git', ['show', 'HEAD:server/db.ts'], {encoding: 'utf8'})],
  ['working-tree', fs.readFileSync('server/db.ts', 'utf8')],
  ['remote-main', remoteSource]
]) {
  const file = ts.createSourceFile('db.ts', source, ts.ScriptTarget.Latest, true);
  const first = file.parseDiagnostics[0];
  console.log(JSON.stringify({ label, syntaxErrors: file.parseDiagnostics.length,
    ...(first ? { firstLine: file.getLineAndCharacterOfPosition(first.start).line + 1,
      firstError: ts.flattenDiagnosticMessageText(first.messageText, ' ') } : {}) }));
}
