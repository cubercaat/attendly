const U = guard(['teacher', 'starosta', 'super_admin']);
if (U) {
  let tab = 'today', openId = null, timer = null;
  const TABS = [['today', 'Bugungi darslar'], ['week', 'Hafta jadvali'], ['new', 'Yangi dars'], ['history', 'Tarix'], ['inbox', 'Xabarlar'], ['chat', 'Chat']];
  const mine = (d, l) => U.role == 'starosta' ? lessonGroups(l).includes(U.group_id) : (U.role == 'super_admin' || U.all || l.teacher_id == U.id);

  function draw() {
    clearInterval(timer);
    shell(U, U.role == 'starosta' ? 'Starosta paneli' : "O'qituvchi paneli", openId ? null : tabLabel(U, TABS), tab);
    $$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    const d = DB.get(), el = $('#view');
    if (openId) return qrView(d, el);
    ({ today, week, new: newLesson, history, inbox: (d, el) => renderInbox(el, U), chat: (d, el) => renderChat(el, U) })[tab](d, el);
  }
  const lessonRow = (d, l) => [`<b>${l.pair}</b> <span class="muted sm">${SLOTS[l.pair] || ''}</span>`, esc(lessonName(d, l)), esc(groupCodes(d, l)),
    esc(by(d.rooms, l.room_id)?.name || '—')];

  function today(d, el) {
    const ls = d.lessons.filter(l => !l.closed && isToday(l) && mine(d, l)).sort((a, b) => a.pair - b.pair);
    el.innerHTML = `<div class="card"><h2>Bugungi darslar</h2>${table(['Juftlik', 'Fan', 'Guruh', 'Xona', ''],
      ls.map(l => [...lessonRow(d, l), `<button class="btn p sm" data-o="${l.id}">${l.open ? 'QR ekrani' : 'Davomatni ochish'}</button>`]),
      "Bugun darsingiz yo'q (yakshanba yoki dars tugagan). «Yangi dars» bo'limidan demo dars yarating.")}</div>`;
    $$('[data-o]', el).forEach(b => b.onclick = () => {
      const d = DB.get(), l = by(d.lessons, b.dataset.o);
      if (!l.open) { l.open = true; audit(d, `Dars ochildi: ${by(d.subjects, l.subject_id).name} (${groupCodes(d, l)})`); DB.save(d); }
      openId = l.id; draw();
    });
  }
  function week(d, el) {
    const gs = U.role == 'starosta' ? d.groups.filter(g => g.id == U.group_id) : d.groups;
    el.innerHTML = `<div class="card"><label style="max-width:240px">Guruh<select id="wg">${gs.map(g => `<option value="${g.id}" ${g.code == 'CYB3-26' ? 'selected' : ''}>${esc(g.code)}</option>`).join('')}</select></label><div id="tt"></div></div>`;
    const show = () => $('#tt').innerHTML = ttGrid(d, $('#wg').value); $('#wg').onchange = show; show();
  }
  function newLesson(d, el) {
    const opt = (a, f) => a.map(x => `<option value="${x.id}">${esc(f(x))}</option>`).join('');
    const groups = U.role == 'starosta' ? d.groups.filter(g => g.id == U.group_id) : d.groups;
    el.innerHTML = `<form class="card"><h2>Yangi dars</h2><div class="row">
      <label>Fan<select name="s">${opt(d.subjects, x => x.name)}</select></label>
      <label>Guruh(lar) <span class="muted">— ma'ruza uchun bir nechtasini tanlang (Ctrl)</span><select name="g" multiple size="4">${opt(groups, x => x.code)}</select></label>
      <label>Xona<select name="r">${opt(d.rooms, x => x.name)}</select></label>
      <label>Juftlik<input name="p" type="number" min="1" max="6" value="1" required></label>
      <button class="btn p">Yaratish</button></div></form>`;
    $('form', el).onsubmit = e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), d = DB.get();
      const gs = [...$('select[name=g]').selectedOptions].map(o => +o.value); if (!gs.length) return toast('Kamida bitta guruh tanlang');
      d.lessons.push({ id: DB.id(d, 'lesson'), subject_id: +f.s, group_id: gs[0], group_ids: gs, room_id: +f.r, teacher_id: U.id, pair: +f.p, starts: Date.now(), open: false, closed: false, secret: 'k' + Math.random().toString(36).slice(2) });
      DB.save(d); toast('Dars yaratildi'); tab = 'today'; draw();
    };
  }
  function history(d, el) {
    const ls = d.lessons.filter(l => l.closed && mine(d, l)).sort((a, b) => b.starts - a.starts).slice(0, 30);
    el.innerHTML = `<div class="card"><h2>Yopilgan darslar</h2>${table(['Sana', 'Fan', 'Guruh', 'Kelgan'],
      ls.map(l => { const a = d.attendance.filter(x => x.lesson_id == l.id), p = a.filter(x => x.status == 'present').length;
        return [fmtD(l.starts), esc(by(d.subjects, l.subject_id)?.name), esc(groupCodes(d, l)), `${p}/${a.length}`]; }))}</div>`;
  }

  function qrView(d, el) {
    const l = by(d.lessons, openId), room = by(d.rooms, l.room_id);
    el.innerHTML = `<button class="btn sm" id="back">← Darslar</button>
    <div class="card" style="text-align:center;margin-top:12px"><h2>${esc(lessonName(d, l))} · ${esc(groupCodes(d, l))}</h2>
      <p class="muted sm">${esc(room?.name || '')} · ${SLOTS[l.pair] || ''} · QR har ${STEP} soniyada yangilanadi</p>
      ${lessonGroups(l).length > 1 ? `<p><span class="tag ok">Oqim darsi: ${lessonGroups(l).length} guruh bitta xonada — bitta QR hammaga</span></p>` : ''}
      <div class="qrbox" id="qr"></div><div class="bar" style="max-width:300px;margin:12px auto"><i id="cd"></i></div>
      <p class="mono sm muted" id="tok"></p>
      <p><button class="btn p" id="close">Darsni yopish</button></p></div>
    <div class="card"><h2>Jonli ro'yxat <span class="tag n" id="cnt"></span></h2><div id="roster"></div></div>`;
    $('#back').onclick = () => { openId = null; draw(); };
    $('#close').onclick = () => {
      const d = DB.get(), l = by(d.lessons, openId);
      d.users.filter(u => u.role == 'student' && lessonGroups(l).includes(u.group_id)).forEach(u => {
        if (!d.attendance.some(a => a.lesson_id == l.id && a.user_id == u.id)) d.attendance.push({ lesson_id: l.id, user_id: u.id, status: 'absent', method: '-', flagged: false, at: Date.now() });
      });
      l.open = false; l.closed = true; audit(d, 'Dars yopildi: ' + by(d.subjects, l.subject_id).name);
      DB.save(d); localStorage.removeItem('attendly_live_qr'); openId = null; tab = 'history'; draw(); toast('Dars yopildi');
    };
    let lastW = -1;
    const tick = () => {
      const d = DB.get(), l = by(d.lessons, openId); if (!l) return;
      const w = curWin();
      if (w != lastW) { lastW = w; const t = makeToken(l); renderQR($('#qr'), t); $('#tok').textContent = t;
        localStorage.setItem('attendly_live_qr', JSON.stringify({ lid: l.id, token: t, ts: Date.now() })); }
      $('#cd').style.width = (nextIn() / STEP * 100) + '%';
      drawRoster(d, l);
    };
    tick(); timer = setInterval(tick, 250);
  }
  let rosterSig = '';
  function drawRoster(d, l) {
    const st = d.users.filter(u => u.role == 'student' && lessonGroups(l).includes(u.group_id));
    const a = id => d.attendance.find(x => x.lesson_id == l.id && x.user_id == id);
    const sig = JSON.stringify(d.attendance.filter(x => x.lesson_id == l.id));
    if (sig == rosterSig && $('#roster').innerHTML) return; rosterSig = sig;
    $('#cnt').textContent = st.filter(u => a(u.id)?.status == 'present').length + ' / ' + st.length;
    $('#roster').innerHTML = table(['Talaba', 'Guruh', 'Holat', 'Usul', 'Masofa', ''], st.map(u => { const x = a(u.id);
      return [esc(u.name), esc(by(DB.get().groups, u.group_id)?.code), x ? statusTag(x.status) + (x.flagged ? ' <span class="tag warn">⚠ umumiy qurilma</span>' : '') : '<span class="tag n">Kutilmoqda</span>',
        x ? esc(x.method) : '', x?.distance ? Math.round(x.distance) + ' m' : '',
        x?.status == 'present' ? `<button class="btn sm d" data-c="${u.id}">Bekor qilish</button>` : `<button class="btn sm" data-m="${u.id}">Qo'lda belgilash</button>`]; }));
    $$('[data-c]').forEach(b => b.onclick = () => set(l, +b.dataset.c, 'cancelled'));
    $$('[data-m]').forEach(b => b.onclick = () => set(l, +b.dataset.m, 'present'));
  }
  function set(l, uid, status) {
    const d = DB.get(); let x = d.attendance.find(a => a.lesson_id == l.id && a.user_id == uid);
    if (!x) d.attendance.push(x = { lesson_id: l.id, user_id: uid, flagged: false });
    x.status = status == 'cancelled' ? 'absent' : status; x.method = 'teacher'; x.at = Date.now(); x.flagged = false;
    audit(d, `${U.name}: ${by(d.users, uid).name} — ${status == 'present' ? "qo'lda belgilandi" : 'davomat bekor qilindi'}`);
    DB.save(d); rosterSig = ''; drawRoster(d, l);
  }
  draw();
  window.addEventListener('storage', e => { if (e.key == KEY && openId) rosterSig = ''; });
}
