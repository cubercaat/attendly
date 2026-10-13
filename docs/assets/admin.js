const U = guard(['super_admin']);
if (U) {
  let tab = sessionStorage.getItem('adm_tab') || 'home';
  const TABS = [['home', 'Umumiy'], ['groups', 'Guruhlar'], ['tt', 'Jadval'], ['rooms', 'Xonalar'], ['subjects', 'Fanlar'],
    ['users', 'Foydalanuvchilar'], ['invites', 'Takliflar'], ['report', 'Hisobot'], ['audit', 'Audit log']];

  function draw() {
    shell(U, 'Admin panel', TABS, tab);
    $$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; sessionStorage.setItem('adm_tab', tab); draw(); });
    V[tab](DB.get(), $('#view'));
  }
  const delBtn = id => `<button class="btn sm d" data-del="${id}">O'chirish</button>`;
  const bindDel = (el, fn) => $$('[data-del]', el).forEach(b => b.onclick = () => {
    if (!confirm("O'chirilsinmi?")) return;
    const d = DB.get(); fn(d, +b.dataset.del); DB.save(d); draw();
  });
  function addForm(el, fields, btn, fn) {
    el.insertAdjacentHTML('afterbegin', `<form class="card"><div class="row">${fields.map(([n, l, t, o]) =>
      `<label>${l}${t == 'select' ? `<select name="${n}">${o}</select>` : `<input name="${n}" type="${t || 'text'}" required>`}</label>`).join('')}
      <button class="btn p">${btn}</button></div></form>`);
    $('form', el).onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const d = DB.get();
      if (fn(d, f) === false) return;
      DB.save(d); draw(); toast('Saqlandi');
    };
  }
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  const V = {
    home(d, el) {
      const a = d.attendance, pr = a.filter(x => x.status == 'present').length;
      const stats = [['Talabalar', d.users.filter(u => u.role == 'student').length],
        ["O'qituvchilar", d.users.filter(u => u.role == 'teacher').length],
        ['Guruhlar', d.groups.length], ['Xonalar', d.rooms.length], ['Darslar', d.lessons.length],
        ['Davomat', a.length ? pct(pr, a.length) + '%' : '—'], ['Shubhali', a.filter(x => x.flagged).length]];
      el.innerHTML = `<div class="grid">${stats.map(([n, v]) => `<div class="card stat"><b>${v}</b><span>${n}</span></div>`).join('')}</div>
      <div class="card"><h2>So'nggi hodisalar</h2>${table(['Vaqt', 'Hodisa', ''],
        d.audit.slice(0, 8).map(x => [fmtT(x.at), esc(x.text), x.ok ? '<span class="tag ok">OK</span>' : '<span class="tag bad">Rad</span>']),
        "Hali hodisa yo'q — talaba panelida davomat belgilab ko'ring")}</div>
      <div class="card"><h2>Qanday sinash</h2><ol class="sm">
        <li>Yangi tabda <a href="../login.html" target="_blank">kirish sahifasi</a> → O'qituvchi → dars oching.</li>
        <li>Yana bir tabda Talaba bilan kiring va QR ni skanerlang.</li>
        <li>Bu yerda Hisobot va Audit logda natijani ko'ring.</li></ol></div>`;
    },
    groups(d, el) {
      el.innerHTML = '';
      addForm(el, [['code', 'Guruh kodi'], ['year', 'Yil', 'number']], "Qo'shish", (d, f) => {
        const c = f.code.trim().toUpperCase();
        if (d.groups.some(g => g.code == c)) { toast('Bu guruh bor'); return false; }
        d.groups.push({ id: DB.id(d, 'group'), code: c, year: +f.year, invite: Math.random().toString(36).slice(2, 10) });
        audit(d, "Guruh qo'shildi: " + c);
      });
      el.insertAdjacentHTML('beforeend', `<div class="card">${table(['Kod', 'Yil', 'Talabalar', 'Taklif havolasi', ''],
        d.groups.map(g => [`<b>${esc(g.code)}</b>`, g.year, d.users.filter(u => u.group_id == g.id && u.role == 'student').length,
          `<span class="cred">/join/${g.invite}</span>`, delBtn(g.id)]))}</div>`);
      bindDel(el, (d, id) => d.groups = d.groups.filter(g => g.id != id));
    },
    tt(d, el) {
      el.innerHTML = `<div class="card"><label style="max-width:240px">Guruh<select id="wg">${d.groups.map(g => `<option value="${g.id}" ${g.code == 'CYB3-26' ? 'selected' : ''}>${esc(g.code)}</option>`).join('')}</select></label><div id="tt"></div></div>`;
      const show = () => $('#tt').innerHTML = ttGrid(d, $('#wg').value); $('#wg').onchange = show; show();
    },
    rooms(d, el) {
      el.innerHTML = '';
      addForm(el, [['name', 'Nomi'], ['building', 'Bino'], ['radius', 'Geofence (m)', 'number']], "Qo'shish", (d, f) => {
        d.rooms.push({ id: DB.id(d, 'room'), name: f.name, building: f.building, radius: +f.radius });
        audit(d, "Xona qo'shildi: " + f.name);
      });
      el.insertAdjacentHTML('beforeend', `<div class="card">${table(['Xona', 'Bino', 'Radius', ''],
        d.rooms.map(r => [`<b>${esc(r.name)}</b>`, esc(r.building), r.radius + ' m', delBtn(r.id)]))}</div>`);
      bindDel(el, (d, id) => d.rooms = d.rooms.filter(r => r.id != id));
    },
    subjects(d, el) {
      el.innerHTML = '';
      addForm(el, [['name', 'Fan nomi']], "Qo'shish", (d, f) => { d.subjects.push({ id: DB.id(d, 'subject'), name: f.name }); });
      el.insertAdjacentHTML('beforeend', `<div class="card">${table(['Fan', ''], d.subjects.map(s => [esc(s.name), delBtn(s.id)]))}</div>`);
      bindDel(el, (d, id) => d.subjects = d.subjects.filter(s => s.id != id));
    },
    users(d, el) {
      el.innerHTML = '';
      const go = d.groups.map(g => `<option value="${g.id}">${esc(g.code)}</option>`).join('');
      addForm(el, [['name', 'F.I.Sh.'], ['login', 'Login'], ['pass', 'Parol'],
        ['role', 'Rol', 'select', `<option value="student">Talaba</option><option value="teacher">O'qituvchi</option><option value="starosta">Starosta</option>`],
        ['group', 'Guruh', 'select', go]], "Qo'shish", (d, f) => {
        if (d.users.some(u => u.login == f.login)) { toast('Login band'); return false; }
        d.users.push({ id: DB.id(d, 'user'), login: f.login, pass: f.pass, name: f.name, role: f.role, group_id: +f.group, enrolled: true });
        audit(d, "Foydalanuvchi qo'shildi: " + f.name);
      });
      el.insertAdjacentHTML('beforeend', `<div class="card">${table(['Ism', 'Rol', 'Guruh', 'Login', ''],
        d.users.map(u => [esc(u.name), `<span class="tag n">${ROLE_UZ[u.role]}</span>`, esc(by(d.groups, u.group_id)?.code || '—'),
          `<span class="cred">${esc(u.login)}</span>`, u.id == U.id ? '' : delBtn(u.id)]))}</div>`);
      bindDel(el, (d, id) => d.users = d.users.filter(u => u.id != id));
    },
    invites(d, el) {
      el.innerHTML = '';
      addForm(el, [['role', 'Rol', 'select', `<option value="teacher">O'qituvchi</option><option value="starosta">Starosta</option>`], ['note', 'Izoh']],
        'Havola yaratish', (d, f) => {
          d.invites.unshift({ id: DB.id(d, 'invite'), role: f.role, note: f.note, token: Math.random().toString(36).slice(2, 14), used: false, at: Date.now() });
          audit(d, 'Taklif yaratildi: ' + f.role);
        });
      el.insertAdjacentHTML('beforeend', `<div class="card">${table(['Rol', 'Izoh', 'Havola', 'Holat'],
        d.invites.map(i => [ROLE_UZ[i.role], esc(i.note), `<span class="cred">t.me/AttendlyBot?start=t_${i.token}</span>`,
          i.used ? '<span class="tag n">Ishlatilgan</span>' : '<span class="tag ok">Faol</span>']), "Havola yo'q")}</div>`);
    },
    report(d, el) {
      const rows = d.groups.map(g => {
        const st = d.users.filter(u => u.group_id == g.id && u.role == 'student').map(u => u.id);
        const a = d.attendance.filter(x => st.includes(x.user_id));
        return [esc(g.code), st.length, a.length, a.length ? pct(a.filter(x => x.status == 'present').length, a.length) + '%' : '—', a.filter(x => x.flagged).length];
      });
      const sts = d.users.filter(u => u.role == 'student').map(u => {
        const a = d.attendance.filter(x => x.user_id == u.id);
        return [esc(u.name), esc(by(d.groups, u.group_id)?.code || ''), a.length, pct(a.filter(x => x.status == 'present').length, a.length)];
      }).sort((a, b) => a[3] - b[3]);
      el.innerHTML = `<div class="card"><h2>Guruhlar bo'yicha</h2>${table(['Guruh', 'Talaba', 'Yozuv', 'Davomat', 'Shubhali'], rows)}</div>
      <div class="card"><h2>Talabalar (eng past davomat birinchi)</h2>${table(['Talaba', 'Guruh', 'Dars', '%'],
        sts.map(r => [r[0], r[1], r[2], `<div class="bar" style="width:90px;display:inline-block"><i style="width:${r[3]}%"></i></div> ${r[3]}%`]))}</div>`;
    },
    audit(d, el) {
      el.innerHTML = `<div class="card"><h2>Audit log</h2>${table(['Vaqt', 'Hodisa', 'Natija'],
        d.audit.map(x => [fmtD(x.at) + ' ' + fmtT(x.at), esc(x.text), x.ok ? '<span class="tag ok">OK</span>' : '<span class="tag bad">Rad</span>']), "Hodisa yo'q")}</div>`;
    },
  };
  draw();
  window.addEventListener('storage', e => { if (e.key == KEY && ['home', 'audit', 'report'].includes(tab)) draw(); });
}
