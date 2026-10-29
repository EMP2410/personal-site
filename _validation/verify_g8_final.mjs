// READ-ONLY final check: the mid-size window must show the navigation *beside* the
// article (not above it) and must not paint anything outside its own column.
import { chromium } from 'playwright';

const BASE = 'http://localhost:1313/personal-site';
const browser = await chromium.launch();

for (const [w, h] of [[700, 800], [768, 400], [820, 500], [900, 700], [1024, 600], [1280, 800], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/about/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const sb = document.querySelector('.left-sidebar');
    const m = document.querySelector('main.main');
    const menu = sb.querySelector('.menu');
    const toggle = sb.querySelector('#dark-mode-toggle');
    const s = sb.getBoundingClientRect();
    const mm = m.getBoundingClientRect();
    const t = toggle.getBoundingClientRect();
    const mb = menu.getBoundingClientRect();
    return {
      dir: getComputedStyle(document.querySelector('.main-container')).flexDirection,
      sb: `x${Math.round(s.x)}..${Math.round(s.right)} y${Math.round(s.y)}..${Math.round(s.bottom)}`,
      main: `x${Math.round(mm.x)}..${Math.round(mm.right)} y${Math.round(mm.y)}..${Math.round(mm.bottom)}`,
      beside: mm.x > s.right,
      menuBox: `y${Math.round(mb.y)}..${Math.round(mb.bottom)}`,
      menuScroll: `${menu.scrollHeight}/${menu.clientHeight}`,
      toggle: `y${Math.round(t.y)}..${Math.round(t.bottom)} inSidebar=${t.bottom <= s.bottom + 1 && t.top >= s.top - 1}`,
      sbScroll: `${sb.scrollHeight}/${sb.clientHeight}`,
    };
  });
  console.log(`${w}x${h}  dir=${r.dir.padEnd(7)} beside=${r.beside}  sb[${r.sb}]  main[${r.main}]  menu[${r.menuBox}] menuScroll=${r.menuScroll}  toggle[${r.toggle}]  sbScroll=${r.sbScroll}`);
  await ctx.close();
}
await browser.close();
