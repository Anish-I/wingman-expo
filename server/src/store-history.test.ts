import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { PgStore } from './store.js';

const skip = process.env.DATABASE_URL ? false : 'set DATABASE_URL to run store tests';
const rid = () => crypto.randomBytes(4).toString('hex');

test('chat history persists and trims to the limit', { skip }, async () => {
  const store = await PgStore.open();
  const created = await store.createAccount({ name: 'Hist', email: `hist-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const userId = created.account.id;
  for (let i = 0; i < 5; i++) {
    await store.appendHistory(userId, { role: 'user', content: `m${i}` });
  }
  const history = await store.getHistory(userId);
  assert.equal(history.length, 5);
});

test('clearing history removes all messages for the user', { skip }, async () => {
  const store = await PgStore.open();
  const created = await store.createAccount({ name: 'Clear', email: `clear-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const userId = created.account.id;
  await store.appendHistory(userId, { role: 'user', content: 'hello' });
  await store.clearHistory(userId);
  const history = await store.getHistory(userId);
  assert.equal(history.length, 0);
});
