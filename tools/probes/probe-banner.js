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

  const info = await page.evaluate(() => {
    const hits = [];
    document.querySelectorAll('*').forEach((n) => {
      const own = [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('');
      if (/MODE DEMO AKTIF/i.test(own)) {
        hits.push({
          tag: n.tagName,
          cls: n.className && n.className.toString().slice(0, 120),
          text: (n.textContent || '').trim().slice(0, 70),
          len: (n.textContent || '').trim().length,
          parentCls: n.parentElement ? n.parentElement.className.toString().slice(0, 120) : null,
          parentTag: n.parentElement ? n.parentElement.tagName : null,
        });
      }
    });
    // is the commission data loaded?
    const body = document.body.innerText;
    return {
      hits,
      stillLoading: /Memuat/i.test(body),
      hasRupiah: (body.match(/Rp\s?[\d.]{4,}/g) || []).slice(0, 6),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
