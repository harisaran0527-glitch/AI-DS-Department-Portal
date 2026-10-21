import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

let failures = 0;
let checked = 0;
function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) check(filename);
    else if (filename.endsWith('.ts')) {
      checked++;
      const file = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
      failures += file.parseDiagnostics.length;
      for (const diagnostic of file.parseDiagnostics.slice(0, 3)) {
        const location = file.getLineAndCharacterOfPosition(diagnostic.start);
        console.error(`${filename}:${location.line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
      }
    }
  }
}
check('server');
check('api');
console.log(`Parsed ${checked} server/API TypeScript files; ${failures} syntax errors. This does not verify runtime or database access.`);
if (failures) process.exitCode = 1;
