// READ-ONLY probe: how tall is the navigation column, and does it fit the viewport?
import { chromium } from 'playwright';

const BASE = 'http://localhost:1313/personal-site';
const browser = await chromium.launch();

for (const w of [768, 900, 1024, 1440]) {
  for (const h of [600, 700, 800, 900]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/about/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => {
      const sb = document.querySelector('.left-sidebar');
      const box = (sel) => {
        const e = sb.querySelector(sel);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { h: Math.round(b.height), w: Math.round(b.width) };
      };
      return {
        scrollH: sb.scrollHeight,
        clientH: sb.clientHeight,
        overflows: sb.scrollHeight - sb.clientHeight,
        avatar: box('.site-avatar'),
        name: box('.site-name'),
        desc: box('.site-description'),
        menu: box('.menu'),
        themeSwitch: box('.dark-mode-switch') || box('#toggle-theme'),
        sidebarW: Math.round(sb.getBoundingClientRect().width),
        mainW: Math.round(document.querySelector('main.main').getBoundingClientRect().width),
      };
    });
    console.log(
      `${w}x${h} sbW=${r.sidebarW} mainW=${r.mainW} scrollH=${r.scrollH} clientH=${r.clientH} need=${r.overflows}px | avatar=${JSON.stringify(r.avatar)} name=${JSON.stringify(r.name)} desc=${JSON.stringify(r.desc)} menu=${JSON.stringify(r.menu)} sw=${JSON.stringify(r.themeSwitch)}`
    );
    await ctx.close();
  }
}
await browser.close();
