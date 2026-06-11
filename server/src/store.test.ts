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

test('upsertUser creates then updates (Supabase-auth path)', { skip }, async () => {
  const store = await freshStore();
  const id = `sb-${rid()}`;
  const email = `sb-${rid()}@example.com`;
  const first = await store.upsertUser({ id, email, name: 'First Name' });
  assert.equal(first.created, true);
  assert.equal(first.user.id, id);
  assert.equal(first.user.email, email);

  // Same id again -> update, not create; name/email can change.
  const second = await store.upsertUser({ id, email, name: 'Renamed' });
  assert.equal(second.created, false);
  assert.equal(second.user.name, 'Renamed');

  const fetched = await store.getUserById(id);
  assert.equal(fetched?.name, 'Renamed');
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

test('createFlow + getFlowById round-trips the executable definition', { skip }, async () => {
  const store = await freshStore();
  const created = await store.createAccount({ name: 'Flow', email: `flow-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const userId = created.account.id;
  const flow = await store.createFlow(userId, {
    title: 'Morning brief',
    schedule: { hour: 8, minute: 0, days: [1, 2, 3, 4, 5] },
    steps: [{ id: 'step-1', tool: 'briefing_today', args: {} }],
  });
  assert.equal(flow.trigger, 'Weekdays 8:00 AM'); // derived, not hand-typed

  const fetched = await store.getFlowById(flow.id, userId);
  assert.ok(fetched);
  assert.equal(fetched?.definition?.steps.length, 1);
  assert.equal(fetched?.definition?.steps[0]?.tool, 'briefing_today');
  assert.deepEqual(fetched?.definition?.schedule?.days, [1, 2, 3, 4, 5]);

  // Owner scoping: another user can't read it.
  const other = await store.createAccount({ name: 'Other', email: `other-${rid()}@example.com`, password: 'secret123' });
  assert.ok(other.ok);
  assert.equal(await store.getFlowById(flow.id, other.account.id), null);
});

test('updateFlow re-derives the trigger and merges partial fields', { skip }, async () => {
  const store = await freshStore();
  const created = await store.createAccount({ name: 'Upd', email: `upd-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const userId = created.account.id;
  const flow = await store.createFlow(userId, { title: 'Draft', schedule: null, steps: [] });
  assert.equal(flow.trigger, 'Manual trigger');

  // Update only the schedule + steps; title is untouched.
  const updated = await store.updateFlow(flow.id, userId, {
    schedule: { hour: 21, minute: 30, days: [] },
    steps: [{ id: 'step-1', tool: 'briefing_today', args: {} }],
  });
  assert.ok(updated);
  assert.equal(updated?.title, 'Draft');
  assert.equal(updated?.trigger, 'Daily 9:30 PM');

  const fetched = await store.getFlowById(flow.id, userId);
  assert.equal(fetched?.definition?.steps.length, 1);
  assert.equal(fetched?.definition?.schedule?.hour, 21);

  // Updating a flow that isn't yours is a no-op (null).
  const other = await store.createAccount({ name: 'NotOwner', email: `no-${rid()}@example.com`, password: 'secret123' });
  assert.ok(other.ok);
  assert.equal(await store.updateFlow(flow.id, other.account.id, { title: 'Hijack' }), null);
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
