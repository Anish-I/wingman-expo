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

export function isValidSchedule(s: FlowSchedule): boolean {
  if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) return false;
  if (!Number.isInteger(s.minute) || s.minute < 0 || s.minute > 59) return false;
  if (!Array.isArray(s.days)) return false;
  return s.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

/** True if `at` falls on a scheduled weekday at the scheduled hour:minute. */
export function isDue(schedule: FlowSchedule, at: Date): boolean {
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

/** Render a schedule as the display `trigger` string the flows UI expects. */
export function describeSchedule(schedule: FlowSchedule | null): string {
  if (!schedule) return 'Manual trigger';
  const clock = fmtClock(schedule.hour, schedule.minute);
  const days = [...schedule.days].sort((a, b) => a - b);
  if (days.length === 0) return `Daily ${clock}`;
  if (sameSet(days, WEEKDAYS)) return `Weekdays ${clock}`;
  if (sameSet(days, WEEKEND)) return `Weekends ${clock}`;
  return `${days.map((d) => WEEKDAY_NAMES[d]).join(', ')} ${clock}`;
}
