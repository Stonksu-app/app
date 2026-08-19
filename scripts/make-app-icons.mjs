// Rasterises the brand mark into the source images @capacitor/assets expects.
// Run with: node scripts/make-app-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const LIME = '#C6FF34';
const CARBON = '#171717';

/** The bull mark, drawn on a 100x100 grid (same paths as src/components/Mascot.tsx). */
const bull = `
  <path d="M16 16 C11 22 10 30 14 36.5 C17 38 21 38 24 36.5 C19 31 17 23 16 16 Z" fill="${LIME}"/>
  <path d="M84 16 C89 22 90 30 86 36.5 C83 38 79 38 76 36.5 C81 31 83 23 84 16 Z" fill="${LIME}"/>
  <path d="M20 47 C15 48 10 51 7.5 55.5 C11 58 16 58.5 21 57.5 Z" fill="${LIME}"/>
  <path d="M80 47 C85 48 90 51 92.5 55.5 C89 58 84 58.5 79 57.5 Z" fill="${LIME}"/>
  <path d="M50 24 C64 24 75 29 79.5 37 C82 42 83 47 83 54 C83 72 69 85.5 50 85.5 C31 85.5 17 72 17 54 C17 47 18 42 20.5 37 C25 29 36 24 50 24 Z" fill="${LIME}"/>
  <rect x="25.5" y="42.3" width="49" height="18.9" rx="9.5" fill="${CARBON}"/>
  <path d="M34 55.8 Q38 50 42.1 55.8" stroke="${LIME}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <path d="M57.9 55.8 Q62 50 66 55.8" stroke="${LIME}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <path d="M45.5 66.5 C46.5 68 48 69.5 49.3 70.3 C48.5 68 47.3 66.6 45.5 66.5 Z" fill="${CARBON}"/>
  <path d="M54.5 66.5 C53.5 68 52 69.5 50.7 70.3 C51.5 68 52.7 66.6 54.5 66.5 Z" fill="${CARBON}"/>
`;

/** `scale` controls how much of the canvas the mark fills — splash screens want it small. */
const canvas = (size, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${CARBON}"/>
  <g transform="translate(50 52) scale(${scale}) translate(-50 -50.75)">${bull}</g>
</svg>`;

const splash = (w, h, markSize) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${CARBON}"/>
  <svg x="${(w - markSize) / 2}" y="${(h - markSize) / 2}" width="${markSize}" height="${markSize}" viewBox="0 0 100 100">
    <g transform="translate(50 52) scale(0.86) translate(-50 -50.75)">${bull}</g>
  </svg>
</svg>`;

await mkdir('assets', { recursive: true });

const jobs = [
  // iOS applies its own rounded mask, so the icon art stays square and full-bleed.
  ['assets/icon.png', canvas(1024, 0.82)],
  // Android adaptive icons crop to a circle; keep the mark inside the safe zone.
  ['assets/icon-foreground.png', canvas(1024, 0.6)],
  ['assets/icon-background.png', canvas(1024, 0)],
  ['assets/splash.png', splash(2732, 2732, 640)],
  ['assets/splash-dark.png', splash(2732, 2732, 640)],
];

for (const [path, svg] of jobs) {
  await writeFile(path, await sharp(Buffer.from(svg)).png().toBuffer());
  console.log('wrote', path);
}
