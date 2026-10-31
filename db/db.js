const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;

const unlockCols = db.prepare('PRAGMA table_info(unlocks)').all();
if (!unlockCols.some((c) => c.name === 'position')) {
  db.exec('ALTER TABLE unlocks ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
  db.exec('UPDATE unlocks SET position = (SELECT position FROM lessons WHERE lessons.id = unlocks.lesson_id)');
}