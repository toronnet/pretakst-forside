const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const fs = require('fs');
const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const exe = candidates.find(p => fs.existsSync(p));
if (!exe) { console.error('no chrome/edge found'); process.exit(1); }
(async () => {
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--no-sandbox'] });
  const url = process.argv[2] || 'http://localhost:8765/pretakst-forside.html';
  const outdir = process.argv[3] || 'assets/gen/shots';
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 3500));
    await page.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: `${outdir}/${name}-fold.png` });
    const full = `${outdir}/${name}-full.png`;
    await page.screenshot({ path: full, fullPage: true });
    const meta = await sharp(full).metadata();
    const slice = mobile ? 1400 : 1000;
    let i = 0;
    for (let y = 0; y < meta.height; y += slice, i++) {
      const hgt = Math.min(slice, meta.height - y);
      await sharp(full).extract({ left: 0, top: y, width: meta.width, height: hgt }).jpeg({ quality: 82 }).toFile(`${outdir}/${name}-${String(i + 1).padStart(2, '0')}.jpg`);
    }
    console.log(name, `${meta.width}x${meta.height}`, 'slices:', i);
    await page.close();
  }
  await browser.close();
  console.log('shots done with', exe);
})().catch(e => { console.error(e); process.exit(1); });
