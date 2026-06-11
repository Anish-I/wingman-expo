import type { PgStore } from '../store.js';
import type { ComposioRuntime } from '../tools/composio.js';
import { buildRegistry } from '../tools/registry.js';
import { isDue } from './schedule.js';
import { runFlowDefinition } from './runner.js';

/**
 * Flow scheduler — a once-a-minute tick that runs due flows.
 *
 * Design choices for v1:
 *  - Polls every 60s and checks each active+scheduled flow against the current
 *    minute (isDue). Simple, no external job queue (BullMQ/Redis) — fits the
 *    "simple infra" goal and is easy to reason about at small scale.
 *  - De-dupes within the same minute via `last_run_at` so a flow fires at most
 *    once per scheduled minute even if a tick overlaps.
 *  - Each run builds a per-user tool registry (same path as chat), executes the
 *    steps deterministically, logs an activity entry, and bumps the run count.
 *  - Failures are logged to activity (not thrown) so one bad flow never stops the
 *    scheduler or other users' flows.
 *
 * Revisit for scale: move to a real job queue + leader election once we run more
 * than one server instance (a single SQLite/PG poller is fine for now).
 */

const TICK_MS = 60_000;

function sameMinute(aIso: string, b: Date): boolean {
  const a = new Date(aIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

export type Scheduler = { stop: () => void };

export async function runDueFlows(
  store: PgStore,
  composio: ComposioRuntime,
  now: Date = new Date(),
): Promise<number> {
  const flows = await store.getActiveScheduledFlows();
  let ran = 0;

  for (const flow of flows) {
    const def = flow.definition;
    if (!def?.schedule) continue;
    if (!isDue(def.schedule, now)) continue;
    // Already ran this minute? skip (idempotent within the tick window).
    if (flow.lastRunAt && sameMinute(flow.lastRunAt, now)) continue;

    const ctx = { userId: flow.userId, store };
    try {
      const registry = await buildRegistry({ ctx, composio });
      const result = await runFlowDefinition(def, registry, ctx);
      await store.recordFlowRun(flow.id, flow.userId, now.toISOString());
      ran += 1;

      if (result.ok) {
        await store.addActivity(flow.userId, {
          title: 'Flow ran',
          subtitle: flow.title,
          pip: 'clap',
          color: flow.color,
        });
      } else {
        await store.addActivity(flow.userId, {
          title: 'Flow failed',
          subtitle: `${flow.title}: ${result.error ?? 'unknown error'}`,
          pip: 'sad',
          color: '#EF4444',
        });
      }
    } catch (err) {
      // Never let one flow's failure break the tick.
      await store
        .addActivity(flow.userId, {
          title: 'Flow failed',
          subtitle: `${flow.title}: ${(err as Error).message}`,
          pip: 'sad',
          color: '#EF4444',
        })
        .catch(() => {});
    }
  }

  return ran;
}

export function startScheduler(store: PgStore, composio: ComposioRuntime): Scheduler {
  const timer = setInterval(() => {
    void runDueFlows(store, composio).catch((err) => {
      console.warn('[scheduler] tick failed:', (err as Error).message);
    });
  }, TICK_MS);
  // Don't keep the process alive solely for the scheduler.
  if (typeof timer.unref === 'function') timer.unref();
  return { stop: () => clearInterval(timer) };
}
