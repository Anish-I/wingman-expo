import type { Registry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';
import type { FlowDefinition, FlowRunResult, FlowStep } from './types.js';

/**
 * Flow runner — executes a flow's steps in order through the tool registry.
 *
 * Templating: any string in a step's args may reference an earlier step's output
 * with `{{steps.<stepId>.output}}` (or `{{steps.<index>.output}}`, 0-based).
 * This is the "steps with templated inputs/outputs" primitive from the roadmap —
 * deterministic, no LLM in the loop, so it's cheap and predictable.
 *
 * Note (carried from the SQLite-era guidance, still true on Postgres): the runner
 * never holds a DB transaction across a tool call. Each tool dispatch is its own
 * awaited unit; persistence (activity log, run count) happens in the caller.
 */

const TEMPLATE_RE = /\{\{\s*steps\.([A-Za-z0-9_-]+)\.output\s*\}\}/g;

/** Resolve `{{steps.X.output}}` templates in a single string against prior outputs. */
export function resolveTemplate(
  value: string,
  outputsById: Map<string, string>,
  outputsByIndex: string[],
): string {
  return value.replace(TEMPLATE_RE, (_match, ref: string) => {
    if (outputsById.has(ref)) return outputsById.get(ref)!;
    const idx = Number(ref);
    if (Number.isInteger(idx) && idx >= 0 && idx < outputsByIndex.length) {
      return outputsByIndex[idx];
    }
    return '';
  });
}

/** Deep-resolve templates across a step's args (strings only; other types pass through). */
function resolveArgs(
  args: Record<string, unknown>,
  outputsById: Map<string, string>,
  outputsByIndex: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(args)) {
    out[key] = typeof val === 'string' ? resolveTemplate(val, outputsById, outputsByIndex) : val;
  }
  return out;
}

export async function runFlowDefinition(
  def: FlowDefinition,
  registry: Registry,
  ctx: ToolContext,
): Promise<FlowRunResult> {
  const outputs: string[] = [];
  const outputsById = new Map<string, string>();

  for (const step of def.steps) {
    const resolvedArgs = resolveArgs(step.args, outputsById, outputs);
    const call = { id: step.id, name: step.tool, arguments: resolvedArgs };
    try {
      const result = await registry.dispatch(call, ctx);
      outputs.push(result.output);
      outputsById.set(step.id, result.output);
    } catch (err) {
      return {
        ok: false,
        outputs,
        error: (err as Error).message,
        failedStepId: step.id,
      };
    }
  }

  return { ok: true, outputs };
}

/** Validate a step list before save (used by the dry-run / create path). */
export function validateSteps(steps: FlowStep[], knownTools: Set<string>): string | null {
  if (steps.length === 0) return 'A flow needs at least one step.';
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step.id) return 'Every step needs an id.';
    if (seen.has(step.id)) return `Duplicate step id: ${step.id}`;
    seen.add(step.id);
    if (!knownTools.has(step.tool)) return `Unknown tool: ${step.tool}`;
  }
  return null;
}
