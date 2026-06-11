import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { PgStore } from './store.js';

const skip = process.env.DATABASE_URL ? false : 'set DATABASE_URL to run store tests';
const rid = () => crypto.randomBytes(4).toString('hex');

async function makeUser(store: PgStore) {
  const created = await store.createAccount({ name: 'Settings', email: `set-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  return created.account.id;
}

test('new accounts have an empty phone (never the fake placeholder)', { skip }, async () => {
  const store = await PgStore.open();
  const id = await makeUser(store);
  const user = await store.getUserById(id);
  assert.equal(user?.phone, '');
});

test('settings default sensibly and persist a partial update', { skip }, async () => {
  const store = await PgStore.open();
  const id = await makeUser(store);

  const defaults = await store.getSettings(id);
  assert.deepEqual(defaults, { pushEnabled: true, quietHours: '10pm - 7am', memoryEnabled: true, timezone: '' });

  const updated = await store.updateSettings(id, { memoryEnabled: false, quietHours: '9pm - 6am', timezone: 'America/New_York' });
  assert.equal(updated.memoryEnabled, false);
  assert.equal(updated.quietHours, '9pm - 6am');
  assert.equal(updated.timezone, 'America/New_York');
  assert.equal(updated.pushEnabled, true); // untouched

  // Re-read proves persistence, not just the returned object.
  const reread = await store.getSettings(id);
  assert.deepEqual(reread, { pushEnabled: true, quietHours: '9pm - 6am', memoryEnabled: false, timezone: 'America/New_York' });
});

test('updateProfile changes name + phone, scoped to the owner', { skip }, async () => {
  const store = await PgStore.open();
  const id = await makeUser(store);

  const updated = await store.updateProfile(id, { name: 'Renamed', phone: '+1 555 222 3333' });
  assert.equal(updated?.name, 'Renamed');
  assert.equal(updated?.phone, '+1 555 222 3333');

  // Phone can be cleared back to empty.
  const cleared = await store.updateProfile(id, { phone: '' });
  assert.equal(cleared?.phone, '');
  assert.equal(cleared?.name, 'Renamed'); // name untouched when omitted
});

test('push subscriptions upsert by endpoint and read back scoped', { skip }, async () => {
  const store = await PgStore.open();
  const id = await makeUser(store);

  await store.savePushSubscription(id, { platform: 'web', endpoint: 'https://push.example/abc', keys: { p256dh: 'k1', auth: 'a1' } });
  // Same endpoint re-subscribes -> updates in place (still one row).
  await store.savePushSubscription(id, { platform: 'web', endpoint: 'https://push.example/abc', keys: { p256dh: 'k2', auth: 'a2' } });

  const targets = await store.getPushSubscriptions(id);
  assert.equal(targets.length, 1);
  assert.equal(targets[0]!.p256dh, 'k2');

  await store.deletePushSubscription(id, { endpoint: 'https://push.example/abc' });
  assert.equal((await store.getPushSubscriptions(id)).length, 0);
});
