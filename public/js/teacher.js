const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem('teacherToken');
let students = [];
let lessons = [];
let selected = null;
let editingId = null;
let blocks = [];
let lockedState = { student: null, locked: [] };

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach((c) => node.append(c));
  return node;
}

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const matches = (text, query) => normalize(text).includes(normalize(query.trim()));


async function api(url, method = 'GET', body) {
  const res = await fetch('/api/teacher' + url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-teacher-token': token || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401 && url !== '/login') {
    logout();
    throw new Error('Not logged in');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason.message !== 'Not logged in') alert(e.reason.message);
});

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/login', 'POST', { password: $('password').value });
    token = data.token;
    sessionStorage.setItem('teacherToken', token);
    $('password').value = '';
    $('loginError').textContent = '';
    showPanel();
  } catch (err) {
    $('loginError').textContent = err.message;
  }
});

function showPanel() {
  $('login').hidden = true;
  $('panel').hidden = false;
  refresh();
}

function logout() {
  token = null;
  sessionStorage.removeItem('teacherToken');
  $('panel').hidden = true;
  $('login').hidden = false;
}
$('logout').onclick = logout;

async function refresh() {
  [students, lessons] = await Promise.all([api('/students'), api('/lessons')]);
  renderStudents();
  renderLessons();
  renderUnlocks();
}






function renderStudents() {
  const ul = $('students');
  ul.replaceChildren();
  const shown = students.filter((s) => matches(s.name, $('studentSearch').value));
  if (!shown.length) {
    ul.append(el('li', {
      className: 'muted',
      textContent: students.length ? 'No students match your search.' : 'No students yet.',
    }));
  }
  shown.forEach((s) => {
    ul.append(
      el('li', { className: s.id === selected ? 'selected' : '' },
        el('button', {
          className: 'link grow',
          textContent: s.name,
          onclick: () => { selected = s.id; renderStudents(); renderUnlocks(); },
        }),
        el('button', { className: 'danger', textContent: 'Delete', onclick: () => deleteStudent(s) })
      )
    );
  });
}

function renderLessons() {
  const ul = $('lessons');
  ul.replaceChildren();
  const shown = lessons.filter((l) => matches(l.title, $('lessonSearch').value));
  if (!shown.length) {
    ul.append(el('li', {
      className: 'muted',
      textContent: lessons.length ? 'No lessons match your search.' : 'No lessons yet.',
    }));
  }
  shown.forEach((l) => {
    ul.append(
      el('li', {},
        el('span', { className: 'grow', textContent: l.title }),
        el('button', { textContent: 'Edit', onclick: () => startEdit(l) }),
        el('button', { className: 'danger', textContent: 'Delete', onclick: () => deleteLesson(l) })
      )
    );
  });
}







