import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { PgStore } from './store.js';

// Store tests run against a real Postgres (Supabase). Set DATABASE_URL to enable.
const skip = process.env.DATABASE_URL ? false : 'set DATABASE_URL to run store tests';
const rid = () => crypto.randomBytes(4).toString('hex');

function freshStore() {
  return PgStore.open();
}

test('createAccount + signIn issues a working session', { skip }, async () => {
  const store = await freshStore();
  const email = `test-${rid()}@example.com`;
  const created = await store.createAccount({ name: 'Test User', email, password: 'secret123' });
  assert.equal(created.ok, true);
  const signedIn = await store.signIn(email, 'secret123');
  assert.equal(signedIn.ok, true);
  assert.ok(signedIn.ok && signedIn.token.length > 0);
});

test('sessions resolve back to the user', { skip }, async () => {
  const store = await freshStore();
  const email = `Case-${rid()}@Example.com`;
  const created = await store.createAccount({ name: 'Case', email, password: 'secret123' });
  assert.ok(created.ok);
  const token = await store.createSession(created.account.id);
  const user = await store.getUserBySession(token);
  assert.ok(user);
  assert.equal(user?.email, email.toLowerCase());
});

test('data is isolated per user', { skip }, async () => {
  const store = await freshStore();
  const a = await store.createAccount({ name: 'A', email: `a-${rid()}@example.com`, password: 'secret123' });
  const b = await store.createAccount({ name: 'B', email: `b-${rid()}@example.com`, password: 'secret123' });
  assert.ok(a.ok && b.ok);
  await store.connectApp(a.account.id, 'gmail');
  const aApps = (await store.getApps(a.account.id)).filter((x) => x.connected).map((x) => x.slug);
  const bApps = (await store.getApps(b.account.id)).filter((x) => x.connected).map((x) => x.slug);
  assert.deepEqual(aApps, ['gmail']);
  assert.deepEqual(bApps, []);
});

test('connect token round-trips and marks app connected', { skip }, async () => {
  const store = await freshStore();
  const created = await store.createAccount({ name: 'Conn', email: `conn-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const token = await store.createConnectToken(created.account.id, 'slack');
  const consumed = await store.consumeConnectToken(token);
  assert.equal(consumed?.appSlug, 'slack');
  await store.connectApp(created.account.id, 'slack');
  const apps = (await store.getApps(created.account.id)).filter((x) => x.connected).map((x) => x.slug);
  assert.ok(apps.includes('slack'));
});
