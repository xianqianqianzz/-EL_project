import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on('console', msg => {
  if (msg.type() === 'error') console.log('JS ERROR:', msg.text());
  else if (msg.type() === 'warning') console.log('JS WARN:', msg.text());
});

page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });

// Wait for the map to load
await page.waitForSelector('#outdoor-map canvas, #outdoor-map img, .leaflet-image-layer', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2000);

// Take initial screenshot
await page.screenshot({ path: '_screenshot_initial.png' });
console.log('Initial screenshot saved');

// Check search input exists
const searchInput = await page.locator('#search-from');
const exists = await searchInput.isVisible();
console.log('Search input visible:', exists);

// Check if there are any markers on the map
const markers = await page.locator('.place-marker, .leaflet-marker-icon').count();
console.log('Initial markers:', markers);

// Type 食堂 in the search
await searchInput.click();
await searchInput.fill('');
await page.waitForTimeout(300);

// Type Chinese characters one by one using input event
await searchInput.fill('食堂');
await page.waitForTimeout(1000);

// Check suggestions
const suggestions = await page.locator('#suggestions-from li');
const sugCount = await suggestions.count();
console.log('Suggestions count for 食堂:', sugCount);
for (let i = 0; i < Math.min(sugCount, 5); i++) {
  const text = await suggestions.nth(i).textContent();
  console.log('  -', text);
}

// Check map markers after search
const markers2 = await page.locator('.place-marker, .leaflet-marker-icon').count();
console.log('Markers after search:', markers2);

// Screenshot after search
await page.screenshot({ path: '_screenshot_search.png' });
console.log('Search screenshot saved');

// Now test clearing the search
await searchInput.fill('');
await page.waitForTimeout(500);
const markers3 = await page.locator('.place-marker, .leaflet-marker-icon').count();
console.log('Markers after clearing:', markers3);

// Screenshot after clearing
await page.screenshot({ path: '_screenshot_cleared.png' });
console.log('Cleared screenshot saved');

await browser.close();
console.log('Done!');