async function renderUnlocks() {
  const student = students.find((s) => s.id === selected);
  $('unlockPanel').hidden = !student;
  $('unlockHint').hidden = !!student;
  $('unlockTitle').textContent = student ? `${student.name}'s lessons` : 'Student lessons';
  if (!student) return;

  const items = await api(`/students/${student.id}/unlocks`);
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const openIds = new Set(items.filter((i) => i.type === 'lesson').map((i) => i.id));
  const locked = lessons.filter((l) => !openIds.has(l.id));
  const order = items.map(({ type, id }) => ({ type, id }));

  const openList = $('unlocked');
  openList.replaceChildren();
  if (!items.length) openList.append(el('li', { className: 'muted', textContent: 'Nothing unlocked yet.' }));
  items.forEach((item, i) => {
    const isHeader = item.type === 'header';
    const row = el('li', { className: isHeader ? 'header-row' : '' },
      el('span', { className: 'grow', textContent: isHeader ? item.title : byId.get(item.id).title }),
      el('button', {
        textContent: '↑', title: 'Move up', disabled: i === 0,
        onclick: () => moveItem(student.id, order, i, -1),
      }),
      el('button', {
        textContent: '↓', title: 'Move down', disabled: i === items.length - 1,
        onclick: () => moveItem(student.id, order, i, 1),
      })
    );
    if (isHeader) {
      row.append(el('button', {
        textContent: 'Rename',
        onclick: async () => {
          const title = prompt('Header text', item.title);
          if (!title || !title.trim()) return;
          await api(`/students/${student.id}/headers/${item.id}`, 'PUT', { title });
          renderUnlocks();
        },
      }));
    }
    row.append(el('button', {
      className: 'danger', textContent: 'Remove',
      onclick: async () => {
        const url = isHeader
          ? `/students/${student.id}/headers/${item.id}`
          : `/students/${student.id}/unlocks/${item.id}`;
        await api(url, 'DELETE');
        renderUnlocks();
      },
    }));
    openList.append(row);
  });

  lockedState = { student, locked };
  renderLocked();



  function renderLocked() {
    const { student, locked } = lockedState;
    const list = $('locked');
    list.replaceChildren();
    if (!student) return;
    const shown = locked.filter((l) => matches(l.title, $('lockedSearch').value));
    if (!shown.length) {
      list.append(el('li', {
        className: 'muted',
        textContent: locked.length ? 'No lessons match your search.' : 'Everything is unlocked.',
      }));
    }
    shown.forEach((l) => {
      list.append(
        el('li', {},
          el('span', { className: 'grow', textContent: l.title }),
          el('button', {
            textContent: 'Add',
            onclick: async () => {
              await api(`/students/${student.id}/unlocks`, 'POST', { lessonId: l.id });
              renderUnlocks();
            },
          })
        )
      );
    });
  }
}

async function moveItem(studentId, order, from, delta) {
  const to = from + delta;
  [order[from], order[to]] = [order[to], order[from]];
  await api(`/students/${studentId}/unlock-order`, 'PUT', { order });
  renderUnlocks();
}

$('headerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selected) return;
  await api(`/students/${selected}/headers`, 'POST', { title: $('headerTitle').value });
  $('headerForm').reset();
  renderUnlocks();
});










const BLOCK_LABELS = {
  text: 'Text',
  choice: 'Multiple choice',
  open: 'Open question',
  reveal: 'Hidden text',
};

function parseBlocks(body) {
  try {
    const data = JSON.parse(body);
    if (Array.isArray(data)) return data;
  } catch {}
  return [{ type: 'text', html: body }];
}

function newBlock(type) {
  if (type === 'text') return { type, html: '' };
  if (type === 'choice') return { type, question: '', options: ['', ''], correct: 0, explanation: '' };
  if (type === 'open') return { type, question: '' };
  return { type, label: 'Click to reveal', content: '' };
}

function textInput(block, key, placeholder) {
  return el('input', {
    type: 'text',
    value: block[key] || '',
    placeholder,
    oninput: (e) => { block[key] = e.target.value; },
  });
}

function textArea(block, key, placeholder, rows) {
  return el('textarea', {
    value: block[key] || '',
    placeholder,
    rows,
    oninput: (e) => { block[key] = e.target.value; },
  });
}

function moveBlock(i, delta) {
  [blocks[i], blocks[i + delta]] = [blocks[i + delta], blocks[i]];
  renderBlocks();
}

