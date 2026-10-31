const express = require('express');
const crypto = require('crypto');
const db = require('../db/db');

const router = express.Router();
const tokens = new Set();

router.post('/login', (req, res) => {
  if (req.body.password !== process.env.TEACHER_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  tokens.add(token);
  res.json({ token });
});

router.use((req, res, next) => {
  if (!tokens.has(req.get('x-teacher-token'))) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
});

router.get('/students', (req, res) => {
  res.json(db.prepare('SELECT id, name FROM students ORDER BY name').all());
});

router.post('/students', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const info = db.prepare('INSERT INTO students (name) VALUES (?)').run(name);
    res.json({ id: info.lastInsertRowid, name });
  } catch {
    res.status(409).json({ error: 'That student already exists' });
  }
});

router.delete('/students/:id', (req, res) => {
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/lessons', (req, res) => {
  res.json(db.prepare('SELECT id, title, body, position FROM lessons ORDER BY position, id').all());
});

router.post('/lessons', (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const { next } = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM lessons').get();
  const info = db
    .prepare('INSERT INTO lessons (title, body, position) VALUES (?, ?, ?)')
    .run(title, req.body.body || '', next);
  res.json({ id: info.lastInsertRowid });
});

router.put('/lessons/:id', (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  db.prepare('UPDATE lessons SET title = ?, body = ? WHERE id = ?')
    .run(title, req.body.body || '', req.params.id);
  res.json({ ok: true });
});

router.delete('/lessons/:id', (req, res) => {
  db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});




router.get('/students/:id/unlocks', (req, res) => {
  const rows = db
    .prepare('SELECT lesson_id FROM unlocks WHERE student_id = ? ORDER BY position, lesson_id')
    .all(req.params.id);
  res.json(rows.map((r) => r.lesson_id));
});

router.post('/students/:id/unlocks', (req, res) => {
  try {
    const { next } = db
      .prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM unlocks WHERE student_id = ?')
      .get(req.params.id);
    db.prepare('INSERT OR IGNORE INTO unlocks (student_id, lesson_id, position) VALUES (?, ?, ?)')
      .run(req.params.id, req.body.lessonId, next);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Could not unlock that lesson' });
  }
});

router.delete('/students/:id/unlocks/:lessonId', (req, res) => {
  db.prepare('DELETE FROM unlocks WHERE student_id = ? AND lesson_id = ?')
    .run(req.params.id, req.params.lessonId);
  res.json({ ok: true });
});

router.put('/students/:id/unlock-order', (req, res) => {
  const update = db.prepare('UPDATE unlocks SET position = ? WHERE student_id = ? AND lesson_id = ?');
  db.transaction((ids) => {
    ids.forEach((lessonId, i) => update.run(i + 1, req.params.id, lessonId));
  })(req.body.order || []);
  res.json({ ok: true });
});

module.exports = router;