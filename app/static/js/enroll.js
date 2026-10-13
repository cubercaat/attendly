// Shaxsni biriktirish: passkey + yuz
const pkBtn = $('#pk-btn'), pkNote = $('#pk-note'), pkPill = $('#pk-pill');
const faceBtn = $('#face-btn'), faceNote = $('#face-note'), facePill = $('#face-pill');
const faceCam = $('#face-cam'), faceVideo = $('#face-video'), faceHint = $('#face-hint');

const KIND_UZ = {
  center: 'To‘g‘ri qarang',
  left: 'Boshingizni CHAPGA buring',
  right: 'Boshingizni O‘NGGA buring',
};

let state = null;

async function refresh() {
  state = await api('/api/enroll/status');

  if (state.passkeys.length) {
    pkPill.textContent = 'ulangan ✓'; pkPill.className = 'pill ok';
    pkBtn.textContent = 'Yana bir qurilma qo‘shish';
    pkBtn.classList.add('secondary');
  }
  if (!passkeySupported()) {
    pkPill.textContent = 'qo‘llanmaydi'; pkPill.className = 'pill warn';
    pkBtn.disabled = true;
    note(pkNote, 'Bu brauzer passkey’ni qo‘llamaydi. Yuz zaxirasidan foydalaning.', 'warn');
  }
  if (state.face_enrolled) {
    facePill.textContent = 'ulangan ✓'; facePill.className = 'pill ok';
    faceBtn.textContent = 'Yuzni qayta biriktirish';
  }
  if (!state.face_available) {
    facePill.textContent = 'o‘chiq'; facePill.className = 'pill';
    faceBtn.disabled = true;
  }
  $('#done-btn').classList.toggle('hidden', !state.complete);
}

// ------------------------------------------------------------- passkey
pkBtn.addEventListener('click', async () => {
  pkBtn.disabled = true;
  try {
    const { options, attempt } = await api('/api/enroll/passkey/begin', {});
    const cred = await navigator.credentials.create({ publicKey: prepCreate(options) });
    await api('/api/enroll/passkey/complete', {
      attempt,
      credential: packAttestation(cred),
      device_label: (navigator.userAgentData?.platform) || navigator.platform || 'Qurilma',
    });
    note(pkNote, 'Passkey ulandi ✓', 'ok');
    await refresh();
  } catch (e) {
    note(pkNote, e.name === 'NotAllowedError' ? 'Bekor qilindi' : e.message, 'bad');
  } finally {
    pkBtn.disabled = false;
  }
});

// ----------------------------------------------------------------- yuz
async function openCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
    audio: false,
  });
  faceVideo.srcObject = stream;
  await faceVideo.play();
  return stream;
}

function grab() {
  const c = document.createElement('canvas');
  const size = Math.min(faceVideo.videoWidth, faceVideo.videoHeight) || 480;
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const sx = (faceVideo.videoWidth - size) / 2, sy = (faceVideo.videoHeight - size) / 2;
  ctx.drawImage(faceVideo, sx, sy, size, size, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.88);
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function captureSequence(sequence, onHint) {
  const frames = [];
  for (const kind of sequence) {
    onHint(KIND_UZ[kind] || kind);
    await wait(1800);
    for (let i = 3; i > 0; i--) { onHint(`${KIND_UZ[kind]} — ${i}`); await wait(700); }
    frames.push({ kind, image: grab() });
    onHint('✓');
    await wait(400);
  }
  return frames;
}

faceBtn.addEventListener('click', async () => {
  faceBtn.disabled = true;
  hide(faceNote);
  let stream = null;
  try {
    const { challenge, sequence } = await api('/api/enroll/face/challenge');
    show(faceCam);
    stream = await openCamera();
    const frames = await captureSequence(sequence, t => { faceHint.textContent = t; });
    faceHint.textContent = 'Tekshirilmoqda…';
    await api('/api/enroll/face', { challenge, frames });
    note(faceNote, 'Yuz biriktirildi ✓', 'ok');
    hide(faceCam);
    await refresh();
  } catch (e) {
    note(faceNote, e.message || 'Xatolik', 'bad');
  } finally {
    if (stream) stream.getTracks().forEach(t => t.stop());
    faceBtn.disabled = false;
  }
});

refresh();
