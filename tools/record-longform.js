// Long-form recorder for the 6-minute narration (voice_asli.wav).
//
// The 24-clip library was cut for a 52s video: ~12-18s usable each. The long-form
// narration dwells on some screens far longer (home-edit alone gets 42.9s), and it
// also talks about two screens the library never captured: the login page itself and
// the public landing page. This script records exactly those gaps.
//
// Durations come from plan-longform.py (need + margin), not from taste.
//
// Usage:  node record-longform.js            (all)
//         node record-longform.js home-edit  (one)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
// Tools run from inside brands/<brand>/ — resolve against the CWD, not tools/.
const OUT = path.join(process.cwd(), 'footage');
const W = 1920, H = 1080;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HIDE_CSS = `div.bg-amber-50.border-b { display: none !important; }`;
const hideChrome = (p) => p.addStyleTag({ content: HIDE_CSS }).catch(() => {});

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const manifest = [];

async function glide(page, fx, fy, tx, ty, steps = 26) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(fx + (tx - fx) * e, fy + (ty - fy) * e);
    await sleep(16);
  }
}

// Slow, human-paced scrolling: many small steps beat a few big jumps on camera.
async function creep(page, totalTicks, stepMs = 420, perTick = 130) {
  for (let i = 0; i < totalTicks; i++) {
    await page.mouse.wheel(0, perTick);
    await sleep(stepMs);
  }
}

async function login(page, role) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await sleep(1000);
  const want = role === 'dokter' ? /arina@klinik/i : /admin@klinik/i;
  for (const b of await page.$$('button')) {
    if (want.test((await b.textContent()) || '')) { await b.click(); break; }
  }
  await sleep(1000);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 60000 });
  await sleep(2500);
}

