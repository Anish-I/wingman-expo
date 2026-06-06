import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { PgStore } from './store.js';

const skip = process.env.DATABASE_URL ? false : 'set DATABASE_URL to run store tests';
const rid = () => crypto.randomBytes(4).toString('hex');

test('memory docs persist per user and inject into context', { skip }, async () => {
  const store = await PgStore.open();
  const created = await store.createAccount({ name: 'Mem', email: `mem-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const userId = created.account.id;
  await store.setMemoryDoc(userId, 'profile', 'Prefers tea over coffee.');
  const ctx = await store.getMemoryContext(userId);
  assert.match(ctx, /Prefers tea/);
});

test('appendDailyLog accumulates lines under the daily log', { skip }, async () => {
  const store = await PgStore.open();
  const created = await store.createAccount({ name: 'Log', email: `log-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const userId = created.account.id;
  await store.appendDailyLog(userId, 'Went for a run');
  const ctx = await store.getMemoryContext(userId);
  assert.match(ctx, /Went for a run/);
});
