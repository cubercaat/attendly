# Attendly — TTPU Attendance System

QR + GPS + biometrika asosidagi davomat tizimi.
O'qituvchi ekranda **har 3 soniyada yangilanadigan** QR ko'rsatadi; talaba uni
skanerlaydi, telefon joylashuvni va shaxsni tasdiqlaydi — shundan keyingina
davomat yoziladi.

**Demo sahifa:** https://cubercaat.github.io/attendly/ — QR aylanishini va
aldash urinishlarini brauzerda sinab ko'rasiz (statik, backend kerak emas).

Arxitektura va baza sxemasi: **[ARCHITECTURE.md](ARCHITECTURE.md)**

---

## 🧪 Test rejimi (eng tez yo'l)

Telegram botisiz, parolsiz butun tizimni bosib ko'rish:

```bash
cp .env.example .env
# .env da:
#   DEMO_MODE=true
#   DATABASE_URL=sqlite+aiosqlite:///./dev.db
#   BASE_URL=http://localhost:8000
#   SECRET_KEY=istalgan-uzun-satr

pip install -r requirements.txt
python seed_demo.py            # o'qituvchi, starosta, 12 talaba, 3 dars
uvicorn app.main:app --reload
```

Keyin **http://localhost:8000/demo** ni oching — ro'yxatdan hisob tanlab kiring.

**Muhim:** test rejimida ham **GPS va biometrika tekshiriladi** — ya'ni
haqiqiy sharoitni sinaysiz. Shuning uchun `/demo` sahifasida
**«📍 Xonani shu yerga qo'yish»** tugmasi bor: demo auditoriyani o'zingiz
turgan nuqtaga ko'chiradi, geofence ishlayveradi, lekin siz o'tasiz.

Demo kirish faqat `is_demo=True` hisoblarga ishlaydi — haqiqiy talaba
hisobiga `/demo` orqali kirib bo'lmaydi (403).

Noutbukda kamera/GPS siz shunchaki bosib ko'rmoqchi bo'lsangiz:

```env
DEMO_SKIP_GEOFENCE=true
DEMO_SKIP_BIOMETRY=true
```

> ⚠️ Produksiyada `DEMO_MODE=false`. Yoqilgan bo'lsa har sahifada sariq
> «TEST REJIMI» tasmasi turadi va server loglarida ogohlantirish chiqadi.

### Telefonda sinash

Passkey va kamera HTTPS talab qiladi. Eng oson:

```bash
ngrok http 8000
# .env → BASE_URL=https://xxxx.ngrok-free.app  → serverni qayta ishga tushiring
```

Kompyuterda o'qituvchi bilan kirib QR ekranini oching, telefonda talaba
bilan kirib shu QR ni skanerlang.

---

## Ishga tushirish (haqiqiy rejim)

```bash
cp .env.example .env
# .env: BOT_TOKEN, BOT_USERNAME, SUPER_ADMIN_IDS ni to'ldiring
# sinov uchun: DATABASE_URL=sqlite+aiosqlite:///./dev.db
#              BASE_URL=http://localhost:8000

python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

python seed.py                 # CYB1-26 … CYB4-26, xonalar, fanlar, namuna dars
uvicorn app.main:app --reload  # sayt
python bot/bot.py              # alohida terminalda — bot
```

`seed.py` taklif havolalarini chiqaradi. Birinchi bo'lib `SUPER_ADMIN_IDS`
dagi Telegram ID bilan `/start` bosgan odam avtomatik **super_admin** bo'ladi.

> ⚠️ Kamera, GPS va passkey faqat **HTTPS** da (yoki `localhost` da) ishlaydi.
> Telefondan sinash uchun `ngrok http 8000` qilib `BASE_URL` ni o'zgartiring.

## Produksiya (Docker)

```bash
cp .env.example .env     # BASE_URL=https://sizning-domen.uz
nano Caddyfile           # domeningizni yozing
docker compose up -d --build
docker compose exec web python seed.py
```

Caddy HTTPS sertifikatni avtomatik oladi.

---

## 🛡 Aldashga qarshi 6 qatlam

