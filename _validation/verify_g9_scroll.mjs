// Scroll-aware overlap check: the left sidebar is sticky, so anything it paints
// outside its own column lands on the article as soon as the page is scrolled.
// For each viewport we capture the full viewport (A = normal, B = sidebar hidden)
// at several scroll offsets and diff the two images.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:1313/personal-site';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const CASES = [
  { page: 'about', w: 768, h: 400 },
  { page: 'about', w: 820, h: 500 },
  { page: 'about', w: 900, h: 500 },
  { page: 'about', w: 900, h: 700 },
  { page: 'cv', w: 768, h: 400 },
  { page: 'gallery', w: 768, h: 500 },
];

const browser = await chromium.launch();
const meta = [];

for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${c.page}/`, { waitUntil: 'networkidle' });
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (const sy of [0, 150, 300, 450, 600, 900].filter((v) => v <= Math.max(0, maxScroll))) {
    await page.evaluate((y) => window.scrollTo(0, y), sy);
    await page.waitForTimeout(150);
    const key = `${c.page}_${c.w}x${c.h}_s${sy}`;
    await page.screenshot({ path: path.join(OUT, `A_${key}.png`) });
    await page.addStyleTag({ content: '.left-sidebar, #toggle-menu { visibility: hidden !important; }' });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, `B_${key}.png`) });
    const geo = await page.evaluate(() => {
      const sb = document.querySelector('.left-sidebar');
      const m = document.querySelector('main.main');
      const menu = sb.querySelector('.menu');
      const s = sb.getBoundingClientRect();
      const mm = m.getBoundingClientRect();
      const mb = menu.getBoundingClientRect();
      return {
        sb: { x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.width), h: Math.round(s.height) },
        main: { x: Math.round(mm.x), y: Math.round(mm.y), w: Math.round(mm.width), h: Math.round(mm.height) },
        menu: { y: Math.round(mb.y), h: Math.round(mb.height), scroll: menu.scrollHeight, client: menu.clientHeight },
        dir: getComputedStyle(document.querySelector('.main-container')).flexDirection,
      };
    });
    meta.push({ key, ...c, sy, ...geo });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(HERE, 'out_g9_meta.json'), JSON.stringify(meta, null, 2));
console.log(`captured ${meta.length} pairs`);
for (const m of meta) {
  console.log(`${m.key.padEnd(26)} dir=${m.dir.padEnd(7)} sb=${JSON.stringify(m.sb)} main=${JSON.stringify(m.main)} menu(y${m.menu.y} h${m.menu.h} ${m.menu.scroll}/${m.menu.client})`);
}
