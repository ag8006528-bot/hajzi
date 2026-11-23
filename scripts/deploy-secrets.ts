/**
 * Print fresh secret values to paste into Vercel → Settings → Environment Variables.
 *   npm run deploy:secrets
 * Nothing is saved. Run it once; keep the values private.
 */
import { randomBytes } from 'crypto';

const code = Array.from(randomBytes(12))
  .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
  .join('')
  .replace(/(.{4})(?=.)/g, '$1-');

console.log(`
Paste these into Vercel → your project → Settings → Environment Variables:

  AUTH_SECRET        ${randomBytes(48).toString('base64url')}
  ADMIN_SETUP_CODE   ${code}

AUTH_SECRET protects logins and 2FA. Never share it, and don't change it later (everyone would be logged out).
ADMIN_SETUP_CODE lets you create the first admin account at /admin/setup. It works once.
`);
