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

  await page.goto(BASE + '/examination/1', { waitUntil: 'networkidle' });
  await sleep(5000);

  const chain = await page.evaluate(() => {
    const span = [...document.querySelectorAll('span,div,p')]
      .find((s) => /^MODE DEMO AKTIF$/i.test((s.textContent || '').trim()));
    if (!span) return { found: false };
    const out = [];
    let cur = span;
    for (let i = 0; i < 6 && cur; i++) {
      out.push({ tag: cur.tagName, cls: cur.className.toString(), textLen: (cur.textContent || '').trim().length });
      cur = cur.parentElement;
    }
    // does the selector we use actually match anything here?
    return {
      found: true,
      chain: out,
      matchesCurrentSelector: document.querySelectorAll('div.bg-amber-50.border-b').length,
      matchesLoose: document.querySelectorAll('div[class*="bg-amber-50"]').length,
    };
  });
  console.log(JSON.stringify(chain, null, 1));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
