import { chromium } from 'playwright';

const BASE = 'http://localhost:1313/personal-site';
const PAGES = [
  '/', '/about/', '/cv/', '/gallery/', '/blog/', '/news/', '/archives/', '/search/',
  '/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/',
  '/blog/training-at-the-beamline-sending-students-to-csns-isis-and-soleil/',
  '/blog/neutrons-x-rays-and-the-question-of-what-a-battery-is-actually-doing/',
  '/news/establishment-of-the-core-materials-and-physics-characterization-platform/',
  '/news/2026-hong-kong-forum-on-neutron-scattering-711-december-at-cityu/',
];

const browser = await chromium.launch();
const consoleErrors = [], failedRequests = [], overflow = [], mojibake = [];
const out = { consoleErrors, failedRequests, overflow, mojibake, gallery: {}, photoswipe: {}, search: {}, rss: {}, darkPersist: null, status: {} };

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text()}`); });
page.on('requestfailed', (r) => failedRequests.push(`${page.url()} :: ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${page.url()} :: ${r.url()} :: HTTP ${r.status()}`); });

// 1. every page: load, check status, overflow, mojibake
for (const p of PAGES) {
  const resp = await page.goto(BASE + p, { waitUntil: 'networkidle' });
  out.status[p] = resp?.status();
  const ov = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  if (ov.sw > ov.cw + 1) overflow.push(`${p}: scrollWidth=${ov.sw} clientWidth=${ov.cw}`);
  const body = await page.evaluate(() => document.body.innerText);
  const bad = body.match(/[�]|Ã[\x80-\xbf]|â€|ï¿½/g);
  if (bad) mojibake.push(`${p}: ${bad.slice(0, 5).join(',')}`);
}

// 2. gallery structure
await page.goto(BASE + '/gallery/', { waitUntil: 'networkidle' });
out.gallery = await page.evaluate(() => {
  const gs = document.querySelectorAll('.gallery');
  const figs = document.querySelectorAll('.gallery figure');
  const grid = getComputedStyle(gs[0]);
  return {
    galleryContainers: gs.length,
    figures: figs.length,
    display: grid.display,
    columns: grid.gridTemplateColumns.split(' ').length,
    captionsVisible: [...figs].filter((f) => f.querySelector('figcaption') && f.querySelector('figcaption').getBoundingClientRect().height > 0).length,
    imagesLoaded: [...figs].filter((f) => { const i = f.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }).length,
    srcset: document.querySelector('.gallery figure img')?.getAttribute('srcset') || null,
  };
});

// 3. PhotoSwipe
await page.click('.gallery figure a');
await page.waitForTimeout(1200);
out.photoswipe = await page.evaluate(() => {
  const root = document.querySelector('.pswp');
  const counter = document.querySelector('.pswp__counter');
  const cap = document.querySelector('.pswp__caption');
  return {
    open: !!root && root.classList.contains('pswp--open'),
    visible: !!root && root.classList.contains('pswp--visible'),
    counter: counter ? counter.textContent.trim() : null,
    caption: cap ? cap.textContent.trim().slice(0, 50) : null,
  };
});
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 4. search
await page.goto(BASE + '/search/', { waitUntil: 'networkidle' });
await page.fill('.search-form input[name="keyword"]', 'neutron').catch((e) => { console.error('fill failed', e.message); });
await page.waitForTimeout(2000);
out.search = await page.evaluate(() => ({
  marks: document.querySelectorAll('.search-result--list mark').length,
  results: document.querySelectorAll('.search-result--list > *').length,
  title: document.querySelector('.search-result--title')?.textContent?.trim() || null,
  previews: [...document.querySelectorAll('.search-result--list .article-preview')].length,
}));
const idx = await page.evaluate(async (b) => {
  const r = await fetch(b + '/search/index.json');
  return { status: r.status, len: (await r.text()).length };
}, BASE);
out.search.indexJson = idx;

// 5. RSS
const rss = await page.evaluate(async (b) => {
  const r = await fetch(b + '/index.xml');
  const t = await r.text();
  return { status: r.status, hasEditor: /<managingEditor>/.test(t), items: (t.match(/<item>/g) || []).length };
}, BASE);
out.rss = rss;

// 6. dark mode persistence — click the real toggle, then reload
await page.goto(BASE + '/cv/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('StackColorScheme', 'dark'));
await page.reload({ waitUntil: 'networkidle' });
const persisted = await page.evaluate(() => ({
  scheme: document.documentElement.dataset.scheme,
  ls: localStorage.getItem('StackColorScheme'),
}));
await page.click('#dark-mode-toggle');
await page.waitForTimeout(600);
const afterToggle = await page.evaluate(() => ({
  scheme: document.documentElement.dataset.scheme,
  ls: localStorage.getItem('StackColorScheme'),
}));
await page.reload({ waitUntil: 'networkidle' });
const afterReload = await page.evaluate(() => ({
  scheme: document.documentElement.dataset.scheme,
  ls: localStorage.getItem('StackColorScheme'),
}));
out.darkPersist = { persisted, afterToggle, afterReload };

await ctx.close();
await browser.close();

console.log(JSON.stringify(out, null, 2));
