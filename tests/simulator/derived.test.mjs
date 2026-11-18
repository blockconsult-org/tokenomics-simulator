// KPIs, holder outcomes and health checks, computed from hand-built runs (see derived-fixtures.mjs)
// so that every expected number below can be worked out on paper.
import test from "node:test";
import assert from "node:assert/strict";
import { computeHealthChecks, monteCarloHealthCheck } from "@/simulator/engine/health-checks";
import { computeKpis } from "@/simulator/engine/kpis";
import { computeOutcomes } from "@/simulator/engine/outcomes";
import { healthCheckIds } from "@/simulator/engine/types";
import { assertClose, buildCore, fixtureModel, row } from "./derived-fixtures.mjs";

/* ------------------------------------------------------------------------------------------ */
/* KPIs                                                                                       */
/* ------------------------------------------------------------------------------------------ */

// 1,000,000 tokens at $2 with a 2,000,000 cap. 40% public at TGE (bought at $0.50), 40% team behind
// a 12-month cliff vesting over 12 months, 20% treasury vesting over 10 months from TGE.
function kpiModel() {
  return fixtureModel({
    token: { genesisSupply: 1_000_000, tgePriceUsd: 2 },
    emissions: { maxSupply: 2_000_000 },
    treasury: { startingUsd: 1_000_000, monthlyCostUsd: 100_000 },
    allocations: [
      row({ id: "public", category: "public_sale", share: 0.4, tgeUnlock: 1, purchasePriceUsd: 0.5 }),
      row({ id: "team", category: "team", share: 0.4, cliffMonths: 12, vestingMonths: 12 }),
      row({ id: "reserve", category: "treasury", share: 0.2, vestingMonths: 10 }),
    ],
  });
}

test("computeKpis reads each headline number from the run", () => {
  const model = kpiModel();
  const core = buildCore(model, {
    exhaustedMonth: 11,
    series: {
      marketCapUsd: { 0: 800_000 },
      circulating: (month) => (month === 12 ? 500_000 : 400_000),
      totalSupply: (month) => (month >= 12 ? 1_100_000 : 1_000_000),
      // 30,000 on a float of 500,000 is 6%; 40,000 on 400,000 is 10% and wins despite month 13
      // following the larger float.
      unlockTokens: { 13: 30_000, 14: 40_000 },
      locked: { 24: 50_000 },
      // 24 months of 100 in costs, 600 of them covered by one token sale.
      treasuryCostUsd: (month) => (month === 0 ? 0 : 100),
      treasurySaleUsd: { 3: 600 },
      // Months 13–24 are the last year: 120 burned against 480 emitted. The month-2 and month-5
      // entries sit outside that window and must not count.
      burnTokens: (month) => (month >= 13 ? 10 : month === 5 ? 1_000 : 0),
      emissionTokens: (month) => (month >= 13 ? 40 : month === 2 ? 5_000 : 0),
    },
  });

  const kpis = computeKpis(model, core);

  assert.equal(kpis.initialCirculatingShare, 0.4);
  assert.equal(kpis.initialMarketCapUsd, 800_000);
  assert.equal(kpis.initialFdvUsd, 4_000_000, "TGE price × the cap, not × genesis supply");
  assert.equal(kpis.marketCapToFdv, 0.2);
  assertClose(kpis.circulatingShareMonth12, 500_000 / 1_100_000, "circulating share at month 12");
  assert.deepEqual(kpis.largestUnlock, { month: 14, tokens: 40_000, shareOfCirculating: 0.1 });
  assertClose(kpis.inflationYear1, 0.1, "year-1 inflation");
  // Public 40% at TGE; the treasury row adds 2 points a month, reaching 50% at month 5.
  assert.equal(kpis.monthsTo50Unlocked, 5);
  // 60% once the treasury row is done; the team row adds 40%/12 a month from month 13, and nine
  // of those tranches make 90% at month 21.
  assert.equal(kpis.monthsTo90Unlocked, 21);
  assert.equal(kpis.lockedAtHorizonShare, 0.05);
  assert.equal(kpis.impliedRaiseUsd, 200_000, "400,000 tokens at $0.50; rows without a price add nothing");
  assert.deepEqual(kpis.runway, { staticMonths: 10, exhaustedMonth: 11 });
  assert.equal(kpis.treasurySaleShareOfCosts, 0.25);
  assert.equal(kpis.burnToEmissionLast12, 0.25);
});

