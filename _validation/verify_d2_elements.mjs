import { chromium } from 'playwright';

const BASE = 'http://localhost:1313/personal-site';

function lum(rgb) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function parse(s) { const m = s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; }
function blend(fg, bg) {
  const m = fg.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map(Number);
  const a = p.length > 3 ? p[3] : 1;
  return [0, 1, 2].map((i) => p[i] * a + bg[i] * (1 - a));
}

const TARGETS = [
  { id: 'N5', page: '/cv/', sel: '.article-content table a[href^="mailto:"]', need: 4.5, label: 'CV mailto (table row)' },
  { id: 'N7', page: '/cv/', sel: '.article-content table a:not([href^="mailto:"])', need: 4.5, label: 'CV other table link' },
  { id: 'N8', page: '/about/', sel: '.site-name a', need: 3, label: 'sidebar site name' },
  { id: 'N9', page: '/about/', sel: '.menu a', need: 4.5, label: 'sidebar menu item' },
  { id: 'N11', page: '/about/', sel: '.widget.social a', need: 4.5, label: 'social widget link' },
  { id: 'N13', page: '/about/', sel: '.widget.tagCloud .tagCloud-tags a', need: 4.5, label: 'tag cloud tag' },
  { id: 'N14', page: '/blog/', sel: '.article-list--compact .article-title', need: 4.5, label: 'blog list title' },
  { id: 'N15', page: '/blog/', sel: '.article-list--compact .article-time', need: 4.5, label: 'blog list time' },
  { id: 'N16', page: '/about/', sel: '.widget-archive--list .count', need: 4.5, label: 'archives widget count' },
  { id: 'N17', page: '/about/', sel: '.widget-archive--list .year', need: 4.5, label: 'archives widget year' },
  { id: 'N18', page: '/cv/', sel: '.right-sidebar .widget--toc a', need: 4.5, label: 'right TOC link' },
  { id: 'N19', page: '/cv/', sel: '.article-content td', need: 4.5, label: 'CV table cell text' },
  { id: 'N20', page: '/cv/', sel: '.article-content th', need: 4.5, label: 'CV table header text' },
];

const browser = await chromium.launch();
const rows = [];

for (const mode of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript((m) => {
    try { localStorage.setItem('data-scheme', m); } catch (e) {}
  }, mode);

  const kill = async () => page.evaluate((m) => {
    document.documentElement.setAttribute('data-scheme', m);
    document.body.setAttribute('data-scheme', m);
    let s = document.getElementById('kill-transitions');
    if (!s) {
      s = document.createElement('style');
      s.id = 'kill-transitions';
      s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
      document.head.appendChild(s);
    }
  }, mode);

  let current = null;
  for (const t of TARGETS) {
    if (current !== t.page) {
      await page.goto(BASE + t.page, { waitUntil: 'networkidle' });
      await kill();
      await page.waitForTimeout(350);
      current = t.page;
    }

    const res = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { missing: true };
      const cs = getComputedStyle(el);
      let node = el, bg = [255, 255, 255];
      while (node && node !== document.documentElement) {
        const b = getComputedStyle(node).backgroundColor;
        const p = b.match(/rgba?\(([^)]+)\)/);
        if (p) {
          const parts = p[1].split(',').map(Number);
          const a = parts.length > 3 ? parts[3] : 1;
          if (a >= 0.95) { bg = parts.slice(0, 3); break; }
        }
        node = node.parentElement;
      }
      return { fgRaw: cs.color, bg, text: (el.textContent || '').trim().slice(0, 40) };
    }, t.sel);

    if (res.missing) { rows.push({ mode, id: t.id, label: t.label, ratio: null, note: 'selector not found' }); continue; }
    let fg = parse(res.fgRaw);
    if (/rgba/.test(res.fgRaw)) fg = blend(res.fgRaw, res.bg);
    const r = ratio(fg, res.bg);
    rows.push({
      mode, id: t.id, label: t.label, ratio: Number(r.toFixed(2)), need: t.need,
      fg: res.fgRaw, bg: `rgb(${res.bg.join(',')})`, text: res.text,
      verdict: r >= t.need ? 'PASS' : 'FAIL',
    });
  }
  await ctx.close();
}
await browser.close();

let pass = 0, fail = 0, miss = 0;
for (const r of rows) {
  if (r.ratio === null) { miss++; console.log(`MISS  ${r.mode.padEnd(5)} ${r.id} ${r.label.padEnd(28)} selector not found`); continue; }
  if (r.verdict === 'PASS') pass++; else fail++;
  console.log(`${r.verdict.padEnd(5)} ${r.mode.padEnd(5)} ${r.id} ${r.label.padEnd(28)} ${String(r.ratio).padStart(6)}:1 (need ${r.need})  fg=${r.fg} bg=${r.bg}  "${r.text}"`);
}
console.log(`\nTOTAL ${rows.length}  pass ${pass}  fail ${fail}  miss ${miss}`);