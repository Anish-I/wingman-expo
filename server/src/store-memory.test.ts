import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SqliteStore } from './store.js';

const dir = mkdtempSync(path.join(tmpdir(), 'wingman-memory-'));
const dbPath = path.join(dir, 'test.db');
let store: SqliteStore;

before(async () => {
  store = new SqliteStore(dbPath);
  await store.init();
});

beforeEach(() => {
  store.db.exec('DELETE FROM users');
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

async function makeUser() {
  const r = await store.createAccount({ name: 'Ana', email: 'ana@wingman.dev', password: 'hunter2pw' });
  if (!r.ok) throw new Error('account failed');
  return r.account;
}

test('appendDailyLog note is recalled in the memory context', async () => {
  const user = await makeUser();
  store.appendDailyLog(user.id, 'Prefers tea over coffee');
  const ctx = store.getMemoryContext(user.id);
  assert.match(ctx, /Prefers tea over coffee/);
});

test('profile doc is included in the memory context', async () => {
  const user = await makeUser();
  store.setMemoryDoc(user.id, 'profile', 'Name: Ana. Role: founder. Timezone: PT.');
  const ctx = store.getMemoryContext(user.id);
  assert.match(ctx, /Role: founder/);
});

test('memory survives a fresh store instance on the same db file', async () => {
  const user = await makeUser();
  store.appendDailyLog(user.id, 'Launches on Friday');

  const reopened = new SqliteStore(dbPath);
  await reopened.init();
  const ctx = reopened.getMemoryContext(user.id);
  reopened.close();
  assert.match(ctx, /Launches on Friday/);
});

test('memory context caps the daily log to recent notes', async () => {
  const user = await makeUser();
  for (let i = 0; i < 200; i++) {
    store.appendDailyLog(user.id, `note number ${i}`);
  }
  const ctx = store.getMemoryContext(user.id);
  assert.match(ctx, /note number 199/, 'newest note should be present');
  assert.doesNotMatch(ctx, /note number 0\b/, 'oldest note should be trimmed');
});

test('a user with no memory still returns a usable context string', async () => {
  const user = await makeUser();
  const ctx = store.getMemoryContext(user.id);
  assert.equal(typeof ctx, 'string');
  assert.equal(ctx.length > 0, true);
});
