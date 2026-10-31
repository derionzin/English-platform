const express = require('express');
const db = require('../db/db');

const router = express.Router();

router.post('/enter', (req, res) => {
  const name = (req.body.name || '').trim();
  const student = db.prepare('SELECT id, name FROM students WHERE name = ?').get(name);
  if (!student) {
    return res.status(404).json({ error: "We couldn't find that name. Check the spelling or ask your teacher." });
  }
  res.json(student);
});

router.use((req, res, next) => {
  const student = db.prepare('SELECT id, name FROM students WHERE id = ?').get(req.get('x-student-id'));
  if (!student) return res.status(401).json({ error: 'Unknown student' });
  req.student = student;
  next();
});

router.get('/lessons', (req, res) => {
  const lessons = db.prepare(`
    SELECT 'lesson' AS type, l.id, l.title, u.position
    FROM lessons l JOIN unlocks u ON u.lesson_id = l.id
    WHERE u.student_id = ?
  `).all(req.student.id);
  const headers = db.prepare(`
    SELECT 'header' AS type, id, title, position FROM headers WHERE student_id = ?
  `).all(req.student.id);
  const items = [...lessons, ...headers].sort(
    (a, b) => a.position - b.position || (a.type === 'header' ? -1 : 1) || a.id - b.id
  );
  res.json(items);
});

router.get('/lessons/:id', (req, res) => {
  const lesson = db.prepare(`
    SELECT l.id, l.title, l.body FROM lessons l
    JOIN unlocks u ON u.lesson_id = l.id
    WHERE u.student_id = ? AND l.id = ?
  `).get(req.student.id, req.params.id);
  if (!lesson) return res.status(403).json({ error: 'This lesson is not available yet' });

  const saved = db
    .prepare('SELECT block_key, answer FROM open_answers WHERE student_id = ? AND lesson_id = ?')
    .all(req.student.id, lesson.id);
  lesson.answers = Object.fromEntries(saved.map((r) => [r.block_key, r.answer]));
  res.json(lesson);
});

router.post('/answers', (req, res) => {
  const { lessonId, type, question, answer, correct, blockKey } = req.body;
  const lesson = db.prepare('SELECT title FROM lessons WHERE id = ?').get(lessonId);

  if (type === 'open') {
    const unlocked = db
      .prepare('SELECT 1 FROM unlocks WHERE student_id = ? AND lesson_id = ?')
      .get(req.student.id, lessonId);
    if (!unlocked || !blockKey || !String(answer || '').trim()) {
      return res.status(400).json({ error: 'Could not save that answer' });
    }
    db.prepare(`
      INSERT INTO open_answers (student_id, lesson_id, block_key, answer)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, lesson_id, block_key)
      DO UPDATE SET answer = excluded.answer, updated_at = CURRENT_TIMESTAMP
    `).run(req.student.id, lessonId, blockKey, answer);
  }

  const result = type === 'choice' ? (correct ? ' (correct)' : ' (wrong)') : '';
  console.log(
    `[${new Date().toLocaleTimeString()}] ${req.student.name} | ${lesson ? lesson.title : 'Lesson ' + lessonId} | ${question}\n    -> ${answer}${result}`
  );
  res.json({ ok: true });
});

module.exports = router;