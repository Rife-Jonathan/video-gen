const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Users\\RIFE\\.cache\\puppeteer\\chrome\\win64-150.0.7871.24\\chrome-win64\\chrome.exe';
const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  await sleep(1500);
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await b.evaluate((el) => (el.textContent || '').trim());
    if (/admin@klinik/i.test(t)) { await b.click(); break; }
  }
  await sleep(1500);
  await (await page.$('button[type=submit]')).click();
  await page.waitForFunction(() => /dashboard/i.test(location.pathname), { timeout: 60000 });
  await sleep(3000);

  // open patient list, click first patient row
  await page.goto(BASE + '/patients', { waitUntil: 'networkidle2' });
  await sleep(3000);

  const rowInfo = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')];
    return { count: rows.length, first: rows[0] ? rows[0].innerText.replace(/\s+/g, ' ').slice(0, 120) : null };
  });
  console.log('patients rows:', JSON.stringify(rowInfo));

  // find any link/button mentioning odontogram / rekam medis / detail
  const candidates = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a[href], button').forEach((el) => {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      const href = el.getAttribute('href') || '';
      if (/odontogram|rekam|medis|detail|lihat/i.test(t + ' ' + href)) out.push({ t: t.slice(0, 40), href });
    });
    return out.slice(0, 20);
  });
  console.log('candidates:', JSON.stringify(candidates, null, 1));

  // try clicking the first table row
  const clicked = await page.evaluate(() => {
    const r = document.querySelector('tbody tr');
    if (!r) return false;
    const a = r.querySelector('a[href]');
    if (a) { a.click(); return 'link'; }
    r.click(); return 'row';
  });
  await sleep(3500);
  console.log('row click:', clicked, '-> url:', page.url());

  const hasOdonto = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      mentionsOdontogram: /odontogram/i.test(body),
      headings: [...document.querySelectorAll('h1,h2,h3,button[role=tab],[role=tab]')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 25),
      svgCount: document.querySelectorAll('svg').length,
    };
  });
  console.log('page probe:', JSON.stringify(hasOdonto, null, 1));

  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
