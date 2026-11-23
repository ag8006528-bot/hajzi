/**
 * Import downloaded photos into public/fields/ as clean, uniform WebP files.
 *   node scripts/import-photos.mjs <downloadDir>
 * Each file is verified by its magic bytes, re-encoded (strips EXIF/GPS/metadata),
 * centre-cropped with "attention" focus to 16:10 and resized to 1600×1000.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const srcDir = process.argv[2];
if (!srcDir) throw new Error('usage: node scripts/import-photos.mjs <downloadDir>');

// Unsplash photo id → output name (field id + index)
// (Photos showing famous stadiums, brand signage, crowds or the wrong surface were rejected.)
const MAP = {
  W8XwIYFDh2I: 'green-line-arena-1',
  '8-s5QuUBtyM': 'green-line-arena-2',
  dxcVW0W_q_o: 'green-line-arena-3',
  BTmakFfGSAw: 'midfield-five-1', // aerial of a small cage pitch → 5v5
  '6l0RUEu1dhw': 'midfield-five-2',
  deGn9vSwXIM: 'golden-boot-stadium-1',
  maFOyIkw6P4: 'golden-boot-stadium-2',
  K5ChxJaheKI: 'golden-boot-stadium-3', // large floodlit pitch → 11v11
  '7JH2-xHTS-4': 'corner-flag-park-1',
  '5bG4UI5SaiM': 'corner-flag-park-2',
  HgwY_YQ1m0w: 'corner-flag-park-3',
};

const isImage = (b) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // JPEG
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || // PNG
  (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP');

const outDir = path.join(process.cwd(), 'public', 'fields');
mkdirSync(outDir, { recursive: true });

for (const [id, name] of Object.entries(MAP)) {
  const buf = readFileSync(path.join(srcDir, `${id}.jpg`));
  if (!isImage(buf)) {
    console.log(`SKIP ${id}: not an image`);
    continue;
  }
  const out = await sharp(buf, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: 1280, height: 800, fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 72 })
    .toBuffer();
  writeFileSync(path.join(outDir, `${name}.webp`), out);
  console.log(`${name}.webp  ${(out.length / 1024).toFixed(0)} KB`);
}