test("computeKpis has a defined answer when a denominator is missing", () => {
  const model = fixtureModel();
  const kpis = computeKpis(model, buildCore(model, { series: { marketCapUsd: { 0: 1_000_000 }, circulating: () => 1_000_000 } }));

  assert.equal(kpis.initialFdvUsd, 1_000_000, "no cap: TGE price × genesis supply");
  assert.equal(kpis.marketCapToFdv, 1);
  assert.deepEqual(kpis.largestUnlock, { month: null, tokens: 0, shareOfCirculating: 0 }, "nothing unlocks after TGE");
  assert.deepEqual(kpis.runway, { staticMonths: null, exhaustedMonth: null }, "no cost, no static runway");
  assert.equal(kpis.treasurySaleShareOfCosts, 0);
  assert.equal(kpis.burnToEmissionLast12, null, "nothing was emitted");
  assert.equal(kpis.impliedRaiseUsd, 0);
});

test("largestUnlock skips a month that follows an empty float", () => {
  const model = fixtureModel();
  const core = buildCore(model, {
    series: {
      circulating: (month) => (month >= 3 ? 100 : 0),
      // Month 1 would be an infinite ratio; month 4 is 10 on a float of 100.
      unlockTokens: { 1: 1_000_000, 4: 10 },
    },
  });

  assert.deepEqual(computeKpis(model, core).largestUnlock, { month: 4, tokens: 10, shareOfCirculating: 0.1 });
});

test("the unlock milestones come from the schedule and look past the horizon", () => {
  // Nothing until month 100, then 1% a month: 50% at month 150 and 90% at month 190, on a
  // 24-month run that never sees either.
  const late = fixtureModel({ allocations: [row({ id: "late", cliffMonths: 100, vestingMonths: 100 })] });
  const lateKpis = computeKpis(late, buildCore(late));
  assert.equal(lateKpis.monthsTo50Unlocked, 150);
  assert.equal(lateKpis.monthsTo90Unlocked, 190);

  // A quarterly schedule only moves on its step months: 4 of 8 tranches have landed at month 12,
  // and the eighth, at month 24, is the first to pass 90%.
  const quarterly = fixtureModel({ allocations: [row({ id: "q", vestingMonths: 24, vestingStepMonths: 3 })] });
  const quarterlyKpis = computeKpis(quarterly, buildCore(quarterly));
  assert.equal(quarterlyKpis.monthsTo50Unlocked, 12);
  assert.equal(quarterlyKpis.monthsTo90Unlocked, 24);

  // The search stops at month 240. A cliff beyond it is outside the form's range, but the answer
  // must still be "never" and not a wrong month.
  const never = fixtureModel({ allocations: [row({ id: "never", cliffMonths: 300 })] });
  assert.equal(computeKpis(never, buildCore(never)).monthsTo50Unlocked, null);
});

/* ------------------------------------------------------------------------------------------ */
/* Holder outcomes                                                                            */
/* ------------------------------------------------------------------------------------------ */

