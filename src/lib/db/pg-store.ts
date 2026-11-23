import 'server-only';
import { randomUUID } from 'crypto';
import { todayISO } from '../booking';
import type { AuditEntry, Block, Booking, ContactMessage, Customer, Field, Session, User } from '../types';
import { query } from './sql';
import { NotFoundError, PhoneLimitError, SlotTakenError, type DataStore } from './store';

/**
 * PostgreSQL implementation of DataStore (Supabase / Neon / Vercel Postgres / any Postgres 14+).
 * Schema: supabase/migrations/001_hajzi_schema.sql. Every query is parameterised.
 * Race-sensitive operations (booking, restoring, blocking) run inside database functions with
 * advisory locks + exclusion constraints, so they stay correct across many server instances.
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'field';

/** Split a patch into keys to set and keys to remove (undefined = remove, like `delete obj.key`). */
function patchParts(patch: object) {
  const set: Record<string, unknown> = {};
  const remove: string[] = [];
  for (const [k, v] of Object.entries(patch)) (v === undefined ? remove.push(k) : (set[k] = v));
  return { set: set, remove };
}

const pgCode = (e: unknown) => (e as { code?: string })?.code;
const pgMsg = (e: unknown) => (e as { message?: string })?.message ?? '';

/** Map database errors raised by our functions to the app's error types. */
function mapError(e: unknown): never {
  const m = pgMsg(e);
  if (m.includes('SLOT_TAKEN') || pgCode(e) === '23P01') throw new SlotTakenError();
  if (m.includes('PHONE_LIMIT')) throw new PhoneLimitError();
  if (m.includes('FIELD_NOT_FOUND')) throw new NotFoundError('FIELD_NOT_FOUND');
  if (m.includes('FIELD_NOT_BOOKABLE')) throw new NotFoundError('FIELD_NOT_BOOKABLE');
  if (m.includes('OUTSIDE_HOURS')) throw new NotFoundError('OUTSIDE_HOURS');
  throw e;
}

type DocRow<T> = { doc: T };
/** Drivers/poolers differ: jsonb may arrive parsed or as text. Accept both. */
const asDoc = <T,>(v: T | string | null | undefined): T | null =>
  v == null ? null : typeof v === 'string' ? (JSON.parse(v) as T) : v;
const docs = <T,>(rows: DocRow<T>[]) => rows.map((r) => asDoc(r.doc) as T);
const one = <T,>(rows: DocRow<T>[]) => asDoc(rows[0]?.doc);

