import type { FlowSchedule } from './types.js';

/**
 * Schedule helpers — pure functions, no I/O, so they unit-test without a DB.
 *
 * A flow is "due" within a one-minute tick when the current local time matches
 * the schedule's hour/minute and the weekday is allowed. We also expose
 * `describeSchedule` to render the human-friendly `trigger` string the UI shows
 * (e.g. "Weekdays 8:00 AM"), keeping the display string derived from real data
 * instead of hand-typed.
 */

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A one-shot schedule runs once at an absolute date, then auto-pauses. */
export function isOneShot(s: FlowSchedule): boolean {
  return typeof s.date === 'string' && s.date.length > 0;
}

/** Resolve a one-shot schedule to its concrete local run time (or null if malformed). */
export function oneShotTarget(s: FlowSchedule): Date | null {
  if (!s.date) return null;
  const m = s.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, s.hour, s.minute, 0, 0);
  // Reject silent rollover (e.g. Feb 30 → Mar 1, or month 13 → next year).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function isValidSchedule(s: FlowSchedule): boolean {
  if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) return false;
  if (!Number.isInteger(s.minute) || s.minute < 0 || s.minute > 59) return false;
  if (isOneShot(s)) return oneShotTarget(s) !== null;
  if (!Array.isArray(s.days)) return false;
  return s.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

/**
 * True if the flow should run at `at`.
 *  - One-shot: due once its target time has arrived (`at >= target`). Catch-up
 *    safe — a missed minute still fires on the next tick; the scheduler pauses it
 *    after running so it never repeats.
 *  - Recurring: `at` falls on a scheduled weekday at the scheduled hour:minute.
 */
export function isDue(schedule: FlowSchedule, at: Date): boolean {
  if (isOneShot(schedule)) {
    const target = oneShotTarget(schedule);
    return target !== null && at.getTime() >= target.getTime();
  }
  if (at.getHours() !== schedule.hour) return false;
  if (at.getMinutes() !== schedule.minute) return false;
  if (schedule.days.length === 0) return true;
  return schedule.days.includes(at.getDay());
}

function fmtClock(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/** Format a one-shot date string ('YYYY-MM-DD') as e.g. "Jun 16". */
function fmtOnceDate(dateStr: string): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  return `${MONTH_NAMES[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`;
}

/** Render a schedule as the display `trigger` string the flows UI expects. */
export function describeSchedule(schedule: FlowSchedule | null): string {
  if (!schedule) return 'Manual trigger';
  const clock = fmtClock(schedule.hour, schedule.minute);
  if (isOneShot(schedule)) return `Once · ${fmtOnceDate(schedule.date as string)}, ${clock}`;
  const days = [...schedule.days].sort((a, b) => a - b);
  if (days.length === 0) return `Daily ${clock}`;
  if (sameSet(days, WEEKDAYS)) return `Weekdays ${clock}`;
  if (sameSet(days, WEEKEND)) return `Weekends ${clock}`;
  return `${days.map((d) => WEEKDAY_NAMES[d]).join(', ')} ${clock}`;
}
