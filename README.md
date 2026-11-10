# ぴあのラボ

A small piano practice page for a young child (about 3–7), meant for an iPad in landscape. Personal use. It is a static site: pick a picture, press the green button, and follow the colored note and the colored key.

## Songs

About 20 built-in one-hand melodies, mostly quarter and half notes, inside C4–E5. The picker is a picture grid. The search box matches hiragana, katakana, kanji aliases, and romaji (`かえる` and `kaeru` both find かえるのうた). Recently opened songs are kept in `localStorage`.

ぞうさん and いぬのおまわりさん are still in copyright, so they are not in the library. うみ is omitted for the same reason. Sources for the tunes that are included are in each song's `origin` field in `src/data/songs.json`. Regenerate that file with `node scripts/library.mjs`.

Colors match the usual kindergarten solfege: ド red, レ orange, ミ yellow, ファ green, ソ blue, ラ indigo, シ purple. The same color is on the note and on the key, so reading is optional.

## Add it to the iPad

1. Open the GitHub Pages URL in Safari (see below). The first open needs a network so the page can cache.
2. Tap the Share button, then **Add to Home Screen** (ホーム画面に追加).
3. Open ぴあの from the home screen, turn the iPad sideways, tap a picture, then tap the big green button.
4. The child can also tap the keys. Sound starts on the first tap — Safari will not play audio before that.

If there is no sound, turn the volume up with the side buttons and tap the speaker icon in the corner, then press the green button again. iPad silent mode and the iPhone Ring/Silent switch mute Web Audio unless the page asks for playback. After an update, reload in Safari; if the home-screen icon still seems old, delete it and add it again.

## Song data

Melodies live in `src/data/songs.json`. The player only understands this shape, so a later search or melody-extraction step can append objects of the same kind (`origin.type`: `builtin`, `search`, or `extraction`).

```json
{
  "id": "twinkle",
  "title": "きらきら星",
  "picture": "star",
  "accent": "#3B49C9",
  "bpm": 88,
  "meter": [4, 4],
  "origin": { "type": "builtin", "label": "nursery rhyme" },
  "melody": [
    { "pitch": "C4", "beats": 1 },
    { "pitch": "G4", "beats": 2 },
    { "pitch": null, "beats": 1 }
  ]
}
```

- `beats` is always in quarter-note lengths (`1` quarter, `2` half, `3` dotted half).
- One pitch at a time. `pitch: null` is a rest. No chords.
- `picture` is `star`, `frog`, or `tulip`. Anything else still plays, with the star picture.
- The keyboard drawn on screen is **C4–E5**. Notes outside that range still sound and show on the staff, but no key lights up.
- A song with `youtubeId` and `startSec` shows ✨ on its card. On the practice screen, **with original** plays that YouTube video from `startSec` and moves the highlight with `player.getCurrentTime()`. **piano only** is the built-in piano. Note `i` starts at `startSec + (beats before i) × 60 / bpm`.

To add another song from a local file (audio and cookies stay gitignored):

```bash
tools/add-song/.venv/bin/python tools/add-song/add_song.py --audio <file> --youtube-id <id> --title "曲名"
```

## Develop

```bash
npm install
npm run dev
```

The dev server uses the Pages base path, so open `http://127.0.0.1:5173/piano-lab/`.

```bash
npm run build
npm run preview
```

`npm run icons` redraws the home-screen icons (needs Pillow).

## GitHub Pages

The workflow `.github/workflows/pages.yml` publishes `dist/` to GitHub Pages on every push to `main`. It does not run until that workflow file is on `main`.

The site URL, once Pages is actually serving the site, is:

https://tsubaaasa14-cyber.github.io/piano-lab/

Asset paths are rooted at `/piano-lab/`. That value is set in `vite.config.ts`, `public/manifest.webmanifest`, and `scripts/emit-sw.mjs`.

This repository is private, and the automation token cannot change Pages settings (`POST /repos/tsubaaasa14-cyber/piano-lab/pages` returns 403, “Resource not accessible by integration”). An owner with admin on the repo has to turn Pages on:

1. Merge the app to `main` so the workflow exists on the default branch.
2. GitHub Free serves Pages only for **public** repositories. Either make this repo public, or use a plan that includes Pages for private repos (GitHub Pro, Team, or Enterprise). On a user account the Pages site is still reachable by anyone who has the URL, even when the repo is private.
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The live site is https://tsubaaasa14-cyber.github.io/piano-lab/.

## iOS Safari notes

- Audio will not start until a tap. The app calls `AudioContext.resume()` and plays a silent looping media element inside `click` / `touchend`, and again on later taps if the context is `suspended` or `interrupted`.
- Safari's default audio session is ambient, so the iPhone silent switch and iPad silent mode mute Web Audio. The page sets `navigator.audioSession.type = 'playback'` where that API exists (iOS 17+). The volume buttons still matter. A speaker icon in the corner is crossed out until the context is running; tap it to try again.
- Add to Home Screen uses the apple touch icon and `apple-mobile-web-app-capable`. The service worker caches hashed files for offline use and checks for a new `sw.js` with `updateViaCache: 'none'`. When an update activates, the page reloads once. iOS can still keep a home-screen snapshot: delete the icon and add it again if the speaker icon never appears.
- Portrait shows a “turn the iPad” picture. The manifest asks for landscape; Safari does not always honor that.
- Pinch-zoom and scroll bounce are blocked while the page is open. The score can still be swiped sideways.
- Newer iOS sometimes ignores `user-scalable=no`. `touch-action` and gesture handlers cover the usual pinch.
