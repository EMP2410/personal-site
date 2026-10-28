// READ-ONLY verification: B (part 2) - enumerate EVERY element that actually uses
// --card-text-color-tertiary across all key pages and measure its contrast.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out_b2.json');

const PAGES = {
  home: '/', about: '/about/', cv: '/cv/', gallery: '/gallery/',
  blog: '/blog/', news: '/news/', archives: '/archives/',
  post: '/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/',
  newsitem: '/news/establishment-of-the-core-materials-and-physics-characterization-platform/',
};

const browser = await chromium.launch();
const all = [];

for (const mode of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((s) => { try { localStorage.setItem('StackColorScheme', s); } catch (e) {} }, mode);
  const page = await ctx.newPage();

  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE.replace(/\/$/, '') + p, { waitUntil: 'networkidle', timeout: 30000 });
    const r = await page.evaluate(() => {
      function parseColor(str) {
        if (!str) return null;
        str = str.trim();
        let m = str.match(/rgba?\(([^)]+)\)/);
        if (m) {
          const v = m[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
          return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
        }
        m = str.match(/^#([0-9a-f]{3,8})$/i);
        if (m) {
          let h = m[1];
          if (h.length === 3) h = h.split('').map(c => c + c).join('');
          if (h.length === 6) h += 'ff';
          if (h.length === 8) {
            return {
              r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16),
              b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255,
            };
          }
        }
        return null;
      }
      function effBg(el) {
        const chain = []; let n = el;
        while (n) {
          const c = parseColor(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0) { chain.push(c); if (c.a >= 1) break; }
          n = n.parentElement;
        }
        let base = { r: 255, g: 255, b: 255 };
        if (chain.length && chain[chain.length - 1].a >= 1) base = { ...chain[chain.length - 1] };
        for (let i = chain.length - 2; i >= 0; i--) {
          const c = chain[i];
          base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) };
        }
        return base;
      }
      function lum(c) {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      }
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

      const root = getComputedStyle(document.documentElement);
      const ter = parseColor(root.getPropertyValue('--card-text-color-tertiary'));
      const res = { tertiaryVar: root.getPropertyValue('--card-text-color-tertiary').trim(), users: [] };

      const seen = new Set();
      for (const el of document.querySelectorAll('body *')) {
        const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (!hasDirectText) continue;
        const cs = getComputedStyle(el);
        const c = parseColor(cs.color);
        if (!c || !ter) continue;
        if (Math.abs(c.r - ter.r) > 2 || Math.abs(c.g - ter.g) > 2 || Math.abs(c.b - ter.b) > 2 || Math.abs((c.a - ter.a) * 100) > 2) continue;
        const bg = effBg(el);
        const alpha = c.a * (parseFloat(cs.opacity) || 1);
        const fg = { r: c.r * alpha + bg.r * (1 - alpha), g: c.g * alpha + bg.g * (1 - alpha), b: c.b * alpha + bg.b * (1 - alpha) };
        const fs = parseFloat(cs.fontSize);
        const fw = parseInt(cs.fontWeight, 10) || 400;
        const key2 = el.tagName + '|' + (el.className || '') + '|' + Math.round(ratio(fg, bg) * 100);
        if (seen.has(key2)) continue;
        seen.add(key2);
        res.users.push({
          tag: el.tagName.toLowerCase(), cls: el.className || '',
          color: cs.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
          fontSize: fs, fontWeight: fw,
          isLarge: fs >= 24 || (fs >= 18.66 && fw >= 700),
          ratio: Math.round(ratio(fg, bg) * 100) / 100,
          text: (el.textContent || '').trim().slice(0, 50),
        });
      }
      // also the specific corrected selectors
      res.specific = {};
      for (const sel of ['.widget.archives span.count', '.widget.archives span.year', '.article-preview', '.archives-year .count']) {
        res.specific[sel] = Array.from(document.querySelectorAll(sel)).map(el => ({
          text: (el.textContent || '').trim().slice(0, 30),
          color: getComputedStyle(el).color,
        }));
      }
      return res;
    });

    for (const u of r.users) {
      const threshold = u.isLarge ? 3.0 : 4.5;
      all.push({ mode, page: key, url: p, ...u, threshold, pass: u.ratio >= threshold });
    }
    all.push({ mode, page: key, url: p, _specific: r.specific, tertiaryVar: r.tertiaryVar });
  }
  await ctx.close();
}

const users = all.filter(x => !x._specific);
const summary = {
  tertiaryUsers: users.length,
  pass: users.filter(u => u.pass).length,
  fail: users.filter(u => !u.pass).length,
  failures: users.filter(u => !u.pass).map(u => ({ mode: u.mode, page: u.page, sel: `${u.tag}.${u.cls}`, ratio: u.ratio, need: u.threshold, fg: u.color, bg: u.bg, text: u.text })),
  byMode: {
    light: { n: users.filter(u => u.mode === 'light').length, min: Math.min(...users.filter(u => u.mode === 'light').map(u => u.ratio)) },
    dark: { n: users.filter(u => u.mode === 'dark').length, min: Math.min(...users.filter(u => u.mode === 'dark').map(u => u.ratio)) },
  },
};

fs.writeFileSync(OUT, JSON.stringify({ summary, all }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\n--- TERTIARY USERS (unique by mode/page/selector) ---');
const seen = new Set();
for (const u of users) {
  const k = `${u.mode}|${u.tag}.${u.cls}`;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(`${u.pass ? 'PASS' : 'FAIL'} ${u.mode.padEnd(5)} ${u.tag}.${u.cls}`.padEnd(52) + ` ${u.ratio}:1 (need ${u.threshold}) fg=${u.color} bg=${u.bg} "${u.text}"`);
}
console.log('\n--- SPECIFIC SELECTOR PRESENCE ---');
for (const a of all.filter(x => x._specific)) {
  console.log(`\n[${a.mode} ${a.page}] tertiaryVar=${a.tertiaryVar}`);
  for (const [k, v] of Object.entries(a._specific)) {
    if (v.length) console.log(`   ${k}: ${v.length} -> ${JSON.stringify(v.slice(0, 4))}`);
  }
}

await browser.close();
