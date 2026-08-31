// Rich screen-recording library for DentalCare Studio demo
// Reuses verbatim patterns from record.js (login / hideChrome / glide / clip)
// Produces at least 18 clips into footage-lib/ with real interactions.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
// Tools run from inside brands/<brand>/, so paths resolve against the CWD —
// not against tools/, where this file happens to live.
const OUT = path.join(process.cwd(), 'footage');
const W = 1920, H = 1080;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HIDE_CSS = `
  div.bg-amber-50.border-b { display: none !important; }
`;

async function hideChrome(page) {
  await page.addStyleTag({ content: HIDE_CSS }).catch(() => {});
}

async function glide(page, fx, fy, tx, ty, steps = 26) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(fx + (tx - fx) * e, fy + (ty - fy) * e);
    await sleep(16);
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

const manifest = [];

// Optional CLI filter: `node record-library.js examination` re-records that clip only,
// leaving the other 23 (and their manifest entries) untouched.
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'));

async function clip(def, body) {
  const { name, role, route, feature, actions } = def;
  if (ONLY.length && !ONLY.includes(name)) return;
  console.log('-> ' + name + ' (' + role + ' ' + route + ')');
  const dir = path.join(OUT, '_' + name);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir, size: { width: W, height: H } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  let contentStart = 0;
  let contentEnd = 0;
  let ok = false;
  // Injecting the hide-CSS once per navigation is not enough: every full navigation
  // (goto, goBack) drops the injected <style>, leaving a 1.5-2.5s window where the
  // sandbox banner is on camera. Measured on all 24 clips; `patients-visits`, which
  // navigates three times, was showing it for 13 of its 21 seconds. So re-inject on a
  // timer for the whole clip instead of at hand-picked moments.
  let keeper = null;
  try {
    await login(page, role);
    await hideChrome(page);
    keeper = setInterval(() => { hideChrome(page); }, 400);
    await sleep(1800);
    contentStart = (Date.now() - t0) / 1000;
    console.log('   content starts at ~' + contentStart.toFixed(2) + 's');
    await body(page);
    contentEnd = (Date.now() - t0) / 1000;
    console.log('   clip content ends at ~' + contentEnd.toFixed(2) + 's');
    ok = true;
  } catch (e) {
    console.log('   !! clip failed: ' + e.message);
    // still compute contentEnd for diagnostics
    contentEnd = (Date.now() - t0) / 1000;
    console.log('   clip content ends at ~' + contentEnd.toFixed(2) + 's (failed)');
  } finally {
    if (keeper) clearInterval(keeper);
    try { await page.close(); } catch {}
    try { await ctx.close(); } catch {}
    try { await browser.close(); } catch {}
  }
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.webm')) : [];
  const f = files[0];
  if (!f) {
    console.log('  !! no video for ' + name + ' -- skipping manifest');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    return null;
  }
  const dst = path.join(OUT, name + '.webm');
  try { fs.rmSync(dst, { force: true }); } catch {}
  fs.renameSync(path.join(dir, f), dst);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  const sizeMB = (fs.statSync(dst).size / 1048576).toFixed(2);
  console.log('  [clip] ' + name + '.webm ' + sizeMB + ' MB');
  if (ok) {
    manifest.push({
      name,
      file: 'footage-lib/' + name + '.webm',
      role,
      route,
      feature,
      contentStart: Number(contentStart.toFixed(2)),
      contentEnd: Number(contentEnd.toFixed(2)),
      actions,
    });
  } else {
    console.log('  !! not adding to manifest due to failure');
  }
  return dst;
}

// helpers used inside bodies
async function hoverFirstRow(page) {
  const rows = await page.$$('tbody tr');
  if (rows.length) {
    const box = await rows[0].boundingBox().catch(() => null);
    if (box) {
      await glide(page, 960, 540, box.x + box.width / 2, box.y + box.height / 2, 20);
      await sleep(800);
    }
  }
}

async function typeInSearch(page, text) {
  // find first text input that looks like search
  const sel = 'input[type="text"], input[type="search"], input[placeholder]';
  const inp = await page.$(sel);
  if (inp) {
    const box = await inp.boundingBox().catch(() => null);
    if (box) await glide(page, 960, 300, box.x + box.width / 2, box.y + box.height / 2, 18);
    await inp.click().catch(() => {});
    await sleep(400);
    await inp.fill(text).catch(() => {});
    await sleep(1200);
    // clear
    await inp.fill('').catch(() => {});
    await sleep(600);
  }
}

