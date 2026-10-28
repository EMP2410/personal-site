// READ-ONLY verification: C. Navigation, sidebar, TOC, dark-mode toggle, horizontal overflow
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:1313/personal-site/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out_c.json');

const PAGES = {
  about: '/about/',
  cv: '/cv/',
  gallery: '/gallery/',
  blog: '/blog/',
  news: '/news/',
  post: '/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/',
  newsitem: '/news/establishment-of-the-core-materials-and-physics-characterization-platform/',
  home: '/',
  archives: '/archives/',
  search: '/search/',
};

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 900, height: 900 };
const MOBILE = { width: 390, height: 844 };

const browser = await chromium.launch();
const report = { sidebar: [], toc: [], toggle: [], overflow: [] };

// ---------- C1 + C4: sidebar presence & overflow at 3 widths ----------
for (const [vpName, vp] of [['wide-1440', WIDE], ['narrow-900', NARROW], ['mobile-390', MOBILE]]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE.replace(/\/$/, '') + p, { waitUntil: 'networkidle', timeout: 30000 });
    const r = await page.evaluate(() => {
      const sb = document.querySelector('.left-sidebar');
      const menu = document.querySelector('#main-menu');
      const toggle = document.querySelector('#dark-mode-toggle');
      const avatar = document.querySelector('.site-avatar img, .site-avatar .emoji');
      const siteName = document.querySelector('.site-name');
      const menuLinks = menu ? Array.from(menu.querySelectorAll('a')).map(a => ({
        text: (a.textContent || '').trim(), href: a.getAttribute('href'),
      })) : [];
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      // element at centre of the menu item / toggle -> is it covered by something else?
      const topEl = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return t ? { tag: t.tagName.toLowerCase(), cls: t.className || '', id: t.id || '' } : null;
      };
      const firstMenuA = menu ? menu.querySelector('a') : null;
      return {
        hasSidebar: !!sb,
        sidebarVisible: vis(sb),
        sidebarDisplay: sb ? getComputedStyle(sb).display : null,
        sidebarFlexDisplay: sb ? getComputedStyle(sb).flexDirection : null,
        hasAvatar: !!avatar, avatarVisible: vis(avatar),
        hasSiteName: !!siteName, siteNameText: siteName ? siteName.textContent.trim() : null,
        hasMenu: !!menu, menuLinks, menuLinkCount: menuLinks.length,
        hasToggle: !!toggle, toggleVisible: vis(toggle),
        toggleText: toggle ? (toggle.textContent || '').trim() : null,
        bodyClass: document.body.className,
        // overflow
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        overflowingElements: Array.from(document.querySelectorAll('body *')).filter(el => {
          const b = el.getBoundingClientRect();
          return b.right > document.documentElement.clientWidth + 1 || b.left < -1;
        }).slice(0, 6).map(el => ({
          tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60),
          right: Math.round(el.getBoundingClientRect().right),
          left: Math.round(el.getBoundingClientRect().left),
        })),
        // hit test
        firstMenuHitTarget: topEl(firstMenuA),
        toggleHitTarget: topEl(toggle),
      };
    });
    report.sidebar.push({ viewport: vpName, page: key, url: p, ...r });
    report.overflow.push({ viewport: vpName, page: key, scrollWidth: r.scrollWidth, clientWidth: r.clientWidth, overflow: r.overflowX, offenders: r.overflowingElements });
  }
  await ctx.close();
}