test("computeOutcomes values each row at the requested months inside the horizon", () => {
  const model = fixtureModel({
    outcomeMonths: [12, 24, 36],
    allocations: [
      // 400,000 tokens bought at $0.50: 10% at TGE, then 90% over 12 months after a 6-month cliff.
      row({ id: "seed", category: "investors", share: 0.4, tgeUnlock: 0.1, cliffMonths: 6, vestingMonths: 12, purchasePriceUsd: 0.5 }),
      row({ id: "community", category: "community", share: 0.6, tgeUnlock: 1 }),
    ],
  });
  const core = buildCore(model, { series: { priceUsd: { 12: 3, 24: 1 } } });

  const [seed, community, ...rest] = computeOutcomes(model, core);
  assert.equal(rest.length, 0);

  assert.equal(seed.id, "seed");
  assertClose(seed.tokens, 400_000, "seed tokens");
  assertClose(seed.costBasisUsd, 200_000, "seed cost basis");
  assert.deepEqual(seed.atMonths.map((entry) => entry.month), [12, 24], "month 36 is past the 24-month horizon");

  // Month 12 is six months into vesting: 10% + 90% × 6/12 = 55% unlocked, at a price of $3.
  const [year1, year2] = seed.atMonths;
  assertClose(year1.unlockedTokens, 220_000, "unlocked at 12");
  assertClose(year1.unlockedValueUsd, 660_000, "unlocked value at 12");
  assertClose(year1.lockedValueUsd, 540_000, "locked value at 12");
  assertClose(year1.paperMultiple, 6, "paper multiple at 12");
  assertClose(year1.liquidMultiple, 3.3, "liquid multiple at 12");
  // Fully vested by month 24, at a price of $1.
  assertClose(year2.unlockedTokens, 400_000, "unlocked at 24");
  assertClose(year2.unlockedValueUsd, 400_000, "unlocked value at 24");
  assertClose(year2.lockedValueUsd, 0, "locked value at 24");
  assertClose(year2.paperMultiple, 2, "paper multiple at 24");
  assertClose(year2.liquidMultiple, 2, "liquid multiple at 24");

  // A row nobody paid for has a value but no cost basis and no multiples.
  assert.equal(community.costBasisUsd, null);
  assertClose(community.atMonths[0].unlockedValueUsd, 1_800_000, "community value at 12");
  assert.equal(community.atMonths[0].paperMultiple, null);
  assert.equal(community.atMonths[0].liquidMultiple, null);
});

/* ------------------------------------------------------------------------------------------ */
/* Health checks                                                                              */
/* ------------------------------------------------------------------------------------------ */

const deterministicIds = healthCheckIds.filter((id) => id !== "treasury_exhaustion_probability");

// A run in which every check has something to measure and nothing to object to: full float,
// constant supply, a treasury with costs that never runs out, and sell pressure half met by burns.
const calmSeries = {
  marketCapUsd: { 0: 1_000_000 },
  circulating: () => 1_000_000,
  totalSupply: () => 1_000_000,
  treasuryCostUsd: (month) => (month === 0 ? 0 : 100),
  sellPressureUsd: (month) => (month === 0 ? 0 : 100),
  burnUsd: (month) => (month === 0 ? 0 : 50),
};

function calmModel(sections = {}) {
  return fixtureModel({ treasury: { startingUsd: 1_000_000, monthlyCostUsd: 100 }, ...sections });
}

/** The checks for a calm run with some series, flags or KPIs changed. */
function checksFor({ model = calmModel(), series = {}, flags, exhaustedMonth, kpis: kpiPatch = {} } = {}) {
  const core = buildCore(model, { series: { ...calmSeries, ...series }, flags, exhaustedMonth });
  const kpis = { ...computeKpis(model, core), ...kpiPatch };
  return Object.fromEntries(computeHealthChecks(model, core, kpis).map((check) => [check.id, check]));
}

test("computeHealthChecks returns the eight deterministic checks in order with the documented thresholds", () => {
  const model = calmModel();
  const core = buildCore(model, { series: calmSeries });
  const checks = computeHealthChecks(model, core, computeKpis(model, core));

  assert.deepEqual(checks.map((check) => check.id), deterministicIds);
  assert.deepEqual(checks.map((check) => check.status), deterministicIds.map(() => "pass"));
  assert.deepEqual(
    Object.fromEntries(checks.map((check) => [check.id, [check.watchAt, check.riskAt]])),
    {
      insider_share: [1 / 3, 1 / 2],
      low_float: [0.2, 0.1],
      unlock_shock: [0.05, 0.15],
      net_inflation: [0.05, 0.15],
      runway: [36, 18],
      treasury_token_dependence: [0.25, 0.5],
      structural_demand: [0.35, 0.1],
      // "Any flagged month" is a watch; the check has no risk level.
      model_range: [1, Infinity],
    },
  );
});

