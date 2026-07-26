/**
 * Screenshots the running app for design review.
 *
 * Web is used as the render target because it's fast and the design system is
 * platform-agnostic. For Android-specific verification use the emulator flow in
 * docs/setup.md instead.
 *
 * Usage:
 *   npx expo start --web --port 8093
 *   node scripts/screenshot.mjs /design out.png [--light] [--width 420] [--height 2200]
 */
import { chromium } from 'playwright';

const [, , route = '/', out = 'shot.png', ...flags] = process.argv;
const arg = (name, fallback) => {
  const i = flags.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(flags[i + 1]);
};

const width = arg('width', 420);
const height = arg('height', 2200);
const light = flags.includes('--light');
const port = arg('port', 8093);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 2,
});

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

// NOT networkidle: Instant holds a sync websocket open, so the page is never idle.
await page.goto(`http://localhost:${port}${route}`, {
  waitUntil: 'domcontentloaded',
  timeout: 120_000,
});
await page.waitForTimeout(14_000);

// The design gallery pins its own scheme, so light mode goes through the in-app toggle.
if (light) {
  await page.getByText('Scheme: dark').click();
  await page.waitForTimeout(2_500);
}

await page.screenshot({ path: out });
console.log(errors.length ? errors.slice(0, 6).join('\n') : 'no page errors');
await browser.close();
