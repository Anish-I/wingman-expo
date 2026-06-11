import assert from 'node:assert/strict';
import test from 'node:test';

import { isQuietNow } from './notifier.js';

function at(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 30, 0, 0);
  return d;
}

test('overnight quiet window wraps past midnight', () => {
  // "10pm - 7am" => quiet from 22:00 to 06:59
  assert.equal(isQuietNow('10pm - 7am', at(23)), true);
  assert.equal(isQuietNow('10pm - 7am', at(2)), true);
  assert.equal(isQuietNow('10pm - 7am', at(6)), true);
  assert.equal(isQuietNow('10pm - 7am', at(7)), false);
  assert.equal(isQuietNow('10pm - 7am', at(12)), false);
  assert.equal(isQuietNow('10pm - 7am', at(21)), false);
});

test('different windows parse correctly', () => {
  assert.equal(isQuietNow('9pm - 6am', at(21)), true);
  assert.equal(isQuietNow('9pm - 6am', at(20)), false);
  assert.equal(isQuietNow('11pm - 8am', at(23)), true);
  assert.equal(isQuietNow('11pm - 8am', at(22)), false);
});

test('Off (or junk) is never quiet', () => {
  assert.equal(isQuietNow('Off', at(3)), false);
  assert.equal(isQuietNow('', at(3)), false);
  assert.equal(isQuietNow('nonsense', at(3)), false);
});

test('quiet hours evaluate in the user timezone, not the server', () => {
  // A fixed instant: 2024-01-01T05:00:00Z.
  // In New York (UTC-5) that's 00:00 -> inside "10pm - 7am" (quiet).
  // In Tokyo (UTC+9) that's 14:00 -> outside the window (not quiet).
  const instant = new Date('2024-01-01T05:00:00Z');
  assert.equal(isQuietNow('10pm - 7am', instant, 'America/New_York'), true);
  assert.equal(isQuietNow('10pm - 7am', instant, 'Asia/Tokyo'), false);
});
