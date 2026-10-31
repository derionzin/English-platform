if (localStorage.getItem('student')) location.href = '/student.html';

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/student/enter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: document.getElementById('name').value }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('error').textContent = data.error;
    return;
  }
  localStorage.setItem('student', JSON.stringify(data));
  location.href = '/student.html';
});