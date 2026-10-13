/* Attendly demo — barcha ma'lumot brauzerda (localStorage). Backend kerak emas. */
const KEY='attendly_demo_v3', SESS='attendly_demo_sess';
const STEP=3, WINDOWS=4;           // QR har 3s, 4 oyna = 12s
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE=location.pathname.replace(/\/(admin|teacher|student)\/.*$/,'/').replace(/[^/]*$/,'');

const DB={
  get(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.v==3){ensureToday(d);return d}}catch(e){}const d=seed();localStorage.setItem(KEY,JSON.stringify(d));return d},
  save(d){localStorage.setItem(KEY,JSON.stringify(d))},
  reset(){localStorage.removeItem(KEY);localStorage.removeItem('attendly_live_qr')},
  id(d,k){return d.nid[k]++},
};
function audit(d,text,ok=true){d.audit.unshift({at:Date.now(),text,ok});d.audit.length=Math.min(d.audit.length,200)}
const ROLE_UZ={super_admin:'Super admin',teacher:"O'qituvchi",starosta:'Starosta',student:'Talaba'};
const HOME={super_admin:'admin',teacher:'teacher',starosta:'teacher',student:'student'};

/* ---- sessiya (har brauzer tabi uchun alohida: o'qituvchi va talaba yonma-yon sinaladi) */
function me(){const id=+sessionStorage.getItem(SESS);return DB.get().users.find(u=>u.id===id)||null}
function login(l,p){const u=DB.get().users.find(u=>u.login===l.trim()&&u.pass===p);if(u)sessionStorage.setItem(SESS,u.id);return u}
function logout(){sessionStorage.removeItem(SESS);location.href=BASE+'login.html'}
function guard(roles){const u=me();if(!u||!roles.includes(u.role)){location.href=BASE+'login.html?need='+roles[0];return null}return u}

/* ---- QR token (demo imzo: FNV; haqiqiy tizimda HMAC-SHA256) */
function sig(secret,lid,w){let h=2166136261;const s=`${secret}|${lid}|${w}`;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h.toString(36)}
const curWin=(t=Date.now())=>Math.floor(t/1000/STEP);
const makeToken=(l,t)=>{const w=curWin(t);return `${l.id}.${w}.${sig(l.secret,l.id,w)}`};
const nextIn=()=>STEP-((Date.now()/1000)%STEP);
function verifyToken(tok,d){
  const p=String(tok||'').trim().split('.');
  if(p.length!=3||!/^\d+$/.test(p[0])||!/^\d+$/.test(p[1]))return{err:"QR kod noto'g'ri"};
  const l=d.lessons.find(x=>x.id==p[0]);if(!l)return{err:'Dars topilmadi'};
  const w=+p[1],n=curWin();
  if(w>n)return{err:"Qurilma soati noto'g'ri"};
  if(n-w>=WINDOWS)return{err:'QR kod eskirgan — ekrandagi yangi kodni skanerlang'};
  if(sig(l.secret,l.id,w)!==p[2])return{err:'QR kod yaroqsiz'};
  return{lesson:l,age:(n-w)*STEP};
}
function deviceId(){let v=localStorage.getItem('attendly_dev');if(!v){v=Math.random().toString(36).slice(2,10);localStorage.setItem('attendly_dev',v)}return v}

