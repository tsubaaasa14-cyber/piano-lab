import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const outDir = process.env.PROOF_DIR ?? '/tmp/piano-proof';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/google/chrome/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});

const context = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  screen: { width: 1180, height: 820 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});

const page = await context.newPage();
page.on('pageerror', (error) => console.error('PAGE', error));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('CONSOLE', msg.text());
});

await page.goto('http://127.0.0.1:4173/piano-lab/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-song-id="twinkle"]');
await page.screenshot({ path: path.join(outDir, 'home.png') });

const before = await page.locator('.sound').getAttribute('data-state');
console.log('sound before gesture', before);
await page.locator('[data-song-id="twinkle"]').tap();
await page.waitForSelector('.practice');
const afterSong = await page.evaluate(() => {
  const button = document.querySelector('.sound');
  const keeper = document.querySelector('audio.ios-keep-alive');
  return {
    state: button?.getAttribute('data-state') ?? null,
    ready: button?.classList.contains('is-ready') ?? false,
    keeper: !!keeper,
    keeperPaused: keeper ? keeper.paused : null,
    session: navigator.audioSession?.type ?? null,
  };
});
console.log('sound after song tap', afterSong);
await page.waitForSelector('.key[data-pitch="C4"]');
const white = await page.locator('.white-key').first().boundingBox();
console.log('white key box', white);
await page.screenshot({ path: path.join(outDir, 'practice-idle.png') });

await page.locator('[data-action="play"]').tap({ force: true });
await page.waitForFunction(() => {
  const practice = document.querySelector('.practice');
  const index = Number(practice?.getAttribute('data-note-index'));
  const note = document.querySelector('.note.is-current');
  const key = document.querySelector('.key.is-current');
  return index >= 6 && note && key && practice?.classList.contains('is-playing');
}, null, { timeout: 12000 });

const state = await page.evaluate(() => {
  const note = document.querySelector('.note.is-current');
  const key = document.querySelector('.key.is-current');
  const practice = document.querySelector('.practice');
  return {
    index: practice?.getAttribute('data-note-index'),
    notePitch: note?.getAttribute('data-pitch'),
    keyPitch: key?.getAttribute('data-pitch'),
    playing: practice?.classList.contains('is-playing'),
    playPressed: document.querySelector('[data-action="play"]')?.getAttribute('aria-pressed'),
  };
});
console.log('playback', state);

await page.screenshot({ path: path.join(outDir, 'playback-highlight.png') });

const pressed = await page.evaluate(() => {
  const key = document.querySelector('.key[data-pitch="E4"]');
  if (!(key instanceof HTMLElement)) return false;
  key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, pointerType: 'touch' }));
  return key.classList.contains('is-pressed');
});
console.log('key pressed after pointerdown', pressed);

await browser.close();
if (state.notePitch !== state.keyPitch || !state.playing) {
  console.error('highlight mismatch', state);
  process.exit(1);
}
console.log('proof ok', outDir);
