const $ = (id) => document.getElementById(id);
const student = JSON.parse(localStorage.getItem('student') || 'null');
if (!student) location.href = '/';

let items = [];
let currentId = null;

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

$('hello').textContent = `Hi, ${student.name}`;
$('leave').onclick = () => {
  localStorage.removeItem('student');
  location.href = '/';
};

function mk(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(url) {
  try {
    const res = await fetch(url, { headers: { 'x-student-id': student.id } });
    if (res.status === 401) {
      localStorage.removeItem('student');
      location.href = '/';
    }
    return await res.json();
  } catch {
    return { error: 'Connection problem. Please try again.' };
  }
}

function parseBlocks(body) {
  try {
    const data = JSON.parse(body);
    if (Array.isArray(data)) return data;
  } catch {}
  return [{ type: 'text', html: body }];
}

async function logAnswer(lesson, data) {
  console.log(`[${student.name}] ${lesson.title}`, data);
  try {
    const res = await fetch('/api/student/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': student.id },
      body: JSON.stringify({ lessonId: lesson.id, ...data }),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}



const POINTS_PER_CORRECT = 10;
let lessonPoints = 0;
let shownPoints = 0;
let countId = 0;

function resetPoints() {
  countId++;
  lessonPoints = 0;
  shownPoints = 0;
  $('pointsValue').textContent = 0;
}

function countTo(target) {
  const id = ++countId;
  const start = shownPoints;
  const t0 = performance.now();
  const step = (now) => {
    if (id !== countId) return;
    const p = Math.min((now - t0) / 600, 1);
    shownPoints = Math.round(start + (target - start) * p);
    $('pointsValue').textContent = shownPoints;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function celebrate(button, awarded) {
  playDing();
  lessonPoints += awarded;

  const pop = mk('span', 'float-points', `+${awarded}`);
  pop.addEventListener('animationend', () => pop.remove());
  button.append(pop);
  button.classList.add('pop');

  const badge = $('points');
  badge.classList.remove('bump');
  void badge.offsetWidth;
  badge.classList.add('bump');
  countTo(lessonPoints);
}


let soundOn = localStorage.getItem('sound') !== 'off';
let audioCtx = null;

function playDing() {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const start = t + i * 0.1;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {}
}

function updateSoundButton() {
  $('sound').textContent = soundOn ? 'Sound: on' : 'Sound: off';
}

$('sound').onclick = () => {
  soundOn = !soundOn;
  localStorage.setItem('sound', soundOn ? 'on' : 'off');
  updateSoundButton();
  playDing();
};
updateSoundButton();








function renderBlock(block, lesson) {
  const box = mk('div', 'block');

  if (block.type === 'text') {
    box.innerHTML = block.html;
  } else if (block.type === 'choice') {
    const key = block.id || block.question;
    let answered = false;
    const feedback = mk('p', 'feedback');
    const buttons = block.options.map((opt, i) => {
      const btn = mk('button', 'opt', opt);
      btn.onclick = () => {
        if (answered) return;
        answered = true;
        box.classList.add('done');
        const isCorrect = i === block.correct;
        buttons[block.correct].classList.add('correct');
        if (!isCorrect) btn.classList.add('wrong');
        feedback.textContent = (isCorrect ? 'Correct! ' : 'Not quite. ') + (block.explanation || '');
        logAnswer(lesson, {
          type: 'choice', blockKey: key, question: block.question, answer: opt, correct: isCorrect,
        });
        if (isCorrect) celebrate(btn, POINTS_PER_CORRECT);
      };
      return btn;
    });
    box.append(mk('p', 'question', block.question), ...buttons, feedback);
  } else if (block.type === 'open') {
    const key = block.id || block.question;
    const saved = (lesson.answers || {})[key];
    const input = mk('textarea');
    input.placeholder = 'Write your answer here...';
    input.value = saved || '';
    const error = mk('p', 'error');
    const status = mk('p', 'feedback', saved ? 'This is your last saved answer.' : '');
    const send = mk('button', '', saved ? 'Update answer' : 'Send answer');
    input.oninput = () => {
      error.textContent = '';
      status.textContent = '';
    };
    send.onclick = async () => {
      const answer = input.value.trim();
      if (!answer) {
        error.textContent = 'Write an answer first.';
        return;
      }
      send.disabled = true;
      const ok = await logAnswer(lesson, { type: 'open', blockKey: key, question: block.question, answer });
      send.disabled = false;
      if (ok) {
        status.textContent = 'Answer saved!';
        send.textContent = 'Update answer';
      } else {
        error.textContent = "Couldn't save your answer. Please try again.";
      }
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
  resetPoints();
  const title = mk('h2', '', lesson.title);
  $('lesson').replaceChildren(title, ...parseBlocks(lesson.body).map((b) => renderBlock(b, lesson)));
}

async function loadList() {
  const data = await api('/api/student/lessons');
  if (!Array.isArray(data)) {
    $('list').replaceChildren(mk('p', 'error', 'Could not load your lessons. Refresh the page.'));
    return;
  }
  items = data;
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

loadList();