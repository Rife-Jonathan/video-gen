const { chromium } = require('playwright');
const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await sleep(1000);
  for (const b of await page.$$('button')) {
    if (/admin@klinik/i.test((await b.textContent()) || '')) { await b.click(); break; }
  }
  await sleep(1000);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 60000 });
  await sleep(2000);
  await page.goto(BASE + '/commissions', { waitUntil: 'networkidle' });
  await sleep(6000);

  // pass a real function, not a string
  const report = await page.evaluate(() => {
    const matched = [];
    for (const n of document.querySelectorAll('div,section,aside,p')) {
      const t = (n.textContent || '').trim();
      if (/^MODE DEMO AKTIF/i.test(t) && t.length < 250) {
        matched.push({ tag: n.tagName, cls: n.className.toString().slice(0, 80), len: t.length });
        n.style.display = 'none';
      }
    }
    // what does the banner's ancestry actually look like?
    let chain = [];
    const span = [...document.querySelectorAll('span')].find((s) => /^MODE DEMO AKTIF$/i.test((s.textContent || '').trim()));
    if (span) {
      let cur = span;
      for (let i = 0; i < 5 && cur; i++) {
        chain.push({ tag: cur.tagName, cls: cur.className.toString().slice(0, 90), textLen: (cur.textContent || '').trim().length });
        cur = cur.parentElement;
      }
    }
    return { matchedCount: matched.length, matched, chain };
  });
  console.log(JSON.stringify(report, null, 1));

  await page.screenshot({ path: 'chk/after-kill.png' });
  console.log('screenshot -> chk/after-kill.png');
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
