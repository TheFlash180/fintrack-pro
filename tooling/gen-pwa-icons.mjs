// FinTrack PWA icons: teal chart glyph on graphite. Run once: npm run gen:pwa-icons
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="0" fill="#16181d"/>
  <g stroke-linecap="round">
    <rect x="22" y="52" width="12" height="26" rx="4" fill="#2dd4bf" opacity="0.55"/>
    <rect x="44" y="38" width="12" height="40" rx="4" fill="#2dd4bf" opacity="0.8"/>
    <rect x="66" y="24" width="12" height="54" rx="4" fill="#2dd4bf"/>
    <path d="M22 40 Q40 20 56 28 T84 16" stroke="#e8eaf0" stroke-width="4" fill="none"/>
    <circle cx="84" cy="16" r="4.5" fill="#e8eaf0"/>
  </g>
</svg>`;

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, `pwa-${size}.png`));
  console.log(`wrote pwa-${size}.png`);
}
