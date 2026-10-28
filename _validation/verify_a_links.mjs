// READ-ONLY verification: A. internal link prefixes + all internal links return 200
import { chromium } from 'playwright';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const BASE = 'http://localhost:1313/personal-site/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out_a.json');

const PAGES = [
  '/', '/about/', '/cv/', '/gallery/', '/blog/', '/news/', '/archives/', '/search/',
  '/categories/', '/tags/',
  '/blog/neutrons-x-rays-and-the-question-of-what-a-battery-is-actually-doing/',
  '/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/',
  '/blog/training-at-the-beamline-sending-students-to-csns-isis-and-soleil/',
  '/news/2026-hong-kong-forum-on-neutron-scattering-711-december-at-cityu/',
  '/news/in-situ-experiments-at-csns-spring-8-and-soleil/',
  '/news/invited-lectures-in-suzhou-quanzhou-and-ningde/',
  '/news/guangdonghong-kong-universities-1-1-1-joint-funding-scheme-award/',
  '/news/establishment-of-the-core-materials-and-physics-characterization-platform/',
  '/news/memorandum-of-understanding-signed-with-the-university-of-cambridge/',
  '/news/jc-stem-lab-of-energy-and-materials-physics-officially-launched/',
];

const isExternal = (attrHref, rawUrl, pageOrigin) => {
  const h = (attrHref || '').trim();
  if (!h) return true;
  if (/^(mailto:|tel:|javascript:|data:)/i.test(h)) return true;
  if (h.startsWith('#')) return false;              // same-page anchor -> internal
  if (/^\/\//.test(h)) return true;                  // protocol-relative -> external
  if (/^https?:\/\//i.test(h)) {
    try { return new URL(h).origin !== pageOrigin; } catch { return true; }
  }
  // relative or root-relative: internal
  return false;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const report = { pages: [], summary: {} };
const allBadPrefix = [];
const allInternalHrefs = new Set();
const statusResults = [];

for (const p of PAGES) {
  const url = BASE.replace(/\/$/, '') + p;
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const pageStatus = resp ? resp.status() : 0;

  const links = await page.$$eval('a[href]', (els) =>
    els.map((e) => ({
      href: e.getAttribute('href'),
      raw: e.href,
      text: (e.textContent || '').trim().slice(0, 60),
      cls: e.className || '',
    }))
  );

  const pageOrigin = new URL(url).origin;
  const bad = [];
  const good = [];
  const ext = [];
  for (const l of links) {
    if (!l.href) continue;
    if (isExternal(l.href, l.raw, pageOrigin)) { ext.push(l); continue; }
    // internal: resolve against the page URL
    let resolved;
    try { resolved = new URL(l.raw, url); } catch { resolved = null; }
    if (!resolved) { bad.push({ ...l, resolved: 'UNPARSEABLE' }); continue; }
    const pathname = resolved.pathname + resolved.search + resolved.hash;
    if (!pathname.startsWith('/personal-site/')) {
      bad.push({ ...l, resolved: pathname });
      allBadPrefix.push({ page: p, href: l.href, resolved: pathname, text: l.text });
    } else {
      good.push(pathname);
      allInternalHrefs.add(pathname);
    }
  }

  report.pages.push({
    page: p, url, pageStatus, totalA: links.length,
    internal: good.length, external: ext.length, badPrefix: bad.length,
    badSample: bad.slice(0, 12),
    externalSample: ext.map(e => e.href).slice(0, 20),
  });
}

// Now check every unique internal href returns 200
const hrefs = [...allInternalHrefs].filter(h => !h.startsWith('#')).sort();
for (const h of hrefs) {
  const u = BASE.replace(/\/$/, '') + h.replace(/^\/personal-site/, '');
  try {
    const r = await ctx.request.get(u, { timeout: 20000 });
    statusResults.push({ href: h, status: r.status() });
  } catch (e) {
    statusResults.push({ href: h, status: 0, error: String(e.message || e) });
  }
}

// left sidebar menu links specifically
await page.goto(BASE, { waitUntil: 'networkidle' });
const sidebar = await page.$$eval('#main-menu a, .left-sidebar .menu a', (els) =>
  els.map(e => ({ text: (e.textContent || '').trim(), href: e.getAttribute('href'), raw: e.href }))
);
const darkToggle = await page.$('#dark-mode-toggle');

// relref links from blog posts
const relrefChecks = [];
for (const [src, expectText] of [
  ['/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/', 'Characterisation Platform'],
  ['/blog/training-at-the-beamline-sending-students-to-csns-isis-and-soleil/', 'Hong Kong Forum on Neutron Scattering'],
]) {
  await page.goto(BASE.replace(/\/$/, '') + src, { waitUntil: 'networkidle' });
  const found = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.article-content a')).map(e => ({
      text: (e.textContent || '').trim(), href: e.getAttribute('href'), raw: e.href,
    }))
  );
  const st = [];
  for (const f of found) {
    const r = await ctx.request.get(f.raw, { timeout: 20000 });
    st.push({ ...f, status: r.status() });
  }
  relrefChecks.push({ source: src, expectedText: expectText, allArticleLinks: st });
}

report.summary = {
  pagesChecked: PAGES.length,
  totalLinks: report.pages.reduce((a, b) => a + b.totalA, 0),
  totalInternal: report.pages.reduce((a, b) => a + b.internal, 0),
  totalExternal: report.pages.reduce((a, b) => a + b.external, 0),
  badPrefixTotal: allBadPrefix.length,
  uniqueInternalHrefs: hrefs.length,
  status200: statusResults.filter(s => s.status === 200).length,
  statusNon200: statusResults.filter(s => s.status !== 200).length,
  non200List: statusResults.filter(s => s.status !== 200),
};
report.badPrefixList = allBadPrefix;
report.statusResults = statusResults;
report.sidebarMenu = sidebar;
report.darkTogglePresent = !!darkToggle;
report.relrefChecks = relrefChecks;

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log('SIDEBAR:', JSON.stringify(sidebar, null, 2));
console.log('RELREF:', JSON.stringify(relrefChecks, null, 2));
console.log('BADPREFIX:', JSON.stringify(allBadPrefix.slice(0, 40), null, 2));

await browser.close();
