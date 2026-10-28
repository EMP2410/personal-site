// READ-ONLY: C follow-ups — mobile hamburger reveal + inline <details> toggle interaction
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();

// --- mobile: hamburger reveals sidebar with menu + toggle, and items are clickable ---
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'cv/', { waitUntil: 'networkidle' });
  const before = await page.evaluate(() => {
    const sb = document.querySelector('.left-sidebar');
    const t = document.querySelector('#dark-mode-toggle');
    return {
      sidebarDisplay: getComputedStyle(sb).display,
      sidebarTransform: getComputedStyle(sb).transform,
      sidebarLeft: sb.getBoundingClientRect().left,
      toggleRect: t.getBoundingClientRect().toJSON(),
      hamburgerExists: !!document.querySelector('#toggle-menu'),
      hamburgerVisible: (() => { const h = document.querySelector('#toggle-menu'); const b = h.getBoundingClientRect(); return b.width > 0 && b.height > 0; })(),
    };
  });
  await page.locator('#toggle-menu').click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const sb = document.querySelector('.left-sidebar');
    const t = document.querySelector('#dark-mode-toggle');
    const menuLinks = Array.from(document.querySelectorAll('#main-menu a')).map(a => ({
      text: a.textContent.trim(), href: a.getAttribute('href'),
      visible: a.getBoundingClientRect().width > 0,
    }));
    const tb = t.getBoundingClientRect();
    const hit = document.elementFromPoint(tb.x + tb.width / 2, tb.y + tb.height / 2);
    return {
      sidebarTransform: getComputedStyle(sb).transform,
      sidebarLeft: Math.round(sb.getBoundingClientRect().left),
      toggleRect: { x: Math.round(tb.x), y: Math.round(tb.y), w: Math.round(tb.width), h: Math.round(tb.height) },
      toggleHit: hit ? { tag: hit.tagName.toLowerCase(), cls: (hit.className || '').toString() } : null,
      menuLinks,
      allMenuVisible: menuLinks.every(m => m.visible),
    };
  });
  // actually click a menu link after opening the menu
  let clickRes = { ok: false };
  try {
    await page.locator('#main-menu a[href="/personal-site/about/"]').click({ timeout: 5000 });
    await page.waitForLoadState('networkidle');
    clickRes = { ok: true, landed: page.url() };
  } catch (e) { clickRes = { ok: false, err: e.message.slice(0, 160) }; }
  console.log('MOBILE HAMBURGER:', JSON.stringify({ before, after, clickRes }, null, 2));
  await ctx.close();
}

// --- narrow: inline <details> summary is clickable and expands the TOC ---
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'cv/', { waitUntil: 'networkidle' });
  const pre = await page.evaluate(() => {
    const d = document.querySelector('details.article-toc-inline');
    const s = d.querySelector('summary');
    const b = s.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return {
      open: d.hasAttribute('open'),
      summaryText: s.textContent.trim(),
      summaryVisible: b.width > 0 && b.height > 0,
      summaryRect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
      summaryHit: hit ? { tag: hit.tagName.toLowerCase(), cls: (hit.className || '').toString(), isSummary: hit === s || s.contains(hit) } : null,
      tocLinksVisible: getComputedStyle(d.querySelector('.widget--toc')).display,
    };
  });
  await page.locator('details.article-toc-inline > summary').click();
  await page.waitForTimeout(300);
  const post = await page.evaluate(() => {
    const d = document.querySelector('details.article-toc-inline');
    const toc = d.querySelector('.widget--toc');
    const b = toc.getBoundingClientRect();
    return { open: d.hasAttribute('open'), tocVisible: b.height > 0, tocHeight: Math.round(b.height), linkCount: toc.querySelectorAll('a').length };
  });
  console.log('INLINE DETAILS:', JSON.stringify({ pre, post }, null, 2));
  await ctx.close();
}

// --- wide: right sidebar TOC links actually navigate to anchors ---
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'cv/', { waitUntil: 'networkidle' });
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('.right-sidebar .widget--toc a')).map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') })));
  let nav = { ok: false };
  try {
    await page.locator('.right-sidebar .widget--toc a').first().click({ timeout: 5000 });
    await page.waitForTimeout(400);
    nav = { ok: true, url: page.url(), hash: await page.evaluate(() => location.hash) };
  } catch (e) { nav = { ok: false, err: e.message.slice(0, 160) }; }
  console.log('RIGHT TOC:', JSON.stringify({ links, nav }, null, 2));
  await ctx.close();
}

await browser.close();
