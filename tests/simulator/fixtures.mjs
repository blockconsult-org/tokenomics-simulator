import assert from "node:assert/strict";

/**
 * Shared builders and assertions for the engine tests.
 *
 * The base model is as quiet as a model can be: one row, fully unlocked at
 * TGE, and no emissions, staking, users, speculation, treasury or holder
 * selling. Its price stays at 1 until a test switches something on, so each
 * expected value can be worked out by hand from the one thing that changed.
 */

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function merge(target, overrides) {
  for (const [key, value] of Object.entries(overrides)) {
    target[key] =
      isPlainObject(value) && isPlainObject(target[key]) ? merge(target[key], value) : value;
  }
  return target;
}

/** One allocation row; by default a public sale fully unlocked at TGE. */
export function row(overrides = {}) {
  return {
    id: "public",
    name: "Public sale",
    category: "public_sale",
    share: 1,
    tgeUnlock: 1,
    cliffMonths: 0,
    vestingMonths: 0,
    vestingStepMonths: 1,
    sellPropensity: 0.5,
    purchasePriceUsd: null,
    ...overrides,
  };
}

/**
 * The base model with `overrides` merged in. Nested objects merge key by
 * key; arrays (the allocation rows) are replaced whole.
 */
export function baseModel(overrides = {}) {
  const model = {
    version: 1,
    horizonMonths: 24,
    token: { name: "", symbol: "TKN", genesisSupply: 1_000_000, tgePriceUsd: 1 },
    allocations: [row()],
    emissions: {
      mode: "none",
      annualInflationRate: 0,
      tokensPerMonth: 0,
      decay: "none",
      halvingEveryMonths: 24,
      annualDecayRate: 0,
      maxSupply: null,
      capBasis: "minted",
      sellRate: 0,
      toStakersShare: 1,
    },
    staking: { initialRatio: 0, targetRatio: 0, rampMonths: 0 },
    utility: {
      initialUsers: 0,
      saturationUsers: 0,
      monthlyGrowthRate: 0,
      spendPerUserUsd: 0,
      holdingMonths: 0,
    },
    revenueSplit: { burnShare: 0, treasuryShare: 0, stakerShare: 0 },
    speculation: {
      baseInflowUsd: 0,
      monthlyGrowth: 0,
      scenario: "base",
      scenarioMultipliers: { bear: 0.5, base: 1, bull: 2 },
      momentum: 0,
    },
    market: { depthRatio: 0.1, minDepthUsd: 1, holderSellRate: 0 },
    treasury: {
      startingUsd: 0,
      monthlyCostUsd: 0,
      annualCostGrowth: 0,
      sellTokens: false,
      bufferMonths: 0,
      maxMonthlySaleShare: 0,
    },
    monteCarlo: {
      runs: 500,
      seed: 1,
      marketVolatility: 0.25,
      growthVolatility: 0.3,
      sellPropensityVolatility: 0.5,
    },
    outcomeMonths: [12, 24],
  };
  return merge(model, overrides);
}

/** Series that are 0 at month 0 because nothing has happened yet. */
export const monthZeroSeries = [
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
  "burnedCum",
  "emittedCum",
  "netInflationAnnualised",
];

/** Token and USD flows of a month. Depth is a level, so it is not one. */
export const flowSeries = monthZeroSeries.filter(
  (name) => !["depthUsd", "burnedCum", "emittedCum", "netInflationAnnualised"].includes(name),
);

/** Every series of a result, in declaration order. */
export const seriesNames = [
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
  "stakingYieldNominal",
  "stakingYieldReal",
  "netInflationAnnualised",
];

/**
 * Asserts two numbers agree to `tolerance`, relative to the expected value
 * and never tighter than absolute `tolerance` (so values near zero compare
 * absolutely).
 */
export function assertNear(actual, expected, tolerance = 1e-9, label = "value") {
  const allowed = tolerance * Math.max(1, Math.abs(expected));
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= allowed,
    `${label}: expected ${expected}, got ${actual} (allowed ±${allowed})`,
  );
}

/**
 * Asserts a number matches a reference printed to `decimals` decimal places:
 * it may differ by at most half a unit of the last printed digit.
 */
export function assertDecimals(actual, expected, decimals, label = "value") {
  const allowed = 0.5 * 10 ** -decimals;
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= allowed * (1 + 1e-9),
    `${label}: expected ${expected} to ${decimals} decimals, got ${actual}`,
  );
}
