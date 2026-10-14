/* Demo ma'lumot: TTPU jadvali (CYB3-26), xonalar, o'qituvchilar va talabalar.
   Boshqa guruhlar (CYB1/2/4-26) ismlari tasodifiy generatsiya qilingan. */
const SLOTS = { 1: '9:00–10:20', 2: '10:30–11:50', 3: '12:00–13:20', 4: '14:20–15:40', 5: '15:50–17:10', 6: '17:20–18:40', 7: '18:50–20:10', 8: '20:20–21:40' };
const SLOT_START = { 1: [9, 0], 2: [10, 30], 3: [12, 0], 4: [14, 20], 5: [15, 50], 6: [17, 20], 7: [18, 50], 8: [20, 20] };
const DAYS = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];

const ROOM_NAMES = ['101 Chem LAB', '105', '107', '201', '203', '204', '205', '206', '207', '301', '303', '304', '305', '306', '307',
  '303AB', '302AB', '402AB', '403AB', '404AB', '305AB Phy LAB', 'LAB 401', 'LAB 403', 'LAB 404', 'LAB 405', 'LAB 406', 'LAB 407',
  'Library', 'Library 2nd FL', 'Conference Hall', 'BLUE HALL', 'Grey Hall', 'Green Hall', 'Prerecorded'];

const SUBJECT_NAMES = { MATH: 'Matematika 1', ENG: 'Ingliz tili 1', PHY: 'Fizika 1', PROG: 'Dasturlash', PHS: 'PHS', NHU: 'NHU' };
const TEACHERS = [
  ['eshkobilova', 'M. Eshkobilova'], ['nazarova', 'L. Nazarova'], ['khajiev', 'I. Khajiev'], ['makhkamov', 'F. Makhkamov'],
  ['yarbekov', 'A. Yarbekov'], ['khamidulla', 'Kh. Khamidulla'], ['mahamatov', 'N. Mahamatov'], ['rakhimova', 'G. Rakhimova']];

/* CYB3-26 haftalik jadval: [kun(1=Du..6=Sha), juftlik, fan, tur, o'qituvchi, xona] */
const TT = [
  [1, 2, 'MATH', 'prac', 'eshkobilova', '305'], [1, 3, 'ENG', 'prac', 'nazarova', '304'],
  [2, 1, 'MATH', 'lec', 'khajiev', 'Grey Hall'], [2, 2, 'PHY', 'prac', 'makhkamov', '304'],
  [3, 3, 'PHY', 'lec', 'yarbekov', 'BLUE HALL'],
  [4, 1, 'PROG', 'prac', 'khamidulla', 'LAB 403'], [4, 2, 'PROG', 'lec', 'mahamatov', 'Green Hall'],
  [4, 3, 'PHS', 'prac', 'rakhimova', 'Grey Hall'], [4, 4, 'NHU', 'prac', 'rakhimova', 'Grey Hall'],
  [5, 1, 'MATH', 'prac', 'eshkobilova', '307'], [5, 2, 'PROG', 'prac', 'khamidulla', 'LAB 403'], [5, 3, 'PROG', 'prac', 'mahamatov', 'Grey Hall'],
  [6, 2, 'ENG', 'prac', 'nazarova', '304'], [6, 7, 'NHU', 'lec', 'rakhimova', 'Prerecorded'], [6, 8, 'PHS', 'lec', 'rakhimova', 'Prerecorded']];

const CYB3_NAMES = ["Akbarxo'jayev Saidxo'ja", "Bekbo'tayev Ibrohim", 'Bakhromov Shakhzod', 'Baxtiyorov Abduqodir', 'Nigmatov Abdurahim',
  'Muhammadjonov Sultonbek', 'Shoniyozov Behruz', 'Mirzaev Muzaffar', "Mo'minjonov Aliakbar", 'Yunusov Raxim', 'Fazliddin Sidikov',
  'Mamatqulov Zafar', 'Mirrahimov Shaxzod', "Toychiev Shaxzod", 'Ruzikulov Radmir', 'Saidazim Saidganiev', "Ulug'bek Umarov",
  'Khabibullayev Asadulla', 'Allamurodov Behruz', "Usmonxo'jayev Habibulloh", "G'ofurjonov Muhammad Yusuf", 'Polatboyev Ibrohimboy',
  "Do'stbekova Muslima", 'Kozimiy Abdulaziz', "Mirshokirov Ulug'bek", 'Nazarov Iso', "Zabixullayev Said'azam", 'Alimjanov Xondamir',
  'Firdavs Nurmatov', 'Abdumajitov Shohjahon', 'Erkinov Asilbek', "Subhonov Maqsud", 'Vohidov Biloliddin'];

