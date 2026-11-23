/**
 * Replace ALL fields in the database with the seed fields.
 *   npm run demo:reset-fields                  → the real "call to book" listings (src/data/seed.ts)
 *   HAJZI_SEED=demo npm run demo:reset-fields  → the fictional, bookable demo fields (src/data/demo-fields.ts)
 * Users, customers, bookings and logs are kept (old bookings keep their saved field name).
 */
import { seedFields } from '../src/data/seed';
import { closeSql, getStore } from '../src/lib/db';

async function main() {
  const store = getStore();
  const fieldsToLoad = seedFields();
  const existing = await store.listFields();
  for (const f of existing) if (!fieldsToLoad.some((s) => s.id === f.id)) await store.deleteField(f.id);
  for (const s of fieldsToLoad) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, ...data } = s;
    const updated = await store.updateField(id, data);
    if (!updated) {
      // createField derives the id from the English name, which matches the seed ids.
      const created = await store.createField(data);
      if (created.id !== id) console.warn(`Note: created ${created.id} (expected ${id})`);
    }
  }
  const fields = await store.listFields();
  console.log(`${fields.length} fields now:\n${fields.map((f) => `  ${f.name.en} (${f.type}${f.onlineBooking === false ? ', call to book' : ''})`).join('\n')}`);
}

main()
  .then(() => closeSql())
  .catch(async (e) => {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    await closeSql();
    process.exit(1);
  });
