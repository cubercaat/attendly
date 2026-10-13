# Railway'ga joylash

Loyiha `~/Claude/attendly` papkasida. Mac'ingizda **Terminal** oching va
buyruqlarni ketma-ket bajaring.

```bash
cd ~/Claude/attendly
```

---

## 1. Railway CLI

```bash
railway --version || npm i -g @railway/cli
railway login
```

Brauzer ochiladi, hisobingizga kiring.

## 2. Loyiha va baza

```bash
railway init --name attendly
railway add --database postgres
```

## 3. Web xizmatini joylash

```bash
railway up
```

Birinchi build ~3–5 daqiqa (Docker image yig'iladi).

## 4. Domen olish

```bash
railway domain
```

Chiqadi, masalan: `attendly-production-a1b2.up.railway.app`

**Shu manzilni eslab qoling** — keyingi qadamda kerak.

## 5. O'zgaruvchilar

```bash
railway variables \
  --set "SECRET_KEY=$(openssl rand -hex 32)" \
  --set "BASE_URL=https://SIZNING-DOMEN.up.railway.app" \
  --set "BOT_TOKEN=BOTFATHER_BERGAN_TOKEN" \
  --set "BOT_USERNAME=BOT_USERNAME_ETSIZ" \
  --set "SUPER_ADMIN_IDS=6616758518" \
  --set "TZ=Asia/Tashkent" \
  --set "DEMO_MODE=true"
```

> `BASE_URL` — 4-qadamdagi domen, oldiga `https://`.
> `BOT_USERNAME` — `@` siz, masalan `AttendlyBot`.
> `DATABASE_URL` ni Railway o'zi qo'shadi, lekin uni moslashtirish kerak —
> keyingi qadamga qarang.

### DATABASE_URL ni moslash

Railway `postgresql://...` beradi, bizga `postgresql+asyncpg://...` kerak:

```bash
railway variables --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
```

Agar ishlamasa, Railway panelida (**Variables** bo'limida) `DATABASE_URL` ni
qo'lda `postgresql://` → `postgresql+asyncpg://` qilib o'zgartiring.

## 6. Bot xizmati

Bot — alohida jarayon. Railway panelida:

**New** → **Empty Service** → nomi `bot` → **Settings**:

- **Source**: xuddi shu repo / papka
- **Start Command**: `python bot/bot.py`
- **Variables**: web xizmatidagi o'zgaruvchilarni nusxalang
  (Variables → ⋯ → *Copy from service*)

Yoki terminaldan:

```bash
railway service create bot
railway up --service bot
railway variables --service bot --set "BOT_TOKEN=..." ...
```

## 7. Demo ma'lumot

```bash
railway run python seed_demo.py
```

Chiqqan taklif havolalarini saqlab qo'ying.

---

## Tekshirish

```bash
curl https://SIZNING-DOMEN.up.railway.app/healthz
```

`{"ok":true,...}` chiqishi kerak.

Keyin:

- `https://SIZNING-DOMEN.up.railway.app/demo` — test rejimi
- Telegramda botga `/start` — endi javob beradi

---

## Loglarni ko'rish

```bash
railway logs              # web
railway logs --service bot
```

---

## Keyin nima

1. `/demo` → **Olimov Jahongir (O'qituvchi)** bilan kiring
2. Panel → **Yangi dars** → guruh/fan/xona → QR ekrani ochiladi
3. Telefonda `/demo` → **📍 Xonani shu yerga qo'yish**
4. Telefonda talaba tanlang → `/enroll` → **Passkey yaratish** (Face ID)
5. `/scan` → kompyuter ekranidagi QR ni oling

Hammasi ishlagach:

```bash
railway variables --set "DEMO_MODE=false"
```

va demo hisoblarni o'chiring:

```sql
DELETE FROM users WHERE is_demo = true;
```

---

## Yuz tanishni yoqish (ixtiyoriy)

`Dockerfile` dagi quyidagi qatorni oching (`#` ni olib tashlang):

```dockerfile
RUN pip install --no-cache-dir insightface==0.7.3 onnxruntime==1.20.1 \
    opencv-python-headless==4.10.0.84
```

Image ~300MB kattalashadi, birinchi ishga tushishda model yuklanadi.
Railway'ning bepul tarifida xotira yetmasligi mumkin — passkey'siz
sinamoqchi bo'lsangiz yoqing, aks holda shart emas.

---

## Muammolar

| Belgi | Sabab |
|---|---|
| Bot `/start` ga javob bermaydi | `bot` xizmati ishlamayapti yoki `BOT_TOKEN` noto'g'ri. `railway logs --service bot` |
| Sayt 502 | `DATABASE_URL` da `+asyncpg` yo'q |
| "Saytga qaytish" tugmasi ishlamaydi | `BASE_URL` noto'g'ri yoki `https://` qo'yilmagan |
| Passkey yaratilmaydi | `BASE_URL` domeni brauzerdagi domen bilan bir xil emas |
| Kamera ochilmaydi | HTTPS emas |
