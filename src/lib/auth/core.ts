import 'server-only';
import bcrypt from 'bcryptjs';
import { createHmac, randomUUID } from 'crypto';
import { getStore } from '../db';
import { env, getAuthSecret } from '../env';
import { audit, log } from '../logger';
import { decrypt, encrypt, randomToken, safeEqual, sha256 } from '../security/crypto';
import { verifyTotp } from '../security/totp';
import type { PublicUser, Role, User } from '../types';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 12;

let dummyHash: string | undefined;
/** Compare against a dummy hash for unknown users so response time doesn't reveal which emails exist. */
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('timing-equaliser-not-a-password', BCRYPT_COST));

/** Returns a reason the password is too weak, or null if it's acceptable. */
export function passwordProblem(p: string, minLength = MIN_PASSWORD_LENGTH): 'short' | 'weak' | null {
  if (p.length < minLength) return 'short';
  if (/^(.)\1+$/.test(p) || /password|hajzi|123456|qwerty|abcdef/i.test(p)) return 'weak';
  return null;
}

const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

export type SetupResult = { ok: true } | { ok: false; reason: 'disabled' | 'invalid_code' | 'used_code' | 'exists' | 'short' | 'weak' };

/**
 * First-admin code for a brand-new site with no ADMIN_SETUP_CODE configured: derived from the server secret,
 * valid ONLY while no staff account exists, and written to the server logs (visible only to the site owner)
 * when /admin/setup is opened.
 */
export function firstAdminCode(): string {
  const raw = createHmac('sha256', getAuthSecret()).update('first-admin-setup-code-v1').digest();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(raw.subarray(0, 12), (b) => alphabet[b % 32]).join('').replace(/(.{4})(?=.)/g, '$1-');
}

/** The setup code currently accepted: ADMIN_SETUP_CODE, or the first-admin code while there are no staff accounts. */
export async function activeSetupCode(): Promise<{ code: string; source: 'env' | 'first-admin' } | null> {
  if (env.setupCode) return { code: env.setupCode, source: 'env' };
  if ((await getStore().countUsers()) === 0) return { code: firstAdminCode(), source: 'first-admin' };
  return null;
}

/**
 * "Create account" page: creates an ADMIN account only with a secret one-time setup code
 * (ADMIN_SETUP_CODE, or the first-admin code on a new site). Each code can be used once.
 */
export async function createAccountWithSetupCode(input: { email: string; password: string; code: string }, ipHash: string): Promise<SetupResult> {
  const active = await activeSetupCode();
  if (!active) return { ok: false, reason: 'disabled' };
  const email = input.email.trim().toLowerCase();
  const expected = normalizeCode(active.code);
  const given = normalizeCode(input.code);
  if (expected.length < 8 || !safeEqual(given, expected)) {
    await audit('anonymous', 'account_setup_failed', email, { reason: 'bad_code', ip: ipHash });
    return { ok: false, reason: 'invalid_code' };
  }
  const store = getStore();
  const codeHash = sha256(`setup:${expected}`);
  if ((await store.listUsers()).some((u) => u.setupCodeHash === codeHash)) return { ok: false, reason: 'used_code' };
  if (await store.getUserByEmail(email)) return { ok: false, reason: 'exists' };
  const weak = passwordProblem(input.password);
  if (weak) return { ok: false, reason: weak };

  await store.createUser({
    id: randomUUID(),
    email,
    name: email.split('@')[0],
    role: 'admin',
    passwordHash: await hashPassword(input.password),
    totpEnabled: false,
    failedAttempts: 0,
    createdAt: new Date().toISOString(),
    setupCodeHash: codeHash,
  });
  await audit(email, 'account_created_with_setup_code', email, { role: 'admin', ip: ipHash });
  return { ok: true };
}

export async function hashPassword(password: string, minLength = MIN_PASSWORD_LENGTH) {
  if (password.length < minLength) throw new Error(`Password must be at least ${minLength} characters`);
  return bcrypt.hash(password, BCRYPT_COST);
}

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  totpEnabled: u.totpEnabled,
  ...(u.role === 'owner' ? { fieldIds: u.fieldIds ?? [] } : {}),
  ...(u.mustChangePassword ? { mustChangePassword: true } : {}),
});

/** Field-level access: admins and staff see every field; an owner only their own. Always checked server-side. */
export const canAccessField = (u: User, fieldId: string) => u.role !== 'owner' || (u.fieldIds ?? []).includes(fieldId);

