// Screen-recording rig for the DentalCare Studio review video.
// Playwright records at browser-context level (no desktop capture, no frame drops).
//
// Each clip prints its own CONTENT_START offset, so the composition never has to
// guess where the throwaway login/toast head ends.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
const OUT = path.join(process.cwd(), 'footage');
const W = 1920, H = 1080;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Keep the sandbox banner and the login toast out of frame for good. Both are
// artifacts of the demo deployment, not product UI, and React re-renders bring
// the banner back, so a one-shot hide is not enough.
// The sandbox banner is an artifact of the demo deployment, not product UI.
// A JS hide loses to React re-renders; a stylesheet does not. The amber wrapper
// (`div.bg-amber-50.border-b`) is the banner's own container — confirmed by
// walking the DOM from the "MODE DEMO AKTIF" span (probe-kill.js).
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

async function clip(name, role, body) {
  const dir = path.join(OUT, '_' + name);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir, size: { width: W, height: H } },
  });
  // runs on every document, including client-side route changes
  const page = await ctx.newPage();

  const t0 = Date.now();
  try {
    await login(page, role);
    await hideChrome(page);
    await sleep(1200);
    const contentStart = (Date.now() - t0) / 1000;
    console.log('   content starts at ~' + contentStart.toFixed(2) + 's');
    await body(page);
    console.log('   clip content ends at ~' + ((Date.now() - t0) / 1000).toFixed(2) + 's');
  } finally {
    await page.close();
    await ctx.close();
    await browser.close();
  }

  const f = fs.readdirSync(dir).filter((x) => x.endsWith('.webm'))[0];
  if (!f) { console.log('  !! no video for', name); return; }
  const dst = path.join(OUT, name + '.webm');
  fs.rmSync(dst, { force: true });
  fs.renameSync(path.join(dir, f), dst);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('  [clip]', name + '.webm', (fs.statSync(dst).size / 1048576).toFixed(2), 'MB');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const ONLY = process.argv[2]; // optional: re-record a single clip by name
  const want = (n) => !ONLY || ONLY === n;

  // S1 (needs ~7.7s of content) - dashboard reveal
  if (want('s1')) { console.log('-> s1-dashboard');
  await clip('s1-dashboard', 'admin', async (page) => {
    await sleep(2500);
    await glide(page, 960, 200, 700, 430);
    await sleep(2000);
    await page.mouse.wheel(0, 300);
    await sleep(3500);
    await page.mouse.wheel(0, 260);
    await sleep(3000);
  }); }

  // S2 (needs ~9.0s) - the menu is the story
  if (want('s2')) { console.log('-> s2-menu');
  await clip('s2-menu', 'admin', async (page) => {
    await sleep(1500);
    let prev = [960, 300];
    for (const label of ['Front Office', 'Antrean', 'Invoice']) {
      const el = page.locator('a', { hasText: new RegExp('^\\s*' + label + '\\s*$') }).first();
      const box = await el.boundingBox().catch(() => null);
      if (!box) { console.log('   (menu item not found:', label + ')'); continue; }
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await glide(page, prev[0], prev[1], cx, cy, 22);
      await sleep(1200);
      prev = [cx, cy];
    }
    // a full goto discards the injected stylesheet — re-inject after every one
    await page.goto(BASE + '/queue', { waitUntil: 'networkidle' });
    await hideChrome(page);
    await sleep(4000);
  }); }

  // S4 (needs ~10.6s) - automation: commissions then staff report.
  // Commission figures take ~6s to populate; recording earlier shows "Memuat..." and Rp 0.
  if (want('s4')) { console.log('-> s4-commissions');
  await clip('s4-commissions', 'admin', async (page) => {
    await page.goto(BASE + '/commissions', { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => /Rp\s?\d{2,3}\.\d{3}\.\d{3}/.test(document.body.innerText),
      { timeout: 30000 }
    ).catch(() => console.log('   (commission figures did not populate in time)'));
    await sleep(1500);
    await hideChrome(page);
    await sleep(3500);
    await page.mouse.wheel(0, 300);
    await sleep(3500);
    await page.goto(BASE + '/staff-report', { waitUntil: 'networkidle' });
    await sleep(2000);
    await hideChrome(page);
    await sleep(4000);
  }); }

  console.log('\nDONE ->', OUT);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
