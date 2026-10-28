// READ-ONLY verification: B. WCAG AA contrast in light and dark mode
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out_b.json');

const PAGES = {
  home: '/',
  about: '/about/',
  cv: '/cv/',
  gallery: '/gallery/',
  blog: '/blog/',
  news: '/news/',
  archives: '/archives/',
  post: '/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/',
  newsitem: '/news/establishment-of-the-core-materials-and-physics-characterization-platform/',
};

// [id, pageKey, selector, mode, expectedThreshold, label]
const TARGETS = [
  // --- B1: dark mode .home-intro p ---
  ['B1.1', 'home', '.home-intro p', 'dark', 4.5, 'dark: home intro paragraph'],
  ['B1.2', 'home', '.home-intro p', 'light', 4.5, 'light: home intro paragraph'],

  // --- B2: light mode sidebar / section-title / time / powerby ---
  ['B2.1', 'about', '.left-sidebar .site-description', 'light', 4.5, 'light: .site-description'],
  ['B2.2', 'about', '.left-sidebar .site-description', 'dark', 4.5, 'dark: .site-description'],
  ['B2.3', 'home', '.section-title', 'light', 4.5, 'light: .section-title'],
  ['B2.4', 'home', '.section-title', 'dark', 4.5, 'dark: .section-title'],
  ['B2.5', 'blog', '.article-time', 'light', 4.5, 'light: .article-time (list)'],
  ['B2.6', 'blog', '.article-time', 'dark', 4.5, 'dark: .article-time (list)'],
  ['B2.7', 'blog', 'time', 'light', 4.5, 'light: <time> element'],
  ['B2.8', 'blog', 'time', 'dark', 4.5, 'dark: <time> element'],
  ['B2.9', 'about', '.powerby', 'light', 4.5, 'light: .powerby'],
  ['B2.10', 'about', '.powerby', 'dark', 4.5, 'dark: .powerby'],
  ['B2.11', 'about', '.powerby a', 'light', 4.5, 'light: .powerby link'],
  ['B2.12', 'about', '.powerby a', 'dark', 4.5, 'dark: .powerby link'],
  ['B2.13', 'home', '.site-copyright, .copyright', 'light', 4.5, 'light: .copyright'],
  ['B2.14', 'home', '.site-copyright, .copyright', 'dark', 4.5, 'dark: .copyright'],

  // --- B3: light mode .home-hero__lede ---
  ['B3.1', 'home', '.home-hero__lede', 'light', 4.5, 'light: .home-hero__lede'],
  ['B3.2', 'home', '.home-hero__lede', 'dark', 4.5, 'dark: .home-hero__lede'],

  // --- B4: tertiary text colour ---
  ['B4.1', 'home', '.home-stat__label', 'dark', 4.5, 'dark: .home-stat__label (tertiary)'],
  ['B4.2', 'home', '.home-stat__label', 'light', 4.5, 'light: .home-stat__label (tertiary)'],
  ['B4.3', 'blog', '.article-preview', 'dark', 4.5, 'dark: .article-preview (tertiary)'],
  ['B4.4', 'blog', '.article-preview', 'light', 4.5, 'light: .article-preview (tertiary)'],
  ['B4.5', 'archives', '.widget .archives span.count', 'dark', 4.5, 'dark: archives span.count (tertiary)'],
  ['B4.6', 'archives', '.widget .archives span.count', 'light', 4.5, 'light: archives span.count (tertiary)'],
  ['B4.7', 'cv', '.widget .archives span.count', 'dark', 4.5, 'dark: cv widget count (tertiary)'],

  // --- B5: CV email link ---
  ['B5.1', 'cv', 'a[href^="mailto:"]', 'light', 4.5, 'light: CV mailto link'],
  ['B5.2', 'cv', 'a[href^="mailto:"]', 'dark', 4.5, 'dark: CV mailto link'],
  ['B5.3', 'cv', '.article-content a[href^="mailto:"]', 'light', 4.5, 'light: CV mailto link (in content)'],
  ['B5.4', 'cv', '.article-content a[href^="mailto:"]', 'dark', 4.5, 'dark: CV mailto link (in content)'],

  // --- extra: body text & headings sanity ---
  ['X.1', 'post', '.article-content p', 'light', 4.5, 'light: article body paragraph'],
  ['X.2', 'post', '.article-content p', 'dark', 4.5, 'dark: article body paragraph'],
  ['X.3', 'post', '.article-content h2', 'light', 3.0, 'light: article h2 (large text)'],
  ['X.4', 'post', '.article-content h2', 'dark', 3.0, 'dark: article h2 (large text)'],
  ['X.5', 'post', '.article-content a', 'light', 4.5, 'light: article body link'],
  ['X.6', 'post', '.article-content a', 'dark', 4.5, 'dark: article body link'],
  ['X.7', 'home', '.home-hero__title', 'light', 3.0, 'light: hero title'],
  ['X.8', 'home', '.home-hero__title', 'dark', 3.0, 'dark: hero title'],
  ['X.9', 'home', '.home-hero__eyebrow', 'light', 4.5, 'light: hero eyebrow'],
  ['X.10', 'home', '.home-hero__eyebrow', 'dark', 4.5, 'dark: hero eyebrow'],
  ['X.11', 'home', '.btn--primary', 'light', 4.5, 'light: primary button'],
  ['X.12', 'home', '.btn--primary', 'dark', 4.5, 'dark: primary button'],
  ['X.13', 'home', '.btn--ghost', 'light', 4.5, 'light: ghost button'],
  ['X.14', 'home', '.btn--ghost', 'dark', 4.5, 'dark: ghost button'],
];

