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
  const rows = db.prepare(`
    SELECT l.id, l.title FROM lessons l
    JOIN unlocks u ON u.lesson_id = l.id
    WHERE u.student_id = ?
    ORDER BY u.position ASC, l.id ASC
  `).all(req.student.id);
  res.json(rows);
});

router.get('/lessons/:id', (req, res) => {
  const lesson = db.prepare(`
    SELECT l.id, l.title, l.body FROM lessons l
    JOIN unlocks u ON u.lesson_id = l.id
    WHERE u.student_id = ? AND l.id = ?
  `).get(req.student.id, req.params.id);
  if (!lesson) return res.status(403).json({ error: 'This lesson is not available yet' });
  res.json(lesson);
});

router.post('/answers', (req, res) => {
  const { lessonId, type, question, answer, correct } = req.body;
  const lesson = db.prepare('SELECT title FROM lessons WHERE id = ?').get(lessonId);
  const result = type === 'choice' ? (correct ? ' (correct)' : ' (wrong)') : '';
  console.log(
    `[${new Date().toLocaleTimeString()}] ${req.student.name} | ${lesson ? lesson.title : 'Lesson ' + lessonId} | ${question}\n    -> ${answer}${result}`
  );
  res.json({ ok: true });
});

module.exports = router;