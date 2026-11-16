// Screenshot tool for Nova Drift. Serves game/ with serve.ts on :8080, opens each
// ?shot= scene in a 1280x720 Chromium viewport, waits for window.__shotReady,
// and saves a JPEG (quality 80) to screenshots/. The first file by name is the
// cover, so 1-play.jpg (the action frame) goes first.
//
// Usage: node tools/shoot.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const shotsDir = join(repo, 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const SHOTS = [
  { file: '1-play.jpg', query: '?shot=play' },
  { file: '2-title.jpg', query: '?shot=title' },
  { file: '3-upgrade.jpg', query: '?shot=upgrade' },
  { file: '4-end.jpg', query: '?shot=end' },
];

const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1187/chrome-linux/chrome');

function waitForServer(port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(`http://127.0.0.1:${port}/`)
        .then((r) => (r.ok ? resolve() : retry()))
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error('server did not start'));
      else setTimeout(tick, 200);
    };
    tick();
  });
}

const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: repo, stdio: 'inherit' });

try {
  await waitForServer(8080, 15000);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (err) => console.error('PAGE ERROR:', String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
  });
  for (const shot of SHOTS) {
    await page.goto(`http://127.0.0.1:8080/${shot.query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    const out = join(shotsDir, shot.file);
    await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
    const size = statSync(out).size;
    console.log(`${shot.file}: ${size} bytes ${size <= 262144 ? 'OK' : 'OVER 256 KiB!'}`);
  }
  await browser.close();
  console.log('done.');
} finally {
  server.kill();
}