test("insider_share is exclusive at one third and one half of supply", () => {
  const withShares = ([team, investors, advisors], outsiders) =>
    checksFor({
      model: calmModel({
        allocations: [
          row({ id: "team", category: "team", share: team }),
          row({ id: "investors", category: "investors", share: investors }),
          row({ id: "advisors", category: "advisors", share: advisors }),
          ...outsiders.map((share, index) => row({ id: `outside-${index}`, category: "community", share, tgeUnlock: 1 })),
        ],
      }),
    }).insider_share;

  assert.equal(withShares([0.2, 0.1, 0.03], [0.67]).status, "pass");
  assert.equal(withShares([0.2, 0.1, 0.04], [0.66]).status, "watch");
  assert.equal(withShares([0.3, 0.2, 0], [0.5]).status, "watch", "exactly half is not above half");
  assert.equal(withShares([0.25, 0.15, 0.11], [0.49]).status, "risk");

  // Insiders hold exactly half here too, but these five shares sum to 0.9999999999999999, which
  // puts the computed ratio one ulp above 0.5. The status must follow the typed numbers.
  const noisyHalf = withShares([0.01, 0.02, 0.47], [0.41, 0.09]);
  assert.ok(noisyHalf.value > 0.5);
  assert.equal(noisyHalf.status, "watch");
});

test("low_float is exclusive below 20% and 10% market cap to FDV", () => {
  const at = (marketCapToFdv) => checksFor({ kpis: { marketCapToFdv } }).low_float.status;

  assert.equal(at(0.2), "pass");
  assert.equal(at(0.19), "watch");
  assert.equal(at(0.1), "watch");
  assert.equal(at(0.09), "risk");
});

test("unlock_shock is inclusive at 5% and 15% of the float and names the month", () => {
  const unlocking = (tokens) => checksFor({ series: { unlockTokens: { 5: tokens } } }).unlock_shock;

  assert.equal(unlocking(49_999).status, "pass");
  assert.deepEqual(unlocking(50_000), { id: "unlock_shock", status: "watch", value: 0.05, watchAt: 0.05, riskAt: 0.15, month: 5 });
  assert.equal(unlocking(149_999).status, "watch");
  assert.equal(unlocking(150_000).status, "risk");

  const emptyFloat = checksFor({ series: { circulating: () => 0, unlockTokens: { 5: 1_000 } } }).unlock_shock;
  assert.deepEqual([emptyFloat.status, emptyFloat.value, emptyFloat.month], ["na", null, null]);
});

test("net_inflation takes the worst 12-month supply growth and is exclusive at 5% and 15%", () => {
  const growing = (rate) => checksFor({ series: { totalSupply: (month) => (month >= 12 ? 1_000_000 * (1 + rate) : 1_000_000) } }).net_inflation;

  // 1,050,000 / 1,000,000 − 1 is 0.050000000000000044 in floating point and must still read as 5%.
  assert.equal(growing(0.05).status, "pass");
  assert.equal(growing(0.06).status, "watch");
  assert.equal(growing(0.15).status, "watch");
  assert.equal(growing(0.16).status, "risk");
  assert.equal(growing(0.06).month, 12, "the first month that shows the worst growth");

  // A jump at month 20 is invisible at month 12 and is still the worst year in the run.
  const lateJump = checksFor({
    model: calmModel({ horizonMonths: 36 }),
    series: { totalSupply: (month) => (month >= 20 ? 1_200_000 : 1_000_000) },
  }).net_inflation;
  assert.equal(lateJump.status, "risk");
  assert.equal(lateJump.month, 20);
  assertClose(lateJump.value, 0.2, "worst 12-month growth");

  // A supply that burns 1% a month shrinks by the same share every year; the check reports that
  // negative growth and does not floor it at zero.
  const shrinking = checksFor({ series: { totalSupply: (month) => 1_000_000 * 0.99 ** month } }).net_inflation;
  assert.equal(shrinking.status, "pass");
  assertClose(shrinking.value, 0.99 ** 12 - 1, "12-month growth of a shrinking supply");
});

test("runway is inclusive at 36 and 18 months, passes when never exhausted, and is na without costs", () => {
  const exhaustedAt = (exhaustedMonth) => checksFor({ model: calmModel({ horizonMonths: 60 }), exhaustedMonth }).runway;

  assert.equal(exhaustedAt(18).status, "risk");
  assert.equal(exhaustedAt(19).status, "watch");
  assert.equal(exhaustedAt(36).status, "watch");
  assert.equal(exhaustedAt(37).status, "pass");
  assert.deepEqual([exhaustedAt(36).value, exhaustedAt(36).month], [36, 36]);
  assert.deepEqual([exhaustedAt(null).status, exhaustedAt(null).value], ["pass", null]);

  const noCosts = checksFor({ model: calmModel({ treasury: { monthlyCostUsd: 0 } }), exhaustedMonth: null }).runway;
  assert.deepEqual([noCosts.status, noCosts.value], ["na", null]);
});

