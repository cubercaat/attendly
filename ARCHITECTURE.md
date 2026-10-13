# Attendly — TTPU Attendance System

QR + GPS + biometrika asosidagi davomat tizimi. O'qituvchi ekranda **har 3 soniyada
yangilanadigan QR** ko'rsatadi, talaba uni skanerlaydi, telefon joylashuvni va
shaxsni (passkey yoki yuz) tasdiqlaydi — shundan keyingina davomat yoziladi.

---

## 1. Rollar

| Rol | Kim | Nima qiladi |
|---|---|---|
| `super_admin` | Zafar | Fakultet, guruh, o'qituvchi, starosta yaratadi. Hamma narsani ko'radi |
| `teacher` | O'qituvchi | Dars ochadi, QR ko'rsatadi, jonli ro'yxatni ko'radi, shubhalini bekor qiladi. Starosta tayinlaydi |
| `starosta` | Guruh sardori | O'z guruhi talabalarini boshqaradi, taklif linkini tarqatadi, hisobot ko'radi |
| `student` | Talaba | QR skanerlaydi, davomatini ko'radi |

Guruh kodi formati: `CYB1-26`, `CYB2-26`, `CYB3-26`, `CYB4-26`
→ `<YO'NALISH><OQIM>-<YIL>`

---

## 2. Ro'yxatdan o'tish oqimi (talaba)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Starosta guruh taklif linkini tarqatadi                      │
│    https://attendly.uz/join/CYB3-26-a7f3k9                      │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Sayt: "CYB3-26 guruhiga qo'shilish"                          │
│    [ Telegram orqali ro'yxatdan o'tish ]                        │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. BOT  t.me/AttendlyBot?start=g_a7f3k9                         │
│    • Ism-familiyangizni yozing                                  │
│    • [📱 Telefon raqamni yuborish]  ← request_contact tugmasi    │
│      (raqam Telegram akkauntidan keladi — qo'lda yozib bo'lmaydi)│
│    • [🌐 Saytga qaytish]  ← bir martalik login link (10 daqiqa)  │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Sayt — SHAXSNI BIRIKTIRISH (bir marta)                       │
│    a) Passkey:  [Face ID / Touch ID bilan himoyalash]           │
│       → telefonning o'z biometrikasi, WebAuthn                  │
│    b) Yuz zaxirasi: 3 ta kadr + liveness                        │
│       → telefon yo'qolsa boshqa qurilmadan kirish uchun         │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
                    ✅ Talaba tayyor
```

Telefon raqam **faqat** Telegram `request_contact` orqali olinadi — qo'lda yozilgan
raqam qabul qilinmaydi, ya'ni soxta raqam kiritib bo'lmaydi.

---

## 3. Davomat oqimi

```
O'QITUVCHI                          TALABA                        SERVER
────────────                        ──────                        ──────
Darsni ochadi  ──────────────────────────────────────────────────▶ lesson_session
                                                                   secret yaratiladi
Ekranda QR
(har 3 soniyada yangi) ◀──────────────────────────────────────────  token
                                                                   window=now//3
                                    QR ni skanerlaydi
                                    ────────────────────────────▶   token tekshir
                                                                   (≤ 4 oyna = 12s)
                                    GPS so'raladi
                                    lat/lng/accuracy ──────────▶    geofence tekshir
                                                                   (xona koordinatasi)
                                    Passkey yoki Yuz
                                    ───────────────────────────▶    WebAuthn assert
                                                                   yoki yuz + liveness
Ekranda ismi                                                       ✅ attendance
chiqadi (SSE) ◀────────────────────────────────────────────────────  yoziladi
[🚫 Bekor qilish]
```

---

## 4. Aldashga qarshi 6 qatlam

| # | Qatlam | Qaysi hiylani yopadi |
|---|---|---|
| 1 | **Aylanuvchi QR** — har 3s yangi token, HMAC imzolangan, TTL 12s | Do'sti QR skrinshotini yuboradi → kod o'lgan |
| 2 | **GPS geofence** — xona/bino koordinatasidan R metr ichida, aniqlik ≤ 100m | Uydan turib skanerlash |
| 3 | **Passkey (WebAuthn)** — qurilmaga bog'langan, phishing-proof | Boshqa odam akkauntga kirishi |
| 4 | **Yuz tanish + liveness** — zaxira yo'l, challenge (ko'z qisish / bosh burish) | Telefon yo'q → do'stining telefonidan O'Z yuzi bilan kiradi. Do'stining yuzi o'tmaydi |
| 5 | **Qurilma barmoq izi** — bitta qurilma 2 talabani belgilasa → flag | Bitta telefondan 5 kishini belgilash |
| 6 | **O'qituvchi nazorati** — jonli ro'yxat, bir bosishda bekor qilish + audit log | Qolgan hamma narsa |

Har bir urinish (muvaffaqiyatli yoki yo'q) `audit_log` ga yoziladi: sabab, IP,
qurilma, masofa, token oynasi.

### Nega 3 soniya?

Token `window = floor(unix_time / 3)` bo'yicha hisoblanadi va server oxirgi **4 ta
oyna**ni qabul qiladi (≈12 soniya) — skanerlash va tarmoq kechikishi uchun. Do'stiga
skrinshot yuborib ulgurguncha token o'ladi. Agar 12 soniyada ulgursa ham — GPS va
yuz/passkey to'sadi.

---

## 5. Baza sxemasi (PostgreSQL)

```
faculties        id, name, code
groups           id, code (CYB3-26), faculty_id, year, invite_token, starosta_id
rooms            id, name, building, lat, lng, radius_m
subjects         id, name, code

