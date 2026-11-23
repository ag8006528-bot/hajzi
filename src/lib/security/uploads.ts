import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { hasDatabase, query } from '../db/sql';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPLOAD_NAME_RE = /^[a-f0-9]{32}\.webp$/;

/** Stored OUTSIDE /public and served through a route that only accepts generated names. */
export const UPLOAD_DIR =
  process.env.HAJZI_UPLOAD_DIR || (process.env.VERCEL ? '/tmp/hajzi-uploads' : path.join(process.cwd(), 'data', 'uploads'));

/** Identify the real file type from its first bytes (magic numbers) — never trust the extension or MIME type. */
export function sniffImageType(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

/**
 * Re-encode to WebP: drops ALL metadata (EXIF GPS location, camera serials, comments),
 * neutralises polyglot files, applies EXIF orientation and caps dimensions.
 */
export async function processImage(buf: Buffer) {
  return sharp(buf, { limitInputPixels: 40_000_000, failOn: 'error' })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/**
 * With a database (production): images are stored in the `uploads` table, so they survive redeploys and
 * every server instance sees them. Without one (local dev): files in UPLOAD_DIR.
 */
export async function saveUpload(webp: Buffer) {
  const name = `${randomBytes(16).toString('hex')}.webp`; // random, unguessable, no user input in the path
  if (hasDatabase()) {
    await query('insert into uploads (name, data) values ($1, $2)', [name, webp]);
    return name;
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), webp, { mode: 0o644 });
  return name;
}

export async function readUpload(name: string) {
  if (!UPLOAD_NAME_RE.test(name)) return null; // blocks path traversal
  if (hasDatabase()) {
    const rows = await query<{ data: Uint8Array }>('select data from uploads where name = $1', [name]);
    return rows[0] ? Buffer.from(rows[0].data) : null;
  }
  try {
    return await fs.readFile(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}
