import assert from 'node:assert/strict';
import test from 'node:test';

import { isDue, isValidSchedule, describeSchedule } from './schedule.js';
import { resolveTemplate, runFlowDefinition, validateSteps } from './runner.js';
import type { FlowDefinition, FlowStep } from './types.js';
import type { Registry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';

// These are pure-logic tests — no DB, no network — so they always run.

function at(hour: number, minute: number, day = 1): Date {
  // Build a date with a known weekday. 2024-01-01 is a Monday (day 1).
  const base = new Date(2024, 0, 1); // Mon
  base.setDate(base.getDate() + (day - 1));
  base.setHours(hour, minute, 0, 0);
  return base;
}

test('isValidSchedule accepts valid and rejects out-of-range', () => {
  assert.equal(isValidSchedule({ hour: 8, minute: 0, days: [1, 2, 3, 4, 5] }), true);
  assert.equal(isValidSchedule({ hour: 24, minute: 0, days: [] }), false);
  assert.equal(isValidSchedule({ hour: 8, minute: 60, days: [] }), false);
  assert.equal(isValidSchedule({ hour: 8, minute: 0, days: [7] }), false);
});

test('isDue matches hour, minute, and weekday', () => {
  const sched = { hour: 8, minute: 30, days: [1, 2, 3, 4, 5] }; // weekdays 8:30
  assert.equal(isDue(sched, at(8, 30, 1)), true, 'Monday 8:30 is due');
  assert.equal(isDue(sched, at(8, 31, 1)), false, 'wrong minute');
  assert.equal(isDue(sched, at(9, 30, 1)), false, 'wrong hour');
  assert.equal(isDue(sched, at(8, 30, 7)), false, 'Sunday not in weekdays');
});

test('isDue with empty days means every day', () => {
  const sched = { hour: 0, minute: 0, days: [] };
  assert.equal(isDue(sched, at(0, 0, 7)), true);
  assert.equal(isDue(sched, at(0, 0, 3)), true);
});

test('describeSchedule renders friendly strings', () => {
  assert.equal(describeSchedule(null), 'Manual trigger');
  assert.equal(describeSchedule({ hour: 8, minute: 0, days: [] }), 'Daily 8:00 AM');
  assert.equal(describeSchedule({ hour: 8, minute: 0, days: [1, 2, 3, 4, 5] }), 'Weekdays 8:00 AM');
  assert.equal(describeSchedule({ hour: 21, minute: 30, days: [0, 6] }), 'Weekends 9:30 PM');
  assert.equal(describeSchedule({ hour: 12, minute: 0, days: [1] }), 'Mon 12:00 PM');
});

test('one-shot schedule: validate, describe, and due-after-target', () => {
  const once = { hour: 4, minute: 0, days: [], date: '2024-01-01' }; // Mon 4:00 AM
  assert.equal(isValidSchedule(once), true);
  assert.equal(isValidSchedule({ hour: 4, minute: 0, days: [], date: '2024-13-40' }), false, 'bad date rejected');
  assert.equal(describeSchedule(once), 'Once · Jan 1, 4:00 AM');

  // Due once the target time has arrived, and stays due afterwards (catch-up);
  // the scheduler pauses it after the first run so it never repeats.
  assert.equal(isDue(once, at(3, 59, 1)), false, 'before target not due');
  assert.equal(isDue(once, at(4, 0, 1)), true, 'at target is due');
  assert.equal(isDue(once, at(6, 30, 1)), true, 'after target still due (missed-tick catch-up)');
});

test('resolveTemplate substitutes prior step outputs by id and index', () => {
  const byId = new Map([['a', 'hello']]);
  const byIndex = ['hello'];
  assert.equal(resolveTemplate('say {{steps.a.output}}', byId, byIndex), 'say hello');
  assert.equal(resolveTemplate('say {{steps.0.output}}', byId, byIndex), 'say hello');
  assert.equal(resolveTemplate('say {{steps.missing.output}}', byId, byIndex), 'say ');
});

test('validateSteps catches empty, duplicate ids, and unknown tools', () => {
  const known = new Set(['briefing_today', 'remember']);
  assert.match(validateSteps([], known) ?? '', /at least one step/);
  assert.match(
    validateSteps([
      { id: 's1', tool: 'briefing_today', args: {} },
      { id: 's1', tool: 'remember', args: {} },
    ], known) ?? '',
    /Duplicate step id/,
  );
  assert.match(
    validateSteps([{ id: 's1', tool: 'nope', args: {} }], known) ?? '',
    /Unknown tool/,
  );
  assert.equal(validateSteps([{ id: 's1', tool: 'briefing_today', args: {} }], known), null);
});

test('runFlowDefinition executes steps in order and templates outputs', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const fakeRegistry: Registry = {
    definitions: [],
    async dispatch(call) {
      calls.push({ name: call.name, args: call.arguments });
      // Echo tool returns its `text` arg; list tool returns a fixed string.
      if (call.name === 'list') return { output: 'item1, item2' };
      return { output: String(call.arguments.text ?? '') };
    },
  };
  const def: FlowDefinition = {
    schedule: null,
    steps: [
      { id: 'fetch', tool: 'list', args: {} },
      { id: 'post', tool: 'echo', args: { text: 'Found: {{steps.fetch.output}}' } },
    ],
  };
  const ctx = { userId: 'u1' } as unknown as ToolContext;
  const result = await runFlowDefinition(def, fakeRegistry, ctx);
  assert.equal(result.ok, true);
  assert.deepEqual(result.outputs, ['item1, item2', 'Found: item1, item2']);
  assert.equal(calls[1].args.text, 'Found: item1, item2');
});

test('runFlowDefinition stops and reports on a failing step', async () => {
  const fakeRegistry: Registry = {
    definitions: [],
    async dispatch(call) {
      if (call.name === 'boom') throw new Error('kaboom');
      return { output: 'ok' };
    },
  };
  const def: FlowDefinition = {
    schedule: null,
    steps: [
      { id: 's1', tool: 'fine', args: {} },
      { id: 's2', tool: 'boom', args: {} },
      { id: 's3', tool: 'fine', args: {} },
    ] satisfies FlowStep[],
  };
  const ctx = { userId: 'u1' } as unknown as ToolContext;
  const result = await runFlowDefinition(def, fakeRegistry, ctx);
  assert.equal(result.ok, false);
  assert.equal(result.failedStepId, 's2');
  assert.match(result.error ?? '', /kaboom/);
  assert.deepEqual(result.outputs, ['ok']); // only the first step's output
});
