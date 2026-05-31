import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SqliteStore } from '../store.js';
import { buildRegistry, MAX_COMPOSIO_TOOLS } from './registry.js';
import type { ComposioRuntime } from './composio.js';
import type { ToolDefinition, ToolCall } from '../llm/types.js';

const dir = mkdtempSync(path.join(tmpdir(), 'wingman-registry-'));
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

// Fake Composio that records which toolkits were queried and returns `perToolkit` tools each.
function fakeComposio(perToolkit: number): ComposioRuntime & { queried: string[] } {
  const queried: string[] = [];
  return {
    queried,
    enabled: true,
    async listTools(_userId: string, toolkits?: string[]) {
      const slugs = toolkits ?? [];
      const out: { definition: ToolDefinition; slug: string; toolkit: string }[] = [];
      for (const tk of slugs) {
        queried.push(tk);
        for (let i = 0; i < perToolkit; i++) {
          out.push({ definition: { name: `${tk}_tool_${i}`, description: '', parameters: {} }, slug: `${tk}_tool_${i}`, toolkit: tk });
        }
      }
      return out;
    },
    async execute(_userId: string, _call: ToolCall) {
      return 'ok';
    },
    async initiateConnection() {
      return { url: null, connectionId: null };
    },
  };
}

test('only the user\'s connected toolkits are queried for tools', async () => {
  const user = await makeUser();
  await store.connectApp(user.id, 'gmail');
  await store.connectApp(user.id, 'slack');
  const composio = fakeComposio(2);

  await buildRegistry({ ctx: { userId: user.id, store }, composio });

  assert.deepEqual([...composio.queried].sort(), ['gmail', 'slack']);
});

test('no connected apps means no Composio tools are loaded', async () => {
  const user = await makeUser();
  const composio = fakeComposio(5);

  const registry = await buildRegistry({ ctx: { userId: user.id, store }, composio });

  assert.equal(composio.queried.length, 0);
  // Only builtin tools remain.
  assert.equal(registry.definitions.every((d) => !d.name.includes('_tool_')), true);
});

test('the exposed Composio tool count is capped per turn', async () => {
  const user = await makeUser();
  for (const slug of ['gmail', 'slack', 'github', 'notion']) {
    await store.connectApp(user.id, slug);
  }
  const composio = fakeComposio(20); // 4 toolkits * 20 = 80 available

  const registry = await buildRegistry({ ctx: { userId: user.id, store }, composio });

  const composioCount = registry.definitions.filter((d) => d.name.includes('_tool_')).length;
  assert.equal(composioCount <= MAX_COMPOSIO_TOOLS, true, `expected <= ${MAX_COMPOSIO_TOOLS}, got ${composioCount}`);
});

test('builtin tools are always present', async () => {
  const user = await makeUser();
  const composio = fakeComposio(0);
  const registry = await buildRegistry({ ctx: { userId: user.id, store }, composio });
  const names = registry.definitions.map((d) => d.name);
  for (const t of ['briefing_today', 'create_app_connection', 'remember']) {
    assert.equal(names.includes(t), true, `missing builtin ${t}`);
  }
});
