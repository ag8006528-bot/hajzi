/**
 * Text sanitising shared by client and server.
 * React already escapes output (so stored text can never execute), but we also
 * strip markup at the input boundary so no HTML/script ever reaches the database,
 * the admin dashboard, exports, emails or calendar files.
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

export function cleanText(input: unknown, max: number, { multiline = false } = {}) {
  let s = String(input ?? '').normalize('NFKC');
  s = s.replace(CONTROL, '');
  s = s.replace(/<[^>]*>?/g, ''); // strip tags (incl. unterminated "<img src=x onerror=…")
  s = s.replace(/[<>]/g, ''); // no stray angle brackets
  s = s.replace(/\b(?:javascript|vbscript|data)\s*:/gi, ''); // no script URLs
  s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

/** Normalise to E.164 where possible: "079 123 4567" → "+962791234567". */
export function normalizePhone(raw: string) {
  let p = String(raw ?? '').replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (/^07[789]\d{7}$/.test(p)) p = `+962${p.slice(1)}`;
  if (/^7[789]\d{7}$/.test(p)) p = `+962${p}`;
  if (/^962\d+$/.test(p)) p = `+${p}`;
  return p;
}

/** Jordan mobile (+962 77/78/79 + 7 digits) or another international E.164 number. */
export function isValidPhone(raw: string) {
  const p = normalizePhone(raw);
  if (p.startsWith('+962')) return /^\+9627[789]\d{7}$/.test(p);
  return /^\+[1-9]\d{7,14}$/.test(p);
}

/** "+962791234521" → "+962 79 *** 4521" */
export function maskPhone(raw: string) {
  const p = normalizePhone(raw);
  if (!p) return '';
  if (/^\+9627\d{8}$/.test(p)) return `+962 ${p.slice(4, 6)} *** ${p.slice(-4)}`;
  if (p.length <= 6) return '***';
  return `${p.slice(0, 4)} *** ${p.slice(-4)}`;
}

/** Mask anything that looks like a phone number or e-mail inside free text (for logs). */
export function scrubPII(s: string) {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, (m) => `${m[0]}***@***`)
    // 9+ digits looks like a phone number (dates like 2026-11-23 have 8 and are left alone).
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? maskPhone(m) || '***' : m));
}
