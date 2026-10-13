const ROLE = window.MY_ROLE;

function fill(sel, items, label, empty) {
  const el = $(sel);
  if (!el) return;
  el.innerHTML = items.length
    ? items.map(i => `<option value="${i.id}">${label(i)}</option>`).join('')
    : `<option value="">${empty}</option>`;
}

// ------------------------------------------------------------- darslar
async function loadLessons() {
  const box = $('#lessons');
  try {
    const ls = await api('/api/teacher/lessons/today');
    if (!ls.length) {
      box.innerHTML = '<div class="row"><span class="small">Bugun dars yo‘q</span></div>';
      return;
    }
    box.innerHTML = ls.map(l => {
      const t = new Date(l.starts_at).toLocaleTimeString('uz-UZ',
        { hour: '2-digit', minute: '2-digit' });
      const action = l.status === 'open'
        ? `<button class="btn sm" data-qr="${l.id}">QR ekrani</button>`
        : (l.status === 'closed'
          ? `<span class="pill">yopilgan</span>`
          : `<button class="btn sm" data-open="${l.id}">Davomatni ochish</button>`);
      return `<div class="row">
        <div><div class="name">${l.pair_no ? l.pair_no + '-para · ' : ''}${l.subject}</div>
        <div class="meta">${t} · ${l.group || ''}${l.room ? ' · ' + l.room : ''}</div></div>
        <div>${action}</div></div>`;
    }).join('');
  } catch (e) {
    note($('#l-note'), e.message, 'bad');
  }
}

async function loadGroups() {
  const box = $('#groups');
  try {
    const gs = await api('/api/teacher/groups');
    box.innerHTML = gs.map(g => `<div class="row">
      <div><div class="name">${g.code}</div>
      <div class="meta">${g.students} talaba</div></div>
      <button class="btn ghost sm" data-copy="${g.invite_url}">Havola</button>
    </div>`).join('') || '<div class="row"><span class="small">Guruh yo‘q</span></div>';

    fill('#f-group', gs, g => g.code, 'Guruh yo‘q');
    fill('#i-group', gs, g => g.code, '—');
  } catch (e) { /* starosta uchun bo'sh bo'lishi mumkin */ }
}

// -------------------------------------------------------- yangi dars
async function loadLessonForm() {
  if (!$('#f-subject')) return;
  try {
    const [subjects, rooms] = await Promise.all([
      api('/api/teacher/subjects'),
      api('/api/teacher/rooms'),
    ]);
    fill('#f-subject', subjects, s => s.name, 'Fan kiritilmagan');
    fill('#f-room', rooms, r => r.building ? `${r.name} · ${r.building}` : r.name,
         'Auditoriya kiritilmagan');
    if (!rooms.length) {
      note($('#c-note'), 'Auditoriya kiritilmagan — GPS tekshiruvi ishlamaydi. '
        + 'Avval admin xona qo‘shsin.', 'warn');
    }
  } catch (e) { /* jim */ }
}

$('#toggle-new')?.addEventListener('click', () => {
  const box = $('#new-lesson');
  box.classList.toggle('hidden');
  $('#toggle-new').textContent = box.classList.contains('hidden') ? 'Ochish' : 'Yopish';
});

$('#create-btn')?.addEventListener('click', async () => {
  const btn = $('#create-btn');
  const group = $('#f-group').value, subject = $('#f-subject').value;
  if (!group) { note($('#c-note'), 'Guruh tanlang', 'bad'); return; }
  btn.disabled = true;
  try {
    const l = await api('/api/teacher/lessons', {
      group_id: +group,
      subject_id: subject ? +subject : null,
      room_id: $('#f-room').value ? +$('#f-room').value : null,
      pair_no: +$('#f-pair').value,
      duration_min: 80,
    });
    await api(`/api/teacher/lessons/${l.id}/open`, { window_minutes: 15 });
    location.href = `/teacher/lesson/${l.id}/qr`;
  } catch (e) {
    note($('#c-note'), e.message, 'bad');
    btn.disabled = false;
  }
});

// --------------------------------------------------- taklif havolalari
$('#toggle-inv')?.addEventListener('click', () => {
  const box = $('#inv-box');
  box.classList.toggle('hidden');
  $('#toggle-inv').textContent = box.classList.contains('hidden') ? 'Ochish' : 'Yopish';
  if (!box.classList.contains('hidden')) loadInvites();
});

const ROLE_UZ = { teacher: 'O‘qituvchi', starosta: 'Starosta' };

async function loadInvites() {
  const box = $('#inv-list');
  if (!box) return;
  try {
    const rows = await api('/api/admin/invites');
    box.innerHTML = rows.map(i => `<div class="row">
      <div><div class="name">${ROLE_UZ[i.role] || i.role}${i.note ? ' · ' + i.note : ''}</div>
      <div class="meta">${i.used ? 'ishlatilgan' : 'kutilmoqda'} · ${
        new Date(i.expires_at).toLocaleDateString('uz-UZ')} gacha</div></div>
      ${i.used ? '<span class="pill ok">✓</span>'
               : `<button class="btn ghost sm" data-copy="${i.url}">Havola</button>`}
    </div>`).join('') || '<div class="row"><span class="small">Havola yo‘q</span></div>';
  } catch (e) { /* jim */ }
}

$('#inv-btn')?.addEventListener('click', async () => {
  const btn = $('#inv-btn'), role = $('#i-role').value;
  const gid = $('#i-group').value;
  if (role === 'starosta' && !gid) {
    note($('#i-note-box'), 'Starosta uchun guruh tanlang', 'bad'); return;
  }
  btn.disabled = true;
  try {
    const inv = await api('/api/admin/invites', {
      role, group_id: role === 'starosta' ? +gid : null,
      note: $('#i-note').value || null, days: +$('#i-days').value,
    });
    note($('#i-note-box'), 'Havola tayyor: ' + inv.url, 'ok');
    try { await navigator.clipboard.writeText(inv.url); } catch (_) {}
    $('#i-note').value = '';
    loadInvites();
  } catch (e) {
    note($('#i-note-box'), e.message, 'bad');
  } finally { btn.disabled = false; }
});

// ------------------------------------------------------------- umumiy
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.dataset.qr) location.href = `/teacher/lesson/${t.dataset.qr}/qr`;
  if (t.dataset.open) {
    t.disabled = true;
    try {
      await api(`/api/teacher/lessons/${t.dataset.open}/open`, { window_minutes: 15 });
      location.href = `/teacher/lesson/${t.dataset.open}/qr`;
    } catch (err) { note($('#l-note'), err.message, 'bad'); t.disabled = false; }
  }
  if (t.dataset.copy) {
    const old = t.textContent;
    navigator.clipboard.writeText(t.dataset.copy)
      .then(() => { t.textContent = 'Nusxalandi ✓'; setTimeout(() => t.textContent = old, 1800); })
      .catch(() => { t.textContent = 'Nusxalanmadi'; setTimeout(() => t.textContent = old, 1800); });
  }
});

loadLessons();
loadGroups();
loadLessonForm();