test("treasury_token_dependence is exclusive at 25% and 50% of costs", () => {
  // Costs are 24 × 100 = 2,400.
  const selling = (usd) => checksFor({ series: { treasurySaleUsd: { 1: usd } } }).treasury_token_dependence;

  assert.equal(selling(0).status, "pass");
  assert.equal(selling(600).status, "pass");
  assert.equal(selling(624).status, "watch");
  assert.equal(selling(1_200).status, "watch");
  assert.equal(selling(1_224).status, "risk");
  assert.equal(selling(1_224).value, 0.51);

  const noCosts = checksFor({ series: { treasuryCostUsd: () => 0 } }).treasury_token_dependence;
  assert.deepEqual([noCosts.status, noCosts.value], ["na", null]);
});

test("structural_demand compares the last year's burns and working-balance buys with sell pressure", () => {
  // Sell pressure is 100 a month, so 1,200 over the last year (months 13–24).
  const lastYear = (burnUsd, workingBalanceBuyUsd) =>
    checksFor({
      series: {
        burnUsd: (month) => (month >= 13 ? burnUsd : 0),
        workingBalanceBuyUsd: (month) => (month >= 13 ? workingBalanceBuyUsd : 0),
      },
    }).structural_demand;

  assert.equal(lastYear(20, 15).status, "pass");
  assertClose(lastYear(20, 15).value, 0.35, "structural demand share");
  assert.equal(lastYear(20, 14).status, "watch");
  assert.equal(lastYear(10, 0).status, "watch");
  assert.equal(lastYear(9, 0).status, "risk");

  // Heavy burns in the first year say nothing about the last one.
  const earlyOnly = checksFor({ series: { burnUsd: (month) => (month >= 1 && month <= 12 ? 1_000 : 0) } }).structural_demand;
  assert.deepEqual([earlyOnly.status, earlyOnly.value], ["risk", 0]);

  const nothingSold = checksFor({ series: { sellPressureUsd: () => 0 } }).structural_demand;
  assert.deepEqual([nothingSold.status, nothingSold.value], ["na", null]);
});

test("model_range counts each flagged month once and never reaches risk", () => {
  const clean = checksFor().model_range;
  assert.deepEqual([clean.status, clean.value, clean.month], ["pass", 0, null]);

  // Month 5 tripped two guards; months 3, 5 and 9 make three.
  const flagged = checksFor({ flags: { priceClampMonths: [5, 3], minDepthMonths: [5], burnClampMonths: [9] } }).model_range;
  assert.deepEqual([flagged.status, flagged.value, flagged.month], ["watch", 3, 3]);

  const everyMonth = Array.from({ length: 24 }, (_, index) => index + 1);
  assert.equal(checksFor({ flags: { minDepthMonths: everyMonth } }).model_range.status, "watch");
});

test("checks with nothing to measure report na instead of a pass", () => {
  // The quiet base model has no treasury costs, and an all-zero run has no sell pressure and no
  // supply to grow.
  const model = fixtureModel();
  const core = buildCore(model);
  const checks = Object.fromEntries(computeHealthChecks(model, core, computeKpis(model, core)).map((check) => [check.id, check]));

  for (const id of ["unlock_shock", "net_inflation", "runway", "treasury_token_dependence", "structural_demand"]) {
    assert.deepEqual([checks[id].status, checks[id].value, checks[id].month], ["na", null, null], id);
  }
});

test("monteCarloHealthCheck is inclusive at 25% and 50% of runs and na before any run", () => {
  const at = (probTreasuryExhausted, runs = 400) => monteCarloHealthCheck({ runs, probTreasuryExhausted });

  assert.deepEqual(at(0.25), { id: "treasury_exhaustion_probability", status: "watch", value: 0.25, watchAt: 0.25, riskAt: 0.5, month: null });
  assert.equal(at(0.2475).status, "pass");
  assert.equal(at(0.4975).status, "watch");
  assert.equal(at(0.5).status, "risk");
  assert.equal(at(0).status, "pass");
  assert.deepEqual([at(0, 0).status, at(0, 0).value], ["na", null]);
});