const FIRST_M = ['Sardor', 'Jasur', 'Bekzod', 'Otabek', 'Rustam', 'Aziz', 'Dilshod', 'Sherzod', 'Javohir', 'Eldor', 'Timur', 'Umid', 'Bobur', 'Farruh', 'Nodir', 'Anvar', 'Shahzod', 'Doniyor'];
const FIRST_F = ['Malika', 'Nilufar', 'Sevinch', 'Zilola', 'Dilnoza', 'Madina', 'Gulnora', 'Shahnoza', 'Kamola', 'Feruza', 'Laylo', 'Mohira', 'Nargiza', 'Aziza'];
const LAST = ['Karimov', 'Toshmatov', 'Rahimov', 'Sobirov', 'Ergashev', 'Qodirov', 'Xolmatov', 'Sattorov', 'Yusupov', 'Umarov', 'Hasanov', 'Ismoilov', 'Normatov', 'Tursunov', 'Abdullayev', 'Ruziyev', 'Saidov', 'Mirzayev', 'Juraev', 'Nurmatov', 'Aliyev', 'Botirov', 'Davronov', 'Egamberdiyev'];

const SHIFT = [1, 2, 0, 3];   // amaliyot: CYB3-26 asl jadval, qolganlari siljitilgan
/* Ma'ruza oqimlari: bitta xona, bitta QR, bir nechta guruh (guruh id lari) */
const LEC_GROUPS = { MATH: [1, 2, 3, 4], PHY: [1, 2, 3], PROG: [2, 3, 4], NHU: [1, 2, 3, 4], PHS: [1, 2, 3, 4] };
function planFor(day) {
  const out = [];
  TT.forEach(([dd, s0, sub, kind, tch, room]) => {
    if (dd !== day) return;
    if (kind === 'lec') return out.push({ groups: LEC_GROUPS[sub], sub, kind, tch, room, slot: s0 });
    [1, 2, 3, 4].forEach((gid, gi) => {
      const rn = gid == 3 ? room : ROOM_NAMES[(ROOM_NAMES.indexOf(room) + gi * 3) % 33];
      out.push({ groups: [gid], sub, kind, tch, room: rn, slot: ((s0 - 1 + SHIFT[gi]) % 6) + 1 });
    });
  });
  return out;
}   // CYB3-26 asl jadval, qolganlari siljitilgan
function prng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function genNames(n, seed) {
  const r = prng(seed), out = new Set();
  while (out.size < n) {
    const f = r() < .6, first = (f ? FIRST_F : FIRST_M)[Math.floor(r() * (f ? FIRST_F : FIRST_M).length)];
    let last = LAST[Math.floor(r() * LAST.length)]; if (f) last = last.replace(/ov$/, 'ova').replace(/ev$/, 'eva');
    out.add(last + ' ' + first);
  }
  return [...out];
}

function dayStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function lessonTime(dayMs, slot) { const d = new Date(dayMs); d.setHours(SLOT_START[slot][0], SLOT_START[slot][1], 0, 0); return d.getTime(); }
const dayKey = t => new Date(t).toDateString();