/** Role permissions. Staff can run day-to-day bookings; only admins change fields or read the audit log. */
export const permissions = {
  // Owners get these too, but only for their own fields (canAccessField in each route).
  viewBookings: (r: Role) => r === 'admin' || r === 'staff' || r === 'owner',
  manageBookings: (r: Role) => r === 'admin' || r === 'staff' || r === 'owner',
  manageBlocks: (r: Role) => r === 'admin' || r === 'staff' || r === 'owner',
  editOwnField: (r: Role) => r === 'admin' || r === 'owner',
  uploadImages: (r: Role) => r === 'admin' || r === 'owner',
  // Admin/staff only:
  viewMessages: (r: Role) => r === 'admin' || r === 'staff',
  manageFields: (r: Role) => r === 'admin',
  manageOwners: (r: Role) => r === 'admin',
  viewAudit: (r: Role) => r === 'admin',
};
export type Permission = keyof typeof permissions;

/** Create the first admin from ADMIN_EMAIL + ADMIN_PASSWORD_HASH when no users exist yet. */
export async function ensureBootstrapAdmin() {
  const store = getStore();
  if ((await store.countUsers()) > 0) return;
  if (!env.bootstrapAdminEmail || !/^\$2[aby]\$\d{2}\$/.test(env.bootstrapAdminPasswordHash)) return;
  try {
    await store.createUser({
      id: randomUUID(),
      email: env.bootstrapAdminEmail,
      name: 'Admin',
      role: 'admin',
      passwordHash: env.bootstrapAdminPasswordHash,
      totpEnabled: false,
      failedAttempts: 0,
      createdAt: new Date().toISOString(),
    });
    await audit('system', 'user_bootstrapped', env.bootstrapAdminEmail, { role: 'admin' });
  } catch {
    /* created concurrently */
  }
}

export type LoginResult =
  | { ok: true; user: User; token: string }
  | { ok: false; reason: 'invalid' | 'locked' | 'totp_required' };

export async function authenticate(input: { email: string; password: string; totp?: string }, ipHash: string): Promise<LoginResult> {
  await ensureBootstrapAdmin();
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  const user = await store.getUserByEmail(email);

  if (!user || user.disabled) {
    await bcrypt.compare(input.password, await getDummyHash());
    await audit('anonymous', 'login_failed', email, { reason: 'unknown_user', ip: ipHash });
    return { ok: false, reason: 'invalid' };
  }

  // Locked accounts are rejected before the password is even checked.
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    await audit(email, 'login_blocked_locked', email, { ip: ipHash });
    return { ok: false, reason: 'locked' };
  }

  const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
  let totpStep: number | null = null;
  if (passwordOk && user.totpEnabled && user.totpSecretEnc) {
    if (!input.totp) return { ok: false, reason: 'totp_required' }; // not a failure yet: ask for the code
    totpStep = verifyTotp(decrypt(user.totpSecretEnc), input.totp, user.totpLastStep);
  }
  const success = passwordOk && (!user.totpEnabled || totpStep !== null);

  if (!success) {
    const failed = (user.failedAttempts || 0) + 1;
    if (failed >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
      await store.updateUser(user.id, { failedAttempts: 0, lockedUntil });
      await audit(email, 'account_locked', email, { minutes: LOCK_MINUTES, ip: ipHash });
      return { ok: false, reason: 'locked' };
    }
    await store.updateUser(user.id, { failedAttempts: failed });
    await audit(email, 'login_failed', email, { reason: passwordOk ? 'bad_totp' : 'bad_password', attempt: failed, ip: ipHash });
    return { ok: false, reason: 'invalid' };
  }

  await store.updateUser(user.id, {
    failedAttempts: 0,
    lockedUntil: undefined,
    lastLoginAt: new Date().toISOString(),
    ...(totpStep !== null ? { totpLastStep: totpStep } : {}),
  });
  const token = await createSession(user.id);
  await audit(email, 'login_success', email, { ip: ipHash, mfa: user.totpEnabled });
  return { ok: true, user, token };
}

export async function createSession(userId: string, kind: 'staff' | 'customer' = 'staff', maxAgeHours = env.sessionMaxAgeHours) {
  const token = randomToken(32);
  const now = Date.now();
  await getStore().createSession({
    id: sha256(token), // only the hash is stored: a DB leak doesn't leak live sessions
    userId,
    kind,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + maxAgeHours * 3_600_000).toISOString(),
  });
  return token;
}

export async function userFromSessionToken(token: string): Promise<User | null> {
  if (!token || token.length > 128) return null;
  const store = getStore();
  const session = await store.getSession(sha256(token));
  // A customer session must NEVER grant staff/admin access.
  if (!session || (session.kind ?? 'staff') !== 'staff') return null;
  if (new Date(session.expiresAt) <= new Date()) {
    await store.deleteSession(session.id);
    return null;
  }
  const user = await store.getUserById(session.userId);
  return user && !user.disabled ? user : null;
}

