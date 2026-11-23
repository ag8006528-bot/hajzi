/**
 * Manage staff accounts from the command line (no default passwords exist).
 *
 *   npm run user:create -- --email owner@hajzi.jo --role admin --name "Owner"
 *   npm run user:create -- --email staff@hajzi.jo --role staff
 *   npm run user:create -- --hash-only            # print a bcrypt hash for ADMIN_PASSWORD_HASH
 *   npm run user:create -- --unlock owner@hajzi.jo
 *   npm run user:create -- --reset-password owner@hajzi.jo
 *
 * The password is typed interactively (hidden) or read from the HAJZI_NEW_PASSWORD env var.
 */
import { randomUUID } from 'crypto';
import readline from 'readline';
import { hashPassword, MIN_PASSWORD_LENGTH, passwordProblem } from '../src/lib/auth/core';
import { closeSql, getStore } from '../src/lib/db';
import type { Role } from '../src/lib/types';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => {
      if (!muted || s.includes('\n')) out.output.write(muted ? '\n' : s);
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function getPassword() {
  const fromEnv = process.env.HAJZI_NEW_PASSWORD;
  if (fromEnv) return fromEnv;
  const p1 = await askHidden(`Password (min ${MIN_PASSWORD_LENGTH} chars): `);
  const p2 = await askHidden('Repeat password: ');
  if (p1 !== p2) throw new Error('Passwords do not match');
  return p1;
}

function checkStrength(p: string) {
  const problem = passwordProblem(p);
  if (problem === 'short') throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (problem === 'weak') throw new Error('Password is too easy to guess');
}

async function main() {
  const store = getStore();

  if (args.includes('--hash-only')) {
    const p = await getPassword();
    checkStrength(p);
    console.log(`\nADMIN_PASSWORD_HASH=${await hashPassword(p)}\n`);
    return;
  }

  const unlock = arg('unlock');
  if (unlock) {
    const u = await store.getUserByEmail(unlock);
    if (!u) throw new Error('User not found');
    await store.updateUser(u.id, { failedAttempts: 0, lockedUntil: undefined });
    console.log(`Unlocked ${u.email}`);
    return;
  }

  const reset = arg('reset-password');
  if (reset) {
    const u = await store.getUserByEmail(reset);
    if (!u) throw new Error('User not found');
    const p = await getPassword();
    checkStrength(p);
    await store.updateUser(u.id, { passwordHash: await hashPassword(p), failedAttempts: 0, lockedUntil: undefined });
    await store.deleteUserSessions(u.id); // log out everywhere
    console.log(`Password reset for ${u.email}; all sessions revoked.`);
    return;
  }

  // No arguments → friendly interactive mode that asks for everything (creates an admin).
  const interactive = !arg('email');
  const email = (arg('email') ?? (await ask('Your email (this is your login username): '))).trim().toLowerCase();
  const role = (arg('role') || (interactive ? 'admin' : 'staff')) as Role;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email, like name@gmail.com');
  if (await store.getUserByEmail(email)) throw new Error('An account with this email already exists');
  if (role !== 'admin' && role !== 'staff') throw new Error('--role must be admin or staff');
  const p = await getPassword();
  checkStrength(p);
  await store.createUser({
    id: randomUUID(),
    email,
    name: arg('name') || email.split('@')[0],
    role,
    passwordHash: await hashPassword(p),
    totpEnabled: false,
    failedAttempts: 0,
    createdAt: new Date().toISOString(),
  });
  console.log(`\n✅ Created ${role} account: ${email}`);
  console.log('   Now open http://localhost:3000/admin/login and sign in with this email and password.\n');
}

main()
  .then(() => closeSql())
  .catch(async (e) => {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    await closeSql();
    process.exit(1);
  });
