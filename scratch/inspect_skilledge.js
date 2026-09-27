import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
console.log('Opening database at:', dbPath);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('Error fetching tables:', err);
      return;
    }
    console.log('Tables in DB:', tables.map(t => t.name));
  });

  db.all("PRAGMA table_info(skilledge_records)", [], (err, columns) => {
    if (err) {
      console.error('Error fetching skilledge_records info:', err);
      return;
    }
    console.log('skilledge_records columns:', columns.map(c => c.name));
  });

  db.all("PRAGMA table_info(skilledge_sync_history)", [], (err, columns) => {
    if (err) {
      console.error('Error fetching skilledge_sync_history info:', err);
      return;
    }
    console.log('skilledge_sync_history columns:', columns.map(c => c.name));
  });

  db.all("SELECT id, name, register_number, email FROM students LIMIT 5", [], (err, rows) => {
    if (err) {
      console.error('Error fetching students:', err);
      return;
    }
    console.log('Sample Students:', rows);
  });
});