/* ---- UI yordamchilar */
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
const fmtT=t=>new Date(t).toLocaleTimeString('uz',{hour:'2-digit',minute:'2-digit'});
const fmtD=t=>new Date(t).toLocaleDateString('uz',{day:'2-digit',month:'2-digit'});
const by=(arr,id)=>arr.find(x=>x.id==id);
const statusTag=s=>({present:'<span class="tag ok">Keldi</span>',late:'<span class="tag warn">Kech</span>',absent:'<span class="tag bad">Kelmadi</span>',cancelled:'<span class="tag bad">Bekor</span>'}[s]||'<span class="tag n">—</span>');
function shell(u,title,tabs,cur){
  document.body.innerHTML=`<div class="banner">DEMO — ma'lumot faqat sizning brauzeringizda saqlanadi</div>
  <div class="top"><span class="brand">Attendly</span><span class="pill">${esc(title)}</span><span class="sp"></span>
  <span class="sm muted">${esc(u.name)} · ${ROLE_UZ[u.role]}</span>
  <button class="btn sm" id="reset">Demoni tiklash</button><button class="btn sm" id="out">Chiqish</button></div>
  <div class="wrap">${tabs?`<div class="tabs">${tabs.map(([k,n])=>`<button class="tab ${k==cur?'on':''}" data-t="${k}">${n}</button>`).join('')}</div>`:''}<div id="view"></div></div>`;
  $('#out').onclick=logout;
  $('#reset').onclick=()=>{if(confirm("Demo ma'lumotlari boshlang'ich holatga qaytarilsinmi?")){DB.reset();location.reload()}};
}
function table(head,rows,empty='Hozircha bo\'sh'){
  return rows.length?`<div class="tw"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p class="muted">${empty}</p>`;
}
function renderQR(el,text){const q=qrcode(0,'M');q.addData(text);q.make();el.innerHTML=q.createSvgTag({cellSize:4,margin:0,scalable:true})}

/* ---- kun almashganda: eski ochiq darslar yopiladi, bugungi jadval qo'shiladi */
function ensureToday(d){
  if(d.todayKey===dayKey(Date.now()))return;
  d.lessons.forEach(l=>{if(!l.closed&&dayStart(l.starts)<dayStart(Date.now())){l.closed=true;l.open=false}});
  const today=dayStart(Date.now());
  planFor(new Date().getDay()).forEach(p=>{
    const t=d.users.find(u=>u.login===p.tch),sj=d.subjects.find(x=>x.key===p.sub),rm=d.rooms.find(x=>x.name===p.room);
    if(t&&sj&&rm)d.lessons.push({id:DB.id(d,'lesson'),subject_id:sj.id,group_id:p.groups[0],group_ids:p.groups,room_id:rm.id,teacher_id:t.id,pair:p.slot,kind:p.kind,starts:lessonTime(today,p.slot),open:false,closed:false,secret:'n'+Math.random().toString(36).slice(2)});
  });
  d.todayKey=dayKey(Date.now());localStorage.setItem(KEY,JSON.stringify(d));
}
const KIND_UZ={lec:"ma'ruza",prac:'amaliyot'};
const lessonGroups=l=>l.group_ids||[l.group_id];
const groupCodes=(d,l)=>lessonGroups(l).map(g=>by(d.groups,g)?.code).join(', ');
const lessonName=(d,l)=>(by(d.subjects,l.subject_id)?.name||'Dars')+(l.kind?' ('+KIND_UZ[l.kind]+')':'');
const isToday=l=>dayKey(l.starts)===dayKey(Date.now());
/* haftalik jadval (guruh bo'yicha). Ma'ruzada boshqa guruhlar ham ko'rsatiladi */
function ttGrid(d,gid){
  const cell={};
  for(let day=1;day<=6;day++)planFor(day).filter(p=>p.groups.includes(+gid)).forEach(p=>{cell[(day-1)+'_'+p.slot]=p});
  const rows=[];for(let s=1;s<=8;s++){if(![0,1,2,3,4,5].some(dd=>cell[dd+'_'+s]))continue;
    rows.push([`<b>${s}</b><br><span class="muted sm">${SLOTS[s]}</span>`,...[0,1,2,3,4,5].map(dd=>{const c=cell[dd+'_'+s];if(!c)return '';
      const others=c.groups.length>1?`<br><span class="tag n">oqim: ${c.groups.map(g=>by(d.groups,g)?.code.replace('-26','')).join(' + ')}</span>`:'';
      return `<div class="slot"><b>${esc(SUBJECT_NAMES[c.sub])}</b> <span class="muted">${KIND_UZ[c.kind]}</span><br><span class="sm muted">${esc(d.users.find(u=>u.login===c.tch)?.name)} · ${esc(c.room)}</span>${others}</div>`})])}
  return table(['Juft.',...DAYS.slice(1,7)],rows);
}
