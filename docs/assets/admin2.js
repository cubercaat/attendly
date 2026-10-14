/* Admin: darslarni xonalarga qo'yish/tahrirlash, ro'yxatga olish, bildirishnoma, chat */
function adminExtras(U, redraw) {
  const dstr = t => { const x = new Date(t); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  let date = dstr(Date.now()), editing = null, rosterId = null, draft = null;
  const opt = (arr, f, sel) => arr.map(x => `<option value="${x.id}" ${sel == x.id ? 'selected' : ''}>${esc(f(x))}</option>`).join('');
  const dayMs = s => dayStart(new Date(s + 'T00:00:00').getTime());
  const stat = l => l.closed ? '<span class="tag n">Yopilgan</span>' : l.open ? '<span class="tag ok">Ochiq</span>' : '<span class="tag warn">Rejada</span>';

  function conflict(d, f) {
    for (const l of d.lessons) {
      if (l.id == f.id || dayKey(l.starts) !== dayKey(f.starts) || l.pair != f.pair) continue;
      if (l.room_id == f.room_id) return `Xona band: ${by(d.rooms, l.room_id)?.name} — ${lessonName(d, l)} (${groupCodes(d, l)})`;
      if (l.teacher_id == f.teacher_id) return `O'qituvchi band: ${by(d.users, l.teacher_id)?.name} — ${lessonName(d, l)}`;
      if (lessonGroups(l).some(g => f.groups.includes(g))) return `Guruh band: ${groupCodes(d, l)} — ${lessonName(d, l)}`;
    }
    return null;
  }

  function lessons(d, el) {
    const L = editing ? by(d.lessons, editing) : null;
    const v = draft || (L ? { date: dstr(L.starts), pair: L.pair, subject: L.subject_id, kind: L.kind || 'lec', groups: lessonGroups(L), teacher: L.teacher_id, room: L.room_id }
      : { date, pair: 1, subject: d.subjects[0]?.id, kind: 'lec', groups: [], teacher: d.users.find(u => u.role == 'teacher' && !u.all)?.id, room: d.rooms[0]?.id });
    draft = null;
    const day = d.lessons.filter(l => dstr(l.starts) == date).sort((a, b) => a.pair - b.pair);
    const teachers = d.users.filter(u => u.role == 'teacher' && !u.all);

    el.innerHTML = `
    <div class="card"><div class="row"><label>Sana<input type="date" id="dt" value="${date}"></label>
      <button class="btn" id="today">Bugun</button></div></div>

    <div class="card"><h2>${esc(dstr(dayMs(date)) == dstr(Date.now()) ? 'Bugungi darslar' : 'Darslar')} — ${date}</h2>
      ${table(['Juftlik', 'Fan', 'Guruh', "O'qituvchi", 'Xona', 'Holat', ''], day.map(l => [
        `<b>${l.pair}</b> <span class="muted sm">${SLOTS[l.pair] || ''}</span>`, esc(lessonName(d, l)), esc(groupCodes(d, l)),
        esc(by(d.users, l.teacher_id)?.name || '—'), esc(by(d.rooms, l.room_id)?.name || '—'), stat(l),
        `<button class="btn sm" data-ro="${l.id}">Ro'yxat</button> <button class="btn sm" data-ed="${l.id}">Tahrirlash</button> <button class="btn sm d" data-dl="${l.id}">O'chirish</button>`]),
        "Bu kunda dars yo'q — pastdagi forma yoki xona jadvalidan qo'shing")}</div>
    <div id="rosterbox"></div>

    <form class="card" id="lf"><h2>${L ? 'Darsni tahrirlash' : "Yangi dars qo'shish"}</h2>
      <div class="row"><label>Sana<input type="date" name="date" value="${v.date}" required></label>
        <label>Juftlik<select name="pair">${[1, 2, 3, 4, 5, 6, 7, 8].map(p => `<option value="${p}" ${v.pair == p ? 'selected' : ''}>${p} · ${SLOTS[p]}</option>`).join('')}</select></label>
        <label>Fan<select name="subject">${opt(d.subjects, s => s.name, v.subject)}</select></label>
        <label>Turi<select name="kind"><option value="lec" ${v.kind == 'lec' ? 'selected' : ''}>Ma'ruza</option><option value="prac" ${v.kind == 'prac' ? 'selected' : ''}>Amaliyot</option></select></label></div>
      <div class="row"><label>Guruh(lar) <span class="muted">— ma'ruza uchun bir nechtasini tanlang (Ctrl)</span>
        <select name="groups" multiple size="4">${d.groups.map(g => `<option value="${g.id}" ${v.groups.includes(g.id) ? 'selected' : ''}>${esc(g.code)}</option>`).join('')}</select></label>
        <label>O'qituvchi<select name="teacher">${opt(teachers, t => t.name, v.teacher)}</select></label>
        <label>Xona<select name="room">${opt(d.rooms, r => r.name, v.room)}</select></label></div>
      <button class="btn p">Saqlash</button> ${L ? '<button type="button" class="btn" id="cx">Bekor</button>' : ''}</form>

    <div class="card"><h2>Xona bandligi — ${date}</h2><p class="sm muted">Bo'sh katakni bosing — dars shu xona va juftlikka qo'yiladi.</p>
      <div class="tw"><table><thead><tr><th>Xona</th>${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<th>${s}<br><span style="font-weight:400;text-transform:none">${SLOTS[s]}</span></th>`).join('')}</tr></thead><tbody>
      ${d.rooms.map(r => `<tr><td><b>${esc(r.name)}</b></td>${[1, 2, 3, 4, 5, 6, 7, 8].map(s => {
        const l = d.lessons.find(x => dstr(x.starts) == date && x.pair == s && x.room_id == r.id);
        return l ? `<td><div class="slot" style="min-width:90px"><b>${esc(by(d.subjects, l.subject_id)?.name || '')}</b><br><span class="sm muted">${esc(groupCodes(d, l).replace(/-26/g, ''))}</span></div></td>`
          : `<td><button class="btn sm" data-fr="${r.id}" data-fs="${s}" title="Bo'sh">+</button></td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div></div>`;

    $('#dt').onchange = e => { date = e.target.value || date; editing = null; rosterId = null; redraw(); };
    $('#today').onclick = () => { date = dstr(Date.now()); redraw(); };
    $$('[data-ed]', el).forEach(b => b.onclick = () => { editing = +b.dataset.ed; redraw(); $('#lf')?.scrollIntoView(); });
    $$('[data-ro]', el).forEach(b => b.onclick = () => { rosterId = +b.dataset.ro; paintRoster(); $('#rosterbox').scrollIntoView(); });
    $$('[data-dl]', el).forEach(b => b.onclick = () => {
      if (!confirm("Dars o'chirilsinmi? Davomat yozuvlari ham o'chadi.")) return;
      const d = DB.get(), id = +b.dataset.dl, l = by(d.lessons, id);
      d.lessons = d.lessons.filter(x => x.id != id); d.attendance = d.attendance.filter(a => a.lesson_id != id);
      audit(d, `Dars o'chirildi: ${lessonName(d, l)} (${groupCodes(d, l)})`); DB.save(d); redraw();
    });
    $$('[data-fr]', el).forEach(b => b.onclick = () => {
      draft = { date, pair: +b.dataset.fs, subject: d.subjects[0]?.id, kind: 'lec', groups: [], teacher: teachers[0]?.id, room: +b.dataset.fr };
      editing = null; redraw(); $('#lf').scrollIntoView();
    });
    if ($('#cx')) $('#cx').onclick = () => { editing = null; redraw(); };
    $('#lf').onsubmit = e => {
      e.preventDefault();
      const f = e.target, d = DB.get();
      const groups = [...f.groups.selectedOptions].map(o => +o.value);
      if (!groups.length) return toast('Kamida bitta guruh tanlang');
      const dm = dayMs(f.date.value), pair = +f.pair.value;
      const rec = { id: editing || 0, starts: lessonTime(dm, pair), pair, room_id: +f.room.value, teacher_id: +f.teacher.value, groups };
      const bad = conflict(d, rec);
      if (bad) { draft = { date: f.date.value, pair, subject: +f.subject.value, kind: f.kind.value, groups, teacher: rec.teacher_id, room: rec.room_id }; redraw(); return toast('⚠ ' + bad); }
      const data = { subject_id: +f.subject.value, kind: f.kind.value, group_id: groups[0], group_ids: groups, room_id: rec.room_id, teacher_id: rec.teacher_id, pair, starts: rec.starts };
      if (editing) { const l = by(d.lessons, editing); Object.assign(l, data); audit(d, `Dars o'zgartirildi: ${lessonName(d, l)} → ${by(d.rooms, l.room_id).name}, ${pair}-juftlik`); }
      else { d.lessons.push({ id: DB.id(d, 'lesson'), open: false, closed: false, secret: 'a' + Math.random().toString(36).slice(2), ...data }); audit(d, `Dars qo'shildi: ${by(d.subjects, data.subject_id).name} → ${by(d.rooms, data.room_id).name}, ${pair}-juftlik`); }
      DB.save(d); date = f.date.value; editing = null; toast('Saqlandi'); redraw();
    };
    if (rosterId) paintRoster();
  }

  function paintRoster() {
    const d = DB.get(), l = by(d.lessons, rosterId), box = $('#rosterbox'); if (!l || !box) return;
    const st = d.users.filter(u => u.role == 'student' && lessonGroups(l).includes(u.group_id));
    const a = id => d.attendance.find(x => x.lesson_id == l.id && x.user_id == id);
    box.innerHTML = `<div class="card"><h2>Ro'yxat: ${esc(lessonName(d, l))} · ${esc(groupCodes(d, l))}</h2>
      <p><button class="btn p" id="allp">Hammasini ro'yxatga olish (keldi)</button> <button class="btn" id="allx">Tozalash</button> <button class="btn" id="cl">Yopish</button></p>
      ${table(['Talaba', 'Guruh', 'Holat', ''], st.map(u => [esc(u.name), esc(by(d.groups, u.group_id)?.code), a(u.id) ? statusTag(a(u.id).status) : '<span class="tag n">—</span>',
        ['present', 'late', 'absent'].map(s => `<button class="btn sm" data-s="${s}" data-u="${u.id}">${{ present: 'Keldi', late: 'Kech', absent: 'Kelmadi' }[s]}</button>`).join(' ')]))}</div>`;
    const set = (d, uid, s) => { let x = d.attendance.find(q => q.lesson_id == l.id && q.user_id == uid);
      if (!x) d.attendance.push(x = { lesson_id: l.id, user_id: uid, flagged: false });
      Object.assign(x, { status: s, method: 'admin', at: Date.now(), flagged: false }); };
    $$('[data-s]', box).forEach(b => b.onclick = () => { const d = DB.get(); set(d, +b.dataset.u, b.dataset.s); audit(d, `Admin: ${by(d.users, +b.dataset.u).name} — ${b.dataset.s}`); DB.save(d); paintRoster(); });
    $('#allp').onclick = () => { const d = DB.get(); st.forEach(u => set(d, u.id, 'present')); audit(d, `Admin: ${lessonGroups(l).length} guruh ro'yxatga olindi (${lessonName(d, l)})`); DB.save(d); paintRoster(); toast("Hammasi ro'yxatga olindi"); };
    $('#allx').onclick = () => { const d = DB.get(); d.attendance = d.attendance.filter(x => x.lesson_id != l.id); DB.save(d); paintRoster(); };
    $('#cl').onclick = () => { rosterId = null; box.innerHTML = ''; };
  }

  function notify(d, el) {
    el.innerHTML = `<form class="card" id="nf"><h2>Bildirishnoma yuborish</h2>
      <div class="row"><label>Kimga<select name="to"><option value="all">Hammaga</option><option value="teachers">Barcha o'qituvchilarga</option>
        <optgroup label="Guruh">${d.groups.map(g => `<option value="g${g.id}">Guruh: ${esc(g.code)}</option>`).join('')}</optgroup>
        <optgroup label="Talaba">${d.users.filter(u => u.role == 'student').map(u => `<option value="u${u.id}">${esc(u.name)} (${esc(by(d.groups, u.group_id)?.code)})</option>`).join('')}</optgroup></select></label>
        <label>Sarlavha<input name="title" required maxlength="80"></label></div>
      <label>Matn<input name="text" required maxlength="500"></label><button class="btn p">Yuborish</button></form>
      <div class="card"><h2>Yuborilganlar</h2>${table(['Vaqt', 'Kimga', 'Sarlavha', 'Matn', ''], (d.notices || []).slice().sort((a, b) => b.at - a.at).map(n => [fmtDT(n.at), esc(toLabel(d, n.to)), `<b>${esc(n.title)}</b>`, esc(n.text), `<button class="btn sm d" data-n="${n.id}">O'chirish</button>`]), "Hali xabar yuborilmagan")}</div>`;
    $('#nf').onsubmit = e => {
      e.preventDefault(); const f = e.target, d = DB.get(), v = f.to.value;
      const to = v == 'all' ? { kind: 'all' } : v == 'teachers' ? { kind: 'teachers' } : v[0] == 'g' ? { kind: 'group', id: +v.slice(1) } : { kind: 'user', id: +v.slice(1) };
      d.notices = d.notices || []; d.notices.push({ id: nextId(), to, title: f.title.value.trim(), text: f.text.value.trim(), at: Date.now(), by: U.name });
      audit(d, 'Bildirishnoma yuborildi: ' + f.title.value.trim()); DB.save(d); toast('Yuborildi ✅'); redraw();
    };
    $$('[data-n]', el).forEach(b => b.onclick = () => { const d = DB.get(); d.notices = d.notices.filter(n => n.id != b.dataset.n); DB.save(d); redraw(); });
  }

  return { lessons, notify, chat: (d, el) => renderChat(el, U) };
}
