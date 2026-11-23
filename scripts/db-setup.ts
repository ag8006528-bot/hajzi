/**
 * Prepare a PostgreSQL database (e.g. Supabase) for HAJZI. Safe to run more than once.
 *
 *   npm run db:setup                         # asks for the database URL (hidden), creates tables, loads the 25 fields
 *   npm run db:setup -- --import data/db.json  # also copies accounts, bookings and messages from the local JSON store
 *
 * The URL can also come from the DATABASE_URL environment variable. It is never printed or saved.
 */
import { existsSync, readFileSync } from 'fs';
import readline from 'readline';
import { seedFields } from '../src/data/seed';
import { SCHEMA_SQL } from '../src/lib/db/schema';
import { closeSql, getSql } from '../src/lib/db/sql';

const args = process.argv.slice(2);
const importIdx = args.indexOf('--import');
const importFile = importIdx >= 0 ? args[importIdx + 1] : undefined;

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => {
      if (!muted || s.includes('\n')) out.output.write(muted ? '\n' : s);
    };
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    });
    muted = true;
  });
}

async function main() {
  if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) process.env.DATABASE_URL = process.env.POSTGRES_URL;
  if (!process.env.DATABASE_URL) {
    console.log('Paste your database connection string (Supabase → Connect → "Transaction pooler" URI).');
    console.log('It stays hidden and is not saved anywhere.\n');
    process.env.DATABASE_URL = await askHidden('DATABASE_URL: ');
  }
  if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) throw new Error('That does not look like a postgres:// URL');
  const sql = getSql();

  // 1) Tables, constraints, security and functions.
  await sql(SCHEMA_SQL);
  console.log('✔ Database tables, double-booking protection and security rules are in place');

  // 2) Fields (only if the table is empty, so edits made in the admin panel are never overwritten).
  const [{ n }] = await sql<{ n: number }>('select count(*)::int as n from fields');
  if (n === 0) {
    for (const f of seedFields()) await sql('insert into fields (id, doc) values ($1, $2::jsonb) on conflict do nothing', [f.id, f]);
    console.log(`✔ Loaded ${seedFields().length} fields`);
  } else {
    console.log(`• ${n} fields already exist, left unchanged`);
  }

  // 3) Optional: copy data from the local JSON store.
  if (importFile) {
    if (!existsSync(importFile)) throw new Error(`File not found: ${importFile}`);
    const db = JSON.parse(readFileSync(importFile, 'utf8'));
    const c = { users: 0, customers: 0, bookings: 0, messages: 0 };
    for (const u of db.users ?? [])
      c.users += (await sql('insert into users (id, email, doc) values ($1, $2, $3::jsonb) on conflict do nothing returning id', [u.id, u.email, u])).length;
    for (const cu of db.customers ?? [])
      c.customers += (await sql('insert into customers (id, email, doc) values ($1, $2, $3::jsonb) on conflict do nothing returning id', [cu.id, cu.email, cu])).length;
    for (const b of db.bookings ?? []) {
      try {
        c.bookings += (
          await sql(
            `insert into bookings (id, ref, field_id, booking_date, start_minutes, duration_minutes, status, phone, customer_id, doc)
             values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10::jsonb) on conflict do nothing returning id`,
            [b.id, b.ref, b.fieldId, b.date, b.startMinutes, b.durationMinutes, b.status, b.phone ?? '', b.customerId ?? null, b],
          )
        ).length;
      } catch (e) {
        console.warn(`  skipped booking ${b.ref}: ${(e as Error).message}`);
      }
    }
    for (const m of db.messages ?? [])
      c.messages += (await sql('insert into contact_messages (id, created_at, doc) values ($1, $2::timestamptz, $3::jsonb) on conflict do nothing returning id', [m.id, m.createdAt, m])).length;
    console.log(`✔ Imported ${c.users} staff, ${c.customers} customers, ${c.bookings} bookings, ${c.messages} messages`);
  }

  console.log('\nDone. The database is ready.');
}

main()
  .then(() => closeSql())
  .catch(async (e) => {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    await closeSql();
    process.exit(1);
  });