async function slowScroll(page, steps) {
  for (const d of steps) {
    await page.mouse.wheel(0, d);
    await sleep(1200);
  }
  // scroll back to top gently
  await page.mouse.wheel(0, -steps.reduce((a, b) => a + b, 0) / 2);
  await sleep(600);
  await page.mouse.wheel(0, -600);
  await sleep(600);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // 1 dashboard
  await clip(
    { name: 'dashboard', role: 'admin', route: '/dashboard', feature: 'Dashboard + statistik klinik + chart', actions: ['wait figures', 'hover chart', 'scroll 2 steps'] },
    async (page) => {
      await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Dashboard|Rp/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      // hover some cards
      const cards = await page.$$('div.rounded');
      if (cards[1]) {
        const box = await cards[1].boundingBox().catch(() => null);
        if (box) {
          await glide(page, 960, 200, box.x + box.width / 2, box.y + box.height / 2, 22);
          await sleep(1200);
        }
      }
      await page.mouse.wheel(0, 340);
      await sleep(2800);
      await glide(page, 700, 430, 980, 540, 20);
      await sleep(1500);
      await page.mouse.wheel(0, 320);
      await sleep(3000);
      await glide(page, 980, 540, 1200, 600, 18);
      await sleep(1400);
      await page.mouse.wheel(0, 220);
      await sleep(2000);
    }
  );

  // 2 patients-list
  await clip(
    { name: 'patients-list', role: 'admin', route: '/patients', feature: 'Daftar pasien + pencarian + scroll', actions: ['type search', 'clear search', 'hover rows', 'scroll'] },
    async (page) => {
      await page.goto(BASE + '/patients', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1200);
      await typeInSearch(page, 'Ahmad');
      await sleep(800);
      await hoverFirstRow(page);
      await sleep(1000);
      // hover second row
      const rows = await page.$$('tbody tr');
      if (rows[1]) {
        const box = await rows[1].boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 540, box.x + box.width / 2, box.y + box.height / 2, 18); await sleep(900); }
      }
      await slowScroll(page, [320, 280, 240]);
      await sleep(1200);
      // scroll to show pagination/footer
      await page.mouse.wheel(0, 400);
      await sleep(1800);
    }
  );

  // 3 patients-detail with tab switching
  await clip(
    { name: 'patients-detail', role: 'admin', route: '/patients/1', feature: 'Detail pasien + tab riwayat kunjungan', actions: ['open row 1', 'tab Riwayat Kunjungan', 'tab Riwayat Perubahan', 'scroll'] },
    async (page) => {
      await page.goto(BASE + '/patients/1', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Info Pasien|Riwayat Kunjungan/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      await page.mouse.wheel(0, 260);
      await sleep(1500);
      // click Riwayat Kunjungan
      const tab2 = page.locator('[role=tab], button').filter({ hasText: /Riwayat Kunjungan/i }).first();
      if (await tab2.count()) {
        const box = await tab2.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 400, box.x + box.width / 2, box.y + box.height / 2, 18);
        await tab2.click().catch(() => {});
        await sleep(2200);
        await page.mouse.wheel(0, 260);
        await sleep(1600);
      }
      const tab3 = page.locator('[role=tab], button').filter({ hasText: /Riwayat Perubahan/i }).first();
      if (await tab3.count()) {
        const box = await tab3.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 460, box.x + box.width / 2, box.y + box.height / 2, 18);
        await tab3.click().catch(() => {});
        await sleep(2000);
        await page.mouse.wheel(0, 220);
        await sleep(1400);
      }
      const tab1 = page.locator('[role=tab], button').filter({ hasText: /^Info Pasien/i }).first();
      if (await tab1.count()) {
        const box = await tab1.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 480, box.x + box.width / 2, box.y + box.height / 2, 18);
        await tab1.click().catch(() => {});
        await sleep(1800);
      }
      await page.mouse.wheel(0, 300);
      await sleep(2000);
    }
  );

  // 4 patients-visits
  await clip(
    { name: 'patients-visits', role: 'admin', route: '/patients/1/visits', feature: 'Daftar kunjungan pasien', actions: ['open visits', 'hover rows', 'open Detail then back', 'scroll'] },
    async (page) => {
      await page.goto(BASE + '/patients/1/visits', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      await hoverFirstRow(page);
      await sleep(1200);
      // click first Detail link
      const detail = page.locator('a, button').filter({ hasText: /^Detail$/ }).first();
      if (await detail.count()) {
        const box = await detail.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 500, box.x + box.width / 2, box.y + box.height / 2, 18);
        await detail.click().catch(() => {});
        await sleep(3000);
        await hideChrome(page);
        await page.mouse.wheel(0, 260);
        await sleep(1800);
        await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
        await hideChrome(page);
        await sleep(2000);
      } else {
        await slowScroll(page, [320, 260]);
        await sleep(2000);
      }
      await page.mouse.wheel(0, 300);
      await sleep(1600);
    }
  );

  // 5 appointments
  await clip(
    { name: 'appointments', role: 'admin', route: '/appointments', feature: 'Kalender appointment + filter tanggal', actions: ['hover calendar header', 'scroll table', 'hover rows'] },
    async (page) => {
      await page.goto(BASE + '/appointments', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      // hover date navigation
      const btn = page.locator('button').filter({ hasText: /today|month/i }).first();
      if (await btn.count()) {
        const box = await btn.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 260, box.x + box.width / 2, box.y + box.height / 2, 18); await sleep(1000); }
      }
      await hoverFirstRow(page);
      await sleep(1000);
      await slowScroll(page, [340, 320, 280]);
      await sleep(1200);
      // hover a row action
      const rows = await page.$$('tbody tr');
      if (rows[2]) {
        const box = await rows[2].boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 520, box.x + box.width / 2, box.y + box.height / 2, 18); await sleep(1000); }
      }
      await page.mouse.wheel(0, 260);
      await sleep(1800);
    }
  );

  // 6 queue with tab switch
  await clip(
    { name: 'queue', role: 'admin', route: '/queue', feature: 'Antrean hari ini + tab riwayat', actions: ['tab Antrian Aktif', 'tab Riwayat Antrian', 'scroll', 'hover'] },
    async (page) => {
      await page.goto(BASE + '/queue', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Antrean|Antrian/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      await page.mouse.wheel(0, 240);
      await sleep(1400);
      const t2 = page.locator('[role=tab], button').filter({ hasText: /Riwayat Antrian/i }).first();
      if (await t2.count()) {
        const box = await t2.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 380, box.x + box.width / 2, box.y + box.height / 2, 18);
        await t2.click().catch(() => {});
        await sleep(2200);
        await page.mouse.wheel(0, 260);
        await sleep(1600);
      }
      const t1 = page.locator('[role=tab], button').filter({ hasText: /Antrian Aktif/i }).first();
      if (await t1.count()) {
        const box = await t1.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 380, box.x + box.width / 2, box.y + box.height / 2, 18);
        await t1.click().catch(() => {});
        await sleep(2000);
      }
      await page.mouse.wheel(0, 300);
      await sleep(1800);
      await slowScroll(page, [240, 200]);
    }
  );

  // 7 treatments
  await clip(
    { name: 'treatments', role: 'admin', route: '/treatments', feature: 'Daftar tindakan medis', actions: ['search tindakan', 'hover rows', 'scroll', 'hover pagination'] },
    async (page) => {
      await page.goto(BASE + '/treatments', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      await typeInSearch(page, 'Cabut');
      await hoverFirstRow(page);
      await sleep(1000);
      await slowScroll(page, [320, 300, 260]);
      await sleep(800);
      // hover Pagination
      const next = page.locator('button').filter({ hasText: /Next|›/ }).first();
      if (await next.count()) {
        const box = await next.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 600, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(800); }
      }
      await page.mouse.wheel(0, 240);
      await sleep(1600);
    }
  );

  // 8 promo-codes (hover only, never click Tambah)
  await clip(
    { name: 'promo-codes', role: 'admin', route: '/promo-codes', feature: 'Kode promo klinik', actions: ['hover Tambah Promo', 'scroll', 'hover table area'] },
    async (page) => {
      await page.goto(BASE + '/promo-codes', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Promo/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const btn = page.locator('button, a').filter({ hasText: /Tambah Promo/i }).first();
      if (await btn.count()) {
        const box = await btn.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 300, box.x + box.width / 2, box.y + box.height / 2, 18); await sleep(1200); }
      }
      await page.mouse.wheel(0, 280);
      await sleep(1800);
      await hoverFirstRow(page);
      await sleep(1000);
      await slowScroll(page, [260, 220]);
      await sleep(1200);
      await page.mouse.wheel(0, 200);
      await sleep(1400);
    }
  );

  // 9 tooth-conditions
  await clip(
    { name: 'tooth-conditions', role: 'admin', route: '/tooth-conditions', feature: 'Kondisi gigi + master data', actions: ['hover rows', 'scroll', 'hover badges'] },
    async (page) => {
      await page.goto(BASE + '/tooth-conditions', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      await hoverFirstRow(page);
      await sleep(1000);
      // hover color badges
      const badges = await page.$$('span.rounded, div.rounded');
      if (badges[0]) {
        const box = await badges[0].boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 480, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(900); }
      }
      await slowScroll(page, [300, 260]);
      await sleep(1200);
      await page.mouse.wheel(0, 240);
      await sleep(1800);
    }
  );

  // 10 medicines
  await clip(
    { name: 'medicines', role: 'admin', route: '/medicines', feature: 'Obat / farmasi + kategori', actions: ['search obat', 'hover rows', 'scroll', 'hover category filter'] },
    async (page) => {
      await page.goto(BASE + '/medicines', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      await typeInSearch(page, 'Amox');
      await hoverFirstRow(page);
      await sleep(1000);
      // hover category pill
      const cat = page.locator('button').filter({ hasText: /Kategori|Semua/i }).first();
      if (await cat.count()) {
        const box = await cat.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 360, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(900); }
      }
      await slowScroll(page, [320, 280]);
      await sleep(1200);
      await page.mouse.wheel(0, 260);
      await sleep(1800);
    }
  );

  // 11 invoices-list
  await clip(
    { name: 'invoices-list', role: 'admin', route: '/invoices', feature: 'Daftar invoice + status bayar', actions: ['hover rows', 'scroll', 'open first invoice', 'back'] },
    async (page) => {
      await page.goto(BASE + '/invoices', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      await hoverFirstRow(page);
      await sleep(1000);
      await slowScroll(page, [300, 260]);
      await sleep(800);
      // open first invoice detail
      const first = page.locator('tbody tr a').first();
      if (await first.count()) {
        const box = await first.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 500, box.x + box.width / 2, box.y + box.height / 2, 18);
        await first.click().catch(() => {});
        await sleep(3000);
        await hideChrome(page);
        await page.waitForFunction(() => /INV0|Invoice/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
        await page.mouse.wheel(0, 260);
        await sleep(1600);
        await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
        await hideChrome(page);
        await sleep(1500);
      } else {
        await page.mouse.wheel(0, 260);
        await sleep(1800);
      }
    }
  );

  // 12 invoices-detail
  await clip(
    { name: 'invoices-detail', role: 'admin', route: '/invoices/1', feature: 'Detail invoice + rincian pembayaran', actions: ['scroll rincian', 'hover Cetak PDF', 'hover rows'] },
    async (page) => {
      await page.goto(BASE + '/invoices/1', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /INV0|Invoice/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const btn = page.locator('button, a').filter({ hasText: /Cetak|PDF/i }).first();
      if (await btn.count()) {
        const box = await btn.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 320, box.x + box.width / 2, box.y + box.height / 2, 18); await sleep(1100); }
      }
      await page.mouse.wheel(0, 300);
      await sleep(2000);
      await hoverFirstRow(page);
      await sleep(900);
      await slowScroll(page, [280, 260]);
      await sleep(1200);
      await page.mouse.wheel(0, 220);
      await sleep(1500);
    }
  );

  // 13 commissions (needs 6s wait for figures)
  await clip(
    { name: 'commissions', role: 'admin', route: '/commissions', feature: 'Laporan komisi dokter', actions: ['wait Rp figures', 'scroll', 'hover rows'] },
    async (page) => {
      await page.goto(BASE + '/commissions', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Rp\s?\d{2,3}\.\d{3}\.\d{3}/.test(document.body.innerText), { timeout: 30000 }).catch(() => console.log('   (commission figures did not populate in time)'));
      await sleep(1500);
      await hideChrome(page);
      await sleep(800);
      await hoverFirstRow(page);
      await sleep(1000);
      await page.mouse.wheel(0, 320);
      await sleep(2800);
      await page.mouse.wheel(0, 280);
      await sleep(2400);
      // hover next pagination
      const nxt = page.locator('button').filter({ hasText: /Next|›/ }).first();
      if (await nxt.count()) {
        const box = await nxt.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 620, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(800); }
      }
      await page.mouse.wheel(0, 200);
      await sleep(1600);
    }
  );

  // 14 staff-report
  await clip(
    { name: 'staff-report', role: 'admin', route: '/staff-report', feature: 'Rekap staff + kehadiran', actions: ['hover month nav', 'scroll', 'hover table'] },
    async (page) => {
      await page.goto(BASE + '/staff-report', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Rekap Staff|Kehadiran/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const nav = page.locator('button').filter({ hasText: /‹|›/ }).first();
      if (await nav.count()) {
        const box = await nav.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 320, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(800); }
      }
      await page.mouse.wheel(0, 280);
      await sleep(1800);
      await hoverFirstRow(page);
      await sleep(900);
      await slowScroll(page, [260, 220]);
      await sleep(1200);
      await page.mouse.wheel(0, 200);
      await sleep(1400);
    }
  );

  // 15 doctors
  await clip(
    { name: 'doctors', role: 'admin', route: '/doctors', feature: 'Manajemen dokter', actions: ['hover rows', 'scroll', 'hover Tambah Dokter'] },
    async (page) => {
      await page.goto(BASE + '/doctors', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      const btn = page.locator('button, a').filter({ hasText: /Tambah Dokter/i }).first();
      if (await btn.count()) {
        const box = await btn.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 300, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(900); }
      }
      await hoverFirstRow(page);
      await sleep(1000);
      await slowScroll(page, [280, 240]);
      await sleep(1200);
      await page.mouse.wheel(0, 220);
      await sleep(1500);
    }
  );

  // 16 nurses
  await clip(
    { name: 'nurses', role: 'admin', route: '/nurses', feature: 'Manajemen perawat', actions: ['hover rows', 'scroll'] },
    async (page) => {
      await page.goto(BASE + '/nurses', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      await hoverFirstRow(page);
      await sleep(1000);
      await page.mouse.wheel(0, 280);
      await sleep(1800);
      const rows = await page.$$('tbody tr');
      if (rows[1]) {
        const box = await rows[1].boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 520, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(900); }
      }
      await slowScroll(page, [240, 200]);
      await sleep(1400);
    }
  );

  // 17 front-offices
  await clip(
    { name: 'front-offices', role: 'admin', route: '/front-offices', feature: 'Manajemen front office', actions: ['hover rows', 'scroll'] },
    async (page) => {
      await page.goto(BASE + '/front-offices', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 }).catch(() => {});
      await sleep(1300);
      await hoverFirstRow(page);
      await sleep(1000);
      await page.mouse.wheel(0, 260);
      await sleep(1800);
      await slowScroll(page, [240, 200]);
      await sleep(1400);
    }
  );

  // 18 home-edit
  await clip(
    { name: 'home-edit', role: 'admin', route: '/home-edit', feature: 'Homepage editor visual + pratinjau', actions: ['scroll editor', 'hover Pratinjau', 'hover sections'] },
    async (page) => {
      await page.goto(BASE + '/home-edit', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Homepage Editor|Pratinjau/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const prev = page.locator('button').filter({ hasText: /Pratinjau/i }).first();
      if (await prev.count()) {
        const box = await prev.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 320, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(1000); }
      }
      await page.mouse.wheel(0, 340);
      await sleep(2400);
      await page.mouse.wheel(0, 320);
      await sleep(2400);
      await glide(page, 900, 500, 1100, 600, 18);
      await sleep(1000);
      await page.mouse.wheel(0, 260);
      await sleep(2000);
    }
  );

  // 19 settings
  await clip(
    { name: 'settings', role: 'admin', route: '/settings', feature: 'Pengaturan klinik + tabs', actions: ['tab Profil', 'tab Lisensi', 'scroll', 'hover upload'] },
    async (page) => {
      await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Pengaturan Klinik/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const tabLisensi = page.locator('button').filter({ hasText: /^Lisensi$/ }).first();
      if (await tabLisensi.count()) {
        const box = await tabLisensi.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 360, box.x + box.width / 2, box.y + box.height / 2, 16);
        await tabLisensi.click().catch(() => {});
        await sleep(2000);
        await page.mouse.wheel(0, 220);
        await sleep(1400);
      }
      const tabProfil = page.locator('button').filter({ hasText: /^Profil$/ }).first();
      if (await tabProfil.count()) {
        const box = await tabProfil.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 360, box.x + box.width / 2, box.y + box.height / 2, 16);
        await tabProfil.click().catch(() => {});
        await sleep(2000);
      }
      await page.mouse.wheel(0, 280);
      await sleep(1800);
      await slowScroll(page, [260, 240]);
      await sleep(1200);
    }
  );

  // 20 profile
  await clip(
    { name: 'profile', role: 'admin', route: '/profile', feature: 'Profil saya + ubah password', actions: ['hover form fields', 'scroll', 'hover Ubah Password'] },
    async (page) => {
      await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Profil Saya/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const inp = await page.$('input[type="text"], input[type="email"]');
      if (inp) {
        const box = await inp.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 400, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(900); }
      }
      await page.mouse.wheel(0, 260);
      await sleep(1800);
      const pwd = page.locator('button').filter({ hasText: /Ubah Password/i }).first();
      if (await pwd.count()) {
        const box = await pwd.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 480, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(1000); }
      }
      await page.mouse.wheel(0, 220);
      await sleep(1600);
      await slowScroll(page, [220, 200]);
      await sleep(1200);
      await glide(page, 960, 500, 1100, 620, 18);
      await sleep(1000);
      await page.mouse.wheel(0, 200);
      await sleep(1800);
    }
  );

  // 21 odontogram (doctor only)
  await clip(
    { name: 'odontogram', role: 'dokter', route: '/odontogram/1', feature: 'Odontogram peta gigi interaktif', actions: ['hover teeth svg', 'scroll legend', 'glide across teeth'] },
    async (page) => {
      await page.goto(BASE + '/odontogram/1', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Odontogram|Peta Gigi/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(2000);
      await hideChrome(page);
      await sleep(600);
      // glide across teeth as in record-s3
      const teeth = await page.$$('svg [data-tooth], svg g[id], svg path');
      let prev = [960, 300];
      let c = 0;
      for (const el of teeth.slice(0, 16)) {
        const box = await el.boundingBox().catch(() => null);
        if (!box || box.width < 8 || box.height < 8) continue;
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        await glide(page, prev[0], prev[1], cx, cy, 14);
        await sleep(650);
        prev = [cx, cy];
        c++;
        if (c >= 10) break;
      }
      await sleep(800);
      await page.mouse.wheel(0, 300);
      await sleep(2000);
      await glide(page, prev[0], prev[1], 960, 700, 20);
      await sleep(1000);
      await page.mouse.wheel(0, 260);
      await sleep(2000);
    }
  );

  // 22 doctor-my-commissions (doctor only)
  await clip(
    { name: 'doctor-commissions', role: 'dokter', route: '/doctor/my-commissions', feature: 'Komisi dokter (role dokter)', actions: ['wait Rp figures', 'scroll', 'hover rows'] },
    async (page) => {
      await page.goto(BASE + '/doctor/my-commissions', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Komisi Saya|Rp/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      await page.waitForFunction(() => /Rp\s?\d/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(800);
      await hoverFirstRow(page);
      await sleep(1000);
      await page.mouse.wheel(0, 300);
      await sleep(2400);
      await page.mouse.wheel(0, 280);
      await sleep(2200);
      await slowScroll(page, [240, 200]);
    }
  );

  // 23 reserve-appointment
  await clip(
    { name: 'reserve-appointment', role: 'admin', route: '/reserve-appointment', feature: 'Form reservasi appointment publik', actions: ['hover form fields', 'type nama demo', 'scroll jam slots', 'hover Konfirmasi'] },
    async (page) => {
      await page.goto(BASE + '/reserve-appointment', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Reservasi|Data Pasien/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const nameInp = await page.$('input[placeholder*="Nama"], input[type="text"]');
      if (nameInp) {
        const box = await nameInp.boundingBox().catch(() => null);
        if (box) await glide(page, 960, 400, box.x + box.width / 2, box.y + box.height / 2, 16);
        await nameInp.click().catch(() => {});
        await sleep(400);
        await nameInp.fill('Budi Demo').catch(() => {});
        await sleep(800);
        await nameInp.fill('').catch(() => {});
        await sleep(400);
      }
      await page.mouse.wheel(0, 280);
      await sleep(1800);
      // hover time slots
      const jam = page.locator('button').filter({ hasText: /^09$|^10$|^11$/ }).first();
      if (await jam.count()) {
        const box = await jam.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 520, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(900); }
      }
      await page.mouse.wheel(0, 260);
      await sleep(1600);
      const confirm = page.locator('button').filter({ hasText: /Konfirmasi Reservasi/i }).first();
      if (await confirm.count()) {
        const box = await confirm.boundingBox().catch(() => null);
        if (box) { await glide(page, 960, 600, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(1000); }
      }
      await page.mouse.wheel(0, 200);
      await sleep(1600);
    }
  );

  // 24 examination
  await clip(
    { name: 'examination', role: 'admin', route: '/examination/1', feature: 'Pemeriksaan SOAP + ICD-10', actions: ['hover SOAP fields', 'scroll', 'hover ICD selector'] },
    async (page) => {
      await page.goto(BASE + '/examination/1', { waitUntil: 'networkidle' });
      await hideChrome(page);
      await page.waitForFunction(() => /Pemeriksaan|SOAP|Catatan Klinis/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      // Re-inject AFTER the route settles. hideChrome swallows its own errors, so an
      // inject fired while the SPA was still routing is lost silently — this was the one
      // clip in 24 that still showed the amber demo banner, for exactly that reason.
      await hideChrome(page);
      await sleep(1500);
      const icd = page.locator('input').filter({ hasText: /ICD/ }).first();
      // generic hover over central area
      await glide(page, 960, 300, 800, 460, 18);
      await sleep(1000);
      await page.mouse.wheel(0, 320);
      await sleep(2200);
      await page.mouse.wheel(0, 300);
      await sleep(2000);
      // hover any textarea
      const ta = await page.$('textarea');
      if (ta) {
        const box = await ta.boundingBox().catch(() => null);
        if (box) { await glide(page, 800, 460, box.x + box.width / 2, box.y + box.height / 2, 16); await sleep(1000); }
      }
      await page.mouse.wheel(0, 260);
      await sleep(1800);
    }
  );

  // write manifest — when only some clips were re-recorded, MERGE into the existing
  // manifest instead of replacing it, so a one-clip rerun never drops the other 23.
  const mfPath = path.join(OUT, 'manifest.json');
  let out = manifest;
  if (ONLY.length && fs.existsSync(mfPath)) {
    const prev = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
    const byName = new Map(prev.map((e) => [e.name, e]));
    for (const e of manifest) byName.set(e.name, e);
    out = [...byName.values()];
  }
  fs.writeFileSync(mfPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('\nManifest wrote ' + out.length + ' entries -> ' + mfPath);

  // summary
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm'));
  let total = 0;
  for (const f of files) total += fs.statSync(path.join(OUT, f)).size;
  console.log('DONE -> ' + OUT);
  console.log('Clips: ' + files.length + '  Total size: ' + (total / 1048576).toFixed(2) + ' MB');
  if (files.length < 18) console.log('WARN: fewer than 18 clips');
  const skipped = ['satusehat-logs'];
  console.log('Skipped routes: ' + skipped.join(', ') + ' (redirects to /settings or /queue, no distinct content)');

  // verify LF / no BOM
  const raw = fs.readFileSync(path.join(__dirname, 'record-library.js'));
  const hasBOM = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  const hasCRLF = raw.includes(0x0d);
  console.log('File check: BOM=' + hasBOM + ' CRLF=' + hasCRLF + ' (expect false/false)');
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
