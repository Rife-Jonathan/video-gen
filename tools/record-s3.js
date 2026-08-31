// Hero scene: the odontogram. Records a longer dwell and grabs a matching
// high-res still for the punch-in. Doctor role — only a doctor sees the chart.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
const OUT = path.join(process.cwd(), 'footage');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A JS hide loses to React re-renders; a stylesheet does not.
const HIDE_CSS = `
  div.bg-amber-50.border-b { display: none !important; }
`;

async function hideChrome(page) {
  await page.addStyleTag({ content: HIDE_CSS }).catch(() => {});
}

async function glide(page, fx, fy, tx, ty, steps = 20) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(fx + (tx - fx) * e, fy + (ty - fy) * e);
    await sleep(16);
  }
}

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await sleep(1000);
  for (const b of await page.$$('button')) {
    if (/arina@klinik/i.test((await b.textContent()) || '')) { await b.click(); break; }
  }
  await sleep(1000);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 60000 });
  await sleep(2500);
}

(async () => {
  // pass 1 - high-res still for the punch-in
  {
    const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE + '/odontogram/1', { waitUntil: 'networkidle' });
    await hideChrome(page);
    await sleep(4000);
    await hideChrome(page);
    await sleep(600);
    const dst = path.join(process.cwd(), 'shots', 'odontogram-hires.png');
    await page.screenshot({ path: dst });
    console.log('[still]', dst, (fs.statSync(dst).size / 1048576).toFixed(2), 'MB');
    await browser.close();
  }

  // pass 2 - the clip
  {
    const dir = path.join(OUT, '_s3');
    fs.mkdirSync(dir, { recursive: true });
    const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir, size: { width: 1920, height: 1080 } },
    });
    const page = await ctx.newPage();
    const t0 = Date.now();

    await login(page);
    await page.goto(BASE + '/odontogram/1', { waitUntil: 'networkidle' });
    await hideChrome(page);
    await sleep(3000);
    await hideChrome(page);
    await sleep(1200);
    console.log('   content starts at ~' + ((Date.now() - t0) / 1000).toFixed(2) + 's');

    const teeth = await page.$$('svg [data-tooth], svg g[id], svg path');
    let prev = [960, 250];
    for (const el of teeth.slice(0, 14)) {
      const box = await el.boundingBox().catch(() => null);
      if (!box || box.width < 8 || box.height < 8) continue;
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await glide(page, prev[0], prev[1], cx, cy, 14);
      await sleep(750);
      prev = [cx, cy];
    }
    await sleep(5000);
    console.log('   clip content ends at ~' + ((Date.now() - t0) / 1000).toFixed(2) + 's');

    await page.close();
    await ctx.close();
    await browser.close();

    const f = fs.readdirSync(dir).filter((x) => x.endsWith('.webm'))[0];
    const dst = path.join(OUT, 's3-odontogram.webm');
    fs.rmSync(dst, { force: true });
    fs.renameSync(path.join(dir, f), dst);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('[clip]', dst, (fs.statSync(dst).size / 1048576).toFixed(2), 'MB');
  }
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
