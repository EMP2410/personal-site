// READ-ONLY verification: G3. Pixel-level proof of sidebar/main overlap.
// Strategy: screenshot the page, then screenshot it again with the left sidebar made
// invisible (visibility:hidden keeps its box, so the layout does not shift).
// Any pixel that changes inside the main column's bounding box was painted by the
// sidebar, i.e. the navigation is drawn on top of the article.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PAGES = {
  home: '/',
  about: '/about/',
  cv: '/cv/',
  gallery: '/gallery/',
  blog: '/blog/',
};

const WIDTHS = [700, 768, 820, 900, 960, 1023, 1024, 1100, 1200, 1279, 1280, 1440];

const browser = await chromium.launch();
const meta = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);

    const geom = await page.evaluate(() => {
      const main = document.querySelector('main.main');
      const sb = document.querySelector('.left-sidebar');
      const m = main.getBoundingClientRect();
      const s = sb.getBoundingClientRect();
      return {
        main: { x: m.x + window.scrollX, y: m.y + window.scrollY, w: m.width, h: m.height },
        sb: { x: s.x + window.scrollX, y: s.y + window.scrollY, w: s.width, h: s.height },
        scrollH: document.documentElement.scrollHeight,
        flexDir: getComputedStyle(document.querySelector('.main-container')).flexDirection,
      };
    });

    const name = `${key}_${width}`;
    await page.screenshot({ path: path.join(SHOTS, `A_${name}.png`), fullPage: true });

    await page.addStyleTag({ content: '.left-sidebar, #toggle-menu { visibility: hidden !important; }' });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, `B_${name}.png`), fullPage: true });

    meta.push({ name, page: key, url: p, width, ...geom });
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(HERE, 'out_g3_meta.json'), JSON.stringify(meta, null, 2));
console.log(`captured ${meta.length} pairs`);
