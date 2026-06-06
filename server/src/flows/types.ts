/**
 * Flows v1 — data model.
 *
 * A flow is data, not code: a schedule (when to run) + an ordered list of steps
 * (what to do). Each step calls a tool (builtin or Composio) with arguments that
 * may template earlier steps' outputs. The runner executes steps in order; the
 * scheduler fires flows when they're due. This is the primitive the roadmap's
 * recipes/visual-builder features build on later.
 */

/** A weekly schedule. `days` empty = every day. days use 0=Sun … 6=Sat. */
export type FlowSchedule = {
  hour: number; // 0–23 (local server time)
  minute: number; // 0–59
  days: number[]; // subset of 0–6; empty means every day
};

/** One step: call `tool` with `args`. `args` strings may contain templates (see runner). */
export type FlowStep = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
};

/** The executable definition stored alongside a flow's display fields. */
export type FlowDefinition = {
  schedule: FlowSchedule | null;
  steps: FlowStep[];
};

export type FlowRunResult = {
  ok: boolean;
  outputs: string[];
  error?: string;
  failedStepId?: string;
};