| # | Qatlam | Qaysi hiylani yopadi |
|---|---|---|
| 1 | **Aylanuvchi QR** — har 3s yangi HMAC token, TTL ≤ 12s | Do'stiga skrinshot yuborish |
| 2 | **GPS geofence** — xona koordinatasidan R metr, aniqlik ≤ 100m | Uydan turib belgilash |
| 3 | **Passkey (WebAuthn)** — qurilmaga bog'langan Face ID / Touch ID | Akkauntni birovga berish |
| 4 | **Yuz tanish + liveness** — challenge (markaz → chap/o'ng) | Telefon yo'q → do'stining telefonidan **o'z yuzi** bilan kiradi; do'stining yuzi o'tmaydi; rasm ko'rsatish o'tmaydi |
| 5 | **Qurilma barmoq izi** — bitta qurilma 2 talabani belgilasa flag | Bitta telefondan 5 kishi |
| 6 | **O'qituvchi nazorati** — jonli ro'yxat + bir bosishda bekor + audit log | Qolgani |

### Nega 3 soniya yetarli

Token `window = unix_time // 3` bo'yicha hisoblanadi, server oxirgi **4 oyna**ni
qabul qiladi. Ya'ni kodning amal qilish muddati **9–12 soniya** — skanerlash va
tarmoq uchun bemalol, lekin skrinshotni do'stiga yuborib ulgurish uchun yo'q.
Ulgurgan taqdirda ham GPS va yuz/passkey to'sadi.

Tekshirilgan (22 ta test):

```bash
pytest tests/ -q
```

---

## Telefon yo'qolsa / do'stining telefonidan

Aynan siz so'ragan holat:

1. Talaba do'stining telefonida saytni ochadi.
2. Telegram orqali kiradi (bot bir martalik havola beradi).
3. Passkey yo'q (bu boshqa qurilma) → tizim **yuz tekshiruviga** o'tadi.
4. Server tasodifiy ketma-ketlik beradi: *to'g'ri qarang → chapga buring*.
5. Yuz o'ziniki bo'lsa — QR ni skanerlab davomatini belgilaydi.

Do'sti o'rniga o'tolmaydi: uning yuzi bazadagi shablonga mos kelmaydi.
Rasm ko'rsatsa — kadrlar bir xil chiqadi va liveness yiqiladi.

---

## Rollar

| Rol | Nima qiladi |
|---|---|
| `super_admin` | Hammasi: guruh, xona, o'qituvchi, starosta |
| `teacher` | Dars ochadi, QR ko'rsatadi, jonli ro'yxatni ko'radi, bekor qiladi |
| `starosta` | O'z guruhi: taklif havolasi, ro'yxat, hisobot |
| `student` | Skanerlaydi, davomatini ko'radi |

Guruh kodi: `CYB1-26`, `CYB2-26`, `CYB3-26`, `CYB4-26`

### O'qituvchi va starostani qo'shish

Panel → **«O'qituvchi / starosta qo'shish»** → rol va (starosta uchun) guruhni
tanlang → **Havola yaratish**.

Havola `https://t.me/AttendlyBot?start=t_<token>` ko'rinishida chiqadi. Odam uni
Telegramda ochadi, ism-familiya va telefon raqamini kiritadi — darhol kerakli
rolni oladi va saytga kirish havolasini oladi. **Havola bir marta ishlaydi** va
muddati bor (default 7 kun).

API: `POST /api/admin/invites {role, group_id?, note?, days}`

Rolni qo'lda o'zgartirish ham mumkin:
`POST /api/admin/users/{id}/role?role=starosta`

### Dars yaratish

O'qituvchi panelida **«Yangi dars»** → guruh, fan, auditoriya, para → tugma.
Dars yaratiladi, davomat darhol ochiladi va QR ekraniga o'tasiz.

> Auditoriya tanlanmasa GPS tekshiruvi o'tkazilmaydi — xona koordinatasi
> bo'lmasa geofence ishlamaydi. Avval admin xona qo'shsin.

---

## Sahifalar

| Yo'l | Kim | Nima |
|---|---|---|
| `/join/{invite}` | ochiq | Guruhga qo'shilish — Telegram tugmasi |
| `/auth/{token}` | ochiq | Botdan qaytish (bir martalik, 10 daqiqa) |
| `/enroll` | talaba | Passkey + yuz biriktirish |
| `/scan` | talaba | QR skaner → GPS → tasdiq |
| `/s/{token}` | talaba | Telefonning **oddiy kamera ilovasi** QR ni ochsa shu yerga tushadi |
| `/me` | talaba | Mening davomatim |
| `/teacher/lesson/{id}/qr` | o'qituvchi | To'liq ekran QR + jonli ro'yxat (SSE) |
| `/dashboard` | xodim | Bugungi darslar, guruhlar, taklif havolalari |
| `/api/docs` | — | OpenAPI |

---

## Yuz tanishni yoqish

Ixtiyoriy — o'rnatilmasa tizim faqat passkey bilan ishlaydi (`/healthz` da ko'rinadi).

