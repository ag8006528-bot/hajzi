import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { seedFields } from '@/data/seed';
import { calcPrice, overlaps, todayISO } from '../booking';
import type { AuditEntry, Block, Booking, BusyInterval, ContactMessage, Customer, Field, Session, User } from '../types';
import { NotFoundError, PhoneLimitError, SlotTakenError, type BookingFilter, type DataStore } from './store';

interface DB {
  fields: Field[];
  bookings: Booking[];
  blocks: Block[];
  users: User[];
  customers: Customer[];
  sessions: Session[];
  audit: AuditEntry[];
  messages: ContactMessage[];
}

export const DATA_FILE =
  process.env.HAJZI_DATA_FILE ||
  (process.env.VERCEL ? '/tmp/hajzi-db.json' : path.join(process.cwd(), 'data', 'db.json'));

/* ───────────── Locking ─────────────
 * 1. An in-process promise queue serialises writes inside one Node process
 *    (kept on globalThis so every route bundle shares the same queue).
 * 2. An atomic lock directory (mkdir is atomic on all OSes) serialises writes
 *    across processes (e.g. several `next start` workers on one server).
 * Every read-check-write (e.g. "is this slot free? then insert") runs inside both,
 * so two simultaneous requests for the same slot can never both succeed.
 */
const g = globalThis as unknown as { __hajziDbQueue?: Promise<unknown> };
g.__hajziDbQueue ??= Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquireFileLock() {
  const lockDir = `${DATA_FILE}.lock`;
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  for (let i = 0; i < 400; i++) {
    try {
      await fs.mkdir(lockDir);
      return () => fs.rmdir(lockDir).catch(() => undefined);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      // Break a stale lock left by a crashed process.
      try {
        const st = await fs.stat(lockDir);
        if (Date.now() - st.mtimeMs > 10_000) await fs.rmdir(lockDir).catch(() => undefined);
      } catch {
        /* lock vanished meanwhile */
      }
      await sleep(15 + Math.floor(Math.random() * 20));
    }
  }
  throw new Error('DB_LOCK_TIMEOUT');
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const task = async () => {
    const release = await acquireFileLock();
    try {
      return await fn();
    } finally {
      await release();
    }
  };
  const run = g.__hajziDbQueue!.then(task, task);
  g.__hajziDbQueue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<DB> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const db = JSON.parse(raw) as Partial<DB>;
    return {
      fields: db.fields ?? [],
      bookings: db.bookings ?? [],
      blocks: db.blocks ?? [],
      users: db.users ?? [],
      customers: db.customers ?? [],
      sessions: db.sessions ?? [],
      audit: db.audit ?? [],
      messages: db.messages ?? [],
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    const db: DB = {
      fields: structuredClone(seedFields()),
      bookings: [],
      blocks: [],
      users: [],
      customers: [],
      sessions: [],
      audit: [],
      messages: [],
    };
    await write(db);
    return db;
  }
}

async function write(db: DB) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, DATA_FILE);
}

/** Read-modify-write under the lock. */
function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const db = await read();
    const result = await fn(db);
    await write(db);
    return result;
  });
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'field';

function busyFrom(db: DB, fieldId: string, date: string): BusyInterval[] {
  return [
    ...db.bookings
      .filter((b) => b.fieldId === fieldId && b.date === date && b.status === 'confirmed')
      .map((b) => ({ start: b.startMinutes, duration: b.durationMinutes, kind: 'booking' as const })),
    ...db.blocks
      .filter((b) => b.fieldId === fieldId && b.date === date)
      .map((b) => ({ start: b.startMinutes, duration: b.durationMinutes, kind: 'block' as const, blockId: b.id })),
  ];
}

