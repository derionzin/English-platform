require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM students').get();
  res.json({ ok: true, students: n });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/student', require('./routes/student'));