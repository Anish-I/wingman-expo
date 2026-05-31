import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SqliteStore } from './store.js';

const dir = mkdtempSync(path.join(tmpdir(), 'wingman-history-'));
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

test('chat history persists, returns in order, and clears per user', async () => {
  const user = await makeUser();
  store.appendHistory(user.id, { role: 'user', content: 'hello' });
  store.appendHistory(user.id, { role: 'assistant', content: 'hi there' });

  const history = store.getHistory(user.id);
  assert.equal(history.length, 2);
  assert.equal(history[0].content, 'hello');
  assert.equal(history[1].content, 'hi there');

  store.clearHistory(user.id);
  assert.equal(store.getHistory(user.id).length, 0);
});

test('chat history preserves tool messages (role, name, toolCallId)', async () => {
  const user = await makeUser();
  store.appendHistory(user.id, { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'briefing_today', arguments: {} }] });
  store.appendHistory(user.id, { role: 'tool', toolCallId: 'c1', name: 'briefing_today', content: 'You have 2 meetings.' });

  const history = store.getHistory(user.id);
  assert.equal(history.length, 2);
  const assistant = history[0];
  assert.equal(assistant.role, 'assistant');
  if (assistant.role === 'assistant') assert.equal(assistant.toolCalls?.[0].name, 'briefing_today');
  const tool = history[1];
  assert.equal(tool.role, 'tool');
  if (tool.role === 'tool') {
    assert.equal(tool.toolCallId, 'c1');
    assert.equal(tool.content, 'You have 2 meetings.');
  }
});

test('chat history survives a fresh store instance on the same db file', async () => {
  const user = await makeUser();
  store.appendHistory(user.id, { role: 'user', content: 'remember me' });

  const reopened = new SqliteStore(dbPath);
  await reopened.init();
  const history = reopened.getHistory(user.id);
  reopened.close();
  assert.equal(history.at(-1)?.content, 'remember me');
});
