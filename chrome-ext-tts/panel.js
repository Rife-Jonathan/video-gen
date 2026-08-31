// Side-panel orchestration: parse the script, drive the AI Studio tab one block at a
// time, download each take, keep going when one fails.
//
// The single-chain guard (busy + runToken) is copied from chatgpt-autopaster, where two
// live chains once read the same index, skipped half the queue and downloaded duplicates.

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TTS_URL = 'https://aistudio.google.com/generate-speech?model=gemini-2.5-pro-preview-tts';

let state = { queue: [], index: 0, running: false };
let busy = false;
let runToken = 0;

const FIELDS = ['scene', 'context', 'script', 'folder', 'delay', 'timeout', 'retry'];

// ---------------- persistence ----------------
async function save() {
  await chrome.storage.local.set({
    tts: { queue: state.queue, index: state.index },
    fields: Object.fromEntries(FIELDS.map((k) => [k, $(k).value])),
  });
}
async function load() {
  const d = await chrome.storage.local.get(['tts', 'fields']);
  if (d.fields) for (const k of FIELDS) if (d.fields[k] !== undefined) $(k).value = d.fields[k];
  if (d.tts && Array.isArray(d.tts.queue)) {
    state.queue = d.tts.queue;
    state.index = d.tts.index || 0;
  }
}
for (const k of FIELDS) $(k).addEventListener('input', save);

// ---------------- script parsing ----------------
// Plain text is the normal case: blocks are separated by a blank line and numbered
// automatically. `=== nama` is optional, only for naming files yourself.
function parseScript(raw) {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  if (/^\s*===\s*\S/m.test(text)) {
    const items = [];
    let cur = null;
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*===\s*(.+?)\s*$/);
      if (m) {
        if (cur) items.push(cur);
        cur = { name: m[1], lines: [] };
      } else if (cur) cur.lines.push(line);
    }
    if (cur) items.push(cur);
    return items
      .map((it) => ({ name: it.name, text: it.lines.join('\n').trim() }))
      .filter((it) => it.text);
  }

  return text
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t, i) => ({ name: String(i + 1).padStart(2, '0'), text: t }));
}

// Only rebuild from the paste box when it actually has content — a folder import must
// not be wiped by an empty textarea when Mulai is pressed.
function buildQueue() {
  const raw = $('script').value.trim();
  if (!raw) return;
  const items = parseScript(raw);
  state.queue = items.map((it) => ({ ...it, status: 'pending', note: '' }));
  state.index = 0;
}

// ---------------- import ----------------
// Folder mode is the main path: one .txt = one take, and the FILE NAME becomes the
// .wav name. That keeps naming under the author's control instead of auto-numbering.
async function importFiles(fileList) {
  const files = [...fileList].filter((f) => /\.(txt|md)$/i.test(f.name));
  if (!files.length) { $('status').textContent = 'tidak ada berkas .txt di folder itu'; return; }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const queue = [];
  for (const f of files) {
    const text = (await f.text()).trim();
    if (!text) continue;
    queue.push({
      name: f.name.replace(/\.[^.]+$/, ''),
      text,
      status: 'pending',
      note: '',
    });
  }
  state.queue = queue;
  state.index = 0;
  $('script').value = '';           // folder wins over the paste box
  await save();
  render();
  $('status').textContent = `${queue.length} berkas dimuat dari folder`;
}

$('folder-in').addEventListener('change', async (e) => {
  await importFiles(e.target.files);
  e.target.value = '';
});

$('file').addEventListener('change', async (e) => {
  await importFiles(e.target.files);
  e.target.value = '';
});

$('script').addEventListener('change', async () => { buildQueue(); await save(); render(); });

// ---------------- tab plumbing ----------------
function sendMsg(tabId, msg, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const to = setTimeout(() => {
      if (!done) { done = true; resolve({ ok: false, error: 'tab tidak merespon' }); }
    }, timeoutMs);
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(resp || { ok: false, error: 'respon kosong' });
    });
  });
}

async function getTab() {
  const tabs = await chrome.tabs.query({ url: 'https://aistudio.google.com/*' });
  if (tabs.length) return tabs.find((t) => t.active) || tabs[0];
  return await chrome.tabs.create({ url: TTS_URL, active: true });
}

// A content script is not re-injected automatically after a navigation, so ping first
// and inject on demand — otherwise the first block after a reload always fails.
async function ensureReady(tabId) {
  let r = await sendMsg(tabId, { type: 'PING' }, 1500);
  if (r && r.ok) return;
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); } catch {}
  await sleep(500);
  r = await sendMsg(tabId, { type: 'PING' }, 2500);
  if (!r || !r.ok) throw new Error('content script tidak aktif — muat ulang tab AI Studio');
}

// Reload straight to the TTS model, leave the preset gallery, force Text mode.
async function openTtsPage(tabId) {
  await chrome.tabs.update(tabId, { url: TTS_URL });
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || tab.status !== 'complete') continue;
    try { await ensureReady(tabId); } catch { continue; }
    const p = await sendMsg(tabId, { type: 'prepare' }, 40000);
    if (p && p.ok) return true;
  }
  return false;
}

