// Hand-built inputs for the metrics that are derived from a finished run. The KPI, outcome and
// health-check tests need a CoreResult whose every number can be checked by hand, so they build
// one here instead of running the monthly loop: all series start at zero and a test sets only the
// few entries its expected value depends on.
import assert from "node:assert/strict";
import { defaultModel } from "@/simulator/engine/presets";
import { vestedFraction } from "@/simulator/engine/vesting";

const numericSeries = [
  "priceUsd",
  "marketCapUsd",
  "fdvUsd",
  "totalSupply",
  "circulating",
  "liquid",
  "staked",
  "locked",
  "treasuryTokens",
  "burnedCum",
  "emittedCum",
  "treasuryUsd",
  "users",
  "stakedRatio",
  "unlockTokens",
  "treasuryVestTokens",
  "emissionTokens",
  "burnTokens",
  "sellUnlockTokens",
  "sellEmissionTokens",
  "sellHolderTokens",
  "treasurySaleTokens",
  "sellPressureUsd",
  "buyUsd",
  "speculativeInflowUsd",
  "revenueUsd",
  "burnUsd",
  "workingBalanceBuyUsd",
  "depthUsd",
  "treasuryCostUsd",
  "treasuryRevenueUsd",
  "treasurySaleUsd",
  "unpaidCostUsd",
  "netInflationAnnualised",
];
// Yields are null whenever nothing is staked, which is the case in an all-zero run.
const nullableSeries = ["stakingYieldNominal", "stakingYieldReal"];

/** An allocation row with every field present. A test names only the fields it is about. */
export function row(fields) {
  return {
    name: fields.id,
    category: "public_sale",
    share: 1,
    tgeUnlock: 0,
    cliffMonths: 0,
    vestingMonths: 0,
    vestingStepMonths: 1,
    sellPropensity: 0,
    purchasePriceUsd: null,
    ...fields,
  };
}

/**
 * The quiet model the engine specification uses as its test base: 1,000,000 tokens at $1, one
 * public-sale row fully unlocked at TGE, and no emissions, staking, users, speculation or treasury,
 * over 24 months. `sections` replaces fields inside the named sections; `allocations`, `horizonMonths`
 * and `outcomeMonths` replace the whole value.
 */
export function fixtureModel(sections = {}) {
  const base = defaultModel();
  const quiet = {
    ...base,
    horizonMonths: 24,
    token: { ...base.token, genesisSupply: 1_000_000, tgePriceUsd: 1 },
    allocations: [row({ id: "public", tgeUnlock: 1 })],
    emissions: { ...base.emissions, mode: "none", maxSupply: null },
    staking: { initialRatio: 0, targetRatio: 0, rampMonths: 0 },
    utility: { ...base.utility, initialUsers: 0, saturationUsers: 0, spendPerUserUsd: 0, holdingMonths: 0 },
    revenueSplit: { burnShare: 0, treasuryShare: 0, stakerShare: 0 },
    speculation: { ...base.speculation, baseInflowUsd: 0, monthlyGrowth: 0, momentum: 0 },
    market: { depthRatio: 0.1, minDepthUsd: 1, holderSellRate: 0 },
    treasury: { ...base.treasury, startingUsd: 0, monthlyCostUsd: 0, annualCostGrowth: 0, sellTokens: false },
  };
  const model = { ...quiet };
  for (const [key, value] of Object.entries(sections)) {
    assert.ok(key in quiet, `fixtureModel: unknown section "${key}"`);
    const replaceWhole = Array.isArray(value) || typeof value !== "object" || value === null;
    model[key] = replaceWhole ? value : { ...quiet[key], ...value };
  }
  return model;
}

/** One series of `length` months: `spec` is either a function of the month or a `{ month: value }`
 *  map whose missing months keep `empty`. */
function buildSeries(spec, length, empty) {
  return Array.from({ length }, (_, month) => {
    if (typeof spec === "function") return spec(month);
    return spec && month in spec ? spec[month] : empty;
  });
}

/**
 * A CoreResult for `model` with every series at zero. The per-row unlock series follow the vesting
 * schedule, because that is their definition and outcome tests read them.
 *
 * `series` overrides series by name, each as `(month) => value` or as `{ 13: 30_000 }`.
 */
export function buildCore(model, { series = {}, flags = {}, exhaustedMonth = null } = {}) {
  const length = model.horizonMonths + 1;
  for (const name of Object.keys(series)) {
    assert.ok(numericSeries.includes(name) || nullableSeries.includes(name), `buildCore: unknown series "${name}"`);
  }

  const shareSum = model.allocations.reduce((total, allocation) => total + allocation.share, 0);
  return {
    months: Array.from({ length }, (_, month) => month),
    series: Object.fromEntries([
      ...numericSeries.map((name) => [name, buildSeries(series[name], length, 0)]),
      ...nullableSeries.map((name) => [name, buildSeries(series[name], length, null)]),
    ]),
    allocations: model.allocations.map((allocation) => {
      const tokens = (model.token.genesisSupply * allocation.share) / shareSum;
      return {
        id: allocation.id,
        tokens,
        unlockedCum: Array.from({ length }, (_, month) => tokens * vestedFraction(allocation, month)),
      };
    }),
    flags: { priceClampMonths: [], minDepthMonths: [], burnClampMonths: [], ...flags },
    exhaustedMonth,
  };
}

/** Equal within float rounding. Expected values in these tests are derived by hand from decimal
 *  inputs, so they differ from the computed ones by a few ulps at most. */
export function assertClose(actual, expected, message) {
  assert.equal(typeof actual, "number", message);
  const tolerance = 1e-9 * Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? "value"}: expected ${expected}, got ${actual}`);
}