// ---------- C2: TOC placement at wide vs narrow ----------
{
  const ctx = await browser.newContext({ viewport: WIDE });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE.replace(/\/$/, '') + p, { waitUntil: 'networkidle', timeout: 30000 });
    const r = await page.evaluate(() => {
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      const rs = document.querySelector('.right-sidebar');
      const rsToc = document.querySelector('.right-sidebar .widget--toc');
      const inline = document.querySelector('details.article-toc-inline');
      const summary = inline ? inline.querySelector('summary') : null;
      const inlineToc = inline ? inline.querySelector('.widget--toc') : null;
      const links = rsToc ? Array.from(rsToc.querySelectorAll('a')).map(a => (a.textContent || '').trim()) : [];
      const ilinks = inlineToc ? Array.from(inlineToc.querySelectorAll('a')).map(a => (a.textContent || '').trim()) : [];
      const sb = summary ? summary.getBoundingClientRect() : null;
      return {
        hasRightSidebar: !!rs, rightSidebarVisible: vis(rs),
        rsTocPresent: !!rsToc, rsTocVisible: vis(rsToc), rsTocLinks: links.length, rsTocSample: links.slice(0, 5),
        inlinePresent: !!inline, inlineVisible: vis(inline), inlineOpen: inline ? inline.hasAttribute('open') : null,
        summaryPresent: !!summary, summaryVisible: vis(summary),
        summaryText: summary ? summary.textContent.trim() : null,
        summaryRect: sb ? { x: Math.round(sb.x), y: Math.round(sb.y), w: Math.round(sb.width), h: Math.round(sb.height) } : null,
        inlineTocLinks: ilinks.length, inlineTocSample: ilinks.slice(0, 5),
        summaryHitTarget: summary ? (() => {
          const b = summary.getBoundingClientRect();
          const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return t ? { tag: t.tagName.toLowerCase(), cls: t.className.toString() } : null;
        })() : null,
      };
    });
    report.toc.push({ viewport: 'wide-1440', page: key, url: p, ...r });
  }
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: NARROW });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    await page.goto(BASE.replace(/\/$/, '') + p, { waitUntil: 'networkidle', timeout: 30000 });
    const r = await page.evaluate(() => {
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      const rs = document.querySelector('.right-sidebar');
      const rsToc = document.querySelector('.right-sidebar .widget--toc');
      const inline = document.querySelector('details.article-toc-inline');
      const summary = inline ? inline.querySelector('summary') : null;
      const inlineToc = inline ? inline.querySelector('.widget--toc') : null;
      const sb = summary ? summary.getBoundingClientRect() : null;
      return {
        hasRightSidebar: !!rs, rightSidebarVisible: vis(rs),
        rsTocPresent: !!rsToc, rsTocVisible: vis(rsToc),
        inlinePresent: !!inline, inlineVisible: vis(inline), inlineOpen: inline ? inline.hasAttribute('open') : null,
        summaryPresent: !!summary, summaryVisible: vis(summary),
        summaryText: summary ? summary.textContent.trim() : null,
        summaryRect: sb ? { x: Math.round(sb.x), y: Math.round(sb.y), w: Math.round(sb.width), h: Math.round(sb.height) } : null,
        inlineTocLinks: inlineToc ? inlineToc.querySelectorAll('a').length : 0,
        summaryHitTarget: summary ? (() => {
          const b = summary.getBoundingClientRect();
          const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return t ? { tag: t.tagName.toLowerCase(), cls: t.className.toString() } : null;
        })() : null,
      };
    });
    report.toc.push({ viewport: 'narrow-900', page: key, url: p, ...r });
  }
  await ctx.close();
}

// ---------- C3: dark-mode toggle actually clickable & works on /cv/ ----------
{
  const ctx = await browser.newContext({ viewport: WIDE });
  const page = await ctx.newPage();
  for (const p of ['/cv/', '/about/', '/gallery/', '/blog/element-by-element-what-xafs-tells-you-that-a-diffractometer-cannot/', '/news/establishment-of-the-core-materials-and-physics-characterization-platform/']) {
    await page.goto(BASE.replace(/\/$/, '') + p, { waitUntil: 'networkidle', timeout: 30000 });
    const before = await page.evaluate(() => ({
      scheme: document.documentElement.dataset.scheme,
      ls: localStorage.getItem('StackColorScheme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
    }));
    // click the menu link (first one) to prove the sidebar is interactive
    let menuClick = { ok: false };
    try {
      const link = page.locator('#main-menu a').first();
      const href = await link.getAttribute('href');
      await link.click({ timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 20000 });
      menuClick = { ok: true, href, landedOn: page.url() };
    } catch (e) { menuClick = { ok: false, error: String(e.message).slice(0, 200) }; }

    // back and toggle dark mode
    await page.goto(BASE.replace(/\/$/, '') + p, { waitUntil: 'networkidle', timeout: 30000 });
    const toggle = page.locator('#dark-mode-toggle');
    let toggleClick = { ok: false };
    try {
      const box = await toggle.boundingBox();
      await toggle.click({ timeout: 5000 });
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => ({
        scheme: document.documentElement.dataset.scheme,
        ls: localStorage.getItem('StackColorScheme'),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
      }));
      toggleClick = { ok: true, box, after, changed: after.scheme !== before.scheme || after.bodyBg !== before.bodyBg };
    } catch (e) { toggleClick = { ok: false, error: String(e.message).slice(0, 200) }; }

    report.toggle.push({ url: p, before, menuClick, toggleClick });
  }
  await ctx.close();
}

