const { chromium } = require('playwright');
const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HIDE_CSS = `div.bg-amber-50.border-b { display: none !important; }`;
const hideChrome = (p) => p.addStyleTag({ content: HIDE_CSS }).catch((e) => console.log('   addStyleTag FAILED:', e.message.slice(0, 80)));

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
  await sleep(2500);
  console.log('after login, url =', page.url());
  await hideChrome(page);

  await page.goto(BASE + '/examination/1', { waitUntil: 'networkidle' });
  console.log('after goto, url =', page.url());
  await hideChrome(page);
  await sleep(4000);
  await hideChrome(page);
  await sleep(1000);

  const state = await page.evaluate(() => {
    const styles = [...document.querySelectorAll('style')].map((s) => s.textContent.slice(0, 60));
    const matches = [...document.querySelectorAll('div[class*="bg-amber-50"]')].map((n) => ({
      cls: n.className.toString(),
      display: getComputedStyle(n).display,
      visible: n.getBoundingClientRect().height > 0,
      text: (n.textContent || '').trim().slice(0, 40),
    }));
    return { injectedStyles: styles.filter((s) => s.includes('bg-amber-50')), matches, url: location.href };
  });
  console.log(JSON.stringify(state, null, 1));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
