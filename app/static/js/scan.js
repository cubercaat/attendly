// QR skaner → GPS → passkey yoki yuz → davomat
const startBtn = $('#start'), msg = $('#msg'), cam = $('#cam');
const video = $('#video'), hint = $('#hint');
const faceStage = $('#face-stage'), fvideo = $('#fvideo'), fhint = $('#fhint');

const KIND_UZ = {
  center: 'To‘g‘ri qarang',
  left: 'Boshingizni CHAPGA buring',
  right: 'Boshingizni O‘NGGA buring',
};

let stream = null, scanning = false, busy = false;

function stopCamera() {
  scanning = false;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  hide(cam);
}

function tokenFromText(text) {
  if (!text) return null;
  const t = text.trim();
  const m = t.match(/\/s\/([^\s/?#]+)/);
  if (m) return m[1];
  return /^\d+\.\d+\.[A-Za-z0-9_-]+$/.test(t) ? t : null;
}

// --------------------------------------------------------------- skaner
async function startScan() {
  hide(msg);
  startBtn.disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false,
    });
  } catch (e) {
    note(msg, 'Kameraga ruxsat berilmadi', 'bad');
    startBtn.disabled = false;
    return;
  }
  show(cam);
  video.srcObject = stream;
  await video.play();
  scanning = true;
  startBtn.textContent = 'Skanerlanmoqda…';

  if ('BarcodeDetector' in window) {
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      loopNative(det);
      return;
    } catch (_) { /* zaxiraga tushamiz */ }
  }
  if (window.jsQR) { loopJsQR(); return; }

  // Hech qaysi skaner yo'q — telefonning o'z kamera ilovasi orqali ochiladi
  stopCamera();
  note(msg,
    'Bu brauzerda ichki skaner ishlamaydi. Telefoningizning oddiy KAMERA ilovasi '
    + 'bilan QR kodga qarang — u shu sahifani o‘zi ochadi va davomat belgilanadi.',
    'warn');
  resetBtn('Qayta urinish');
}

async function loopNative(det) {
  while (scanning) {
    try {
      const codes = await det.detect(video);
      if (codes.length) { await onCode(codes[0].rawValue); }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 180));
  }
}

function loopJsQR() {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const tick = async () => {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && window.jsQR) {
      c.width = video.videoWidth; c.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code) await onCode(code.data);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function onCode(raw) {
  if (busy) return;
  const token = tokenFromText(raw);
  if (!token) return;
  busy = true;
  scanning = false;
  hint.textContent = 'Joylashuv aniqlanmoqda…';
  try {
    await submit(token);
  } finally {
    busy = false;
  }
}

// ------------------------------------------------------------- yuborish
async function submit(token) {
  stopCamera();
  startBtn.textContent = 'Tekshirilmoqda…';
  let pos;
  try {
    note(msg, 'Joylashuv aniqlanmoqda…');
    pos = await getPosition();
  } catch (e) {
    note(msg, e.message, 'bad');
    resetBtn();
    return;
  }

  let begin;
  try {
    note(msg, 'Tekshirilmoqda…');
    begin = await api('/api/attend/begin', {
      qr_token: token, lat: pos.lat, lng: pos.lng,
      accuracy: pos.accuracy, device: deviceId(),
    });
  } catch (e) {
    note(msg, e.message, 'bad');
    resetBtn();
    return;
  }

  if (begin.already) { note(msg, begin.message, 'ok'); resetBtn('Yana skanerlash'); return; }

  const info = begin.lesson;
  const label = `${info.pair_no ? info.pair_no + '-para · ' : ''}${info.subject}`;

  if (begin.methods.includes('passkey') && passkeySupported()) {
    try {
      note(msg, label + ' — Face ID bilan tasdiqlang');
      const cred = await navigator.credentials.get({
        publicKey: prepGet(begin.passkey.options),
      });
      const res = await api('/api/attend/passkey', {
        attempt: begin.attempt, credential: packAssertion(cred),
      });
      done(res, label);
      return;
    } catch (e) {
      if (!begin.methods.includes('face')) {
        note(msg, e.name === 'NotAllowedError' ? 'Tasdiqlash bekor qilindi' : e.message, 'bad');
        resetBtn('Qayta urinish');
        return;
      }
      note(msg, 'Passkey o‘tmadi — yuz bilan davom etamiz', 'warn');
    }
  }

  if (begin.methods.includes('face')) {
    await faceFlow(begin, label);
  } else {
    note(msg, 'Tasdiqlash usuli topilmadi. /enroll sahifasiga o‘ting.', 'bad');
    resetBtn();
  }
}

async function faceFlow(begin, label) {
  let s = null;
  try {
    show(faceStage);
    s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      audio: false,
    });
    fvideo.srcObject = s;
    await fvideo.play();

    const frames = [];
    for (const kind of begin.face.sequence) {
      fhint.textContent = KIND_UZ[kind] || kind;
      await new Promise(r => setTimeout(r, 1500));
      for (let i = 3; i > 0; i--) {
        fhint.textContent = `${KIND_UZ[kind]} — ${i}`;
        await new Promise(r => setTimeout(r, 650));
      }
      const c = document.createElement('canvas');
      const size = Math.min(fvideo.videoWidth, fvideo.videoHeight) || 480;
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(fvideo, (fvideo.videoWidth - size) / 2,
                   (fvideo.videoHeight - size) / 2, size, size, 0, 0, size, size);
      frames.push({ kind, image: c.toDataURL('image/jpeg', 0.88) });
      fhint.textContent = '✓';
      await new Promise(r => setTimeout(r, 350));
    }

    fhint.textContent = 'Tekshirilmoqda…';
    const res = await api('/api/attend/face', { attempt: begin.attempt, frames });
    hide(faceStage);
    done(res, label);
  } catch (e) {
    hide(faceStage);
    note(msg, e.message || 'Yuz tasdiqlanmadi', 'bad');
    resetBtn('Qayta urinish');
  } finally {
    if (s) s.getTracks().forEach(t => t.stop());
  }
}

function done(res, label) {
  note(msg, `${label}\n${res.message}`, 'ok');
  msg.style.whiteSpace = 'pre-line';
  resetBtn('Yana skanerlash');
  if (res.flagged) {
    const w = document.createElement('div');
    w.className = 'note warn';
    w.textContent = 'Diqqat: bu qurilmadan boshqa talaba ham belgilangan — '
      + 'o‘qituvchi tekshiradi.';
    msg.after(w);
  }
}

function resetBtn(text) {
  startBtn.disabled = false;
  startBtn.textContent = text || 'Skanerni ochish';
}

startBtn.addEventListener('click', startScan);
window.addEventListener('pagehide', stopCamera);

// QR to'g'ridan-to'g'ri kamera ilovasida ochilgan bo'lsa
if (window.PREFILL) {
  submit(window.PREFILL);
}
