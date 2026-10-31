const $ = (id) => document.getElementById(id);
const student = JSON.parse(localStorage.getItem('student') || 'null');
if (!student) location.href = '/';

$('hello').textContent = `Hi, ${student.name}`;
$('leave').onclick = () => {
  localStorage.removeItem('student');
  location.href = '/';
};

async function api(url) {
  const res = await fetch(url, { headers: { 'x-student-id': student.id } });
  if (res.status === 401) {
    localStorage.removeItem('student');
    location.href = '/';
  }
  return res.json();
}




let items = [];
let currentId = null;

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function loadList() {
  items = await api('/api/student/lessons');
  renderList();
}

function renderList() {
  const list = $('list');
  const query = normalize($('search').value.trim());
  list.replaceChildren();

  if (!items.some((i) => i.type === 'lesson')) {
    list.append(mk('p', 'muted', 'No lessons unlocked yet.'));
    return;
  }

  let pendingHeader = null;
  let shown = 0;
  items.forEach((item) => {
    if (item.type === 'header') {
      pendingHeader = item;
      return;
    }
    if (query && !normalize(item.title).includes(query)) return;
    if (pendingHeader) {
      list.append(mk('h3', 'list-header', pendingHeader.title));
      pendingHeader = null;
    }
    const btn = mk('button', item.id === currentId ? 'active' : '', item.title);
    btn.onclick = () => openLesson(item.id);
    list.append(btn);
    shown++;
  });

  if (!shown) list.append(mk('p', 'muted', 'No lessons match your search.'));
}

$('search').addEventListener('input', renderList);




function parseBlocks(body) {
  try {
    const data = JSON.parse(body);
    if (Array.isArray(data)) return data;
  } catch {}
  return [{ type: 'text', html: body }];
}

function mk(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function logAnswer(lesson, data) {
  console.log(`[${student.name}] ${lesson.title}`, data);
  fetch('/api/student/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-student-id': student.id },
    body: JSON.stringify({ lessonId: lesson.id, ...data }),
  });
}

function renderBlock(block, lesson) {
  const box = mk('div', 'block');

  if (block.type === 'text') {
    box.innerHTML = block.html;
  } else if (block.type === 'choice') {
    let answered = false;
    const feedback = mk('p', 'feedback');
    const buttons = block.options.map((opt, i) => {
      const btn = mk('button', 'opt', opt);
      btn.onclick = () => {
        if (answered) return;
        answered = true;
        box.classList.add('done');
        buttons[block.correct].classList.add('correct');
        if (i !== block.correct) btn.classList.add('wrong');
        feedback.textContent = (i === block.correct ? 'Correct! ' : 'Not quite. ') + (block.explanation || '');
        logAnswer(lesson, { type: 'choice', question: block.question, answer: opt, correct: i === block.correct });
      };
      return btn;
    });
    box.append(mk('p', 'question', block.question), ...buttons, feedback);
  } else if (block.type === 'open') {
    const input = mk('textarea');
    input.placeholder = 'Write your answer here...';
    const error = mk('p', 'error');
    const status = mk('p', 'feedback');
    const send = mk('button', '', 'Send answer');
    input.oninput = () => { error.textContent = ''; };
    send.onclick = () => {
      const answer = input.value.trim();
      if (!answer) {
        error.textContent = 'Write an answer first.';
        return;
      }
      input.readOnly = true;
      send.hidden = true;
      status.textContent = 'Answer sent!';
      logAnswer(lesson, { type: 'open', question: block.question, answer });
    };
    box.append(mk('p', 'question', block.question), input, error, send, status);
  } else if (block.type === 'reveal') {
    const content = mk('div', 'revealed');
    content.innerHTML = block.content;
    content.hidden = true;
    const btn = mk('button', '', block.label || 'Click to reveal');
    btn.onclick = () => { content.hidden = !content.hidden; };
    box.append(btn, content);
  }
  return box;
}

async function openLesson(id) {
  const lesson = await api('/api/student/lessons/' + id);
  if (lesson.error) {
    $('lesson').textContent = lesson.error;
    return;
  }
  currentId = id;
  renderList();
  const title = mk('h2', '', lesson.title);
  $('lesson').replaceChildren(title, ...parseBlocks(lesson.body).map((b) => renderBlock(b, lesson)));
}

loadList();