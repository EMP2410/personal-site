// READ-ONLY verification: G7. Pixel proof at the sizes that used to overlap.
// For every (page, width, height) we take two full-viewport screenshots:
//   A = as rendered
//   B = same page with the left sidebar hidden (visibility:hidden keeps the layout)
// If the navigation painted over the article, A and B differ inside the article's
// bounding box.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const CASES = [
  { page: 'about', url: '/about/', w: 768, h: 400 },
  { page: 'about', url: '/about/', w: 820, h: 500 },
  { page: 'about', url: '/about/', w: 900, h: 500 },
  { page: 'about', url: '/about/', w: 1024, h: 700 },
  { page: 'about', url: '/about/', w: 1280, h: 700 },
  { page: 'cv', url: '/cv/', w: 768, h: 400 },
  { page: 'cv', url: '/cv/', w: 900, h: 500 },
  { page: 'gallery', url: '/gallery/', w: 768, h: 400 },
  { page: 'blog', url: '/blog/', w: 768, h: 400 },
  { page: 'home', url: '/', w: 768, h: 400 },
];

const browser = await chromium.launch();
const meta = [];

for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h } });
  const page = await ctx.newPage();
  await page.goto(BASE + c.url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(250);

  const box = await page.evaluate(() => {
    const m = document.querySelector('main.main').getBoundingClientRect();
    return { x: Math.round(m.x), y: Math.round(m.y), w: Math.round(m.width), h: Math.round(m.height) };
  });

  const tag = `${c.page}_${c.w}x${c.h}`;
  await page.screenshot({ path: path.join(SHOTS, `G7A_${tag}.png`) });
  await page.addStyleTag({ content: '.left-sidebar, #toggle-menu { visibility: hidden !important; }' });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(SHOTS, `G7B_${tag}.png`) });

  meta.push({ tag, page: c.page, w: c.w, h: c.h, main: box });
  console.log(`captured ${tag}  main=${JSON.stringify(box)}`);
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(HERE, 'out_g7_meta.json'), JSON.stringify(meta, null, 2));
