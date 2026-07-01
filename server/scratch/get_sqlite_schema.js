const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Reading SQLite database schema...');

db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='auditor_counts';", (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('SQLite Schema:', rows);
});

db.all("SELECT * FROM sqlite_master WHERE type='trigger';", (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Triggers:', rows);
});

db.close();
