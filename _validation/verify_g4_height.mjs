// READ-ONLY verification: G4. Overlap as a function of BOTH width and height.
// The Stack sidebar is `position: sticky; top: 0; max-height: 100vh` without
// `overflow: hidden`, so a short window can make the navigation spill out of its own
// box and paint on top of the article next to it.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const PAGES = { home: '/', about: '/about/', cv: '/cv/', blog: '/blog/' };
const SIZES = [];
for (const w of [768, 900, 1024, 1100, 1280, 1440, 1920]) {
  for (const h of [400, 500, 600, 700, 800, 900]) SIZES.push({ w, h });
}

const browser = await chromium.launch();
const rows = [];

for (const { w, h } of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const sb = document.querySelector('.left-sidebar');
      const main = document.querySelector('main.main');
      const s = sb.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      const cs = getComputedStyle(sb);

      // Ink of every text node in the sidebar, in viewport coordinates.
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
          if (r.width > 1 && r.height > 1) ink.push({ x: r.x, y: r.y, right: r.right, bottom: r.bottom, text: (n.nodeValue || '').trim().slice(0, 30) });
        }
      }

      // Does any sidebar ink fall inside the main column's box?
      const hits = ink.filter((k) => k.right > m.x && k.x < m.right && k.bottom > m.y && k.y < m.bottom);

      // Ink painted below the sidebar's own box (i.e. spilled out of it)
      const spilled = ink.filter((k) => k.bottom > s.bottom + 1);

      return {
        flexDir: getComputedStyle(document.querySelector('.main-container')).flexDirection,
        sbBox: { x: Math.round(s.x), y: Math.round(s.y), right: Math.round(s.right), bottom: Math.round(s.bottom), w: Math.round(s.width), h: Math.round(s.height) },
        maxH: cs.maxHeight, pos: cs.position, overflow: cs.overflow,
        mainBox: { x: Math.round(m.x), y: Math.round(m.y), right: Math.round(m.right), bottom: Math.round(m.bottom) },
        inkCount: ink.length,
        hits: hits.slice(0, 6).map((k) => ({ text: k.text, x: Math.round(k.x), y: Math.round(k.y), right: Math.round(k.right), bottom: Math.round(k.bottom) })),
        hitsTotal: hits.length,
        spilled: spilled.slice(0, 6).map((k) => ({ text: k.text, y: Math.round(k.y), bottom: Math.round(k.bottom), over: Math.round(k.bottom - s.bottom) })),
        spillTotal: spilled.length,
      };
    });
    rows.push({ w, h, page: key, ...r });
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(HERE, 'out_g4.json'), JSON.stringify(rows, null, 2));
const bad = rows.filter((r) => r.hitsTotal || r.spillTotal);
console.log(`samples=${rows.length}  problem=${bad.length}`);
console.log('\n--- problem rows ---');
for (const r of bad) {
  console.log(`${r.w}x${r.h} ${r.page.padEnd(7)} flex=${String(r.flexDir).padEnd(7)} sb=${JSON.stringify(r.sbBox)} maxH=${r.maxH} pos=${r.pos} ovf=${r.overflow} hits=${r.hitsTotal} spill=${r.spillTotal}`);
  for (const k of r.hits) console.log(`      OVERLAP-MAIN "${k.text}" rect=[${k.x},${k.y},${k.right},${k.bottom}]`);
  for (const k of r.spilled) console.log(`      SPILL      "${k.text}" bottom=${k.bottom} over=${k.over}px`);
}
console.log('\n--- sidebar box height vs 100vh (all rows, sb.h > vh) ---');
for (const r of rows) {
  if (r.sbBox.h > r.h) console.log(`  ${r.w}x${r.h} ${r.page} sb.h=${r.sbBox.h} > vh=${r.h} spill=${r.spillTotal}`);
}