function renderBlocks() {
  const box = $('blocks');
  box.replaceChildren();
  blocks.forEach((b, i) => {
    const card = el('div', { className: 'block-edit' },
      el('div', { className: 'row' },
        el('strong', { className: 'grow', textContent: BLOCK_LABELS[b.type] }),
        el('button', { type: 'button', textContent: '↑', disabled: i === 0, onclick: () => moveBlock(i, -1) }),
        el('button', { type: 'button', textContent: '↓', disabled: i === blocks.length - 1, onclick: () => moveBlock(i, 1) }),
        el('button', {
          type: 'button', className: 'danger', textContent: 'Remove',
          onclick: () => { blocks.splice(i, 1); renderBlocks(); },
        })
      )
    );

    if (b.type === 'text') {
      card.append(textArea(b, 'html', 'Text (HTML allowed)', 5));
    } else if (b.type === 'choice') {
      card.append(textInput(b, 'question', 'Question'));
      card.append(el('span', { className: 'muted', textContent: 'Select the circle next to the correct option.' }));
      b.options.forEach((opt, j) => {
        card.append(
          el('div', { className: 'row' },
            el('input', {
              type: 'radio', name: 'correct-' + i, checked: b.correct === j,
              onchange: () => { b.correct = j; },
            }),
            el('input', {
              type: 'text', className: 'grow', value: opt, placeholder: 'Option ' + (j + 1),
              oninput: (e) => { b.options[j] = e.target.value; },
            }),
            el('button', {
              type: 'button', textContent: '✕', title: 'Remove option', disabled: b.options.length <= 2,
              onclick: () => {
                b.options.splice(j, 1);
                if (b.correct === j) b.correct = 0;
                else if (b.correct > j) b.correct--;
                renderBlocks();
              },
            })
          )
        );
      });
      card.append(el('button', {
        type: 'button', textContent: '+ Option',
        onclick: () => { b.options.push(''); renderBlocks(); },
      }));
      card.append(textInput(b, 'explanation', 'Explanation shown after answering (optional)'));
    } else if (b.type === 'open') {
      card.append(textInput(b, 'question', 'Question'));
    } else if (b.type === 'reveal') {
      card.append(textInput(b, 'label', 'Button text (e.g. Show hint)'));
      card.append(textArea(b, 'content', 'Hidden text (HTML allowed)', 3));
    }
    box.append(card);
  });
}

const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function cleanBlocks() {
  return blocks
    .filter((b) => b.type !== 'text' || b.html.trim())
    .map((b) => {
      if (b.type === 'open' && !b.id) b.id = makeId();

      if (b.type === 'choice' && (!b.question.trim() || b.options.some((o) => !o.trim()))) {
        throw new Error('Multiple choice blocks need a question and no empty options.');
      }
      if (b.type === 'open' && !b.question.trim()) {
        throw new Error('Open questions need a question.');
      }
      if (b.type === 'reveal' && (!b.label.trim() || !b.content.trim())) {
        throw new Error('Hidden text blocks need button text and hidden text.');
      }
      return b;
    });
}

document.querySelectorAll('[data-add]').forEach((btn) => {
  btn.onclick = () => {
    blocks.push(newBlock(btn.dataset.add));
    renderBlocks();
  };
});

$('lessonForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = { title: $('lessonTitle').value, body: JSON.stringify(cleanBlocks()) };
  if (editingId) await api('/lessons/' + editingId, 'PUT', payload);
  else await api('/lessons', 'POST', payload);
  resetLessonForm();
  refresh();
});

function startEdit(l) {
  editingId = l.id;
  $('lessonTitle').value = l.title;
  blocks = parseBlocks(l.body);
  renderBlocks();
  $('lessonSubmit').textContent = 'Save changes';
  $('lessonCancel').hidden = false;
  $('lessonTitle').focus();
}

function resetLessonForm() {
  editingId = null;
  $('lessonForm').reset();
  blocks = [newBlock('text')];
  renderBlocks();
  $('lessonSubmit').textContent = 'Add lesson';
  $('lessonCancel').hidden = true;
}
$('lessonCancel').onclick = resetLessonForm;

$('studentSearch').addEventListener('input', renderStudents);
$('lessonSearch').addEventListener('input', renderLessons);
$('lockedSearch').addEventListener('input', renderLocked);


async function deleteLesson(l) {
  if (!confirm(`Delete "${l.title}"?`)) return;
  await api('/lessons/' + l.id, 'DELETE');
  refresh();
}

async function unlockAll(l) {
  await api(`/lessons/${l.id}/unlock-all`, 'POST');
  renderUnlocks();
}

resetLessonForm();
if (token) showPanel();