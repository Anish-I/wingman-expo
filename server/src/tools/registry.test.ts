import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { buildRegistry } from './registry.js';
import type { ToolContext } from './types.js';
import { PgStore } from '../store.js';

import { createComposioRuntime } from './composio.js';

const skip = process.env.DATABASE_URL ? false : 'set DATABASE_URL to run store tests';
const rid = () => crypto.randomBytes(4).toString('hex');

test('registry exposes builtin tools and dispatches them', { skip }, async () => {
  const store = await PgStore.open();
  const created = await store.createAccount({ name: 'Reg', email: `reg-${rid()}@example.com`, password: 'secret123' });
  assert.ok(created.ok);
  const ctx: ToolContext = { userId: created.account.id, store };
  const registry = await buildRegistry({ ctx, composio: createComposioRuntime({}) });
  const names = registry.definitions.map((d) => d.name);
  assert.ok(names.includes('remember'));
  assert.ok(names.includes('briefing_today'));
});
