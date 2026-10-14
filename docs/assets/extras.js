/* Bildirishnoma (xabarlar) va chat — admin, o'qituvchi va talaba panellari uchun umumiy. */
const nextId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
const fmtDT = t => fmtD(t) + ' ' + fmtT(t);

/* ------------------------------------------------------------ bildirishnomalar */
function noticeFor(u, n) {
  const t = n.to;
  if (t.kind == 'all') return true;
  if (t.kind == 'teachers') return u.role == 'teacher' || u.role == 'super_admin';
  if (t.kind == 'group') return u.group_id == t.id;
  if (t.kind == 'user') return u.id == t.id;
  return false;
}
function myNotices(d, u) { return (d.notices || []).filter(n => noticeFor(u, n)).sort((a, b) => b.at - a.at); }
function unreadCount(u) {
  const d = DB.get(), seen = (d.reads || {})[u.id] || 0;
  return myNotices(d, u).filter(n => n.at > seen).length;
}
function toLabel(d, t) {
  if (t.kind == 'all') return 'Hammaga';
  if (t.kind == 'teachers') return "Barcha o'qituvchilarga";
  if (t.kind == 'group') return 'Guruh: ' + (by(d.groups, t.id)?.code || '');
  return by(d.users, t.id)?.name || '';
}
function renderInbox(el, U) {
  const d = DB.get(), list = myNotices(d, U), seen = (d.reads || {})[U.id] || 0;
  el.innerHTML = `<div class="card"><h2>Xabarlar</h2>${list.length ? list.map(n => `<div style="padding:12px 0;border-bottom:1px solid var(--line)">
    <div><b>${esc(n.title)}</b> ${n.at > seen ? '<span class="tag ok">Yangi</span>' : ''}</div>
    <div style="white-space:pre-wrap;margin:4px 0">${esc(n.text)}</div>
    <div class="sm muted">${esc(n.by)} · ${fmtDT(n.at)}</div></div>`).join('') : "<p class=\"muted\">Xabarlar yo'q</p>"}</div>`;
  d.reads = d.reads || {}; d.reads[U.id] = Date.now(); DB.save(d);
}
const tabLabel = (U, tabs) => tabs.map(([k, n]) => { const c = k == 'inbox' ? unreadCount(U) : 0; return c ? [k, n + ' (' + c + ')'] : [k, n]; });

/* ------------------------------------------------------------ chat */
function chatChannels(d, U) {
  const ch = [{ id: 'all', name: 'Umumiy chat' }];
  if (U.role != 'student') ch.push({ id: 'staff', name: 'Xodimlar' });
  (U.role == 'super_admin' || U.role == 'teacher' ? d.groups : d.groups.filter(g => g.id == U.group_id)).forEach(g => ch.push({ id: 'g' + g.id, name: g.code }));
  return ch;
}
let chatHandler = null;
function renderChat(el, U, startCh) {
  let ch = startCh || 'all';
  el.innerHTML = `<div class="card"><h2>Chat</h2><div class="tabs" id="chch" style="margin-bottom:10px"></div>
    <div id="chmsg" style="height:380px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--bg)"></div>
    <form id="chf" class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="cht" placeholder="Xabar yozing…" autocomplete="off" style="flex:1"><button class="btn p">Yuborish</button></form></div>`;
  const paint = () => {
    const d = DB.get(), chans = chatChannels(d, U);
    if (!chans.some(c => c.id == ch)) ch = 'all';
    $('#chch').innerHTML = chans.map(c => `<button class="tab ${c.id == ch ? 'on' : ''}" data-c="${c.id}">${esc(c.name)}</button>`).join('');
    $$('#chch .tab').forEach(b => b.onclick = () => { ch = b.dataset.c; paint(); });
    const box = $('#chmsg'), atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    const msgs = (d.chat || []).filter(m => m.ch == ch).slice(-150);
    box.innerHTML = msgs.length ? msgs.map(m => {
      const mine = m.uid == U.id, role = ROLE_UZ[m.role] || '';
      return `<div style="display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};margin-bottom:8px">
        <div class="sm muted">${esc(m.name)} · ${role} · ${fmtT(m.at)}${U.role == 'super_admin' ? ` <a href="#" data-del="${m.id}">✕</a>` : ''}</div>
        <div style="max-width:80%;padding:7px 11px;border-radius:12px;background:${mine ? 'var(--accent)' : 'var(--sunken)'};color:${mine ? 'var(--accent-ink)' : 'var(--ink)'};white-space:pre-wrap;word-break:break-word">${esc(m.text)}</div></div>`;
    }).join('') : `<p class="muted">Hali xabar yo'q — birinchi bo'lib yozing</p>`;
    $$('[data-del]', box).forEach(a => a.onclick = e => { e.preventDefault(); const d = DB.get(); d.chat = d.chat.filter(m => m.id != a.dataset.del); DB.save(d); paint(); });
    if (atEnd || !box.dataset.init) { box.scrollTop = box.scrollHeight; box.dataset.init = 1; }
  };
  $('#chf').onsubmit = e => {
    e.preventDefault(); const t = $('#cht').value.trim(); if (!t) return;
    const d = DB.get(); d.chat = d.chat || [];
    d.chat.push({ id: nextId(), ch, uid: U.id, name: U.name, role: U.role, text: t.slice(0, 500), at: Date.now() });
    if (d.chat.length > 600) d.chat = d.chat.slice(-600);
    DB.save(d); $('#cht').value = ''; paint(); $('#chmsg').scrollTop = 1e9;
  };
  if (chatHandler) window.removeEventListener('storage', chatHandler);
  chatHandler = e => { if (e.key == KEY && $('#chmsg')) paint(); };
  window.addEventListener('storage', chatHandler);
  paint();
}
