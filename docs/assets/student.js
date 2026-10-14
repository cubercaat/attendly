const U = guard(['student']);
if (U) {
  let tab = 'scan', ctx = null, lastTok = sessionStorage.getItem('stu_last') || '';
  const TABS = [['scan', 'Skanerlash'], ['week', 'Jadval'], ['history', 'Davomatim'], ['inbox', 'Xabarlar'], ['chat', 'Chat'], ['me', 'Profil']];
  const DIST = { in: 35, near: 90, far: 4200 };

  function draw() {
    shell(U, 'Talaba paneli', tabLabel(U, TABS), tab);
    $$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; ctx = null; draw(); });
    ({ scan, week, history, inbox: (d, el) => renderInbox(el, U), chat: (d, el) => renderChat(el, U), me: profile })[tab](DB.get(), $('#view'));
  }
  const log = (d, text, ok) => audit(d, `${U.name}: ${text}`, ok);

  function scan(d, el) {
    if (ctx) return verify(d, el);
    el.innerHTML = `<div class="card"><h2>Davomatni belgilash</h2>
      <p class="muted sm">Haqiqiy ilovada kamera QR ni o'qiydi. Demoda ikki yo'l bor:</p>
      <p><button class="btn p" id="cam">📷 Kamera bilan skanerlash (o'qituvchi tabidagi QR)</button></p>
      <label>Yoki kodni qo'lda kiriting (eski kodni sinab ko'rish uchun)<input id="code" class="mono" value="${esc(lastTok)}" placeholder="1.123456.abcd"></label>
      <button class="btn" id="go">Tekshirish</button> <p class="sm muted" id="msg" style="margin-top:10px"></p></div>
      <div class="card"><h3>Aldab ko'rish</h3><p class="sm muted">Kamera bilan bir marta skanerlang, so'ng 15 soniya kuting va «Tekshirish» ni bosing — kod eskirgan bo'ladi. Uzoqlikni «Uyda» deb tanlab ko'ring — GPS to'sadi.</p></div>`;
    const msg = t => $('#msg').textContent = t;
    $('#cam').onclick = () => {
      let q; try { q = JSON.parse(localStorage.getItem('attendly_live_qr')); } catch (e) {}
      if (!q) return msg("O'qituvchi QR ekrani ochiq emas. Boshqa tabda o'qituvchi bilan kirib dars oching.");
      lastTok = q.token; sessionStorage.setItem('stu_last', lastTok); $('#code').value = lastTok; start(lastTok);
    };
    $('#go').onclick = () => { lastTok = $('#code').value; sessionStorage.setItem('stu_last', lastTok); start(lastTok); };
    function start(tok) {
      const d = DB.get(), r = verifyToken(tok, d);
      if (!by(d.users, U.id).enrolled) return msg("❌ Siz ro'yxatga olinmagansiz — «Profil» bo'limida ro'yxatdan o'ting yoki admin ro'yxatga olsin");
      if (r.err) { log(d, 'QR rad etildi — ' + r.err, false); DB.save(d); return msg('❌ ' + r.err); }
      const l = r.lesson;
      if (!lessonGroups(l).includes(U.group_id)) { log(d, 'boshqa guruh darsi', false); DB.save(d); return msg('❌ Bu dars sizning guruhingiz emas'); }
      if (!l.open) return msg('❌ Bu dars davomati yopilgan');
      const ex = d.attendance.find(a => a.lesson_id == l.id && a.user_id == U.id);
      if (ex?.status == 'present') return msg('✅ Davomatingiz allaqachon belgilangan');
      ctx = { lid: l.id, age: r.age, loc: 'in', method: 'passkey' }; draw();
    }
  }

  function verify(d, el) {
    const l = by(d.lessons, ctx.lid), room = by(d.rooms, l.room_id);
    el.innerHTML = `<div class="card"><h2>${esc(lessonName(d, l))}</h2>
      <p class="sm muted">${esc(room?.name)} · ${l.pair}-juftlik · QR yoshi ${ctx.age}s ✅</p>
      <ol class="steps"><li>✅ <span>QR kod to'g'ri va yangi</span></li>
      <li>📍 <span>Joylashuv (GPS) — demo uchun tanlang:<br>
        <select id="loc"><option value="in">Auditoriyada (~35 m)</option><option value="near">Koridorda (~90 m)</option><option value="far">Uyda (~4 km)</option></select></span></li>
      <li>🔐 <span>Shaxsni tasdiqlash:<br><select id="meth"><option value="passkey">Passkey (Face ID / barmoq izi)</option><option value="face">Yuz tanish + liveness</option><option value="friend">Do'stimning yuzi (aldash)</option></select></span></li></ol>
      <button class="btn p" id="ok">Tasdiqlash</button> <button class="btn" id="no">Bekor</button><p class="sm" id="res" style="margin-top:12px"></p></div>`;
    $('#no').onclick = () => { ctx = null; draw(); };
    $('#ok').onclick = async () => {
      const loc = $('#loc').value, meth = $('#meth').value, res = $('#res'), btn = $('#ok'); btn.disabled = true;
      const fail = (t, why) => { const d = DB.get(); log(d, why, false); DB.save(d); res.textContent = '❌ ' + t; btn.disabled = false; };
      const d0 = DB.get();
      if (DIST[loc] > by(d0.rooms, by(d0.lessons, ctx.lid).room_id).radius) return fail(`Siz auditoriyadan uzoqdasiz (~${DIST[loc]} m)`, `geofence rad — ${DIST[loc]} m`);
      res.textContent = meth == 'passkey' ? '🔐 Face ID tekshirilmoqda…' : '🙂 Markazga qarang… chapga buriling…';
      await new Promise(r => setTimeout(r, 1300));
      if (meth == 'friend') return fail("Yuz mos kelmadi — bu sizning akkauntingiz emas", 'face_mismatch');
      const d = DB.get(), lesson = by(d.lessons, ctx.lid);
      if (!lesson.open) return fail('Davomat oynasi yopildi', 'dars yopiq');
      const dev = deviceId(), shared = d.attendance.some(a => a.lesson_id == lesson.id && a.device == dev && a.user_id != U.id);
      let x = d.attendance.find(a => a.lesson_id == lesson.id && a.user_id == U.id);
      if (!x) d.attendance.push(x = { lesson_id: lesson.id, user_id: U.id });
      Object.assign(x, { status: 'present', method: meth, distance: DIST[loc], device: dev, flagged: shared, at: Date.now() });
      log(d, `davomat belgilandi (${meth}, ${DIST[loc]} m)${shared ? ' ⚠ umumiy qurilma' : ''}`, true);
      DB.save(d);
      res.innerHTML = '✅ <b>Davomatingiz belgilandi</b>' + (shared ? '<br>⚠ Bu qurilmadan boshqa talaba ham belgilangan — o\'qituvchiga belgi ketdi.' : '');
      setTimeout(() => { ctx = null; tab = 'history'; draw(); }, 1500);
    };
  }

  function week(d, el) { el.innerHTML = `<div class="card"><h2>${esc(by(d.groups, U.group_id)?.code)} — bu hafta</h2>${ttGrid(d, U.group_id)}</div>`; }
  function history(d, el) {
    const rows = d.attendance.filter(a => a.user_id == U.id).map(a => ({ a, l: by(d.lessons, a.lesson_id) })).filter(x => x.l).sort((p, q) => q.l.starts - p.l.starts);
    const p = rows.filter(x => x.a.status == 'present').length, pc = rows.length ? Math.round(p / rows.length * 100) : 0;
    el.innerHTML = `<div class="card"><h2>Davomat: ${pc}%</h2><div class="bar"><i style="width:${pc}%"></i></div><p class="sm muted">${p} / ${rows.length} dars</p></div>
      <div class="card">${table(['Sana', 'Fan', 'Juftlik', 'Holat', 'Usul'], rows.slice(0, 40).map(({ a, l }) =>
        [fmtD(l.starts), esc(lessonName(d, l)), l.pair, statusTag(a.status), esc(a.method || '')]), 'Hali yozuv yo\'q')}</div>`;
  }
  function profile(d, el) {
    setTimeout(() => { const b = $('#enr'); if (b) b.onclick = () => { const d = DB.get(), u = by(d.users, U.id); u.enrolled = true; audit(d, `${U.name}: ro'yxatdan o'tdi (passkey)`); DB.save(d); toast("Ro'yxatga olindingiz ✅"); draw(); }; });
    el.innerHTML = `<div class="card"><h2>${esc(U.name)}</h2><p class="sm">Guruh: <b>${esc(by(d.groups, U.group_id)?.code)}</b></p>
      <p class="sm">Biriktirilgan: ${by(d.users, U.id).enrolled ? '<span class="tag ok">Passkey</span> <span class="tag ok">Yuz shabloni</span>' : `<span class="tag warn">Ro'yxatda emas</span> <button class="btn p sm" id="enr">Ro'yxatdan o'tish (passkey yaratish)</button>`}</p>
      <p class="sm muted">Qurilma ID: <span class="mono">${deviceId()}</span> — bir brauzerdan ikki talaba belgilansa, o'qituvchiga ogohlantirish boradi.</p></div>`;
  }
  draw();
}
