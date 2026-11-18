import test from "node:test";
import assert from "node:assert/strict";
import { getPreset, presetIds } from "@/simulator/engine/presets";
import { simulate } from "@/simulator/engine/simulate";

/**
 * Reference values for the presets in the base scenario. Percentages are
 * given to one decimal and compared at that precision; prices are given to
 * four significant digits and must match within 1%. A preset that drifts
 * further has left the specification on one side or the other.
 */
const reference = {
  defi_governance: {
    floatPercent: 9.6,
    capToFdvPercent: 9.6,
    unlockPercent: 13.0,
    unlockMonth: 1,
    prices: { 12: 0.2587, 36: 0.1481, 60: 0.2762 },
  },
  staking_network: {
    floatPercent: 13.8,
    capToFdvPercent: 13.8,
    unlockPercent: 10.3,
    unlockMonth: 1,
    prices: { 12: 1.093, 36: 0.7848, 60: 1.243 },
  },
  consumer_game: {
    floatPercent: 11.2,
    capToFdvPercent: 10.1,
    unlockPercent: 17.8,
    unlockMonth: 1,
    prices: { 12: 0.0111, 36: 0.01058, 60: 0.01108 },
  },
  depin: {
    floatPercent: 14.9,
    capToFdvPercent: 7.4,
    unlockPercent: 10.8,
    unlockMonth: 1,
    prices: { 12: 0.2357, 36: 0.1703, 60: 0.3971 },
  },
  fair_launch: {
    floatPercent: 82.5,
    capToFdvPercent: 58.9,
    unlockPercent: 2.5,
    unlockMonth: 1,
    prices: { 12: 0.1921, 36: 0.276, 60: 0.3786 },
  },
};

/** A fraction as a percentage rounded to one decimal, as the table prints it. */
const percent = (fraction) => Number((fraction * 100).toFixed(1));

test("the reference table covers every preset", () => {
  assert.deepEqual(Object.keys(reference), [...presetIds]);
});

for (const id of presetIds) {
  test(`${id} reproduces its reference values`, () => {
    const model = getPreset(id);
    assert.equal(model.speculation.scenario, "base");
    const result = simulate(model);
    assert.equal(result.ok, true, `${id} failed validation: ${JSON.stringify(result.errors)}`);
    const expected = reference[id];
    const { kpis, series, flags } = result;

    assert.equal(percent(kpis.initialCirculatingShare), expected.floatPercent, "initial float");
    assert.equal(percent(kpis.marketCapToFdv), expected.capToFdvPercent, "market cap ÷ FDV");
    assert.equal(
      percent(kpis.largestUnlock.shareOfCirculating),
      expected.unlockPercent,
      "largest unlock",
    );
    assert.equal(kpis.largestUnlock.month, expected.unlockMonth, "month of the largest unlock");

    for (const [month, price] of Object.entries(expected.prices)) {
      const actual = series.priceUsd[Number(month)];
      assert.ok(
        Math.abs(actual - price) <= 0.01 * price,
        `price at month ${month}: expected ${price} within 1%, got ${actual}`,
      );
    }

    assert.deepEqual(flags.priceClampMonths, [], "price clamp months");
    assert.equal(kpis.runway.exhaustedMonth, null, "treasury exhausted");
  });
}