export const pgStore: DataStore = {
  /* ── Fields ── */
  async listFields() {
    return docs(await query<DocRow<Field>>('select doc from fields order by created_at, id'));
  },
  async getField(id) {
    return one(await query<DocRow<Field>>('select doc from fields where id = $1', [id]));
  },
  async createField(input) {
    const base = slugify(input.name.en);
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 4)}`;
      const field: Field = { ...input, id, createdAt: new Date().toISOString() };
      const rows = await query<DocRow<Field>>(
        'insert into fields (id, doc) values ($1, $2::jsonb) on conflict (id) do nothing returning doc',
        [id, field],
      );
      if (rows[0]) return asDoc(rows[0].doc) as Field;
    }
    throw new Error('FIELD_ID_COLLISION');
  },
  async updateField(id, input) {
    const { set, remove } = patchParts({ ...input, id: undefined, createdAt: undefined });
    return one(
      await query<DocRow<Field>>(
        // id/createdAt are protected: removed from the patch, then the stored values are kept.
        `update fields set doc = ((doc - $3::text[]) || ($2::jsonb - 'id' - 'createdAt'))
                                  || jsonb_build_object('id', doc->'id', 'createdAt', doc->'createdAt')
          where id = $1 returning doc`,
        [id, set, remove.filter((k) => k !== 'id' && k !== 'createdAt')],
      ),
    );
  },
  async deleteField(id) {
    const rows = await query('delete from fields where id = $1 returning id', [id]); // blocks cascade
    return rows.length > 0;
  },

  /* ── Bookings ── */
  async listBookings(filter = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (filter.date) add('booking_date = ?::date', filter.date);
    if (filter.fieldId) add('field_id = ?', filter.fieldId);
    if (filter.fieldType) add("doc->>'fieldType' = ?", filter.fieldType);
    if (filter.status) add('status = ?', filter.status);
    if (filter.customerId) add('customer_id = ?', filter.customerId);
    return docs(
      await query<DocRow<Booking>>(
        `select doc from bookings ${where.length ? `where ${where.join(' and ')}` : ''}
          order by booking_date desc, start_minutes asc limit 5000`,
        params,
      ),
    );
  },
  async getBookingById(id) {
    return one(await query<DocRow<Booking>>('select doc from bookings where id = $1', [id]));
  },
  async getBookingByRef(ref) {
    return one(await query<DocRow<Booking>>('select doc from bookings where ref = $1', [ref.toUpperCase()]));
  },
  async createBooking(input, opts) {
    const doc: Partial<Booking> = {
      id: randomUUID(),
      ref: opts.ref,
      fieldId: input.fieldId,
      date: input.date,
      startMinutes: input.startMinutes,
      durationMinutes: input.durationMinutes,
      customerName: input.customerName,
      phone: input.phone,
      ...(input.players !== undefined ? { players: input.players } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      createdAt: new Date().toISOString(),
      accessTokenHash: opts.accessTokenHash,
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      // fieldName/fieldType/fieldAddress/totalPrice/status are filled in by the database function.
    };
    try {
      const rows = await query<{ doc: Booking }>('select hajzi_create_booking($1::jsonb, $2, $3, $4::date) as doc', [
        doc,
        opts.maxPerPhonePerDay,
        opts.maxActivePerPhone,
        todayISO(),
      ]);
      const b = asDoc(rows[0].doc) as Booking;
      return { ...b, totalPrice: Number(b.totalPrice) };
    } catch (e) {
      if (pgCode(e) === '23505' && pgMsg(e).includes('ref')) throw new Error('REF_COLLISION');
      mapError(e);
    }
  },
  async setBookingStatus(id, status) {
    try {
      const rows = await query<{ doc: Booking | null }>('select hajzi_set_booking_status($1, $2) as doc', [id, status]);
      return asDoc(rows[0]?.doc);
    } catch (e) {
      mapError(e);
    }
  },

  /* ── Blocks ── */
  async listBlocks(fieldId, date) {
    const rows = await query<{ id: string; field_id: string; d: string; s: number; dur: number; created: string }>(
      `select id, field_id, block_date::text as d, start_minutes as s, duration_minutes as dur,
              to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created
         from blocks where field_id = $1 and block_date = $2::date order by start_minutes`,
      [fieldId, date],
    );
    return rows.map((r): Block => ({ id: r.id, fieldId: r.field_id, date: r.d, startMinutes: r.s, durationMinutes: r.dur, createdAt: r.created }));
  },
  async addBlock(fieldId, date, startMinutes, durationMinutes) {
    const id = randomUUID();
    try {
      await query('select hajzi_add_block($1, $2, $3::date, $4, $5)', [id, fieldId, date, startMinutes, durationMinutes]);
    } catch (e) {
      if (pgCode(e) === '23503') throw new NotFoundError('FIELD_NOT_FOUND');
      mapError(e);
    }
    return { id, fieldId, date, startMinutes, durationMinutes, createdAt: new Date().toISOString() };
  },
  async removeBlock(id) {
    const rows = await query<{ id: string; field_id: string; d: string; s: number; dur: number }>(
      'delete from blocks where id = $1 returning id, field_id, block_date::text as d, start_minutes as s, duration_minutes as dur',
      [id],
    );
    const r = rows[0];
    return r ? { id: r.id, fieldId: r.field_id, date: r.d, startMinutes: r.s, durationMinutes: r.dur, createdAt: '' } : null;
  },

  async getBusy(fieldId, date) {
    const rows = await query<{ s: number; dur: number; kind: 'booking' | 'block'; block_id: string | null }>(
      `select start_minutes as s, duration_minutes as dur, 'booking' as kind, null as block_id
         from bookings where field_id = $1 and booking_date = $2::date and status = 'confirmed'
       union all
       select start_minutes, duration_minutes, 'block', id from blocks where field_id = $1 and block_date = $2::date`,
      [fieldId, date],
    );
    return rows.map((r) => ({ start: r.s, duration: r.dur, kind: r.kind, ...(r.block_id ? { blockId: r.block_id } : {}) }));
  },

  /* ── Staff users ── */
  async countUsers() {
    const rows = await query<{ n: number }>('select count(*)::int as n from users');
    return rows[0].n;
  },
  async listUsers() {
    return docs(await query<DocRow<User>>('select doc from users order by email'));
  },
  async getUserByEmail(email) {
    return one(await query<DocRow<User>>('select doc from users where email = $1', [email.trim().toLowerCase()]));
  },
  async getUserById(id) {
    return one(await query<DocRow<User>>('select doc from users where id = $1', [id]));
  },
  async createUser(user) {
    try {
      await query('insert into users (id, email, doc) values ($1, $2, $3::jsonb)', [user.id, user.email, user]);
      return user;
    } catch (e) {
      if (pgCode(e) === '23505') throw new Error('USER_EXISTS');
      throw e;
    }
  },
  async updateUser(id, patch) {
    const { set, remove } = patchParts({ ...patch, id: undefined });
    return one(
      await query<DocRow<User>>(
        `update users set doc = ((doc - $3::text[]) || ($2::jsonb - 'id')) || jsonb_build_object('id', doc->'id'),
                          email = coalesce($2::jsonb->>'email', email)
          where id = $1 returning doc`,
        [id, set, remove.filter((k) => k !== 'id')],
      ),
    );
  },

  /* ── Customers ── */
  async getCustomerByEmail(email) {
    return one(await query<DocRow<Customer>>('select doc from customers where email = $1', [email.trim().toLowerCase()]));
  },
  async getCustomerById(id) {
    return one(await query<DocRow<Customer>>('select doc from customers where id = $1', [id]));
  },
  async createCustomer(c) {
    try {
      await query('insert into customers (id, email, doc) values ($1, $2, $3::jsonb)', [c.id, c.email, c]);
      return c;
    } catch (e) {
      if (pgCode(e) === '23505') throw new Error('CUSTOMER_EXISTS');
      throw e;
    }
  },
  async updateCustomer(id, patch) {
    const { set, remove } = patchParts({ ...patch, id: undefined });
    return one(
      await query<DocRow<Customer>>(
        `update customers set doc = ((doc - $3::text[]) || ($2::jsonb - 'id')) || jsonb_build_object('id', doc->'id'),
                              email = coalesce($2::jsonb->>'email', email)
          where id = $1 returning doc`,
        [id, set, remove.filter((k) => k !== 'id')],
      ),
    );
  },

  /* ── Sessions ── */
  async createSession(s: Session) {
    await query('delete from sessions where expires_at < now()');
    await query('insert into sessions (id, user_id, kind, expires_at, doc) values ($1, $2, $3, $4::timestamptz, $5::jsonb)', [
      s.id,
      s.userId,
      s.kind ?? 'staff',
      s.expiresAt,
      s,
    ]);
  },
  async getSession(id) {
    return one(await query<DocRow<Session>>('select doc from sessions where id = $1', [id]));
  },
  async deleteSession(id) {
    await query('delete from sessions where id = $1', [id]);
  },
  async deleteUserSessions(userId) {
    await query('delete from sessions where user_id = $1', [userId]);
  },

  /* ── Audit log & messages ── */
  async addAudit(e: AuditEntry) {
    await query('insert into audit_log (id, at, doc) values ($1, $2::timestamptz, $3::jsonb) on conflict (id) do nothing', [
      e.id,
      e.at,
      e,
    ]);
  },
  async listAudit(limit) {
    return docs(await query<DocRow<AuditEntry>>('select doc from audit_log order by at desc limit $1', [limit]));
  },
  async addMessage(m: ContactMessage) {
    await query('insert into contact_messages (id, created_at, doc) values ($1, $2::timestamptz, $3::jsonb)', [
      m.id,
      m.createdAt,
      m,
    ]);
  },
  async listMessages(limit) {
    return docs(await query<DocRow<ContactMessage>>('select doc from contact_messages order by created_at desc limit $1', [limit]));
  },

  /* ── Data retention ── */
  async runRetention(cutoffDate) {
    const rows = await query<{ r: { bookings: number; audit: number; messages: number } }>(
      'select hajzi_run_retention($1::date) as r',
      [cutoffDate],
    );
    return asDoc(rows[0].r) as { bookings: number; audit: number; messages: number };
  },
};
