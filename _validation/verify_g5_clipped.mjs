// READ-ONLY verification: G5. Overlap as a function of BOTH width and height,
// with clipping taken into account.
//
// The Stack sidebar is `position: sticky; top: 0; max-height: 100vh`. Two upstream
// rules combined to break the mid-size range:
//   1. `.article-page.has-toc .main-container { flex-direction: column }` (md..xl)
//      pushed the navigation *above* the article;
//   2. `overflow: visible` on the sidebar let the navigation paint outside its own box.
// Both are undone in assets/scss/site.scss, so this harness must now report zero
// *visible* collisions at every size.
//
// "Visible" matters: since the sidebar is now a scroll container (`overflow-y: auto`),
// ink that lies outside its client box is clipped away and never painted. Measuring
// raw ink rectangles alone would report those as false positives.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const PAGES = { home: '/', about: '/about/', cv: '/cv/', blog: '/blog/', gallery: '/gallery/' };
const SIZES = [];
for (const w of [360, 480, 640, 768, 820, 900, 1024, 1100, 1280, 1440, 1920]) {
  for (const h of [400, 500, 600, 700, 800, 900]) SIZES.push({ w, h });
}

const browser = await chromium.launch();
const rows = [];

for (const { w, h } of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const sb = document.querySelector('.left-sidebar');
      const main = document.querySelector('main.main');
      const s = sb.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      const cs = getComputedStyle(sb);

      // Clip box of the sidebar: its client area (padding box minus scrollbars).
      const clip = { x: s.x, y: s.y, right: s.right, bottom: s.bottom };

      const walker = document.createTreeWalker(sb, NodeFilter.SHOW_TEXT);
      const ink = [];
      let n;
      while ((n = walker.nextNode())) {
        if (!(n.nodeValue || '').trim()) continue;
        const p = n.parentElement;
        if (!p) continue;
        const pcs = getComputedStyle(p);
        if (pcs.display === 'none' || pcs.visibility === 'hidden') continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const r of Array.from(rg.getClientRects())) {
          if (r.width <= 1 || r.height <= 1) continue;
          ink.push({ x: r.x, y: r.y, right: r.right, bottom: r.bottom, text: (n.nodeValue || '').trim().slice(0, 30) });
        }
      }

      // Only ink that survives the sidebar's own clipping is actually painted.
      const painted = ink.filter(
        (k) => k.right > clip.x && k.x < clip.right && k.bottom > clip.y && k.y < clip.bottom
      );
      // ... and of that, the part that lands inside the article column.
      const hits = painted.filter(
        (k) => k.right > m.x && k.x < m.right && k.bottom > m.y && k.y < m.bottom
      );
      // Ink painted below the sidebar box but NOT clipped => real overflow.
      const unclippedSpill = painted.filter((k) => k.bottom > clip.bottom + 1);

      return {
        flexDir: getComputedStyle(document.querySelector('.main-container')).flexDirection,
        sbBox: { x: Math.round(s.x), y: Math.round(s.y), right: Math.round(s.right), bottom: Math.round(s.bottom), w: Math.round(s.width), h: Math.round(s.height) },
        mainBox: { x: Math.round(m.x), y: Math.round(m.y), right: Math.round(m.right), bottom: Math.round(m.bottom) },
        maxH: cs.maxHeight, pos: cs.position, overflow: cs.overflow,
        inkTotal: ink.length,
        painted: painted.length,
        hits: hits.slice(0, 8).map((k) => ({ text: k.text, x: Math.round(k.x), y: Math.round(k.y), right: Math.round(k.right), bottom: Math.round(k.bottom) })),
        hitsTotal: hits.length,
        spillTotal: unclippedSpill.length,
      };
    });
    rows.push({ w, h, page: key, ...r });
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(HERE, 'out_g5.json'), JSON.stringify(rows, null, 2));
const bad = rows.filter((r) => r.hitsTotal || r.spillTotal);
console.log(`samples=${rows.length}  VISIBLE-PROBLEMS=${bad.length}`);
for (const r of bad) {
  console.log(`${r.w}x${r.h} ${r.page.padEnd(8)} flex=${String(r.flexDir).padEnd(7)} hits=${r.hitsTotal} spill=${r.spillTotal} sb=${JSON.stringify(r.sbBox)} main=${JSON.stringify(r.mainBox)}`);
  for (const k of r.hits) console.log(`      OVERLAP-MAIN "${k.text}" rect=[${k.x},${k.y},${k.right},${k.bottom}]`);
}
const cols = [...new Set(rows.map((r) => r.flexDir))];
console.log(`\nflex-direction values seen: ${cols.join(', ')}`);
console.log(`overflow values seen: ${[...new Set(rows.map((r) => r.overflow))].join(', ')}`);
const mdRows = rows.filter((r) => r.w >= 768 && r.w < 1280);
console.log(`md..lg rows: ${mdRows.length}, with hits>0: ${mdRows.filter((r) => r.hitsTotal > 0).length}`);
