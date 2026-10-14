/* Kamera: QR skaner (jsQR) va yuz tekshiruvi (demo).
   Demo'da yuz "shabloni" — markaziy kadrning 24x24 kulrang vektori. Haqiqiy tizimda InsightFace embedding ishlatiladi. */
const Cam = {
  stream: null, raf: 0,
  async open(video, facing = 'environment') {
    this.stop();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = this.stream; video.setAttribute('playsinline', ''); video.muted = true;
    await video.play();
  },
  stop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  },
  /* videodan QR qidiradi; topilsa onCode(text) */
  scan(video, onCode) {
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    let last = 0;
    const loop = t => {
      this.raf = requestAnimationFrame(loop);
      if (t - last < 110 || video.readyState < 2 || !video.videoWidth) return; last = t;
      const k = Math.min(1, 640 / video.videoWidth); cv.width = video.videoWidth * k; cv.height = video.videoHeight * k;
      cx.drawImage(video, 0, 0, cv.width, cv.height);
      const c = window.jsQR && jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
      if (c && c.data) { cancelAnimationFrame(this.raf); onCode(c.data); }
    };
    this.raf = requestAnimationFrame(loop);
  },
};

const Face = {
  /* 24x24 kulrang, o'rtachasi ayirilgan, normallangan vektor (markaziy 60% kesim) */
  vec(video) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 24;
    const cx = cv.getContext('2d', { willReadFrequently: true }), w = video.videoWidth, h = video.videoHeight, s = Math.min(w, h) * .6;
    cx.drawImage(video, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 24, 24);
    const px = cx.getImageData(0, 0, 24, 24).data, g = new Float32Array(576);
    let m = 0; for (let i = 0; i < 576; i++) { g[i] = .3 * px[i * 4] + .59 * px[i * 4 + 1] + .11 * px[i * 4 + 2]; m += g[i]; }
    m /= 576; let n = 0; for (let i = 0; i < 576; i++) { g[i] -= m; n += g[i] * g[i]; }
    n = Math.sqrt(n) || 1; for (let i = 0; i < 576; i++) g[i] /= n; return Array.from(g);
  },
  cos(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; },
  /* kadrlar bir-biridan farq qiladimi (rasm ko'rsatilmaganmi) */
  distinct(vs) { for (let i = 1; i < vs.length; i++) if (1 - Face.cos(vs[0], vs[i]) < 0.04) return false; return true; },

  /* Interaktiv oqim: steps = ['center','left','right'...]. Natija: {vecs} yoki xato. */
  async run(el, steps, title) {
    const KIND = { center: "To'g'ri qarang", left: 'Chapga buriling', right: "O'ngga buriling" };
    el.innerHTML = `<div class="card"><h2>${title}</h2><div id="fcam" style="position:relative;max-width:420px;margin:auto;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:3/4">
      <video id="fv" style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
      <div style="position:absolute;inset:14% 16%;border:3px solid rgba(255,255,255,.85);border-radius:50%"></div>
      <div id="fi" style="position:absolute;left:0;right:0;bottom:0;padding:12px;text-align:center;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.7));font-weight:600"></div></div>
      <p class="sm muted" style="text-align:center" id="fm"></p></div>`;
    const v = $('#fv'), info = $('#fi'), sleep = ms => new Promise(r => setTimeout(r, ms));
    try { await Cam.open(v, 'user'); } catch (e) { Cam.stop(); throw new Error('nocam'); }
    const vecs = [];
    await sleep(700);
    for (const k of steps) {
      for (let c = 2; c > 0; c--) { info.textContent = KIND[k] + ' — ' + c; await sleep(900); }
      info.textContent = '📸'; vecs.push(Face.vec(v)); await sleep(250);
    }
    Cam.stop(); return { vecs };
  },
};