export const jsonStore: DataStore = {
  /* ── Fields ── */
  async listFields() {
    return (await read()).fields;
  },
  async getField(id) {
    return (await read()).fields.find((f) => f.id === id) ?? null;
  },
  createField(input) {
    return mutate((db) => {
      let id = slugify(input.name.en);
      while (db.fields.some((f) => f.id === id)) id = `${slugify(input.name.en)}-${randomUUID().slice(0, 4)}`;
      const field: Field = { ...input, id, createdAt: new Date().toISOString() };
      db.fields.push(field);
      return field;
    });
  },
  updateField(id, input) {
    return mutate((db) => {
      const i = db.fields.findIndex((f) => f.id === id);
      if (i === -1) return null;
      db.fields[i] = { ...db.fields[i], ...input, id, createdAt: db.fields[i].createdAt };
      return db.fields[i];
    });
  },
  deleteField(id) {
    return mutate((db) => {
      const before = db.fields.length;
      db.fields = db.fields.filter((f) => f.id !== id);
      db.blocks = db.blocks.filter((b) => b.fieldId !== id);
      return db.fields.length !== before;
    });
  },

  /* ── Bookings ── */
  async listBookings(filter: BookingFilter = {}) {
    const db = await read();
    return db.bookings
      .filter(
        (b) =>
          (!filter.date || b.date === filter.date) &&
          (!filter.fieldId || b.fieldId === filter.fieldId) &&
          (!filter.fieldType || b.fieldType === filter.fieldType) &&
          (!filter.status || b.status === filter.status) &&
          (!filter.customerId || b.customerId === filter.customerId),
      )
      .sort((a, b) => (a.date === b.date ? a.startMinutes - b.startMinutes : a.date < b.date ? 1 : -1));
  },
  async getBookingById(id) {
    return (await read()).bookings.find((b) => b.id === id) ?? null;
  },
  async getBookingByRef(ref) {
    return (await read()).bookings.find((b) => b.ref === ref.toUpperCase()) ?? null;
  },
  createBooking(input, opts) {
    return mutate((db) => {
      const field = db.fields.find((f) => f.id === input.fieldId);
      if (!field) throw new NotFoundError('FIELD_NOT_FOUND');
      // "Call to book" fields are listed only — never accept online bookings for them.
      if (field.onlineBooking === false || !(field.pricePerHour > 0)) throw new NotFoundError('FIELD_NOT_BOOKABLE');
      // The field closes earlier than the site-wide hours.
      if (field.closeMinutes && input.startMinutes + input.durationMinutes > field.closeMinutes) throw new NotFoundError('OUTSIDE_HOURS');

      // 1) Double-booking check — inside the lock, so it is race-free.
      const clash = busyFrom(db, field.id, input.date).some((b) =>
        overlaps(input.startMinutes, input.durationMinutes, b.start, b.duration),
      );
      if (clash) throw new SlotTakenError();

      // 2) Abuse limits per phone number.
      const active = db.bookings.filter((b) => b.status === 'confirmed' && b.phone === input.phone);
      const sameDay = active.filter((b) => b.date === input.date).length;
      const upcoming = active.filter((b) => b.date >= todayISO()).length;
      if (sameDay >= opts.maxPerPhonePerDay || upcoming >= opts.maxActivePerPhone) throw new PhoneLimitError();

      if (db.bookings.some((b) => b.ref === opts.ref)) throw new Error('REF_COLLISION');

      const booking: Booking = {
        id: randomUUID(),
        ref: opts.ref,
        fieldId: field.id,
        fieldName: field.name,
        fieldType: field.type,
        fieldAddress: field.address,
        date: input.date,
        startMinutes: input.startMinutes,
        durationMinutes: input.durationMinutes,
        customerName: input.customerName,
        phone: input.phone,
        players: input.players,
        notes: input.notes || undefined,
        // Price is ALWAYS computed on the server from the stored field price.
        totalPrice: calcPrice(field.pricePerHour, input.durationMinutes),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        accessTokenHash: opts.accessTokenHash,
        customerId: opts.customerId,
      };
      db.bookings.push(booking);
      return booking;
    });
  },
  setBookingStatus(id, status) {
    return mutate((db) => {
      const b = db.bookings.find((x) => x.id === id);
      if (!b) return null;
      // Restoring a cancelled booking must never create a double booking.
      if (status === 'confirmed' && b.status !== 'confirmed') {
        const clash = busyFrom(db, b.fieldId, b.date).some((x) => overlaps(b.startMinutes, b.durationMinutes, x.start, x.duration));
        if (clash) throw new SlotTakenError();
      }
      b.status = status;
      return b;
    });
  },

  /* ── Blocks ── */
  async listBlocks(fieldId, date) {
    return (await read()).blocks.filter((b) => b.fieldId === fieldId && b.date === date);
  },
  addBlock(fieldId, date, startMinutes, durationMinutes) {
    return mutate((db) => {
      if (busyFrom(db, fieldId, date).some((b) => overlaps(startMinutes, durationMinutes, b.start, b.duration)))
        throw new SlotTakenError();
      const block: Block = { id: randomUUID(), fieldId, date, startMinutes, durationMinutes, createdAt: new Date().toISOString() };
      db.blocks.push(block);
      return block;
    });
  },
  removeBlock(id) {
    return mutate((db) => {
      const block = db.blocks.find((b) => b.id === id) ?? null;
      db.blocks = db.blocks.filter((b) => b.id !== id);
      return block;
    });
  },

  async getBusy(fieldId, date) {
    return busyFrom(await read(), fieldId, date);
  },

  /* ── Users & sessions ── */
  async countUsers() {
    return (await read()).users.length;
  },
  async listUsers() {
    return (await read()).users;
  },
  async getUserByEmail(email) {
    const e = email.trim().toLowerCase();
    return (await read()).users.find((u) => u.email === e) ?? null;
  },
  async getUserById(id) {
    return (await read()).users.find((u) => u.id === id) ?? null;
  },
  createUser(user) {
    return mutate((db) => {
      if (db.users.some((u) => u.email === user.email)) throw new Error('USER_EXISTS');
      db.users.push(user);
      return user;
    });
  },
  updateUser(id, patch) {
    return mutate((db) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) return null;
      Object.assign(u, patch, { id: u.id });
      return u;
    });
  },
  async getCustomerByEmail(email) {
    const e = email.trim().toLowerCase();
    return (await read()).customers.find((c) => c.email === e) ?? null;
  },
  async getCustomerById(id) {
    return (await read()).customers.find((c) => c.id === id) ?? null;
  },
  createCustomer(customer) {
    return mutate((db) => {
      if (db.customers.some((c) => c.email === customer.email)) throw new Error('CUSTOMER_EXISTS');
      db.customers.push(customer);
      return customer;
    });
  },
  updateCustomer(id, patch) {
    return mutate((db) => {
      const c = db.customers.find((x) => x.id === id);
      if (!c) return null;
      Object.assign(c, patch, { id: c.id });
      return c;
    });
  },

  createSession(s) {
    return mutate((db) => {
      const now = new Date().toISOString();
      db.sessions = db.sessions.filter((x) => x.expiresAt > now); // drop expired
      db.sessions.push(s);
    });
  },
  async getSession(id) {
    return (await read()).sessions.find((s) => s.id === id) ?? null;
  },
  deleteSession(id) {
    return mutate((db) => {
      db.sessions = db.sessions.filter((s) => s.id !== id);
    });
  },
  deleteUserSessions(userId) {
    return mutate((db) => {
      db.sessions = db.sessions.filter((s) => s.userId !== userId);
    });
  },

  /* ── Audit log & messages ── */
  addAudit(e) {
    return mutate((db) => {
      db.audit.push(e);
      if (db.audit.length > 20_000) db.audit = db.audit.slice(-20_000);
    });
  },
  async listAudit(limit) {
    return (await read()).audit.slice(-limit).reverse();
  },
  addMessage(m) {
    return mutate((db) => {
      db.messages.push(m);
    });
  },
  async listMessages(limit) {
    return (await read()).messages.slice(-limit).reverse();
  },

  /* ── Data retention ── */
  runRetention(cutoffDate) {
    return mutate((db) => {
      let bookings = 0;
      for (const b of db.bookings) {
        if (b.date < cutoffDate && !b.anonymized) {
          b.customerName = '—';
          b.phone = '';
          b.notes = undefined;
          b.players = undefined;
          b.accessTokenHash = '';
          b.anonymized = true;
          bookings++;
        }
      }
      const cutoffIso = `${cutoffDate}T00:00:00.000Z`;
      const auditBefore = db.audit.length;
      db.audit = db.audit.filter((a) => a.at >= cutoffIso);
      const msgBefore = db.messages.length;
      db.messages = db.messages.filter((m) => m.createdAt >= cutoffIso);
      db.sessions = db.sessions.filter((s) => s.expiresAt > new Date().toISOString());
      return { bookings, audit: auditBefore - db.audit.length, messages: msgBefore - db.messages.length };
    });
  },
};