export async function destroySession(token: string) {
  if (token) await getStore().deleteSession(sha256(token));
}

/* ───── TOTP management ───── */

export async function startTotpSetup(user: User, secretB32: string) {
  await getStore().updateUser(user.id, { totpPendingEnc: encrypt(secretB32) });
}

export async function confirmTotp(user: User, code: string) {
  if (!user.totpPendingEnc) return false;
  const secret = decrypt(user.totpPendingEnc);
  const step = verifyTotp(secret, code);
  if (step === null) return false;
  await getStore().updateUser(user.id, { totpSecretEnc: user.totpPendingEnc, totpPendingEnc: undefined, totpEnabled: true, totpLastStep: step });
  await audit(user.email, 'totp_enabled', user.email);
  return true;
}

export async function disableTotp(user: User, password: string, code: string) {
  if (!user.totpEnabled || !user.totpSecretEnc) return false;
  const ok = (await bcrypt.compare(password, user.passwordHash)) && verifyTotp(decrypt(user.totpSecretEnc), code, user.totpLastStep) !== null;
  if (!ok) {
    log('warn', 'totp_disable_failed', { user: user.email });
    return false;
  }
  await getStore().updateUser(user.id, { totpEnabled: false, totpSecretEnc: undefined, totpLastStep: undefined });
  await audit(user.email, 'totp_disabled', user.email);
  return true;
}

/* ───── Field owner accounts (created by an admin) ───── */

/** Readable temporary password (no look-alike characters), e.g. "Kp7m-Xw3r-Tq9n". */
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomToken(24);
  let out = '';
  for (let i = 0; out.replace(/-/g, '').length < 12; i++) out += alphabet[bytes.charCodeAt(i) % alphabet.length];
  return out.replace(/(.{4})(?=.)/g, '$1-');
}

export type OwnerResult = { ok: true; user: User; tempPassword: string } | { ok: false; reason: 'exists' | 'no_fields' };

/** Admin creates a field-owner account. Returns a one-time temporary password to give to the owner. */
export async function createOwnerAccount(admin: User, input: { email: string; name: string; fieldIds: string[] }): Promise<OwnerResult> {
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  const existing = (await store.listFields()).map((f) => f.id);
  const fieldIds = Array.from(new Set(input.fieldIds)).filter((id) => existing.includes(id));
  if (fieldIds.length === 0) return { ok: false, reason: 'no_fields' };
  const prev = await store.getUserByEmail(email);
  if (prev && !prev.disabled) return { ok: false, reason: 'exists' };

  const tempPassword = temporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  let user: User;
  if (prev) {
    // Re-activate a previously removed account with the same email.
    user = (await store.updateUser(prev.id, {
      role: 'owner', name: input.name || prev.name, fieldIds, passwordHash, disabled: undefined,
      mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined,
      totpEnabled: false, totpSecretEnc: undefined, totpPendingEnc: undefined,
    }))!;
  } else {
    user = await store.createUser({
      id: randomUUID(), email, name: input.name || email.split('@')[0], role: 'owner', fieldIds,
      passwordHash, totpEnabled: false, failedAttempts: 0, mustChangePassword: true, createdAt: new Date().toISOString(),
    });
  }
  await audit(admin.email, 'owner_created', email, { fields: fieldIds.join(',') });
  return { ok: true, user, tempPassword };
}

/** Admin removes a field owner: they can no longer log in and every session is revoked. */
export async function disableOwner(admin: User, ownerId: string) {
  const store = getStore();
  const u = await store.getUserById(ownerId);
  if (!u || u.role !== 'owner') return false;
  await store.updateUser(u.id, { disabled: true, passwordHash: await bcrypt.hash(randomToken(32), BCRYPT_COST) });
  await store.deleteUserSessions(u.id);
  await audit(admin.email, 'owner_removed', u.email);
  return true;
}

export type PasswordChangeResult = { ok: true } | { ok: false; reason: 'wrong_password' | 'short' | 'weak' | 'same' };

/** Any staff user changes their own password (required for owners after their first login). */
export async function changeOwnPassword(user: User, current: string, next: string): Promise<PasswordChangeResult> {
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    await audit(user.email, 'password_change_failed', user.email, { reason: 'wrong_password' });
    return { ok: false, reason: 'wrong_password' };
  }
  if (current === next) return { ok: false, reason: 'same' };
  const weak = passwordProblem(next);
  if (weak) return { ok: false, reason: weak };
  await getStore().updateUser(user.id, { passwordHash: await hashPassword(next), mustChangePassword: undefined });
  await audit(user.email, 'password_changed', user.email);
  return { ok: true };
}
