/**
 * A brand-new, EMPTY database: the app must create its tables and load the fields by itself on first use,
 * and offer a one-time first-admin code that stops working once an admin exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const pg = new PGlite({ extensions: { btree_gist } });
let calls = 0;
const { setSqlForTests } = await import('../../src/lib/db/sql');
setSqlForTests(async (text: string, params: unknown[] = []) => {
  calls++;
  if (params.length === 0) return ((await pg.exec(text)).at(-1)?.rows ?? []) as never[];
  return (await pg.query(text, params)).rows as never[];
});
delete process.env.HAJZI_SEED;
delete process.env.ADMIN_SETUP_CODE;

const { getStore } = await import('../../src/lib/db');
const { realFields } = await import('../../src/data/seed');
const { SCHEMA_VERSION } = await import('../../src/lib/db/schema');
const core = await import('../../src/lib/auth/core');

test('first request on an empty database creates the tables and loads the 25 fields', async () => {
  const fields = await getStore().listFields();
  assert.equal(fields.length, realFields.length);
  const { rows } = await pg.query<{ value: string }>("select value from hajzi_meta where key = 'schema_version'");
  assert.equal(rows[0].value, SCHEMA_VERSION);
});

test('setup runs once per server instance, not on every query', async () => {
  const before = calls;
  await getStore().listFields();
  assert.equal(calls - before, 1);
});

test('fields edited by the admin are never reloaded over', async () => {
  await getStore().deleteField(realFields[0].id);
  setSqlForTests(async (text: string, params: unknown[] = []) =>
    params.length === 0 ? (((await pg.exec(text)).at(-1)?.rows ?? []) as never[]) : ((await pg.query(text, params)).rows as never[]),
  ); // simulates a new server instance
  assert.equal((await getStore().listFields()).length, realFields.length - 1);
});

test('first-admin code: works once, only while no staff account exists', async () => {
  const active = await core.activeSetupCode();
  assert.equal(active?.source, 'first-admin');
  assert.match(active!.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const pw = `Owner-${Math.random().toString(36).slice(2)}-pw`;
  assert.deepEqual(await core.createAccountWithSetupCode({ email: 'owner@hajzi.test', password: pw, code: 'WRONG-CODE-0000' }, 'ip'), { ok: false, reason: 'invalid_code' });
  assert.deepEqual(await core.createAccountWithSetupCode({ email: 'owner@hajzi.test', password: pw, code: active!.code.toLowerCase() }, 'ip'), { ok: true });
  assert.equal((await getStore().getUserByEmail('owner@hajzi.test'))?.role, 'admin');
  // Now an admin exists → the code no longer works and setup is disabled.
  assert.equal(await core.activeSetupCode(), null);
  assert.deepEqual(await core.createAccountWithSetupCode({ email: 'intruder@hajzi.test', password: pw, code: active!.code }, 'ip'), { ok: false, reason: 'disabled' });
});
