const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../server/data/aids_system.db');
const db = new Database(dbPath, { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('Total Tables:', tables.length);

const counts = {};
for (const t of tables) {
  try {
    const res = db.prepare(`SELECT count(*) as count FROM "${t.name}"`).get();
    counts[t.name] = res.count;
  } catch (err) {
    counts[t.name] = 'Error: ' + err.message;
  }
}

console.log(JSON.stringify(counts, null, 2));
db.close();
