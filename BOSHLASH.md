# Attendly — noldan boshlash

Bu fayl noldan hammasini tushuntiradi. Boshqa kompyuterda ochsangiz ham
shu faylni o'qib ishga tushirasiz.

---

## 1. Bu nima

TTPU uchun davomat tizimi. Ishlash tartibi:

```
O'qituvchi ekranda QR ko'rsatadi  →  har 3 soniyada yangilanadi
        ↓
Talaba telefonida skanerlaydi
        ↓
GPS tekshiriladi                  →  auditoriyada emasmi?
        ↓
Face ID / yuz tekshiriladi        →  o'sha odammi?
        ↓
Davomat yoziladi, o'qituvchi ekranida ismi chiqadi
```

**Nega aldab bo'lmaydi:** QR kod 9–12 soniya yashaydi (do'stiga skrinshot
yuborib ulgurmaydi), GPS auditoriyadan tashqarini rad etadi, Face ID esa
boshqa odam kirishiga yo'l qo'ymaydi.

---

## 2. Nima kerak

| Narsa | Qayerdan |
|---|---|
| **Telegram bot tokeni** | [@BotFather](https://t.me/BotFather) → `/newbot` |
| **Telegram ID ingiz** | [@userinfobot](https://t.me/userinfobot) ga `/start` |
| Python 3.11+ | lokal sinash uchun |
| Railway hisobi *yoki* VPS | internetga chiqarish uchun |

> Bot tokeni — kalit. Uni hech kimga bermang va GitHubga yuklamang.
> `.env` fayli `.gitignore` da, shuning uchun git bilan ketmaydi.

---

## 3. Ichida nima bor

```
BOSHLASH.md        ← shu fayl
README.md          loyiha haqida to'liq
DEPLOY.md          Railway'ga qo'yish, qadamma-qadam
ARCHITECTURE.md    baza sxemasi, oqimlar, anti-cheat mantiqi

app/               sayt va API (FastAPI)
  main.py          kirish nuqtasi
  models.py        baza jadvallari
  security.py      QR imzolash, geofence  ← tizimning yuragi
  face_engine.py   yuz tanish
  passkeys.py      Face ID / Touch ID
  routers/         API endpointlari
  templates/       sahifalar
  static/          CSS va JS

bot/bot.py         Telegram boti (ro'yxatdan o'tish)
tests/             22 ta anti-cheat testi
docs/index.html    GitHub Pages uchun demo sahifa
seed_demo.py       demo ma'lumot (o'qituvchi, 12 talaba, 3 dars)
seed.py            bo'sh boshlash uchun
Dockerfile         Docker образ
docker-compose.yml VPS uchun (web + bot + postgres + HTTPS)
railway.json       Railway sozlamasi
```

---

## 4. A-yo'l — lokal sinash (5 daqiqa)

Internetsiz, botsiz, shunchaki ko'rish uchun.

```bash
cd attendly

python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
```

`.env` da shu uchtasini o'zgartiring:

```env
SECRET_KEY=istalgan-uzun-tasodifiy-satr
DATABASE_URL=sqlite+aiosqlite:///./dev.db
BASE_URL=http://localhost:8000
DEMO_MODE=true
```

```bash
python seed_demo.py
uvicorn app.main:app --reload
```

Brauzerda: **http://localhost:8000/demo**

Telegramsiz, parolsiz kirasiz. Qaysi hisob bilan kirish kerakligi va keyin
nima qilish — 7-bo'limda.

> Lokal rejimda **kamera va Face ID ishlamaydi** — ular HTTPS talab qiladi.
> Faqat ko'rib chiqish uchun.

---

## 5. B-yo'l — Railway (tavsiya)

Internetda ishlaydigan nusxa. HTTPS avtomatik, demak Face ID va kamera ham
ishlaydi.

To'liq ketma-ketlik: **[DEPLOY.md](DEPLOY.md)**

Qisqacha:

```bash
npm i -g @railway/cli
railway login
railway init --name attendly
railway add --database postgres
railway up
railway domain                    # chiqqan domenni eslang
```

Keyin o'zgaruvchilarni qo'yasiz (`BASE_URL`, `BOT_TOKEN`, …) va bot uchun
alohida xizmat ochasiz — start command: `python bot/bot.py`.

**Eng ko'p uchraydigan xato:** Railway `DATABASE_URL` ni `postgresql://`
ko'rinishida beradi, bizga `postgresql+asyncpg://` kerak. Aks holda sayt
502 beradi. DEPLOY.md da yozilgan.

---

## 6. C-yo'l — o'z VPS'ingiz (Docker)

```bash
cp .env.example .env
nano .env                  # BASE_URL=https://sizning-domen.uz
nano Caddyfile             # birinchi qatorga domeningizni yozing

docker compose up -d --build
docker compose exec web python seed_demo.py
```

Caddy HTTPS sertifikatni o'zi oladi. Domen DNS'i VPS IP siga qaratilgan
bo'lishi kerak.

---

## 7. Birinchi marta nima qilish

Sayt ishlagandan keyin:

### Demo rejimida ko'rish

1. `/demo` sahifasini oching
2. **Olimov Jahongir (O'qituvchi)** bilan kiring
3. Panel → **Yangi dars** → guruh, fan, auditoriya tanlang → tugma
4. QR ekrani ochiladi — kompyuterda ochiq qoldiring
5. Telefonda `/demo` ni oching → **📍 Xonani shu yerga qo'yish**
   (demo auditoriyani siz turgan joyga ko'chiradi, GPS tekshiruvi ishlayveradi)
6. Telefonda talaba tanlang → `/enroll` → **Passkey yaratish** (Face ID)
7. `/scan` → kompyuter ekranidagi QR ni oling
8. Ismingiz o'qituvchi ekranida chiqadi

### Haqiqiy foydalanishga o'tish

```env
DEMO_MODE=false
```

1. **Super admin:** `.env` da `SUPER_ADMIN_IDS` ga Telegram ID ingizni yozing,
   botga `/start` bosing — avtomatik super admin bo'lasiz
2. **Auditoriyalar:** har bir xona koordinatasini kiriting
   (Google Maps'da binoni bosib oling)
   ```bash
   curl -X POST https://domen/api/admin/rooms \
     -H 'Content-Type: application/json' -b 'attendly_session=...' \
     -d '{"name":"A-301","lat":41.2646,"lng":69.2163,"radius_m":120}'
   ```
3. **Guruhlar:** `POST /api/admin/groups` → `{"code":"CYB3-26"}`
4. **O'qituvchi/starosta:** Panel → «O'qituvchi / starosta qo'shish» →
   havola yarating → o'sha odamga yuboring
5. **Talabalar:** starosta guruh havolasini tarqatadi
6. Demo hisoblarni o'chiring: `DELETE FROM users WHERE is_demo = true;`

---

## 8. GitHubga qo'yish

Papkada `.git` bor, commitlar tayyor.

```bash
cd attendly
gh repo create attendly --private --source=. --push
```

`gh` bo'lmasa — github.com da bo'sh **private** repo `attendly` yarating
(README qo'shmang), keyin:

```bash
git remote add origin https://github.com/FOYDALANUVCHI/attendly.git
git push -u origin main
```

### GitHub Pages (demo sahifa)

Repo → Settings → Pages → Branch: `main`, papka: `/docs` → Save

`https://FOYDALANUVCHI.github.io/attendly/` — loyihani ko'rsatadigan sahifa.
QR aylanadi, aldash urinishlarini bosib sinash mumkin.

> Bu **butun tizim emas** — Pages statik fayl xosti, Python ishlatmaydi.
> Ishlaydigan nusxa uchun Railway yoki VPS kerak.

---

## 9. Sozlamalar (`.env`)

| Kalit | Default | Nima qiladi |
|---|---|---|
| `BOT_TOKEN` | — | BotFather tokeni |
| `BOT_USERNAME` | — | `@` siz, masalan `AttendlyBot` |
| `BASE_URL` | — | Saytning to'liq manzili, `https://` bilan |
| `SECRET_KEY` | — | Uzun tasodifiy satr. `openssl rand -hex 32` |
| `SUPER_ADMIN_IDS` | — | Telegram ID lar, vergul bilan |
| `DATABASE_URL` | sqlite | Produksiyada `postgresql+asyncpg://...` |
| `QR_ROTATE_SECONDS` | `3` | QR necha soniyada yangilanadi |
| `QR_ACCEPT_WINDOWS` | `4` | Necha oyna qabul qilinadi (3×4 = 12s) |
| `DEFAULT_GEOFENCE_RADIUS_M` | `120` | Auditoriya radiusi |
| `MAX_GPS_ACCURACY_M` | `100` | Bundan yomon aniqlik rad etiladi |
| `FACE_MATCH_THRESHOLD` | `0.38` | Kichikroq = qattiqroq |
| `DEMO_MODE` | `false` | `/demo` sahifasi (parolsiz kirish) |
| `DEMO_SKIP_GEOFENCE` | `false` | Test uchun GPS ni o'chirish |
| `DEMO_SKIP_BIOMETRY` | `false` | Test uchun Face ID ni o'chirish |

---

## 10. Muammolar

| Belgi | Sabab va yechim |
|---|---|
| Bot `/start` ga javob bermaydi | `bot/bot.py` ishlamayapti. Token o'zi yetarli emas — jarayon ishlab turishi kerak |
| Sayt 502 beradi | `DATABASE_URL` da `+asyncpg` yo'q |
| Kamera ochilmaydi | HTTPS emas. Lokal sinash uchun `ngrok http 8000` |
| Passkey yaratilmaydi | `BASE_URL` brauzerdagi domen bilan bir xil emas |
| «Saytga qaytish» tugmasi ishlamaydi | `BASE_URL` da `https://` yo'q yoki localhost |
| «Siz auditoriyadan uzoqdasiz» | Xona koordinatasi noto'g'ri. Demo rejimida `/demo` → «Xonani shu yerga qo'yish» |
| «Yuz tanish o'chiq» | InsightFace o'rnatilmagan — ixtiyoriy, passkey'siz ishlayveradi |
| GPS aniqligi past | Bino ichida normal. `MAX_GPS_ACCURACY_M` ni oshiring yoki radiusni kattalashtiring |

### Testlarni ishga tushirish

```bash
pytest tests/ -q
```

22 ta test: QR eskirishi, soxta imzo, geofence, masofa hisobi.
Kodni o'zgartirgandan keyin shuni ishlating.

---

## 11. Yuz tanishni yoqish (ixtiyoriy)

```bash
pip install insightface==0.7.3 onnxruntime==1.20.1 opencv-python-headless==4.10.0.84
```

Docker uchun `Dockerfile` dagi izohlangan qatorni oching.

Model ~300MB, birinchi ishga tushishda yuklanadi. Railway'ning bepul
tarifida xotira yetmasligi mumkin.

**Maxfiylik:** rasm saqlanmaydi — faqat 512 ta son (embedding). Undan
rasmni tiklab bo'lmaydi. Talabalarga shuni tushuntiring.

---

## 12. Nimalar hali yo'q

- Hisobotlar va grafiklar (kunlik/haftalik/oylik)
- Maxfiy Telegram kanalga avtomatik post
- Admin paneli UI (fan va xona qo'shish hozircha API orqali)
- Haftalik jadvalni bir marta kiritib, darslarni avtomatik yaratish
- PWA (telefonga ilova sifatida o'rnatish)
