import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SqliteStore } from './store.js';

const dir = mkdtempSync(path.join(tmpdir(), 'wingman-store-'));
const dbPath = path.join(dir, 'test.db');
let store: SqliteStore;

before(async () => {
  store = new SqliteStore(dbPath);
  await store.init();
});

beforeEach(() => {
  // Deleting users cascades to every child table (FK ON DELETE CASCADE).
  store.db.exec('DELETE FROM users');
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

async function makeUser(email = 'ana@wingman.dev') {
  const result = await store.createAccount({ name: 'Ana Dev', email, password: 'hunter2pw' });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('account creation failed');
  return result.account;
}

test('createAccount stores a hashed password, never plaintext', async () => {
  const result = await store.createAccount({
    name: 'Ana Dev',
    email: 'ana@wingman.dev',
    password: 'hunter2pw',
  });
  assert.equal(result.ok, true);
  const row = store.db
    .prepare('SELECT password_hash AS h FROM users WHERE lower(email) = lower(?)')
    .get('ana@wingman.dev') as { h: string } | undefined;
  assert.ok(row?.h && row.h.startsWith('scrypt$'));
  assert.notEqual(row?.h, 'hunter2pw');
});

test('signIn succeeds with correct credentials and returns a session token', async () => {
  await makeUser();
  const result = await store.signIn('ana@wingman.dev', 'hunter2pw');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.token.length > 0);
    assert.equal(result.account.email, 'ana@wingman.dev');
  }
});

test('signIn rejects a wrong password', async () => {
  await makeUser();
  const result = await store.signIn('ana@wingman.dev', 'wrongpass');
  assert.equal(result.ok, false);
});

test('getUserBySession resolves the user for a valid token', async () => {
  const user = await makeUser();
  const token = await store.createSession(user.id);
  const resolved = store.getUserBySession(token);
  assert.equal(resolved?.email, 'ana@wingman.dev');
});

test('createAccount rejects a duplicate email', async () => {
  await makeUser();
  const dup = await store.createAccount({
    name: 'Other',
    email: 'ana@wingman.dev',
    password: 'differentpw',
  });
  assert.equal(dup.ok, false);
});

test('a new account starts with all apps disconnected', async () => {
  const user = await makeUser();
  const apps = store.getApps(user.id);
  assert.equal(apps.length > 0, true);
  assert.equal(apps.every((a) => a.connected === false), true);
});

test('connectApp connects an app for one user only', async () => {
  const ana = await makeUser('ana@wingman.dev');
  const ben = await makeUser('ben@wingman.dev');
  await store.connectApp(ana.id, 'gmail');
  assert.equal(store.getApps(ana.id).find((a) => a.slug === 'gmail')?.connected, true);
  assert.equal(store.getApps(ben.id).find((a) => a.slug === 'gmail')?.connected, false);
});

test('connect token roundtrips and is single-use', async () => {
  const user = await makeUser();
  const token = await store.createConnectToken(user.id, 'slack');
  const first = await store.consumeConnectToken(token);
  assert.equal(first?.appSlug, 'slack');
  assert.equal(first?.userId, user.id);
  assert.equal(await store.consumeConnectToken(token), null);
});

test('createFlow then setFlowActive toggles persisted state', async () => {
  const user = await makeUser();
  const flow = await store.createFlow(user.id);
  assert.equal(flow.active, true);
  const paused = await store.setFlowActive(flow.id, false);
  assert.equal(paused?.active, false);
  assert.equal(store.getFlows(user.id).find((f) => f.id === flow.id)?.active, false);
});

test('addActivity is returned newest-first for the user', async () => {
  const user = await makeUser();
  await store.addActivity(user.id, { title: 'First', subtitle: 'one', pip: 'clap', color: '#000' });
  await store.addActivity(user.id, { title: 'Second', subtitle: 'two', pip: 'clap', color: '#000' });
  const items = store.getActivities(user.id);
  assert.equal(items[0].title, 'Second');
  assert.equal(items[1].title, 'First');
});

test('createCalendarEvent persists and appears in the user briefing', async () => {
  const user = await makeUser();
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(30);
  await store.createCalendarEvent(user.id, {
    title: 'Design review',
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    subtitle: 'Meet · 30 min',
  });
  const briefing = store.getBriefing(user.id);
  assert.equal(briefing.items.some((i) => i.title === 'Design review'), true);
});

test('deleteAccount removes the user and their session', async () => {
  const user = await makeUser();
  const token = await store.createSession(user.id);
  await store.connectApp(user.id, 'gmail');
  await store.deleteAccount(user.id);
  assert.equal(store.getUserBySession(token), null);
});
