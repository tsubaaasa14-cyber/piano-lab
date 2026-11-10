import { defineConfig } from 'vite';

// Project site on GitHub Pages: https://<user>.github.io/piano-lab/
// Keep this in sync with scripts/emit-sw.mjs and public/manifest.webmanifest.
export default defineConfig({
  base: '/piano-lab/',
});
