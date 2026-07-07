// Regenerates raster app icons + favicon from the source SVG.
// Run with: node scripts/generate-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public', 'icon.svg');
const pub = join(root, 'public');

const svg = await readFile(src);

// PNG app icons (manifest + apple-touch)
const pngSizes = [180, 192, 512];
for (const size of pngSizes) {
  const out = join(pub, `icon-${size}.png`);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log(`wrote ${out}`);
}

// favicon.ico (multi-resolution 16/32/48)
const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer())
);
const ico = await pngToIco(icoBuffers);
await writeFile(join(pub, 'favicon.ico'), ico);
console.log(`wrote ${join(pub, 'favicon.ico')} (${icoSizes.join('/')})`);
