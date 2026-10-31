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





router.delete('/students/:id/unlocks/:lessonId', (req, res) => {
  db.prepare('DELETE FROM unlocks WHERE student_id = ? AND lesson_id = ?')
    .run(req.params.id, req.params.lessonId);
  res.json({ ok: true });
});




function nextPosition(studentId) {
  const a = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM unlocks WHERE student_id = ?').get(studentId).m;
  const b = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM headers WHERE student_id = ?').get(studentId).m;
  return Math.max(a, b) + 1;
}

router.get('/students/:id/unlocks', (req, res) => {
  const lessons = db
    .prepare("SELECT 'lesson' AS type, lesson_id AS id, position FROM unlocks WHERE student_id = ?")
    .all(req.params.id);
  const headers = db
    .prepare("SELECT 'header' AS type, id, title, position FROM headers WHERE student_id = ?")
    .all(req.params.id);
  const items = [...lessons, ...headers].sort(
    (a, b) => a.position - b.position || (a.type === 'header' ? -1 : 1) || a.id - b.id
  );
  res.json(items);
});

router.post('/students/:id/unlocks', (req, res) => {
  try {
    db.prepare('INSERT OR IGNORE INTO unlocks (student_id, lesson_id, position) VALUES (?, ?, ?)')
      .run(req.params.id, req.body.lessonId, nextPosition(req.params.id));
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Could not unlock that lesson' });
  }
});

router.post('/students/:id/headers', (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Header text is required' });
  db.prepare('INSERT INTO headers (student_id, title, position) VALUES (?, ?, ?)')
    .run(req.params.id, title, nextPosition(req.params.id));
  res.json({ ok: true });
});

router.put('/students/:id/headers/:headerId', (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Header text is required' });
  db.prepare('UPDATE headers SET title = ? WHERE id = ? AND student_id = ?')
    .run(title, req.params.headerId, req.params.id);
  res.json({ ok: true });
});

router.delete('/students/:id/headers/:headerId', (req, res) => {
  db.prepare('DELETE FROM headers WHERE id = ? AND student_id = ?')
    .run(req.params.headerId, req.params.id);
  res.json({ ok: true });
});

router.put('/students/:id/unlock-order', (req, res) => {
  const setLesson = db.prepare('UPDATE unlocks SET position = ? WHERE student_id = ? AND lesson_id = ?');
  const setHeader = db.prepare('UPDATE headers SET position = ? WHERE student_id = ? AND id = ?');
  db.transaction((order) => {
    order.forEach((item, i) => {
      (item.type === 'header' ? setHeader : setLesson).run(i + 1, req.params.id, item.id);
    });
  })(req.body.order || []);
  res.json({ ok: true });
});






module.exports = router;