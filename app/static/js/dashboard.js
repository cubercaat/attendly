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
  } catch (e) { /* starosta uchun bo'sh bo'lishi mumkin */ }
}

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
    navigator.clipboard.writeText(t.dataset.copy)
      .then(() => { t.textContent = 'Nusxalandi ✓'; setTimeout(() => t.textContent = 'Havola', 1800); });
  }
});

loadLessons();
loadGroups();