// summary
const sum = {
  sidebarPages: report.sidebar.length,
  sidebarMissing: report.sidebar.filter(s => !s.hasSidebar).map(s => `${s.viewport} ${s.page}`),
  sidebarHidden: report.sidebar.filter(s => s.hasSidebar && !s.sidebarVisible).map(s => `${s.viewport} ${s.page}`),
  menuLinkIssues: report.sidebar.filter(s => s.menuLinkCount !== 6).map(s => `${s.viewport} ${s.page}: ${s.menuLinkCount} links`),
  menuPrefixIssues: report.sidebar.filter(s => s.menuLinks.some(l => !l.href || !l.href.startsWith('/personal-site/'))).map(s => `${s.viewport} ${s.page}`),
  missingToggle: report.sidebar.filter(s => !s.hasToggle).map(s => `${s.viewport} ${s.page}`),
  hiddenToggle: report.sidebar.filter(s => s.hasToggle && !s.toggleVisible).map(s => `${s.viewport} ${s.page}`),
  overflowIssues: report.overflow.filter(o => o.overflow).map(o => `${o.viewport} ${o.page}: ${o.scrollWidth}>${o.clientWidth} ${JSON.stringify(o.offenders)}`),
  tocWide: report.toc.filter(t => t.viewport === 'wide-1440').map(t => ({ page: t.page, rsToc: t.rsTocVisible, inline: t.inlineVisible, links: t.rsTocLinks })),
  tocNarrow: report.toc.filter(t => t.viewport === 'narrow-900').map(t => ({ page: t.page, rsToc: t.rsTocVisible, inline: t.inlineVisible, summaryVis: t.summaryVisible, links: t.inlineTocLinks })),
  toggleFails: report.toggle.filter(t => !t.toggleClick.ok || !t.toggleClick.changed).map(t => t.url),
  menuClickFails: report.toggle.filter(t => !t.menuClick.ok).map(t => `${t.url}: ${t.menuClick.error}`),
};

fs.writeFileSync(OUT, JSON.stringify({ summary: sum, report }, null, 2));
console.log(JSON.stringify(sum, null, 2));

console.log('\n--- SIDEBAR DETAIL (wide-1440) ---');
for (const s of report.sidebar.filter(s => s.viewport === 'wide-1440')) {
  console.log(`${s.page.padEnd(9)} sidebar=${s.hasSidebar}/${s.sidebarVisible} avatar=${s.hasAvatar}/${s.avatarVisible} name=${s.hasSiteName} menu=${s.menuLinkCount} toggle=${s.hasToggle}/${s.toggleVisible} menuHit=${JSON.stringify(s.firstMenuHitTarget)} toggleHit=${JSON.stringify(s.toggleHitTarget)}`);
}
console.log('\n--- TOC DETAIL ---');
for (const t of report.toc) {
  console.log(`${t.viewport.padEnd(10)} ${t.page.padEnd(9)} rsToc(vis=${t.rsTocVisible},links=${t.rsTocLinks}) inline(vis=${t.inlineVisible},open=${t.inlineOpen},summaryVis=${t.summaryVisible},links=${t.inlineTocLinks}) summaryHit=${JSON.stringify(t.summaryHitTarget)}`);
}
console.log('\n--- TOGGLE DETAIL ---');
console.log(JSON.stringify(report.toggle, null, 2));

await browser.close();