async function clip(def, body, opts = {}) {
  const { name, role, route, feature, actions } = def;
  if (ONLY.length && !ONLY.includes(name)) return;
  console.log('-> ' + name + '  (target ' + def.target + 's)');

  const dir = path.join(OUT, '_' + name);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir, size: { width: W, height: H } },
  });
  const page = await ctx.newPage();

  const t0 = Date.now();
  let keeper = null;
  let contentStart = 0, contentEnd = 0, ok = false;
  try {
    if (!opts.noLogin) await login(page, role);
    await hideChrome(page);
    // Re-inject continuously: every full navigation drops the injected stylesheet.
    keeper = setInterval(() => { hideChrome(page); }, 400);
    await sleep(1800);
    contentStart = (Date.now() - t0) / 1000;
    console.log('   content starts at ~' + contentStart.toFixed(2) + 's');
    await body(page);
    contentEnd = (Date.now() - t0) / 1000;
    const got = (contentEnd - contentStart).toFixed(2);
    console.log('   content ends at ~' + contentEnd.toFixed(2) + 's  (usable ' + got + 's)');
    if (contentEnd - contentStart < def.target) {
      console.log('   !! SHORT of target ' + def.target + 's');
    }
    ok = true;
  } catch (e) {
    console.log('   !! failed: ' + e.message);
    contentEnd = (Date.now() - t0) / 1000;
  } finally {
    if (keeper) clearInterval(keeper);
    try { await page.close(); } catch {}
    try { await ctx.close(); } catch {}
    try { await browser.close(); } catch {}
  }

  const f = fs.readdirSync(dir).filter((x) => x.endsWith('.webm'))[0];
  if (!f) { console.log('   !! no video written'); fs.rmSync(dir, { recursive: true, force: true }); return; }
  const dst = path.join(OUT, name + '.webm');
  fs.rmSync(dst, { force: true });
  fs.renameSync(path.join(dir, f), dst);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('   [clip] ' + name + '.webm ' + (fs.statSync(dst).size / 1048576).toFixed(2) + ' MB');

  if (ok) {
    manifest.push({
      name, file: 'footage-lib/' + name + '.webm', role, route, feature,
      contentStart: Number(contentStart.toFixed(2)),
      contentEnd: Number(contentEnd.toFixed(2)),
      actions,
    });
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // ---- login page itself (narration: "tinggal pilih akun admin, klik sign in") ----
  await clip(
    { name: 'login', role: 'admin', route: '/login', target: 24, feature: 'Halaman login + quick login per peran', actions: ['hover 3 role cards', 'click Admin', 'submit', 'dashboard appears'] },
    async (page) => {
      await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await sleep(3000);
      // hover each demo role card in turn
      let prev = [960, 300];
      for (const re of [/admin@klinik/i, /fo@klinik/i, /arina@klinik/i]) {
        for (const b of await page.$$('button')) {
          if (re.test((await b.textContent()) || '')) {
            const box = await b.boundingBox().catch(() => null);
            if (box) {
              await glide(page, prev[0], prev[1], box.x + box.width / 2, box.y + box.height / 2, 22);
              await sleep(1600);
              prev = [box.x + box.width / 2, box.y + box.height / 2];
            }
            break;
          }
        }
      }
      await sleep(1500);
      // pick Admin, let the form fill visibly, then sign in
      for (const b of await page.$$('button')) {
        if (/admin@klinik/i.test((await b.textContent()) || '')) { await b.click(); break; }
      }
      await sleep(3000);
      const submit = await page.$('button[type=submit]');
      const sb = await submit.boundingBox().catch(() => null);
      if (sb) { await glide(page, prev[0], prev[1], sb.x + sb.width / 2, sb.y + sb.height / 2, 20); await sleep(1200); }
      await submit.click();
      await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 60000 });
      await hideChrome(page);
      await sleep(6000);
    },
    { noLogin: true },
  );

  // ---- public landing page (narration: "landing page yang dilihat pasien") ----
  await clip(
    { name: 'landing', role: 'public', route: '/', target: 28, feature: 'Landing page publik klinik', actions: ['hero', 'layanan', 'FAQ', 'form janji temu'] },
    async (page) => {
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await sleep(4000);
      await creep(page, 22, 430, 150);   // hero -> tentang -> layanan
      await sleep(2000);
      await creep(page, 20, 430, 160);   // FAQ -> CTA -> form
      await sleep(4000);
    },
    { noLogin: true },
  );

  // ---- dashboard, long dwell (34.7s of narration) ----
  await clip(
    { name: 'dashboard', role: 'admin', route: '/dashboard', target: 40, feature: 'Dashboard analitik', actions: ['stat cards', 'chart range 7H/14H/30H', 'hover chart', 'scroll to demografi + leaderboard'] },
    async (page) => {
      await sleep(3000);
      await glide(page, 960, 200, 420, 300); await sleep(2200);   // Pendapatan card
      await glide(page, 420, 300, 1250, 300); await sleep(2200);  // Profit card
      // walk the chart range buttons
      for (const label of ['14H', '30H', '7H']) {
        const b = page.locator('button', { hasText: new RegExp('^' + label + '$') }).first();
        const box = await b.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 400, box.x + box.width / 2, box.y + box.height / 2, 18); await b.click().catch(() => {}); await sleep(2600); }
      }
      await glide(page, 1300, 330, 700, 470); await sleep(2400);  // hover the curve
      await creep(page, 6, 440, 150);
      await sleep(3000);
      await glide(page, 700, 500, 1450, 560); await sleep(2500);  // demografi donut
      await creep(page, 6, 440, 150);
      await sleep(4000);
    },
  );

  // ---- homepage editor, the longest section (42.9s) ----
  await clip(
    { name: 'home-edit', role: 'admin', route: '/home-edit', target: 48, feature: 'Editor visual homepage', actions: ['hero', 'tentang', 'layanan unggulan', 'FAQ', 'CTA', 'form'] },
    async (page) => {
      await page.goto(BASE + '/home-edit', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await sleep(4500);
      await glide(page, 960, 300, 700, 420); await sleep(2500);
      await creep(page, 14, 430, 150);
      await sleep(2500);
      await creep(page, 14, 430, 150);
      await sleep(2500);
      await creep(page, 14, 430, 150);
      await sleep(2500);
      await creep(page, 12, 430, 150);
      await sleep(4000);
    },
  );

  // ---- the seven that were only slightly short ----
  const stretch = [
    { name: 'patients-list', route: '/patients', target: 25, feature: 'Manajemen pasien', search: 'siti' },
    { name: 'queue', route: '/queue', target: 25, feature: 'Antrean hari ini', tabs: [/Riwayat Antrian/i, /Antrian Aktif/i] },
    { name: 'treatments', route: '/treatments', target: 22, feature: 'Daftar tindakan & tarif', search: 'cabut' },
    { name: 'tooth-conditions', route: '/tooth-conditions', target: 18, feature: 'Master kondisi gigi' },
    { name: 'commissions', route: '/commissions', target: 24, feature: 'Laporan komisi dokter', waitMoney: true },
    { name: 'doctors', route: '/doctors', target: 18, feature: 'Manajemen dokter' },
    { name: 'settings', route: '/settings', target: 24, feature: 'Pengaturan klinik', tabs: [/Lisensi/i, /Profil/i] },
  ];

  for (const s of stretch) {
    await clip(
      { name: s.name, role: 'admin', route: s.route, target: s.target, feature: s.feature, actions: ['hover', 'search/tabs', 'slow scroll'] },
      async (page) => {
        await page.goto(BASE + s.route, { waitUntil: 'networkidle' });
        await hideChrome(page);
        if (s.waitMoney) {
          await page.waitForFunction(
            () => /Rp\s?\d{2,3}\.\d{3}\.\d{3}/.test(document.body.innerText),
            { timeout: 30000 },
          ).catch(() => {});
        }
        await sleep(4000);
        await glide(page, 960, 250, 700, 420); await sleep(2500);

        if (s.search) {
          const box = page.locator('input[type=text], input[placeholder]').first();
          const bb = await box.boundingBox().catch(() => null);
          if (bb) {
            await glide(page, 700, 420, bb.x + 120, bb.y + bb.height / 2, 18);
            await box.click().catch(() => {});
            await box.type(s.search, { delay: 190 }).catch(() => {});
            await sleep(3200);
            await box.fill('').catch(() => {});
            await sleep(2000);
          }
        }

        for (const re of s.tabs || []) {
          const t = page.locator('button, a', { hasText: re }).first();
          const bb = await t.boundingBox().catch(() => null);
          if (bb) {
            await glide(page, 900, 400, bb.x + bb.width / 2, bb.y + bb.height / 2, 18);
            await t.click().catch(() => {});
            await sleep(3600);
          }
        }

        await creep(page, 8, 430, 150);
        await sleep(3000);
        await creep(page, 6, 430, 150);
        await sleep(3500);
      },
    );
  }

  // merge into the existing manifest rather than replacing it
  const mfPath = path.join(OUT, 'manifest.json');
  let out = manifest;
  if (fs.existsSync(mfPath)) {
    const prev = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
    const byName = new Map(prev.map((e) => [e.name, e]));
    for (const e of manifest) byName.set(e.name, e);
    out = [...byName.values()];
  }
  fs.writeFileSync(mfPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('\nmanifest: ' + out.length + ' entri -> ' + mfPath);
  console.log('DONE. Jalankan verify-lib.py untuk menghitung ulang safeStart.');
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
