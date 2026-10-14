const U = guard(['student']);
if (U) {
  let tab = 'scan', ctx = null, facing = 'environment', lastTok = sessionStorage.getItem('stu_last') || '';
  const TABS = [['scan', 'Skanerlash'], ['week', 'Jadval'], ['history', 'Davomatim'], ['inbox', 'Xabarlar'], ['chat', 'Chat'], ['me', 'Profil']];
  const DIST = { in: 35, near: 90, far: 4200 };
  const cur = () => by(DB.get().users, U.id);
  const faceKey = 'face_ok_' + U.id;
  const log = (d, text, ok) => audit(d, `${U.name}: ${text}`, ok);
  const rnd = a => a[Math.floor(Math.random() * a.length)];

  /* ishonchli qurilma: ro'yxatdan o'tgan telefon. Birinchi kirgan qurilma avtomatik ishonchli bo'ladi */
  function devices(d) { d.devices = d.devices || {}; return d.devices[U.id] = d.devices[U.id] || []; }
  function trusted() {
    const d = DB.get(); d.devices = d.devices || {};
    if (by(d.users, U.id).enrolled && d.devices[U.id] === undefined) { d.devices[U.id] = [deviceId()]; DB.save(d); }
    return (d.devices[U.id] || []).includes(deviceId());
  }
  const faceOK = () => sessionStorage.getItem(faceKey) == '1';

  function draw() {
    Cam.stop();
    shell(U, 'Talaba paneli', tabLabel(U, TABS), tab);
    $$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; ctx = null; draw(); });
    ({ scan, week, history, inbox: (d, el) => renderInbox(el, U), chat: (d, el) => renderChat(el, U), me: profile })[tab](DB.get(), $('#view'));
  }

  /* ---------------------------------------------------------------- skaner */
  function scan(d, el) {
    if (ctx) return verify(d, el);
    const me = by(d.users, U.id);
    if (!me.enrolled) return el.innerHTML = `<div class="card"><h2>Ro'yxatdan o'tish kerak</h2><p class="muted">Davomat belgilash uchun avval ro'yxatdan o'ting: yuzingiz bir marta olinadi va telefoningiz biriktiriladi.</p>
      <button class="btn p" id="gp">Profilga o'tish</button></div>`, $('#gp').onclick = () => { tab = 'me'; draw(); };
    if (!trusted() && !faceOK()) return gate(d, el);
    scanner(el);
  }

  /* yangi qurilma (masalan, do'stning telefoni): yuz + liveness tekshiruvi */
  function gate(d, el) {
    const hasT = !!(d.faces || {})[U.id];
    el.innerHTML = `<div class="card"><h2>Yangi qurilma</h2>
      <p class="muted">Bu telefon sizning akkauntingizga biriktirilmagan. Davomat belgilashdan oldin yuzingiz tekshiriladi: kamera sizdan <b>chapga yoki o'ngga burilishni</b> so'raydi — shunda rasm ko'rsatib aldab bo'lmaydi.</p>
      ${hasT ? '<button class="btn p" id="gf">Yuzni tekshirish</button>' : `<p class="tag warn">Akkauntda yuz shabloni yo'q — avval asosiy telefonda «Profil» orqali yuzni ro'yxatga oling.</p>`}
      <p class="sm" id="gm"></p></div>`;
    if (!hasT) return;
    $('#gf').onclick = async () => {
      let r;
      try { r = await Face.run(el, ['center', rnd(['left', 'right'])], 'Yuzni tekshirish'); }
      catch (e) { draw(); return toast('Kamera ochilmadi — brauzerda kameraga ruxsat bering'); }
      const d = DB.get(), t = d.faces[U.id];
      const sim = Face.cos(r.vecs[0], t), live = Face.distinct(r.vecs);
      if (!live) { log(d, "yuz tekshiruvi rad: jonli yuz emas (rasm bo'lishi mumkin)", false); DB.save(d); draw(); return toast("❌ Jonli yuz aniqlanmadi (rasm ko'rsatilgan bo'lishi mumkin)"); }
      if (sim < 0.6) { log(d, `yuz tekshiruvi rad: yuz mos kelmadi (${sim.toFixed(2)})`, false); DB.save(d); draw(); return toast('❌ Yuz mos kelmadi — bu sizning akkauntingiz emas'); }
      sessionStorage.setItem(faceKey, '1'); log(d, `yangi qurilmada yuz tekshiruvidan o'tdi (${sim.toFixed(2)})`, true); DB.save(d); draw(); toast('✅ Yuz tasdiqlandi');
    };
  }

  /* doim ochiq kamera */
  function scanner(el) {
    el.innerHTML = `<div class="card" style="padding:12px"><div id="vf" style="position:relative;max-width:420px;margin:auto;aspect-ratio:3/4;background:#000;border-radius:14px;overflow:hidden">
        <video id="sv" style="width:100%;height:100%;object-fit:cover"></video>
        <div class="vfm"><i></i><i></i><i></i><i></i></div><div class="vfl"></div>
        <div id="sm" style="position:absolute;left:0;right:0;bottom:0;padding:10px;text-align:center;color:#fff;font-size:13px;background:linear-gradient(transparent,rgba(0,0,0,.65))">QR kodni ramka ichiga keltiring</div></div>
      <div class="row" style="justify-content:center;margin-top:10px;max-width:420px;margin-inline:auto">
        <button class="btn" id="flip">🔄 Kamerani almashtirish</button></div>
      <p class="sm muted" style="text-align:center;margin:8px 0 0">Faqat jonli kamera qabul qilinadi — galereya yoki skrinshot o'tmaydi</p>
      <details style="max-width:420px;margin:12px auto 0"><summary class="sm muted" style="cursor:pointer">Qo'lda kiritish / demo</summary>
        <label style="margin-top:10px">Kod (eski kodni sinab ko'rish uchun)<input id="code" class="mono" value="${esc(lastTok)}" placeholder="1.123456.abcd"></label>
        <button class="btn" id="go">Tekshirish</button> <button class="btn" id="live">O'qituvchi QR ekranini avtomatik o'qish</button>
        <p class="sm muted" style="margin-top:8px">Kamera bilan bir marta skanerlang, so'ng 15 soniya kuting va «Tekshirish» ni bosing — kod eskirgan bo'ladi. Uzoqlikni «Uyda» deb tanlab ko'ring — GPS to'sadi.</p></details></div>`;
    const v = $('#sv'), msg = t => { const m = $('#sm'); if (m) m.textContent = t; };
    const resume = (ms = 1800) => setTimeout(() => { if ($('#sv') && !ctx) { msg('QR kodni ramka ichiga keltiring'); Cam.scan(v, handle); } }, ms);
    function handle(code) {
      let tok = String(code).trim(); const m = tok.match(/\/s\/([^/?#\s]+)/); if (m) tok = m[1];
      lastTok = tok; sessionStorage.setItem('stu_last', tok);
      const err = start(tok);
      if (err) { msg('❌ ' + err); resume(); }
    }
    const open = async () => {
      try { await Cam.open(v, facing); msg('QR kodni ramka ichiga keltiring'); Cam.scan(v, handle); }
      catch (e) { msg("Kamera ochilmadi. Brauzerda kameraga ruxsat bering."); }
    };
    open();
    $('#flip').onclick = () => { facing = facing == 'environment' ? 'user' : 'environment'; open(); };
    $('#go').onclick = () => { lastTok = $('#code').value; sessionStorage.setItem('stu_last', lastTok); const err = start(lastTok); if (err) msg('❌ ' + err); };
    $('#live').onclick = () => {
      let q; try { q = JSON.parse(localStorage.getItem('attendly_live_qr')); } catch (e) {}
      if (!q) return msg("O'qituvchi QR ekrani ochiq emas. Boshqa tabda o'qituvchi bilan kirib dars oching.");
      handle(q.token);
    };
  }

  /* QR ni tekshiradi; xato bo'lsa matn qaytaradi, aks holda tasdiqlash bosqichiga o'tadi */
  function start(tok) {
    const d = DB.get(), r = verifyToken(tok, d);
    if (r.err) { log(d, 'QR rad etildi — ' + r.err, false); DB.save(d); return r.err; }
    const l = r.lesson;
    if (!lessonGroups(l).includes(U.group_id)) { log(d, 'boshqa guruh darsi', false); DB.save(d); return 'Bu dars sizning guruhingiz emas'; }
    if (l.closed) return 'Bu dars davomati yopilgan';
    const ex = d.attendance.find(a => a.lesson_id == l.id && a.user_id == U.id);
    if (ex?.status == 'present') return 'Davomatingiz allaqachon belgilangan';
    Cam.stop(); ctx = { lid: l.id, age: r.age }; draw(); return null;
  }

  function verify(d, el) {
    const l = by(d.lessons, ctx.lid), room = by(d.rooms, l.room_id), tr_ = trusted(), geoReq = !!room && geoOf(room).required;
    el.innerHTML = `<div class="card"><h2>${esc(lessonName(d, l))}</h2>
      <p class="sm muted">${esc(room?.name)} · ${l.pair}-juftlik · QR yoshi ${ctx.age}s ✅</p>
      <ol class="steps"><li>✅ <span>QR kod to'g'ri va yangi</span></li>
      <li>📍 <span>${geoReq ? (cornersOk(room) ? "Joylashuv (GPS): xonaning 4 burchagi ichida bo'lishingiz kerak" : "⚠ Xona chegarasi belgilanmagan — admin 4 burchakni kiritishi kerak") : "Joylashuv: bu xonada talab qilinmaydi"}
        ${geoReq && cornersOk(room) ? `<br><select id="sim"><option value="real">Haqiqiy GPS (telefon joylashuvi)</option><option value="in">Demo: xona ichida</option><option value="out">Demo: xonadan tashqarida</option></select>` : ''}</span></li>
      <li>🔐 <span>${tr_ ? "Telefon Face ID / barmoq izi (passkey) — yuz kamerasi kerak emas" : "Yuz tekshiruvi bu sessiyada o'tgan"}</span></li></ol>
      <button class="btn p" id="ok">Tasdiqlash</button> <button class="btn" id="no">Bekor</button><p class="sm" id="res" style="margin-top:12px"></p></div>`;
    $('#no').onclick = () => { ctx = null; draw(); };
    $('#ok').onclick = async () => {
      const meth = tr_ ? 'passkey' : 'face', res = $('#res'), btn = $('#ok'); btn.disabled = true;
      const fail = (t, why) => { const d = DB.get(); log(d, why, false); DB.save(d); res.textContent = '❌ ' + t; btn.disabled = false; };
      let dist = null, pos = null;
      if (geoReq) {
        if (!cornersOk(room)) return fail("Xona chegarasi belgilanmagan — admin 4 burchakni kiritishi kerak", "geofence: burchaklar yo'q");
        const sim = $('#sim').value, ct = polyCentroid(geoOf(room).corners);
        try {
          if (sim == 'in') pos = { lat: ct.lat, lng: ct.lng, acc: 8 };
          else if (sim == 'out') pos = { lat: ct.lat + 0.045, lng: ct.lng, acc: 8 };
          else { res.textContent = '📍 Joylashuv aniqlanmoqda…'; pos = await getPosition(); }
        } catch (e) { return fail('Joylashuvga ruxsat bering (brauzer sozlamalarida)', "joylashuv ruxsati yo'q"); }
        if (pos.acc > 100) return fail(`GPS aniqligi past (~${Math.round(pos.acc)} m) — ochiq joyga chiqing`, 'GPS aniqligi past');
        dist = distToPolyM(pos.lat, pos.lng, geoOf(room).corners);
        if (dist - Math.min(pos.acc, 100) > 0) return fail(`Siz auditoriyadan uzoqdasiz (~${Math.round(dist)} m)`, `geofence rad — xonadan ${Math.round(dist)} m tashqarida`);
      }
      res.textContent = '🔐 Face ID tekshirilmoqda…';
      await new Promise(r => setTimeout(r, 1100));
      const d = DB.get(), lesson = by(d.lessons, ctx.lid);
      if (lesson.closed) return fail('Davomat oynasi yopildi', 'dars yopiq');
      const dev = deviceId(), shared = d.attendance.some(a => a.lesson_id == lesson.id && a.device == dev && a.user_id != U.id);
      let x = d.attendance.find(a => a.lesson_id == lesson.id && a.user_id == U.id);
      if (!x) d.attendance.push(x = { lesson_id: lesson.id, user_id: U.id });
      Object.assign(x, { status: 'present', method: meth, distance: dist, lat: pos?.lat, lng: pos?.lng, device: dev, flagged: shared, at: Date.now() });
      log(d, `davomat belgilandi (${meth}${dist !== null ? ', ' + Math.round(dist) + ' m' : ', joylashuv talab qilinmadi'})${shared ? ' ⚠ umumiy qurilma' : ''}`, true);
      DB.save(d);
      res.innerHTML = '✅ <b>Davomatingiz belgilandi</b>' + (shared ? "<br>⚠ Bu qurilmadan boshqa talaba ham belgilangan — o'qituvchiga belgi ketdi." : '');
      setTimeout(() => { ctx = null; tab = 'history'; draw(); }, 1500);
    };
  }

  /* ---------------------------------------------------------------- boshqa bo'limlar */
  function week(d, el) { el.innerHTML = `<div class="card"><h2>${esc(by(d.groups, U.group_id)?.code)} — bu hafta</h2>${ttGrid(d, U.group_id)}</div>`; }
  function history(d, el) {
    const rows = d.attendance.filter(a => a.user_id == U.id).map(a => ({ a, l: by(d.lessons, a.lesson_id) })).filter(x => x.l).sort((p, q) => q.l.starts - p.l.starts);
    const p = rows.filter(x => x.a.status == 'present').length, pc = rows.length ? Math.round(p / rows.length * 100) : 0;
    el.innerHTML = `<div class="card"><h2>Davomat: ${pc}%</h2><div class="bar"><i style="width:${pc}%"></i></div><p class="sm muted">${p} / ${rows.length} dars</p></div>
      <div class="card">${table(['Sana', 'Fan', 'Juftlik', 'Holat', 'Usul'], rows.slice(0, 40).map(({ a, l }) =>
        [fmtD(l.starts), esc(lessonName(d, l)), l.pair, statusTag(a.status), esc(a.method || '')]), "Hali yozuv yo'q")}</div>`;
  }

  async function register(el) {
    let r;
    try { r = await Face.run(el, ['center', ...rnd([['left', 'right'], ['right', 'left']])], "Ro'yxatdan o'tish: yuzni olish"); }
    catch (e) { draw(); return toast('Kamera ochilmadi — brauzerda kameraga ruxsat bering'); }
    if (!Face.distinct(r.vecs)) { draw(); return toast("❌ Kadrlar bir xil — jonli yuz emas. Qaytadan urinib ko'ring"); }
    const d = DB.get(), u = by(d.users, U.id);
    d.faces = d.faces || {}; d.faces[U.id] = r.vecs[0];
    const list = devices(d); if (!list.includes(deviceId())) list.push(deviceId());
    u.enrolled = true; audit(d, `${U.name}: ro'yxatdan o'tdi (yuz + passkey)`); DB.save(d); toast("Ro'yxatga olindingiz ✅"); draw();
  }

  function profile(d, el) {
    const me = by(d.users, U.id), hasT = !!(d.faces || {})[U.id], tr_ = trusted();
    el.innerHTML = `<div class="card"><h2>${esc(U.name)}</h2><p class="sm">Guruh: <b>${esc(by(d.groups, U.group_id)?.code)}</b></p>
      <p class="sm">Biriktirilgan: ${me.enrolled ? `<span class="tag ok">Passkey</span> ${hasT ? '<span class="tag ok">Yuz shabloni</span>' : '<span class="tag warn">Yuz shabloni yo\'q</span>'}` : '<span class="tag warn">Ro\'yxatda emas</span>'}</p>
      <p class="sm">Bu qurilma: ${tr_ ? '<span class="tag ok">Ishonchli</span>' : '<span class="tag warn">Yangi qurilma</span>'}</p>
      <p><button class="btn p" id="reg">${hasT ? 'Yuz shablonini yangilash' : "Ro'yxatdan o'tish (yuzni olish)"}</button>
      ${me.enrolled && !hasT ? '<button class="btn" id="nocam">Kamerasiz ro\'yxatdan o\'tish (demo)</button>' : ''}
      ${tr_ ? '<button class="btn" id="untrust">Bu qurilmani chiqarish (demo: do\'stning telefoni)</button>' : ''}</p>
      <p class="sm muted">Yuz tekshiruvi faqat ro'yxatdan o'tishda va yangi (biriktirilmagan) qurilmada so'raladi. Biriktirilgan telefonda davomat telefonning o'z Face ID / barmoq izi bilan, yuz kamerasisiz belgilanadi.</p>
      <p class="sm muted">Qurilma ID: <span class="mono">${deviceId()}</span> — bir brauzerdan ikki talaba belgilansa, o'qituvchiga ogohlantirish boradi.</p></div>`;
    $('#reg').onclick = () => register(el);
    if ($('#nocam')) $('#nocam').onclick = () => { const d = DB.get(); by(d.users, U.id).enrolled = true; DB.save(d); draw(); };
    if ($('#untrust')) $('#untrust').onclick = () => { const d = DB.get(); d.devices[U.id] = (d.devices[U.id] || []).filter(x => x != deviceId()); sessionStorage.removeItem(faceKey); DB.save(d); toast('Qurilma chiqarildi — endi bu "yangi qurilma"'); draw(); };
  }
  draw();
}