users            id, full_name, phone, telegram_id, username, role,
                 group_id, is_active, created_at
                 ├─ role: super_admin | teacher | starosta | student
                 └─ telegram_id UNIQUE, phone UNIQUE

credentials      id, user_id, credential_id, public_key, sign_count,
                 device_label, created_at, last_used_at        ← passkey
face_templates   id, user_id, embedding (bytea 512f), quality,
                 created_at, is_active                          ← yuz izi

teacher_groups   teacher_id, group_id                           ← kim qaysi guruhga kiradi

lessons          id, group_id, subject_id, teacher_id, room_id,
                 starts_at, ends_at, status (planned|open|closed)
lesson_sessions  id, lesson_id, secret, opened_at, closes_at,
                 geofence_radius, is_open                       ← QR sessiyasi

attendance       id, lesson_id, user_id, status, method,
                 marked_at, lat, lng, distance_m, accuracy_m,
                 device_hash, ip, flagged, flag_reason,
                 reviewed_by, reviewed_at
                 ├─ status: present | late | excused | absent | rejected
                 ├─ method: passkey | face | manual
                 └─ UNIQUE(lesson_id, user_id)

login_tokens     token, user_id, expires_at, used_at            ← bot → sayt ko'prigi
audit_log        id, user_id, lesson_id, action, ok, reason,
                 ip, device_hash, meta (jsonb), created_at
```

---

## 6. Sahifalar

| Yo'l | Kim | Nima |
|---|---|---|
| `/join/{invite}` | ochiq | Guruhga qo'shilish — Telegram tugmasi |
| `/auth/{token}` | ochiq | Botdan qaytish, sessiya o'rnatiladi |
| `/enroll` | student | Passkey + yuz biriktirish |
| `/scan` | student | Kamera, QR skaner, GPS, tasdiq |
| `/me` | student | Mening davomatim |
| `/teacher/lesson/{id}/qr` | teacher | To'liq ekran aylanuvchi QR + jonli ro'yxat |
| `/dashboard` | teacher/starosta/admin | Darslar, guruhlar, hisobotlar |
| `/admin/*` | super_admin | Fakultet, guruh, o'qituvchi, xona CRUD |

Dizayn: oq fon, bitta urg'u rangi (`#2a78d6`), tizim shrifti, animatsiya minimal —
faqat holat o'zgarishida yumshoq o'tish.

---

## 7. Texnologiya

| Qatlam | Nima |
|---|---|
| Backend | FastAPI + SQLAlchemy 2.0 (async) + asyncpg |
| Baza | PostgreSQL 16 |
| Passkey | `webauthn` (py_webauthn 2.x) |
| Yuz | InsightFace `buffalo_l` + onnxruntime (CPU), kosinus masofa |
| Sessiya | imzolangan cookie (`itsdangerous`), HttpOnly + Secure |
| Frontend | Jinja2 + Tailwind (CDN) + vanilla JS, build qadami yo'q |
| QR chizish | `qrcode` JS (CDN) — brauzerda |
| QR o'qish | `BarcodeDetector` API, zaxira: `jsQR` |
| Bot | aiogram 3 — xuddi shu bazaga ulanadi |
| Joylashtirish | Docker Compose: `web` + `bot` + `postgres` + `caddy` (HTTPS) |

> HTTPS **majburiy** — kamera, geolokatsiya va WebAuthn faqat secure context'da
> ishlaydi. Localhost istisno.

---

## 8. Bosqichlar

| Bosqich | Nima | Holat |
|---|---|---|
| 1 | Baza, modellar, QR imzo, geofence | ✅ shu yetkazmada |
| 2 | Bot ko'prigi + ro'yxatdan o'tish | ✅ shu yetkazmada |
| 3 | Passkey + yuz biriktirish/tekshirish | ✅ shu yetkazmada |
| 4 | O'qituvchi QR ekrani + skaner + jonli feed | ✅ shu yetkazmada |
| 5 | Admin CRUD (fakultet/guruh/xona/o'qituvchi) | minimal — kengaytiriladi |
| 6 | Hisobotlar + grafiklar (mavjud bot kodidan) | keyingi bosqich |
| 7 | PWA (offline, "ilovaga o'xshash"), push | keyingi bosqich |
