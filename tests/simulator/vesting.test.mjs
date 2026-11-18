import test from "node:test";
import assert from "node:assert/strict";
import { unlockedInMonth, vestedFraction } from "@/simulator/engine/vesting";
import { assertNear } from "./fixtures.mjs";

const TOKENS = 1_200_000;

function terms(overrides) {
  return { tgeUnlock: 0.1, cliffMonths: 6, vestingMonths: 12, vestingStepMonths: 1, ...overrides };
}

/** Tokens unlocking in each of months 0 to `lastMonth`. */
function schedule(row, lastMonth) {
  return Array.from({ length: lastMonth + 1 }, (_, month) => unlockedInMonth(row, TOKENS, month));
}

/** Asserts the schedule is `expected` in the listed months and 0 elsewhere. */
function assertSchedule(row, lastMonth, expected) {
  const actual = schedule(row, lastMonth);
  for (let month = 0; month <= lastMonth; month++) {
    assertNear(actual[month], expected[month] ?? 0, 1e-12, `month ${month}`);
  }
  assertNear(
    actual.reduce((sum, tokens) => sum + tokens, 0),
    TOKENS,
    1e-12,
    "total unlocked",
  );
}

test("monthly vesting starts one step after the cliff", () => {
  const expected = { 0: 120_000 };
  for (let month = 7; month <= 18; month++) expected[month] = 90_000;
  assertSchedule(terms({}), 24, expected);
});

test("quarterly vesting releases in steps", () => {
  assertSchedule(terms({ vestingStepMonths: 3 }), 24, {
    0: 120_000,
    9: 270_000,
    12: 270_000,
    15: 270_000,
    18: 270_000,
  });
});

test("a vesting period that is not a whole number of steps ends with the remainder", () => {
  assertSchedule(terms({ vestingMonths: 10, vestingStepMonths: 3 }), 24, {
    0: 120_000,
    9: 324_000,
    12: 324_000,
    15: 324_000,
    16: 108_000,
  });
});

test("no vesting period unlocks the rest at the cliff", () => {
  assertSchedule(terms({ vestingMonths: 0 }), 24, { 0: 120_000, 6: 1_080_000 });
  assertSchedule(terms({ vestingMonths: 0, cliffMonths: 0 }), 24, { 0: 1_200_000 });
});

test("the vested fraction never decreases and stays within the row", () => {
  for (const row of [
    terms({}),
    terms({ vestingStepMonths: 3 }),
    terms({ vestingMonths: 10, vestingStepMonths: 3 }),
    terms({ vestingMonths: 7, vestingStepMonths: 12 }),
    terms({ tgeUnlock: 1 }),
    terms({ tgeUnlock: 0, cliffMonths: 0, vestingMonths: 120, vestingStepMonths: 5 }),
  ]) {
    let previous = 0;
    for (let month = 0; month <= 130; month++) {
      const fraction = vestedFraction(row, month);
      assert.ok(fraction >= previous && fraction <= 1, `fraction ${fraction} at month ${month}`);
      previous = fraction;
    }
    assert.equal(previous, 1);
  }
});
