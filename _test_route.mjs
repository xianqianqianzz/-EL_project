import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on('console', msg => {
  if (msg.type() === 'error') console.log('JS ERROR:', msg.text());
});

page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Search for a starting point
const fromInput = page.locator('#search-from');
await fromInput.click();
await fromInput.fill('南大门');
await page.waitForTimeout(500);

// Click the first suggestion
const fromSug = page.locator('#suggestions-from li').first();
const fromText = await fromSug.textContent();
console.log('Selected FROM:', fromText);
await fromSug.click();
await page.waitForTimeout(300);

// Search for a destination
const toInput = page.locator('#search-to');
await toInput.click();
await toInput.fill('图书馆');
await page.waitForTimeout(500);

// Click the first suggestion
const toSug = page.locator('#suggestions-to li').first();
const toText = await toSug.textContent();
console.log('Selected TO:', toText);
await toSug.click();
await page.waitForTimeout(500);

// Trigger route search
const routeBtn = page.locator('#btn-route');
await routeBtn.click();
await page.waitForTimeout(1500);

// Check route panel
const routePanel = page.locator('#panel-route');
const routeVisible = await routePanel.isVisible();
console.log('Route panel visible:', routeVisible);

// Check for route info
const routeText = await page.locator('#panel-route').textContent().catch(() => 'N/A');
console.log('Route panel text:', routeText.substring(0, 200));

// Screenshot after route
await page.screenshot({ path: '_screenshot_route.png' });
console.log('Route screenshot saved');

// Test pinyin search
await fromInput.fill('');
await toInput.fill('');
await page.waitForTimeout(300);

await fromInput.fill('tsg');
await page.waitForTimeout(500);
const pinyinSug = await page.locator('#suggestions-from li').count();
console.log('Pinyin suggestions for "tsg":', pinyinSug);
for (let i = 0; i < Math.min(pinyinSug, 3); i++) {
  const text = await page.locator('#suggestions-from li').nth(i).textContent();
  console.log('  -', text);
}

await browser.close();
console.log('Done!');