const browser = await chromium.launch();
const results = [];

for (const mode of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((s) => {
    try { localStorage.setItem('StackColorScheme', s); } catch (e) { /* ignore */ }
  }, mode);
  const page = await ctx.newPage();

  // group targets by page to avoid re-navigating
  const byPage = {};
  for (const t of TARGETS.filter(t => t[3] === mode)) {
    (byPage[t[1]] ||= []).push(t);
  }

  for (const [pageKey, list] of Object.entries(byPage)) {
    const url = BASE.replace(/\/$/, '') + PAGES[pageKey];
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const actualScheme = await page.evaluate(() => document.documentElement.dataset.scheme);

    for (const [id, , selector, , threshold, label] of list) {
      const measured = await page.evaluate((sel) => {
        function parseColor(str) {
          if (!str) return null;
          const m = str.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
          if (p.length < 3) return null;
          return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        }
        function effBg(el) {
          const chain = [];
          let n = el;
          while (n) {
            const c = parseColor(getComputedStyle(n).backgroundColor);
            if (c && c.a > 0) {
              chain.push(c);
              if (c.a >= 1) break;
            }
            n = n.parentElement;
          }
          let base = { r: 255, g: 255, b: 255, a: 1 };
          if (chain.length && chain[chain.length - 1].a >= 1) {
            base = { ...chain[chain.length - 1], a: 1 };
          }
          for (let i = chain.length - 2; i >= 0; i--) {
            const c = chain[i];
            base = {
              r: c.r * c.a + base.r * (1 - c.a),
              g: c.g * c.a + base.g * (1 - c.a),
              b: c.b * c.a + base.b * (1 - c.a),
              a: 1,
            };
          }
          return base;
        }
        function lum(c) {
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        }
        function ratio(a, b) {
          const l1 = lum(a), l2 = lum(b);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        }
        const out = [];
        const els = Array.from(document.querySelectorAll(sel));
        for (const el of els) {
          const cs = getComputedStyle(el);
          const fg = parseColor(cs.color);
          if (!fg) continue;
          const bg = effBg(el);
          const op = parseFloat(cs.opacity);
          const alpha = fg.a * (isNaN(op) ? 1 : op);
          const eff = {
            r: fg.r * alpha + bg.r * (1 - alpha),
            g: fg.g * alpha + bg.g * (1 - alpha),
            b: fg.b * alpha + bg.b * (1 - alpha),
          };
          const fs = parseFloat(cs.fontSize);
          const fw = parseInt(cs.fontWeight, 10) || 400;
          const isLarge = fs >= 24 || (fs >= 18.66 && fw >= 700);
          out.push({
            text: (el.textContent || '').trim().slice(0, 45),
            fg: `rgb(${Math.round(eff.r)}, ${Math.round(eff.g)}, ${Math.round(eff.b)})`,
            bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
            rawColor: cs.color, rawBg: cs.backgroundColor, opacity: op,
            fontSize: fs, fontWeight: fw, isLarge,
            ratio: Math.round(ratio(eff, bg) * 100) / 100,
          });
        }
        return out;
      }, selector);

      const worst = measured.length ? measured.reduce((a, b) => (b.ratio < a.ratio ? b : a)) : null;
      results.push({
        id, page: pageKey, url, mode, selector, label, threshold,
        httpStatus: resp ? resp.status() : 0,
        actualScheme, matchCount: measured.length,
        worst, samples: measured.slice(0, 4),
      });
    }
  }
  await ctx.close();
}

const summary = {
  total: results.length,
  pass: results.filter(r => r.worst && r.worst.ratio >= r.threshold).length,
  fail: results.filter(r => !r.worst || r.worst.ratio < r.threshold).length,
  noMatch: results.filter(r => r.matchCount === 0).map(r => `${r.id} ${r.selector} @${r.page}`),
  schemeMismatch: results.filter(r => r.actualScheme !== r.mode).map(r => `${r.id} want=${r.mode} got=${r.actualScheme}`),
  failures: results.filter(r => !r.worst || r.worst.ratio < r.threshold).map(r => ({
    id: r.id, label: r.label, page: r.page, mode: r.mode, selector: r.selector,
    ratio: r.worst ? r.worst.ratio : null, threshold: r.threshold,
    fg: r.worst ? r.worst.fg : null, bg: r.worst ? r.worst.bg : null,
    text: r.worst ? r.worst.text : null, matchCount: r.matchCount,
  })),
};

fs.writeFileSync(OUT, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\n--- ALL RESULTS ---');
for (const r of results) {
  const v = r.worst ? `${r.worst.ratio}:1` : 'n/a';
  const st = r.worst && r.worst.ratio >= r.threshold ? 'PASS' : 'FAIL';
  console.log(`${st} ${r.id.padEnd(7)} ${r.mode.padEnd(5)} ${r.page.padEnd(9)} ${String(r.selector).padEnd(38)} ${v.padStart(8)} (need ${r.threshold}) n=${r.matchCount} fg=${r.worst ? r.worst.fg : '-'} bg=${r.worst ? r.worst.bg : '-'}`);
}

await browser.close();