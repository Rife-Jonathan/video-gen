// Runs inside aistudio.google.com. All DOM work lives here; the side panel only
// orchestrates.
//
// Every selector below was read off the live DOM (31 Aug 2026), not guessed:
//
//   button.text-input-container          leaves the preset gallery, opens the editor
//   .toggle-label ("Text" / "Composer")  mode switch; active state = class ms-button-active
//   textarea[aria-label="Scene"]
//   textarea[aria-label="Sample Context"]
//   textarea[aria-label="Enter a prompt"]      <- TEXT mode's big box
//   textarea[aria-label="Speech block text"]   <- COMPOSER mode's box (different!)
//   Run button has no aria-label — matched by its text
//
// The two modes use DIFFERENT aria-labels for the main box. Filling the wrong one
// silently leaves the prompt empty and Run re-reads the previous take, so the mode is
// forced to Text before every fill.

const SEL = {
  scene: 'textarea[aria-label="Scene"]',
  context: 'textarea[aria-label="Sample Context"]',
  textMode: 'textarea[aria-label="Enter a prompt"]',
  composerMode: 'textarea[aria-label="Speech block text"]',
  enterEditor: 'button.text-input-container',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runButton() {
  return [...document.querySelectorAll('button')].find((b) =>
    /(^|\s)Run(\s|$)/i.test((b.textContent || '').replace(/\s+/g, ' ').trim()),
  );
}

function toggleButton(name) {
  const lab = [...document.querySelectorAll('.toggle-label')].find(
    (n) => n.textContent.trim() === name,
  );
  return lab ? lab.closest('button') : null;
}

function isActive(btn) {
  return !!btn && btn.className.toString().includes('ms-button-active');
}

function promptBox() {
  return document.querySelector(SEL.textMode) || document.querySelector(SEL.composerMode);
}

// Angular tracks values through a property setter, so `el.value = x` is invisible to it
// and Run would send the previous take. Go through the native setter + events.
function setNative(el, value) {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
  if (desc && desc.set) desc.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function currentAudio() {
  const list = [...document.querySelectorAll('audio')].filter((a) => a.src);
  return list.length ? list[list.length - 1].src : null;
}

// Step 1: a fresh load of /generate-speech lands on the PRESET GALLERY, not the editor.
// The three textareas do not exist yet. Click through, then wait for them.
async function ensureEditor(timeoutMs = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (promptBox()) return true;
    const enter = document.querySelector(SEL.enterEditor);
    if (enter) enter.click();
    await sleep(700);
  }
  return !!promptBox();
}

// Step 2: force TEXT mode. Composer is what the page opens in by default.
async function ensureTextMode(timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const text = toggleButton('Text');
    if (!text) return !!document.querySelector(SEL.textMode);
    if (isActive(text) && document.querySelector(SEL.textMode)) return true;
    text.click();
    await sleep(900);
  }
  return !!document.querySelector(SEL.textMode);
}

function readState() {
  const run = runButton();
  const text = toggleButton('Text');
  return {
    ready: !!promptBox(),
    inEditor: !!promptBox(),
    textMode: isActive(text),
    hasRun: !!run,
    runDisabled: run ? run.disabled : null,
    audio: currentAudio(),
    speaker: ([...document.querySelectorAll('button')]
      .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
      .find((t) => /^person Speaker/i.test(t)) || '').replace(/^person\s*/i, ''),
  };
}

// The only reliable "done" signal is the <audio> src changing. A fixed sleep either
// truncates a long take or wastes time on a short one. The player can swap src twice
// while initialising, so wait for it to settle.
async function waitForNewAudio(previous, timeoutMs) {
  const t0 = Date.now();
  let seen = null;
  while (Date.now() - t0 < timeoutMs) {
    const now = currentAudio();
    if (now && now !== previous) {
      if (now === seen) { await sleep(600); return now; }
      seen = now;
    }
    await sleep(400);
  }
  return null;
}

async function fetchAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('ambil audio gagal: HTTP ' + res.status);
  const blob = await res.blob();
  if (blob.size < 1024) throw new Error('audio kosong (' + blob.size + ' byte)');
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('gagal membaca audio'));
    fr.readAsDataURL(blob);
  });
}

async function generateOne({ name, text, scene, context, timeoutMs, folder }) {
  if (!(await ensureEditor())) throw new Error('editor tidak terbuka — kolom teks tidak ada');
  if (!(await ensureTextMode())) throw new Error('gagal pindah ke mode Text');

  const box = document.querySelector(SEL.textMode);
  if (!box) throw new Error('kolom teks mode Text tidak ditemukan');

  const sceneEl = document.querySelector(SEL.scene);
  const ctxEl = document.querySelector(SEL.context);
  if (scene && sceneEl) setNative(sceneEl, scene);
  if (context && ctxEl) setNative(ctxEl, context);
  setNative(box, text);
  await sleep(700);

  if (box.value.trim() !== text.trim()) {
    throw new Error('teks tidak masuk ke kolom (Angular menolak nilai)');
  }

  const before = currentAudio();
  const run = runButton();
  if (!run) throw new Error('tombol Run tidak ditemukan');
  if (run.disabled) throw new Error('tombol Run non-aktif');
  run.click();

  const audio = await waitForNewAudio(before, timeoutMs);
  if (!audio) throw new Error('audio tidak muncul dalam ' + Math.round(timeoutMs / 1000) + 's');

  const dataUrl = await fetchAsDataUrl(audio);
  const safe = String(name).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'vo';
  const dir = folder ? folder.replace(/[^A-Za-z0-9._/-]+/g, '-').replace(/^\/+|\/+$/g, '') + '/' : '';
  const filename = dir + safe + '.wav';

  const resp = await chrome.runtime.sendMessage({ type: 'save', dataUrl, filename });
  if (!resp || !resp.ok) throw new Error('unduh gagal: ' + (resp && resp.error));
  return { filename, kb: Math.round((dataUrl.length * 3) / 4 / 1024) };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ ok: true }); return false; }
  if (msg.type === 'state') { sendResponse(readState()); return false; }
  if (msg.type === 'prepare') {
    (async () => {
      const a = await ensureEditor();
      const b = a ? await ensureTextMode() : false;
      sendResponse({ ok: a && b, editor: a, textMode: b });
    })();
    return true;
  }
  if (msg.type === 'generate') {
    generateOne(msg.item)
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  return false;
});