function seed() {
  const r = prng(20261014);
  const users = [{ id: 1, login: 'admin', pass: 'admin123', name: 'Super Admin', role: 'super_admin' },
    { id: 2, login: 'teacher', pass: 'teacher123', name: "Demo o'qituvchi (barcha darslar)", role: 'teacher', all: true }];
  TEACHERS.forEach(([l, n], i) => users.push({ id: 3 + i, login: l, pass: 'teacher123', name: n, role: 'teacher' }));
  const teacherId = l => users.find(u => u.login === l).id;

  const groups = ['CYB1-26', 'CYB2-26', 'CYB3-26', 'CYB4-26'].map((c, i) => ({ id: i + 1, code: c, year: 2026, invite: 'inv' + (i + 1) + 'x' }));
  const rooms = ROOM_NAMES.map((n, i) => ({ id: i + 1, name: n, building: n == 'Prerecorded' ? 'Onlayn' : /LAB|Chem/.test(n) ? 'Laboratoriya' : /Hall|Library/.test(n) ? 'Zallar' : 'Asosiy bino', radius: 120, geo: n == 'BLUE HALL' ? { required: true, corners: [{ lat: 41.26478, lng: 69.21612 }, { lat: 41.26478, lng: 69.21648 }, { lat: 41.26442, lng: 69.21648 }, { lat: 41.26442, lng: 69.21612 }] } : { required: false, corners: [] } }));
  const roomId = n => rooms.find(x => x.name === n).id;
  const subjects = Object.keys(SUBJECT_NAMES).map((k, i) => ({ id: i + 1, key: k, name: SUBJECT_NAMES[k] }));
  const subjId = k => subjects.find(s => s.key === k).id;

  // starosta + talabalar (CYB3: haqiqiy ro'yxat; qolganlar: 20 tadan tasodifiy)
  users.push({ id: 20, login: 'starosta', pass: 'starosta123', name: 'Karimov Aziz (starosta)', role: 'starosta', group_id: 3 });
  let uid = 30; const students = {};
  groups.forEach(g => {
    const names = g.id == 3 ? CYB3_NAMES : genNames(20, 100 + g.id);
    students[g.id] = names.map(n => { const u = { id: uid++, login: '', pass: '', name: n, role: 'student', group_id: g.id, enrolled: true, rate: [0, .06, .12, .3, .5, .65, .8, .9, .95][Math.floor(r() * 9)] }; users.push(u); return u; });
  });
  const me = students[3].find(u => u.name == 'Mamatqulov Zafar'); me.login = 'student'; me.pass = 'student123'; me.rate = .9;
  Object.values(students).flat().forEach((u, i) => { if (u.id % 7 == 3 && u.login !== 'student') u.enrolled = false; if (!u.login) { u.login = 's' + u.id; u.pass = 'pass' + u.id; } });

  // darslar: joriy hafta + 2 hafta tarix. Ma'ruza = oqim (3-4 guruh bitta xonada, bitta dars)
  const today = dayStart(Date.now()), dow = (new Date().getDay() + 6) % 7;       // 0=Du
  const monday = today - dow * 864e5;
  const lessons = [], att = []; let lid = 1;
  for (let w = -2; w <= 0; w++) for (let day = 1; day <= 6; day++) {
    const dayMs = monday + w * 7 * 864e5 + (day - 1) * 864e5;
    if (dayMs > today) continue;
    planFor(day).forEach(p => {
      const closed = dayMs != today;
      const l = { id: lid++, subject_id: subjId(p.sub), group_id: p.groups[0], group_ids: p.groups, room_id: roomId(p.room), teacher_id: teacherId(p.tch),
        pair: p.slot, kind: p.kind, starts: lessonTime(dayMs, p.slot), open: false, closed, secret: 's' + lid + Math.floor(r() * 1e9).toString(36) };
      lessons.push(l);
      if (closed) p.groups.forEach(gid => students[gid].forEach(u => { const x = r(), st = x < u.rate ? 'present' : (x < u.rate + .05 ? 'late' : 'absent');
        att.push({ lesson_id: l.id, user_id: u.id, status: st, method: st == 'absent' ? '-' : (r() < .7 ? 'passkey' : 'face'), distance: st == 'absent' ? null : 20 + Math.floor(r() * 70), flagged: false, at: l.starts }); }));
    });
  }
  return { v: 3, users, groups, rooms, subjects, lessons, attendance: att, audit: [], invites: [], todayKey: dayKey(Date.now()),
    nid: { user: uid + 10, group: 10, room: rooms.length + 10, subject: 20, lesson: lid + 10, invite: 1 } };
}
