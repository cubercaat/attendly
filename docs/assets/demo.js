/* Attendly demo — barcha ma'lumot brauzerda (localStorage). Backend kerak emas. */
const KEY='attendly_demo_v1', SESS='attendly_demo_sess';
const STEP=3, WINDOWS=4;           // QR har 3s, 4 oyna = 12s
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE=location.pathname.replace(/\/(admin|teacher|student)\/.*$/,'/').replace(/[^/]*$/,'');

function seed(){
  const names=['Mamatqulov Zafar','Karimov Aziz','Yusupova Malika','Toshmatov Bekzod','Rahimova Nilufar','Sobirov Jasur','Ergashev Otabek','Qodirova Sevinch','Nazarov Sardor','Umarova Zilola','Xolmatov Rustam','Sattorova Dilnoza'];
  const users=[{id:1,login:'admin',pass:'admin123',name:'Super Admin',role:'super_admin'},
    {id:2,login:'teacher',pass:'teacher123',name:"Olimov Jahongir",role:'teacher'},
    {id:3,login:'starosta',pass:'starosta123',name:'Karimov Aziz (starosta)',role:'starosta',group_id:3}];
  names.forEach((n,i)=>users.push({id:10+i,login:i==1?'student':'student'+(i+1),pass:i==1?'student123':'pass'+(i+1),name:n,role:'student',group_id:3,enrolled:true}));
  const D=864e5, now=Date.now(), lessons=[], att=[];
  const subj=[1,2,3,4,5,6];
  [1,2,3].forEach(p=>lessons.push({id:p,subject_id:subj[p-1],group_id:3,room_id:p,teacher_id:2,pair:p,starts:now,open:false,closed:false,secret:'s'+p+Math.random().toString(36).slice(2)}));
  let id=4;
  for(let d=1;d<=8;d++)for(let p=1;p<=2;p++){const l={id:id++,subject_id:subj[(d+p)%6],group_id:3,room_id:p,teacher_id:2,pair:p,starts:now-d*D,open:false,closed:true,secret:'x'+id};lessons.push(l);
    users.filter(u=>u.role=='student').forEach((u,i)=>{const r=(i*7+d*3+p)%10;att.push({lesson_id:l.id,user_id:u.id,status:r<8?'present':(r==8?'absent':'late'),method:r<4?'passkey':'face',distance:30+r*5,flagged:false,at:l.starts})})}
  return {v:1,users,
    groups:['CYB1-26','CYB2-26','CYB3-26','CYB4-26'].map((c,i)=>({id:i+1,code:c,year:2026,invite:'inv'+(i+1)+'x'})),
    rooms:[{id:1,name:'A-301',building:'A blok',radius:120},{id:2,name:'A-302',building:'A blok',radius:120},{id:3,name:'B-105',building:'B blok',radius:150}],
    subjects:['Kiberxavfsizlik asoslari','Matematik analiz','Dasturlash','Tarmoqlar','Ingliz tili','Kriptografiya'].map((n,i)=>({id:i+1,name:n})),
    lessons,attendance:att,audit:[],invites:[],nid:{user:100,group:10,room:10,subject:10,lesson:id+10,invite:1}};
}
const DB={
  get(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.v==1)return d}catch(e){}const d=seed();localStorage.setItem(KEY,JSON.stringify(d));return d},
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
