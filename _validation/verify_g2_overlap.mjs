// READ-ONLY verification: G2. True *ink* overlap between the left sidebar and the main column.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out_g2.json');

const PAGES = {
  home: '/',
  about: '/about/',
  cv: '/cv/',
  gallery: '/gallery/',
  blog: '/blog/',
  post: '/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/',
};

const WIDTHS = [360, 390, 480, 600, 640, 700, 767, 768, 800, 860, 900, 960, 1000, 1023, 1024, 1100, 1200, 1279, 1280, 1366, 1440, 1536, 1920];

const browser = await chromium.launch();
const rows = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 });
    const r = await page.evaluate(() => {
      const box = (el) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
      };
      const visible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };

      const sb = document.querySelector('.left-sidebar');
      const main = document.querySelector('main.main');
      if (!sb || !main) return { error: 'missing sidebar/main' };

      // true ink rectangles of every text node inside the left sidebar
      const inkOf = (root) => {
        const out = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          const t = (n.nodeValue || '').trim();
          if (!t) continue;
          const parent = n.parentElement;
          if (!parent || !visible(parent)) continue;
          const rg = document.createRange();
          rg.selectNodeContents(n);
          for (const r of Array.from(rg.getClientRects())) {
            if (r.width < 1 || r.height < 1) continue;
            out.push({ text: t.slice(0, 45), tag: parent.tagName.toLowerCase(), cls: (parent.className || '').toString().slice(0, 40), x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height });
          }
        }
        return out;
      };

      const sbInk = inkOf(sb);
      const mainInk = inkOf(main);
      const sbBox = box(sb);
      const mainBox = box(main);
      const sbCS = getComputedStyle(sb);
      const sbPadRight = parseFloat(sbCS.paddingRight) || 0;

      const inter = (a, b) => {
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
        return { x, y, area: x * y };
      };

      // A) sidebar ink overlapping main ink
      const inkOverlaps = [];
      for (const s of sbInk) {
        for (const m of mainInk) {
          const i = inter(s, m);
          if (i.area > 4 && i.x > 0.5 && i.y > 0.5) {
            inkOverlaps.push({ sb: `${s.tag}.${s.cls}:"${s.text}"`, sbRect: [Math.round(s.x), Math.round(s.y), Math.round(s.right), Math.round(s.bottom)], main: `${m.tag}.${m.cls}:"${m.text}"`, mainRect: [Math.round(m.x), Math.round(m.y), Math.round(m.right), Math.round(m.bottom)], area: Math.round(i.area) });
          }
        }
      }

      // B) sidebar ink spilling out of the sidebar's own content box (root cause of A)
      const spills = sbInk.filter((s) => s.right > sbBox.right - sbPadRight + 1.5)
        .map((s) => ({ text: s.text, cls: s.cls, inkRight: Math.round(s.right), sbContentRight: Math.round(sbBox.right - sbPadRight), overBy: Math.round(s.right - (sbBox.right - sbPadRight)) }));

      // C) sidebar ink overlapping the main *box* (visual collision even if main text is elsewhere)
      const boxOverlaps = [];
      for (const s of sbInk) {
        const i = inter(s, mainBox);
        if (i.area > 4 && i.x > 0.5 && i.y > 0.5) {
          boxOverlaps.push({ text: s.text, cls: s.cls, ink: [Math.round(s.x), Math.round(s.y), Math.round(s.right), Math.round(s.bottom)], overBy: Math.round(s.right - mainBox.x) });
        }
      }

      return {
        flexDir: getComputedStyle(document.querySelector('.main-container')).flexDirection,
        sbBox: { x: Math.round(sbBox.x), right: Math.round(sbBox.right), w: Math.round(sbBox.w) },
        sbWidth: sbCS.width, sbMaxWidth: sbCS.maxWidth, sbOverflow: sbCS.overflow,
        mainBox: { x: Math.round(mainBox.x), right: Math.round(mainBox.right) },
        sbInkCount: sbInk.length, mainInkCount: mainInk.length,
        inkOverlaps: inkOverlaps.slice(0, 8), inkOverlapTotal: inkOverlaps.length,
        spills: spills.slice(0, 8), spillTotal: spills.length,
        boxOverlaps: boxOverlaps.slice(0, 8), boxOverlapTotal: boxOverlaps.length,
      };
    });
    rows.push({ width, page: key, url: p, ...r });
  }
  await ctx.close();
}
await browser.close();

const bad = rows.filter((r) => r.inkOverlapTotal || r.spillTotal || r.boxOverlapTotal);
const summary = {
  samples: rows.length,
  problemRows: bad.map((r) => ({
    width: r.width, page: r.page, flexDir: r.flexDir,
    sbBox: r.sbBox, mainBox: r.mainBox, sbMaxWidth: r.sbMaxWidth,
    spill: r.spills, ink: r.inkOverlaps, box: r.boxOverlaps,
  })),
};
fs.writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\n--- per-width snapshot ---');
for (const r of rows) {
  const flag = (r.inkOverlapTotal || r.spillTotal || r.boxOverlapTotal) ? '  <<< PROBLEM' : '';
  console.log(`${String(r.width).padStart(4)} ${r.page.padEnd(7)} flex=${String(r.flexDir).padEnd(8)} sb=${String(r.sbBox.x).padStart(4)}..${String(r.sbBox.right).padStart(4)} (w ${String(r.sbBox.w).padStart(3)}, max ${r.sbMaxWidth}) main=${String(r.mainBox.x).padStart(4)}..${String(r.mainBox.right).padStart(4)} spill=${r.spillTotal} inkOv=${r.inkOverlapTotal} boxOv=${r.boxOverlapTotal}${flag}`);
}
