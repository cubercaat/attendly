// Umumiy yordamchilar
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function api(url, body, method) {
  const res = await fetch(url, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error((data && data.detail) || 'Xatolik yuz berdi');
    err.status = res.status;
    throw err;
  }
  return data;
}

function note(el, text, kind) {
  if (!el) return;
  el.className = 'note' + (kind ? ' ' + kind : '');
  el.textContent = text;
  el.classList.remove('hidden');
}

function hide(el) { el && el.classList.add('hidden'); }
function show(el) { el && el.classList.remove('hidden'); }

// --- qurilma barmoq izi (barqaror, lekin shaxsni ochmaydi) ---
function deviceId() {
  let id = null;
  try { id = localStorage.getItem('attendly_dev'); } catch (_) {}
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).slice(0, 36);
    try { localStorage.setItem('attendly_dev', id); } catch (_) {}
  }
  const parts = [
    id,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || '',
  ];
  return parts.join('|');
}

// --- GPS ---
function getPosition(timeout = 12000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Qurilma joylashuvni qo‘llamaydi'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => reject(new Error(
        e.code === 1 ? 'Joylashuvga ruxsat berilmadi' :
        e.code === 3 ? 'Joylashuv aniqlanmadi — ochiq joyga chiqing' :
        'Joylashuv olinmadi'
      )),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

// --- WebAuthn base64url ---
const b64uToBuf = s => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - p.length % 4) % 4));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};
const bufToB64u = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function prepCreate(o) {
  return {
    ...o,
    challenge: b64uToBuf(o.challenge),
    user: { ...o.user, id: b64uToBuf(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: b64uToBuf(c.id) })),
  };
}
function prepGet(o) {
  return {
    ...o,
    challenge: b64uToBuf(o.challenge),
    allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: b64uToBuf(c.id) })),
  };
}
function packAttestation(cred) {
  return {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: bufToB64u(cred.response.clientDataJSON),
      attestationObject: bufToB64u(cred.response.attestationObject),
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  };
}
function packAssertion(cred) {
  return {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: bufToB64u(cred.response.clientDataJSON),
      authenticatorData: bufToB64u(cred.response.authenticatorData),
      signature: bufToB64u(cred.response.signature),
      userHandle: cred.response.userHandle ? bufToB64u(cred.response.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  };
}

const passkeySupported = () =>
  !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
