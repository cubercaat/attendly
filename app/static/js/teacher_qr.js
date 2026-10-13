// Aylanuvchi QR + jonli ro'yxat
const LID = window.LESSON_ID;
const qrEl = $('#qr'), barEl = $('#bar');
let rotateSeconds = 3, timer = null;

// QR serverda SVG qilib chiziladi — tashqi kutubxona kerak emas
function render(svg) { qrEl.innerHTML = svg; }

function animateBar(ms) {
  barEl.style.transition = 'none';
  barEl.style.width = '100%';
  requestAnimationFrame(() => {
    barEl.style.transition = `width ${ms}ms linear`;
    barEl.style.width = '0%';
  });
}

async function tick() {
  try {
    const d = await api(`/api/teacher/lessons/${LID}/qr`);
    rotateSeconds = d.rotate_seconds || 3;
    render(d.svg);
    animateBar(Math.max(d.rotate_in, 0.2) * 1000);
    const mr = $('#meta-rot'); if (mr) mr.textContent = rotateSeconds;
    $('#meta-closes').textContent =
      'Yopiladi: ' + new Date(d.closes_at).toLocaleTimeString('uz-UZ',
        { hour: '2-digit', minute: '2-digit' });
    timer = setTimeout(tick, Math.max(d.rotate_in, 0.2) * 1000 + 60);
  } catch (e) {
    qrEl.innerHTML = `<div style="padding:40px;color:#d03b3b">${e.message}</div>`;
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------- ro'yxat (SSE)
function paint(data) {
  $('#cnt').textContent = data.present;
  $('#tot').textContent = data.total;
  $('#roster').innerHTML = data.items.map(i => {
    const cls = i.status === 'present' ? 'ok'
      : (i.status === 'excused' ? 'warn' : (i.status === 'pending' ? '' : 'bad'));
    const label = { present: 'Keldi', excused: 'Sababli', absent: 'Kelmadi',
                    rejected: 'Bekor', pending: 'Kutilmoqda' }[i.status] || i.status;
    const meta = [
      i.at ? new Date(i.at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '',
      i.method === 'face' ? 'yuz' : (i.method === 'passkey' ? 'passkey' : ''),
      i.distance_m != null ? i.distance_m + ' m' : '',
      i.flagged ? '⚠ ' + (i.flag_reason || '') : '',
    ].filter(Boolean).join(' · ');
    const btn = i.attendance_id && i.status === 'present'
      ? `<button class="btn ghost sm" data-rej="${i.attendance_id}">Bekor</button>` : '';
    return `<div class="row">
      <div><div class="name">${i.name}</div><div class="meta">${meta}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="pill ${cls}">${label}</span>${btn}</div>
    </div>`;
  }).join('');
}

const es = new EventSource(`/api/teacher/lessons/${LID}/stream`);
es.onmessage = e => { try { paint(JSON.parse(e.data)); } catch (_) {} };

document.addEventListener('click', async e => {
  const id = e.target.dataset?.rej;
  if (!id) return;
  e.target.disabled = true;
  try {
    await api('/api/teacher/review', { attendance_id: +id, action: 'reject' });
  } catch (err) { alert(err.message); e.target.disabled = false; }
});

$('#close-btn').addEventListener('click', async () => {
  if (!confirm('Davomat yopilsinmi? Belgilanmaganlar "kelmadi" bo‘ladi.')) return;
  await api(`/api/teacher/lessons/${LID}/close`, {});
  clearTimeout(timer);
  es.close();
  location.href = '/dashboard';
});

api(`/api/teacher/lessons/today`).then(ls => {
  const l = ls.find(x => x.id === LID);
  if (l) $('#meta-lesson').textContent =
    `${l.group} · ${l.pair_no ? l.pair_no + '-para · ' : ''}${l.subject}${l.room ? ' · ' + l.room : ''}`;
}).catch(() => {});

window.addEventListener('load', tick);
