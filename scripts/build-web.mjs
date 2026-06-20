// Copies the static web app into www/ so Capacitor can bundle it into the
// native app. The project has no build step — assets are served as-is — so
// this script just mirrors the relevant files/folders into a clean www/.
//
// Usage: npm run build   (runs automatically via `npm run sync`)

import { rm, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

// Top-level web assets to ship inside the native app.
const ENTRIES = [
  'index.html',
  'manifest.json',
  'sw.js',
  'css',
  'js',
  'locales',
  'icons',
];

async function main() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  for (const entry of ENTRIES) {
    const src = join(root, entry);
    if (!existsSync(src)) {
      console.warn(`! skip (missing): ${entry}`);
      continue;
    }
    await cp(src, join(out, entry), { recursive: true });
    console.log(`✓ ${entry}`);
  }

  console.log(`\nweb assets copied to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