// ---------------- rendering ----------------
function render() {
  const list = $('list');
  list.innerHTML = '';
  state.queue.forEach((it, i) => {
    const li = document.createElement('li');
    const preview = it.text.replace(/\s+/g, ' ').slice(0, 44);
    li.textContent = `${it.name}.wav — ${preview}${it.text.length > 44 ? '…' : ''}` +
      (it.note ? `  [${it.note}]` : '');
    li.className = it.status;
    li.title = it.text;
    list.appendChild(li);
    if (i === state.index && busy) li.scrollIntoView({ block: 'nearest' });
  });

  const done = state.queue.filter((x) => x.status === 'done').length;
  const bad = state.queue.filter((x) => x.status === 'error').length;
  $('status').textContent = state.queue.length
    ? `${done}/${state.queue.length} selesai${bad ? ` · ${bad} gagal` : ''} · ${busy ? 'berjalan…' : 'berhenti'}`
    : 'Belum ada naskah dimuat.';

  $('pause').disabled = !busy;
  $('start').disabled = busy || !state.queue.length;
  $('continue').disabled = busy || !state.queue.length || done >= state.queue.length;
  $('reset').disabled = busy;
}

async function refreshPage() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://aistudio.google.com/*' });
    if (!tabs.length) {
      $('page').textContent = 'tab AI Studio belum terbuka — akan dibuka otomatis saat Mulai';
      return;
    }
    const st = await sendMsg((tabs.find((t) => t.active) || tabs[0]).id, { type: 'state' }, 1500);
    if (!st || st.error) { $('page').textContent = 'halaman belum siap'; return; }
    $('page').textContent = st.ready
      ? `siap · mode ${st.textMode ? 'Text' : 'Composer'} · suara: ${st.speaker || '—'}`
      : 'masih di galeri preset — akan dibuka otomatis saat Mulai';
  } catch {
    $('page').textContent = 'tidak bisa membaca halaman';
  }
}
setInterval(refreshPage, 4000);

// ---------------- main loop ----------------
const cfg = () => ({
  scene: $('scene').value.trim(),
  context: $('context').value.trim(),
  folder: $('folder').value.trim(),
  delayMs: Math.max(0, Number($('delay').value) || 0) * 1000,
  timeoutMs: Math.max(15, Number($('timeout').value) || 180) * 1000,
  retry: Math.max(0, Number($('retry').value) || 0),
});

async function loop(my) {
  const alive = () => my === runToken && state.running;

  const tab = await getTab();
  if (!(await openTtsPage(tab.id))) {
    $('status').textContent = 'gagal membuka halaman Generate Speech';
    return;
  }

  while (alive() && state.index < state.queue.length) {
    const c = cfg();
    const it = state.queue[state.index];
    if (it.status === 'done') { state.index++; continue; }

    it.status = 'running';
    it.note = '';
    render();

    let resp = { ok: false, error: 'belum jalan' };
    for (let attempt = 0; attempt <= c.retry && alive(); attempt++) {
      if (attempt > 0) { it.note = `ulang ${attempt}`; render(); await sleep(3000); }
      try {
        await ensureReady(tab.id);
        resp = await sendMsg(
          tab.id,
          { type: 'generate', item: { name: it.name, text: it.text, scene: c.scene, context: c.context, timeoutMs: c.timeoutMs, folder: c.folder } },
          c.timeoutMs + 45000,
        );
        if (resp && resp.ok) break;
      } catch (e) {
        resp = { ok: false, error: e.message };
      }
    }
    if (!alive()) return;

    if (resp && resp.ok) {
      it.status = 'done';
      it.note = `${resp.kb} KB`;
    } else {
      // Mark and move on: one bad block must not hold the rest hostage. Use Lanjutkan
      // to retry only what is still red.
      it.status = 'error';
      it.note = (resp && resp.error) || 'gagal';
    }
    state.index++;
    await save();
    render();
    if (alive() && state.index < state.queue.length) await sleep(c.delayMs);
  }
}

async function startLoop(fromIndex) {
  if (busy) return;
  if (!state.queue.length) { buildQueue(); }
  if (!state.queue.length) { $('status').textContent = 'naskah kosong'; return; }
  if (fromIndex != null) state.index = fromIndex;

  busy = true;
  state.running = true;
  const my = ++runToken;
  render();
  const t0 = Date.now();
  try {
    await loop(my);
  } finally {
    if (my === runToken) {
      busy = false;
      state.running = false;
      await save();
      render();
      const done = state.queue.filter((x) => x.status === 'done').length;
      const bad = state.queue.filter((x) => x.status === 'error').length;
      $('status').textContent =
        `selesai — ${done} berhasil, ${bad} gagal, ${((Date.now() - t0) / 60000).toFixed(1)} menit`;
    }
  }
}

$('start').addEventListener('click', () => { buildQueue(); startLoop(0); });
$('pause').addEventListener('click', () => {
  runToken++; state.running = false; busy = false; render();
  $('status').textContent = 'dihentikan';
});
$('continue').addEventListener('click', () => {
  const i = state.queue.findIndex((x) => x.status !== 'done');
  if (i === -1) return;
  startLoop(i);
});
$('reset').addEventListener('click', async () => {
  runToken++; busy = false;
  state = { queue: [], index: 0, running: false };
  await save(); render();
});

load().then(() => { if (!state.queue.length) buildQueue(); render(); refreshPage(); });
