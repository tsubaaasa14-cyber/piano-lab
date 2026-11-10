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
const page = await (
  await browser.newContext({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  })
).newPage();
page.on('pageerror', (error) => {
  console.error('PAGE', error);
  process.exitCode = 1;
});

await page.goto('http://127.0.0.1:4173/piano-lab/', { waitUntil: 'networkidle' });
await page.waitForSelector('.song-grid');
const all = await page.locator('.song-grid .song-card').count();
console.log('cards', all);
if (all < 20) throw new Error(`expected 20 cards, saw ${all}`);
await page.screenshot({ path: path.join(outDir, 'picker.png') });

async function search(text) {
  await page.locator('.search-input').fill(text);
  await page.waitForTimeout(50);
}

async function titles() {
  return page.locator('.song-grid .song-name').allTextContents();
}

await search('kaeru');
let found = await titles();
console.log('kaeru', found);
if (found.join() !== 'かえるのうた') throw new Error(`romaji search failed: ${found}`);
await page.screenshot({ path: path.join(outDir, 'search-kaeru.png') });

await search('かえる');
found = await titles();
console.log('kana', found);
if (!found.includes('かえるのうた')) throw new Error('kana search failed');

await search('カエル');
found = await titles();
console.log('kata', found);
if (!found.includes('かえるのうた')) throw new Error('katakana search failed');

await search('蛙');
found = await titles();
console.log('kanji', found);
if (!found.includes('かえるのうた')) throw new Error('kanji search failed');

await search('星');
found = await titles();
console.log('hoshi', found);
if (!found.includes('きらきら星')) throw new Error('kanji 星 search failed');

await search('zzz');
const empty = await page.locator('.empty-text').textContent();
console.log('empty', empty);
if (empty !== 'みつからない') throw new Error('empty state missing');

await page.locator('.search-clear').tap();
await page.waitForFunction(() => document.querySelectorAll('.song-grid .song-card').length >= 20);

for (const id of ['bee', 'mary', 'jingle']) {
  await page.locator(`.song-grid [data-song-id="${id}"]`).tap();
  await page.waitForSelector('.practice');
  const title = await page.locator('.now-title').textContent();
  await page.locator('[data-action="play"]').tap({ force: true });
  const minIndex = id === 'bee' ? 6 : 2;
  await page.waitForFunction((min) => {
    const practice = document.querySelector('.practice');
    const index = Number(practice?.getAttribute('data-note-index'));
    const note = document.querySelector('.note.is-current');
    const key = document.querySelector('.key.is-current');
    return index >= min && note && key && note.getAttribute('data-pitch') === key.getAttribute('data-pitch');
  }, minIndex);
  const state = await page.evaluate(() => ({
    title: document.querySelector('.now-title')?.textContent,
    index: document.querySelector('.practice')?.getAttribute('data-note-index'),
    pitch: document.querySelector('.note.is-current')?.getAttribute('data-pitch'),
  }));
  console.log('played', title, state);
  if (id === 'bee') await page.screenshot({ path: path.join(outDir, 'playback-bee.png') });
  await page.locator('[data-action="back"]').tap();
  await page.waitForSelector('.song-grid');
}

const recent = await page.locator('.recent-scroll .song-name').allTextContents();
console.log('recent', recent);
if (recent[0] !== 'ジングルベル') throw new Error(`recent order wrong: ${recent}`);
await browser.close();
console.log('picker proof ok');
