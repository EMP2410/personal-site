import { chromium } from 'playwright';

const BASE = 'http://localhost:1313/personal-site';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [], failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text()}`); });
page.on('requestfailed', (r) => failedRequests.push(`${page.url()} :: ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${page.url()} :: ${r.url()} :: HTTP ${r.status()}`); });

const out = { consoleErrors, failedRequests };

// --- 1. search page: type a keyword, expect results with <mark> highlighting ---
await page.goto(BASE + '/search/', { waitUntil: 'networkidle' });
out.dataJson = await page.getAttribute('.search-form', 'data-json');
out.action = await page.getAttribute('.search-form', 'action');
out.widgetFormOnSearchPage = await page.evaluate(() => !!document.querySelector('.search-form.widget'));

await page.fill('.search-form input[name="keyword"]', 'neutron');
await page.waitForTimeout(2500);
out.results = await page.evaluate(() => {
  const list = document.querySelector('.search-result--list');
  const items = list ? [...list.children] : [];
  return {
    resultCount: items.length,
    marks: document.querySelectorAll('.search-result--list mark').length,
    title: document.querySelector('.search-result--title')?.textContent?.trim() || null,
    previewTag: document.querySelector('.search-result--list .article-preview')?.tagName || null,
    previewCount: document.querySelectorAll('.search-result--list .article-preview').length,
    firstTitle: document.querySelector('.search-result--list .article-title')?.textContent?.trim() || null,
    firstHref: document.querySelector('.search-result--list a')?.getAttribute('href') || null,
    url: window.location.search,
  };
});

// --- 2. query string driven search (deep link) ---
await page.goto(BASE + '/search/?keyword=neutron', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
out.deepLink = await page.evaluate(() => ({
  resultCount: document.querySelectorAll('.search-result--list > *').length,
  inputValue: document.querySelector('.search-form input[name="keyword"]')?.value ?? null,
  marks: document.querySelectorAll('.search-result--list mark').length,
}));

// --- 3. empty keyword clears results ---
await page.goto(BASE + '/search/', { waitUntil: 'networkidle' });
await page.fill('.search-form input[name="keyword"]', 'neutron');
await page.waitForTimeout(1500);
await page.fill('.search-form input[name="keyword"]', '');
await page.waitForTimeout(1200);
out.cleared = await page.evaluate(() => ({
  resultCount: document.querySelectorAll('.search-result--list > *').length,
  title: document.querySelector('.search-result--title')?.textContent?.trim() || null,
}));

// --- 4. sidebar widget on a normal page: submit -> jumps to /search/?keyword=... ---
await page.goto(BASE + '/about/', { waitUntil: 'networkidle' });
out.widgetPresent = await page.evaluate(() => ({
  form: !!document.querySelector('.search-form.widget'),
  dataJson: document.querySelector('.search-form.widget')?.getAttribute('data-json') ?? null,
  action: document.querySelector('.search-form.widget')?.getAttribute('action') ?? null,
}));
await page.fill('.search-form.widget input[name="keyword"]', 'neutron');
await page.press('.search-form.widget input[name="keyword"]', 'Enter');
await page.waitForTimeout(2500);
out.widgetSubmit = await page.evaluate(() => ({
  url: window.location.pathname + window.location.search,
  resultCount: document.querySelectorAll('.search-result--list > *').length,
  marks: document.querySelectorAll('.search-result--list mark').length,
}));

// --- 5. normal pages must not raise JS errors (the old init threw a TypeError) ---
const plainPages = ['/', '/about/', '/cv/', '/gallery/', '/blog/', '/news/', '/archives/'];
out.plainPageErrors = {};
for (const p of plainPages) {
  const before = consoleErrors.length;
  await page.goto(BASE + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  out.plainPageErrors[p] = consoleErrors.slice(before);
}

await ctx.close();
await browser.close();

console.log(JSON.stringify(out, null, 2));
