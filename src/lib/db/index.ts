import 'server-only';
import { jsonStore } from './json-store';
import { pgStore } from './pg-store';
import { hasDatabase } from './sql';
import type { DataStore } from './store';

export * from './store';
export { closeSql } from './sql';

/**
 * Single entry point for data access.
 *  - DATABASE_URL set → PostgreSQL (production: Supabase / Neon / Vercel Postgres).
 *  - otherwise        → JSON file in ./data (local development, single server).
 */
export function getStore(): DataStore {
  return hasDatabase() ? pgStore : jsonStore;
}
