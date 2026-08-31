const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Users\\RIFE\\.cache\\puppeteer\\chrome\\win64-150.0.7871.24\\chrome-win64\\chrome.exe';
const BASE = 'https://demo-dokter-gigi.nusawebsite.com';
const OUT = path.join(process.cwd(), 'shots');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1920,1080', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

  console.log('-> login');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(1500);

  // click the "Admin" demo quick-login card with a real mouse click, let React settle
  const buttons = await page.$$('button');
  let adminBtn = null;
  for (const b of buttons) {
    const t = await b.evaluate((el) => (el.textContent || '').trim());
    if (/admin@klinik/i.test(t) || /^\W*Admin\b/i.test(t)) { adminBtn = b; break; }
  }
  if (!adminBtn) throw new Error('Admin quick-login button not found');
  await adminBtn.click();
  console.log('   quick-login admin clicked');
  await sleep(2000);

  const emailVal = await page.$eval('input[type=email], input[name=email]', (el) => el.value).catch(() => '');
  console.log('   email field now:', emailVal || '(empty)');

  const submitBtn = await page.$('button[type=submit]');
  if (!submitBtn) throw new Error('submit button not found');
  await submitBtn.click();

  await page.waitForFunction(
    () => /dashboard|admin/i.test(location.pathname),
    { timeout: 60000 }
  );
  await sleep(4000);
  console.log('   landed on', page.url());

  // enumerate sidebar navigation
  const navItems = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('a[href], nav button, aside button').forEach((el) => {
      const label = (el.textContent || '').trim().replace(/\s+/g, ' ');
      const href = el.getAttribute('href') || '';
      if (!label || label.length > 40) return;
      const key = label + '|' + href;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label, href });
    });
    return out;
  });
  fs.writeFileSync(path.join(OUT, '_nav.json'), JSON.stringify(navItems, null, 2));
  console.log('-> nav items found:', navItems.length);
  navItems.forEach((n) => console.log('   ', n.label, '=>', n.href));

  const shot = async (name) => {
    const f = path.join(OUT, name + '.png');
    await page.screenshot({ path: f, fullPage: false });
    const kb = (fs.statSync(f).size / 1024).toFixed(0);
    console.log('   [shot]', name + '.png', kb + ' KB');
  };

  await shot('01-dashboard');

  // visit each nav route that lives under the app
  const routes = navItems.filter((n) => n.href && n.href.startsWith('/') && n.href !== '/login' && n.href !== '/');
  let i = 2;
  for (const r of routes) {
    const slug = r.href.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    try {
      await page.goto(BASE + r.href, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2500);
      await shot(String(i).padStart(2, '0') + '-' + slug);
      i++;
    } catch (e) {
      console.log('   [skip]', r.href, e.message.slice(0, 60));
    }
  }

  await browser.close();
  console.log('\nDONE. Files in', OUT);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