```bash
pip install insightface==0.7.3 onnxruntime==1.20.1 opencv-python-headless==4.10.0.84
```

Docker uchun `Dockerfile` dagi tegishli qatorni oching. Model (~300MB) birinchi
ishga tushganda yuklanadi va `models` volume'ida saqlanadi.

**Maxfiylik:** rasm saqlanmaydi. Faqat 512 ta son (embedding) yoziladi — undan
rasmni tiklab bo'lmaydi. Talabalarga shuni tushuntiring.

Sozlash: `.env` → `FACE_MATCH_THRESHOLD` (kichikroq = qattiqroq, default `0.38`).

---

## Xona koordinatalarini kiritish

Geofence shunga tayanadi. Google Maps'da auditoriya binosini bosib
koordinatani oling, keyin:

```bash
curl -X POST https://sizning-domen.uz/api/admin/rooms \
  -H 'Content-Type: application/json' -b 'attendly_session=...' \
  -d '{"name":"A-301","building":"Asosiy","lat":41.2646,"lng":69.2163,"radius_m":120}'
```

`seed.py` dagi `TTPU_LAT/TTPU_LNG` ni ham o'z binongizga moslang.
Radiusni juda kichik qilmang — telefon GPS si binoda 30–80 m xato beradi.

---

## Tuzilma

```
app/
  main.py          FastAPI kirish nuqtasi
  config.py        .env sozlamalari
  models.py        SQLAlchemy jadvallar
  db.py            async sessiya
  security.py      QR imzo/rotatsiya, geofence, cookie, attempt token
  passkeys.py      WebAuthn o'rami
  face_engine.py   InsightFace + liveness (ixtiyoriy)
  deps.py          auth dependency'lar
  routers/
    pages.py       HTML sahifalar
    auth.py        bot → sayt ko'prigi
    enroll.py      passkey + yuz biriktirish
    attend.py      begin → passkey/face → davomat
    teacher.py     dars, QR (SVG), jonli ro'yxat, bekor qilish
    admin.py       guruh, xona, fan, rol
  templates/       Jinja2
  static/          CSS + JS (tashqi kutubxonaga bog'liq emas)
bot/bot.py         Telegram ro'yxat boti (shu bazaga ulanadi)
tests/             anti-cheat testlari
seed.py            demo ma'lumot
```

QR **serverda** SVG qilib chiziladi (`segno`) — sayt CDN ga bog'liq emas,
universitet tarmog'i tashqi saytlarni bloklasa ham ishlaydi.

---

## Keyingi bosqich

- [ ] Hisobotlar + grafiklar (mavjud davomat botidagi kod qayta ishlatiladi)
- [ ] Maxfiy Telegram kanalga kunlik/haftalik/oylik post
- [ ] Admin paneli UI (hozircha API)
- [ ] PWA — "ilovaga o'xshash", offline ekran
- [ ] Dars jadvalini bir marta kiritib, darslarni avtomatik yaratish


---

## GitHub Pages (demo sahifa)

`docs/index.html` — loyihaning statik ko'rgazmasi: aylanuvchi QR, aldash
simulyatori, olti qatlam. Backend talab qilmaydi.

Yoqish: repo → **Settings → Pages** → Source: `Deploy from a branch` →
Branch: `main`, papka: `/docs` → Save.

Bir-ikki daqiqadan keyin: `https://cubercaat.github.io/attendly/`

> Haqiqiy tizim (FastAPI + PostgreSQL) GitHub Pages da ishlamaydi — Pages
> faqat statik fayl tarqatadi. Ishlaydigan nusxa uchun VPS yoki Render/Railway
> kerak; `docker-compose.yml` tayyor.
