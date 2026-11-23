import 'server-only';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getStore } from '../db';
import { audit } from '../logger';
import { maskPhone } from '../security/sanitize';
import { sha256 } from '../security/crypto';
import type { Customer, PublicCustomer } from '../types';
import { BCRYPT_COST, createSession, hashPassword, LOCK_MINUTES, MAX_FAILED_ATTEMPTS, passwordProblem } from './core';

/**
 * Customer accounts are completely separate from staff accounts:
 * different table, different cookie, and sessions marked kind='customer'
 * (which staff checks reject). Same protections: bcrypt, lockout, rate limits.
 */
export const CUSTOMER_MIN_PASSWORD = 8;
export const CUSTOMER_SESSION_HOURS = 24 * 30; // 30 days

export const toPublicCustomer = (c: Customer): PublicCustomer => ({ id: c.id, name: c.name, email: c.email, phone: c.phone });

let dummy: string | undefined;
const dummyHash = async () => (dummy ??= await bcrypt.hash('timing-equaliser-customer', BCRYPT_COST));

export type RegisterResult = { ok: true; customer: Customer; token: string } | { ok: false; reason: 'exists' | 'short' | 'weak' };

export async function registerCustomer(input: { name: string; phone: string; email: string; password: string }, ipHash: string): Promise<RegisterResult> {
  const weak = passwordProblem(input.password, CUSTOMER_MIN_PASSWORD);
  if (weak) return { ok: false, reason: weak };
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  if (await store.getCustomerByEmail(email)) return { ok: false, reason: 'exists' };
  let customer: Customer;
  try {
    customer = await store.createCustomer({
      id: randomUUID(),
      name: input.name,
      email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password, CUSTOMER_MIN_PASSWORD),
      failedAttempts: 0,
      createdAt: new Date().toISOString(),
    });
  } catch {
    return { ok: false, reason: 'exists' };
  }
  await audit(email, 'customer_registered', customer.id, { phone: maskPhone(customer.phone), ip: ipHash });
  const token = await createSession(customer.id, 'customer', CUSTOMER_SESSION_HOURS);
  return { ok: true, customer, token };
}

export type CustomerLoginResult = { ok: true; customer: Customer; token: string } | { ok: false };

/** Same lockout rules as staff: 5 failures → 15 minutes. One generic failure for every case. */
export async function authenticateCustomer(input: { email: string; password: string }, ipHash: string): Promise<CustomerLoginResult> {
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  const c = await store.getCustomerByEmail(email);
  if (!c) {
    await bcrypt.compare(input.password, await dummyHash());
    return { ok: false };
  }
  if (c.lockedUntil && new Date(c.lockedUntil) > new Date()) return { ok: false };
  if (!(await bcrypt.compare(input.password, c.passwordHash))) {
    const failed = (c.failedAttempts || 0) + 1;
    if (failed >= MAX_FAILED_ATTEMPTS) {
      await store.updateCustomer(c.id, { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() });
      await audit(email, 'customer_locked', c.id, { ip: ipHash });
    } else {
      await store.updateCustomer(c.id, { failedAttempts: failed });
    }
    return { ok: false };
  }
  await store.updateCustomer(c.id, { failedAttempts: 0, lockedUntil: undefined, lastLoginAt: new Date().toISOString() });
  const token = await createSession(c.id, 'customer', CUSTOMER_SESSION_HOURS);
  return { ok: true, customer: c, token };
}

export async function customerFromSessionToken(token: string): Promise<Customer | null> {
  if (!token || token.length > 128) return null;
  const store = getStore();
  const s = await store.getSession(sha256(token));
  if (!s || s.kind !== 'customer') return null;
  if (new Date(s.expiresAt) <= new Date()) {
    await store.deleteSession(s.id);
    return null;
  }
  return store.getCustomerById(s.userId);
}
