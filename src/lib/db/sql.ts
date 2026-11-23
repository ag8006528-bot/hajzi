import 'server-only';
import postgres from 'postgres';
import { seedFields } from '@/data/seed';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

/** Minimal SQL interface: parameterised queries only ($1, $2…), so user input never becomes SQL. */
export type Sql = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

const g = globalThis as unknown as {
  __hajziSql?: Sql;
  __hajziSqlEnd?: () => Promise<void>;
  __hajziSqlOverride?: Sql;
  __hajziReady?: Promise<void>;
};

/**
 * The database connection string. DATABASE_URL, or POSTGRES_URL, which Vercel's Supabase/Neon
 * integration sets automatically (the pooled connection, suitable for serverless).
 */
export function databaseUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

/** Is a real database configured? */
export const hasDatabase = () => Boolean(g.__hajziSqlOverride || databaseUrl());

/** Shared connection pool. */
export function getSql(): Sql {
  if (g.__hajziSqlOverride) return g.__hajziSqlOverride;
  if (g.__hajziSql) return g.__hajziSql;
  const raw = databaseUrl();
  if (!raw) throw new Error('DATABASE_URL is not set');
  // Drop provider-specific query options (e.g. ?sslmode=…&supa=…); TLS is configured below.
  const url = raw.split('?')[0];
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  const client = postgres(url, {
    max: process.env.VERCEL ? 3 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // required by transaction poolers (Supabase/pgbouncer)
    ssl: local ? false : 'require', // encrypted connection to any remote database
    onnotice: () => undefined,
  });
  g.__hajziSql = (<T,>(text: string, params: unknown[] = []) =>
    client.unsafe(text, params as never[]) as unknown as Promise<T[]>) as Sql;
  g.__hajziSqlEnd = () => client.end({ timeout: 5 });
  return g.__hajziSql;
}

/**
 * First use after a deploy: create/upgrade the tables if needed, and load the fields into an empty database.
 * Runs once per server instance; concurrent instances are serialised by a lock inside SCHEMA_SQL.
 */
export async function ensureSchema(sql: Sql = getSql()) {
  let current: string | undefined;
  try {
    current = (await sql<{ value: string }>("select value from hajzi_meta where key = 'schema_version'"))[0]?.value;
  } catch {
    current = undefined; // fresh database: tables don't exist yet
  }
  if (current !== SCHEMA_VERSION) await sql(SCHEMA_SQL);
  const [{ n }] = await sql<{ n: number }>('select count(*)::int as n from fields');
  if (n === 0) {
    for (const f of seedFields()) await sql('insert into fields (id, doc) values ($1, $2::jsonb) on conflict do nothing', [f.id, f]);
  }
}

function ready(): Promise<void> {
  g.__hajziReady ??= ensureSchema().catch((e) => {
    g.__hajziReady = undefined; // retry on the next request
    throw e;
  });
  return g.__hajziReady;
}

/** Run one parameterised query on the shared pool (the schema is ensured first). */
export const query: Sql = async (text, params) => {
  await ready();
  return getSql()(text, params);
};

/** Close the pool (scripts call this so the process can exit). */
export async function closeSql() {
  await g.__hajziSqlEnd?.();
  g.__hajziSql = undefined;
  g.__hajziSqlEnd = undefined;
  g.__hajziReady = undefined;
}

/** Tests: run the app against an in-process Postgres (PGlite). */
export function setSqlForTests(sql: Sql | undefined) {
  g.__hajziSqlOverride = sql;
  g.__hajziReady = undefined;
}
