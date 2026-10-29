// READ-ONLY verification: G. Left-sidebar text vs. main-content overlap across viewport widths
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out_g.json');

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
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      const rect = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) };
      };
      const sb = document.querySelector('.left-sidebar');
      const main = document.querySelector('main.main');
      const mc = document.querySelector('main.main');
      const container = document.querySelector('.main-container');

      // every text-bearing node inside the left sidebar
      const textNodes = [];
      const collect = (sel) => Array.from(document.querySelectorAll(sel)).forEach((el) => {
        if (!vis(el)) return;
        const t = (el.textContent || '').trim();
        if (!t) return;
        textNodes.push({ sel, text: t.slice(0, 40), rect: rect(el) });
      });
      collect('.left-sidebar .site-name');
      collect('.left-sidebar .site-description');
      collect('.left-sidebar #main-menu a');
      collect('.left-sidebar #main-menu li');
      collect('.left-sidebar #dark-mode-toggle');

      const mainRect = rect(mc);

      // 1) geometric overlap: sidebar text box vs main content box
      const geoOverlaps = [];
      for (const n of textNodes) {
        if (!n.rect || !mainRect) continue;
        const hOverlap = n.rect.right > mainRect.x + 1 && n.rect.x < mainRect.right - 1;
        const vOverlap = n.rect.bottom > mainRect.y + 1 && n.rect.y < mainRect.bottom - 1;
        if (hOverlap && vOverlap) {
          geoOverlaps.push({ ...n, mainRect, overlapBy: n.rect.right - mainRect.x });
        }
      }

      // 2) hit test: is any point of the sidebar text covered by main content?
      const hitOverlaps = [];
      for (const n of textNodes) {
        if (!n.rect || !n.rect.w || !n.rect.h) continue;
        const stepX = Math.max(3, Math.floor(n.rect.w / 12));
        const stepY = Math.max(3, Math.floor(n.rect.h / 4));
        let covered = 0, total = 0, sample = null;
        for (let x = n.rect.x + 2; x < n.rect.right - 1; x += stepX) {
          for (let y = n.rect.y + 2; y < n.rect.bottom - 1; y += stepY) {
            const el = document.elementFromPoint(x, y);
            if (!el) continue;
            total++;
            const inMain = !!el.closest('main.main');
            const inSb = !!el.closest('.left-sidebar');
            if (inMain && !inSb) {
              covered++;
              if (!sample) sample = { x: Math.round(x), y: Math.round(y), tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 50) };
            }
          }
        }
        if (covered > 0) hitOverlaps.push({ ...n, covered, total, sample });
      }

      return {
        bodyClass: document.body.className,
        containerFlexDir: container ? getComputedStyle(container).flexDirection : null,
        sidebarDisplay: sb ? getComputedStyle(sb).display : null,
        sidebarRect: rect(sb),
        mainRect,
        sidebarWidth: sb ? getComputedStyle(sb).width : null,
        sidebarMaxWidth: sb ? getComputedStyle(sb).maxWidth : null,
        menuDisplay: (() => { const m = document.querySelector('#main-menu'); return m ? getComputedStyle(m).display : null; })(),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        geoOverlaps, hitOverlaps,
        textNodes,
      };
    });
    rows.push({ width, page: key, url: p, ...r });
  }
  await ctx.close();
}
await browser.close();

// ---- summary ----
const bad = rows.filter(r => r.geoOverlaps.length || r.hitOverlaps.length);
const summary = {
  widths: WIDTHS,
  pages: Object.keys(PAGES),
  samples: rows.length,
  overlapRows: bad.map(r => ({
    width: r.width, page: r.page, flexDir: r.containerFlexDir,
    sidebarW: r.sidebarRect ? r.sidebarRect.w : null,
    mainX: r.mainRect ? r.mainRect.x : null,
    geo: r.geoOverlaps.map(o => `${o.sel}:"${o.text}" right=${o.rect.right} overBy=${o.overlapBy}`),
    hit: r.hitOverlaps.map(o => `${o.sel}:"${o.text}" ${o.covered}/${o.total} -> ${JSON.stringify(o.sample)}`),
  })),
  overflowRows: rows.filter(r => r.overflowX).map(r => `${r.width} ${r.page} ${r.scrollWidth}>${r.clientWidth}`),
};

fs.writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\n--- per-width layout snapshot (home / about) ---');
for (const r of rows.filter(r => r.page === 'home' || r.page === 'about')) {
  const flag = (r.geoOverlaps.length || r.hitOverlaps.length) ? '  <<< OVERLAP' : '';
  console.log(`${String(r.width).padStart(4)} ${r.page.padEnd(7)} flex=${String(r.containerFlexDir).padEnd(8)} sidebarW=${String(r.sidebarRect ? r.sidebarRect.w : '-').padStart(4)} sidebarRight=${String(r.sidebarRect ? r.sidebarRect.right : '-').padStart(4)} mainX=${String(r.mainRect ? r.mainRect.x : '-').padStart(4)} mainRight=${String(r.mainRect ? r.mainRect.right : '-').padStart(4)}${flag}`);
}
