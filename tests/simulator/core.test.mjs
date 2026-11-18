import test from "node:test";
import assert from "node:assert/strict";
import { runDeterministic } from "@/simulator/engine/core";
import { poolTrade } from "@/simulator/engine/pool";
import { getPreset, presetIds } from "@/simulator/engine/presets";
import { mulberry32 } from "@/simulator/engine/rng";
import { allocationCategories } from "@/simulator/engine/types";
import { vestedFraction } from "@/simulator/engine/vesting";
import {
  assertDecimals,
  assertNear,
  baseModel,
  flowSeries,
  monthZeroSeries,
  row,
  seriesNames,
} from "./fixtures.mjs";

const filled = (length, value) => new Array(length).fill(value);
const monthsFrom1 = (last) => Array.from({ length: last }, (_, i) => i + 1);
const noFlags = { priceClampMonths: [], minDepthMonths: [], burnClampMonths: [] };

// ---------------------------------------------------------------------------
// Hand-derived cases on the base model
// ---------------------------------------------------------------------------

test("with no flows the price never moves", () => {
  const { months, series, flags, exhaustedMonth } = runDeterministic(baseModel());
  assert.deepEqual(months, [0, ...monthsFrom1(24)]);
  assert.deepEqual(series.priceUsd, filled(25, 1));
  for (const name of flowSeries) assert.deepEqual(series[name], filled(25, 0), name);
  assert.deepEqual(series.circulating, filled(25, 1_000_000));
  assert.deepEqual(flags, noFlags);
  assert.equal(exhaustedMonth, null);
});

test("depth re-anchors to last month's market cap, one month late", () => {
  const { series } = runDeterministic(baseModel({ speculation: { baseInflowUsd: 10_000 } }));
  // Month 1 trades against 100,000 of depth, month 2 against 121,000.
  assertNear(series.depthUsd[1], 100_000, 1e-12, "depth in month 1");
  assertNear(series.depthUsd[2], 121_000, 1e-12, "depth in month 2");
  assertNear(series.priceUsd[1], 1.21, 1e-12, "price in month 1");
  assertDecimals(series.priceUsd[2], 1.418264463, 9, "price in month 2");
  assertDecimals(series.priceUsd[3], 1.625315334, 9, "price in month 3");
});

test("half of a cliff unlock sold into the pool", () => {
  const { series } = runDeterministic(
    baseModel({
      allocations: [
        row({ share: 0.8 }),
        row({ id: "late", category: "ecosystem", share: 0.2, tgeUnlock: 0, cliffMonths: 1 }),
      ],
      market: { depthRatio: 0.25 },
    }),
  );
  assertNear(series.unlockTokens[1], 200_000, 1e-12, "unlock");
  assertNear(series.sellUnlockTokens[1], 100_000, 1e-12, "tokens sold");
  assertNear(series.sellPressureUsd[1], 100_000, 1e-12, "sell pressure");
  assertNear(series.priceUsd[1], 4 / 9, 1e-12, "price in month 1");
  assertDecimals(series.priceUsd[1], 0.444444444, 9, "price in month 1");
  // The sellers' average price is what the pool paid them per token.
  const trade = poolTrade(1, series.depthUsd[1], 0, series.sellUnlockTokens[1]);
  assertNear(trade.price, series.priceUsd[1], 1e-12, "pool price");
  assertDecimals(trade.usdToSellers / series.sellUnlockTokens[1], 0.666667, 6, "average sell price");
});

test("price settles where inflow equals what holders sell", () => {
  const market = { holderSellRate: 0.05, depthRatio: 0.25 };

  // 50,000 tokens offered against 50,000 USD: the price is already there.
  const balanced = runDeterministic(baseModel({ market, speculation: { baseInflowUsd: 50_000 } }));
  assert.deepEqual(balanced.series.priceUsd, filled(25, 1));

  const price = runDeterministic(baseModel({ market, speculation: { baseInflowUsd: 100_000 } }))
    .series.priceUsd;
  assertDecimals(price[1], 1.352714, 6, "price in month 1");
  assertDecimals(price[12], 1.992382, 6, "price in month 12");
  for (let t = 1; t <= 24; t++) {
    assert.ok(price[t] >= price[t - 1], `price fell in month ${t}`);
    assert.ok(price[t] <= 2, `price passed its equilibrium in month ${t}`);
  }
});

test("momentum overshoots the equilibrium and then settles on it", () => {
  const settings = (inflow) =>
    baseModel({
      horizonMonths: 60,
      market: { holderSellRate: 0.05, depthRatio: 0.25 },
      speculation: { baseInflowUsd: inflow, momentum: 2 },
    });

  // With no return to react to, momentum has nothing to amplify.
  assert.deepEqual(runDeterministic(settings(50_000)).series.priceUsd, filled(61, 1));

  const price = runDeterministic(settings(60_000)).series.priceUsd;
  // The momentum factor is capped at 2, so inflow can never exceed twice the
  // base and the price can never exceed twice the equilibrium of 1.2.
  for (const [t, value] of price.entries()) {
    assert.ok(value >= 1 && value <= 2.4, `price ${value} out of bounds in month ${t}`);
  }
  assertDecimals(Math.max(...price), 1.293, 3, "peak price");
  assert.ok(Math.abs(price[60] - 1.2) < 1e-4, `price ended at ${price[60]}, not at 1.2`);
});

test("inflation compounds monthly to the annual rate", () => {
  const { series } = runDeterministic(
    baseModel({ emissions: { mode: "inflation", annualInflationRate: 0.12 } }),
  );
  assertNear(series.totalSupply[12] / 1_000_000, 1.12, 1e-12, "supply after a year");
  assertNear(series.totalSupply[24] / 1_000_000, 1.2544, 1e-12, "supply after two years");
  assertNear(series.netInflationAnnualised[1], 12 * (1.12 ** (1 / 12) - 1), 1e-12, "net inflation");
});

test("fixed emissions halve or decay on schedule", () => {
  const halving = runDeterministic(
    baseModel({
      emissions: { mode: "fixed", tokensPerMonth: 1_000, decay: "halving", halvingEveryMonths: 12 },
    }),
  ).series;
  assert.equal(halving.emissionTokens[12], 1_000);
  assert.equal(halving.emissionTokens[13], 500);
  assert.equal(halving.emittedCum[24], 18_000);

  const annual = runDeterministic(
    baseModel({
      emissions: { mode: "fixed", tokensPerMonth: 1_000, decay: "annual", annualDecayRate: 0.25 },
    }),
  ).series;
  assert.equal(annual.emissionTokens[12], 1_000);
  assert.equal(annual.emissionTokens[13], 750);
  assert.equal(annual.emittedCum[24], 21_000);
});

test("a cap on minted supply stops emissions when it is reached", () => {
  const emissions = { mode: "fixed", tokensPerMonth: 1_000, capBasis: "minted" };
  const token = { genesisSupply: 100_000 };

  const capped = runDeterministic(
    baseModel({ token, emissions: { ...emissions, maxSupply: 105_500 } }),
  ).series;
  assert.deepEqual(capped.emissionTokens.slice(1, 8), [1_000, 1_000, 1_000, 1_000, 1_000, 500, 0]);
  assert.deepEqual(capped.emissionTokens.slice(8), filled(17, 0));
  assert.equal(capped.totalSupply[24], 105_500);

  const full = runDeterministic(
    baseModel({ token, emissions: { ...emissions, maxSupply: 100_000 } }),
  ).series;
  assert.deepEqual(full.emissionTokens, filled(25, 0));
});

test("a cap on outstanding supply lets burned tokens be minted again", () => {
  // Supply starts at the cap. Revenue burns a few hundred tokens a month.
  const model = (capBasis) =>
    baseModel({
      token: { genesisSupply: 100_000 },
      emissions: { mode: "fixed", tokensPerMonth: 1_000, maxSupply: 100_000, capBasis },
      utility: { initialUsers: 1_000, saturationUsers: 1_000, spendPerUserUsd: 0.5 },
      revenueSplit: { burnShare: 1 },
    });

  const outstanding = runDeterministic(model("outstanding")).series;
  assert.equal(outstanding.emissionTokens[1], 0);
  for (let t = 1; t <= 24; t++) {
    assert.ok(outstanding.burnTokens[t] > 0, `nothing burned in month ${t}`);
    assert.ok(outstanding.totalSupply[t] <= 100_000, `supply above the cap in month ${t}`);
    // The only room under the cap is what last month's burn freed.
    if (t >= 2) {
      assertNear(outstanding.emissionTokens[t], outstanding.burnTokens[t - 1], 1e-9, `month ${t}`);
    }
  }

  // On the minted basis the same burns free nothing.
  const minted = runDeterministic(model("minted")).series;
  assert.deepEqual(minted.emissionTokens, filled(25, 0));
  assert.ok(minted.burnedCum[24] > 0);
});

test("users follow the logistic curve and revenue follows users", () => {
  const { series } = runDeterministic(
    baseModel({
      utility: {
        initialUsers: 2_000,
        saturationUsers: 10_000,
        monthlyGrowthRate: Math.LN2,
        spendPerUserUsd: 3,
      },
    }),
  );
  assert.equal(series.users[0], 2_000);
  assertNear(series.users[1], 10_000 / 3, 1e-12, "users in month 1");
  assertNear(series.users[2], 5_000, 1e-12, "users in month 2");
  assertNear(series.users[3], 20_000 / 3, 1e-12, "users in month 3");
  assertNear(series.revenueUsd[2], 15_000, 1e-12, "revenue in month 2");
  // Revenue that is not routed anywhere and not held does not touch the price.
  assert.deepEqual(series.priceUsd, filled(25, 1));
});

test("only the change in working balances buys tokens", () => {
  const { series } = runDeterministic(
    baseModel({
      utility: {
        initialUsers: 2_000,
        saturationUsers: 10_000,
        monthlyGrowthRate: Math.LN2,
        spendPerUserUsd: 3,
        holdingMonths: 2,
      },
    }),
  );
  // Balances held: 12,000 at TGE, then 20,000, 30,000 and 40,000.
  assertNear(series.workingBalanceBuyUsd[1], 8_000, 1e-12, "buy in month 1");
  assertNear(series.workingBalanceBuyUsd[2], 10_000, 1e-12, "buy in month 2");
  assertNear(series.workingBalanceBuyUsd[3], 10_000, 1e-12, "buy in month 3");
  assertNear(series.buyUsd[1], 8_000, 1e-12, "total buying in month 1");
  assertNear(series.priceUsd[1], 1.1664, 1e-12, "price in month 1");
});

test("revenue routed to burning buys at the month's average price", () => {
  const { series, flags } = runDeterministic(
    baseModel({
      utility: { initialUsers: 1_000, saturationUsers: 1_000, spendPerUserUsd: 10 },
      revenueSplit: { burnShare: 1 },
    }),
  );
  assert.equal(series.burnUsd[1], 10_000);
  assertNear(series.priceUsd[1], 1.21, 1e-12, "price in month 1");
  assertDecimals(series.burnTokens[1], 9_090.909091, 6, "tokens burned");
  assertDecimals(series.totalSupply[1], 990_909.090909, 6, "total supply");
  assertNear(series.burnUsd[1] / series.burnTokens[1], 1.1, 1e-12, "average buy price");
  assertNear(series.netInflationAnnualised[1], (-12 * (100_000 / 11)) / 1_000_000, 1e-12, "net inflation");
  assert.deepEqual(flags.burnClampMonths, []);
});

test("the treasury runs out in the first month it cannot pay", () => {
  const run = (startingUsd) =>
    runDeterministic(baseModel({ treasury: { startingUsd, monthlyCostUsd: 100_000 } }));

  const exact = run(1_000_000);
  assert.equal(exact.series.treasuryUsd[9], 100_000);
  assert.equal(exact.series.treasuryUsd[10], 0);
  assert.equal(exact.series.unpaidCostUsd[10], 0);
  assert.equal(exact.series.unpaidCostUsd[11], 100_000);
  assert.equal(exact.exhaustedMonth, 11);

  // A shortfall under 1% of the month's cost is recorded but does not count.
  const nearly = run(999_500);
  assert.equal(nearly.series.unpaidCostUsd[10], 500);
  assert.equal(nearly.exhaustedMonth, 11);
  const short = run(998_000);
  assert.equal(short.series.unpaidCostUsd[10], 2_000);
  assert.equal(short.exhaustedMonth, 10);
});

test("the treasury sells tokens to cover costs, up to its monthly cap", () => {
  const run = (maxMonthlySaleShare) =>
    runDeterministic(
      baseModel({
        allocations: [
          row({ share: 0.8 }),
          row({ id: "treasury", category: "treasury", share: 0.2 }),
        ],
        market: { depthRatio: 0.25 },
        treasury: { monthlyCostUsd: 10_000, sellTokens: true, bufferMonths: 0, maxMonthlySaleShare },
      }),
    );

  // 10,000 USD needs 10,526 tokens after slippage; a 1% cap allows 8,000.
  const capped = run(0.01);
  assert.equal(capped.series.circulating[0], 800_000);
  assert.equal(capped.series.treasuryTokens[0], 200_000);
  assertNear(capped.series.treasurySaleTokens[1], 8_000, 1e-12, "tokens sold");
  assertDecimals(capped.series.treasurySaleUsd[1], 7_692.307692, 6, "proceeds");
  assertDecimals(capped.series.priceUsd[1], 0.924556213, 9, "price");
  assertDecimals(capped.series.unpaidCostUsd[1], 2_307.692308, 6, "unpaid cost");
  assertNear(capped.series.treasuryTokens[1], 192_000, 1e-12, "treasury tokens");
  assertNear(capped.series.circulating[1], 808_000, 1e-12, "circulating");
  assert.equal(capped.series.treasuryUsd[1], 0);
  assert.equal(capped.exhaustedMonth, 1);

  // With room under the cap the gross-up makes the sale raise the full cost.
  const covered = run(0.05);
  assertDecimals(covered.series.treasurySaleTokens[1], 10_526.315789, 6, "tokens sold");
  assertDecimals(covered.series.treasurySaleUsd[1], 10_000, 6, "proceeds");
  assertNear(covered.series.priceUsd[1], 0.9025, 1e-12, "price");
  assertDecimals(covered.series.unpaidCostUsd[1], 0, 6, "unpaid cost");
  assert.notEqual(covered.exhaustedMonth, 1);
});

test("staking yield is emissions to stakers over the staked value", () => {
  const { series } = runDeterministic(
    baseModel({
      emissions: { mode: "inflation", annualInflationRate: 0.06, sellRate: 0 },
      staking: { initialRatio: 0.5, targetRatio: 0.5, rampMonths: 0 },
    }),
  );
  assert.equal(series.staked[0], 500_000);
  for (let t = 1; t <= 24; t++) {
    assertDecimals(series.stakingYieldNominal[t], 0.116255335, 9, `nominal yield, month ${t}`);
    assertDecimals(series.stakingYieldReal[t], 0.05756453, 9, `real yield, month ${t}`);
    assertNear(series.stakedRatio[t], 0.5, 1e-12, `staked ratio, month ${t}`);
  }
  assert.deepEqual(series.priceUsd, filled(25, 1));

  const unstaked = runDeterministic(
    baseModel({ emissions: { mode: "inflation", annualInflationRate: 0.06, sellRate: 0 } }),
  ).series;
  assert.deepEqual(unstaked.stakingYieldNominal, filled(25, null));
  assert.deepEqual(unstaked.stakingYieldReal, filled(25, null));
});

test("the staking ratio ramps in a straight line from initial to target", () => {
  const { series } = runDeterministic(
    baseModel({ staking: { initialRatio: 0.2, targetRatio: 0.6, rampMonths: 8 } }),
  );
  assertNear(series.stakedRatio[0], 0.2, 1e-12, "month 0");
  assertNear(series.stakedRatio[2], 0.3, 1e-12, "month 2");
  assertNear(series.stakedRatio[8], 0.6, 1e-12, "month 8");
  assertNear(series.stakedRatio[24], 0.6, 1e-12, "month 24");
  assertNear(series.staked[2] + series.liquid[2], 1_000_000, 1e-12, "circulating");
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

test("a price move beyond five times is clamped and flagged", () => {
  const { series, flags } = runDeterministic(
    baseModel({
      speculation: { baseInflowUsd: 1e10 },
      market: { depthRatio: 0.02, minDepthUsd: 1 },
      utility: { initialUsers: 1_000, saturationUsers: 1_000, spendPerUserUsd: 10 },
      revenueSplit: { burnShare: 1 },
    }),
  );
  // 5^8 is the last power of five under the ceiling of 1e6 × the TGE price.
  for (let t = 1; t <= 8; t++) {
    assert.equal(series.priceUsd[t] / series.priceUsd[t - 1], 5, `ratio in month ${t}`);
  }
  for (let t = 9; t <= 24; t++) assert.equal(series.priceUsd[t], 1e6, `ceiling in month ${t}`);
  assert.deepEqual(flags.priceClampMonths, monthsFrom1(24));

  // A clamped month executes at the geometric mean of its two prices.
  assertNear(series.burnUsd[1] / series.burnTokens[1], Math.sqrt(5), 1e-12, "burn price");

  for (const name of seriesNames) {
    for (const [t, value] of series[name].entries()) {
      assert.ok(value === null || Number.isFinite(value), `${name}[${t}] is ${value}`);
    }
  }
});

test("depth never falls below its floor, and months on the floor are flagged", () => {
  const onFloor = runDeterministic(
    baseModel({ speculation: { baseInflowUsd: 10_000 }, market: { minDepthUsd: 500_000 } }),
  );
  assert.deepEqual(onFloor.series.depthUsd.slice(1), filled(24, 500_000));
  assertNear(onFloor.series.priceUsd[1], 1.02 ** 2, 1e-12, "price in month 1");
  assert.deepEqual(onFloor.flags.minDepthMonths, monthsFrom1(24));

  // Depth that only equals the floor is not held up by it.
  const atFloor = runDeterministic(baseModel({ market: { minDepthUsd: 100_000 } }));
  assert.deepEqual(atFloor.flags.minDepthMonths, []);
});

test("a burn takes at most half of the liquid float", () => {
  const { series, flags } = runDeterministic(
    baseModel({
      utility: { initialUsers: 1_000, saturationUsers: 1_000, spendPerUserUsd: 1e5 },
      revenueSplit: { burnShare: 1 },
    }),
  );
  assert.equal(series.burnTokens[1], 500_000);
  assert.equal(series.liquid[1], 500_000);
  assert.ok(flags.burnClampMonths.includes(1));
});

// ---------------------------------------------------------------------------
// Metamorphic checks on the presets
// ---------------------------------------------------------------------------

const usdSeries = [
  "marketCapUsd",
  "fdvUsd",
  "treasuryUsd",
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
];
const tokenSeries = [
  "totalSupply",
  "circulating",
  "liquid",
  "staked",
  "locked",
  "treasuryTokens",
  "burnedCum",
  "emittedCum",
  "unlockTokens",
  "treasuryVestTokens",
  "emissionTokens",
  "burnTokens",
  "sellUnlockTokens",
  "sellEmissionTokens",
  "sellHolderTokens",
  "treasurySaleTokens",
];
const unitlessSeries = [
  "users",
  "stakedRatio",
  "stakingYieldNominal",
  "stakingYieldReal",
  "netInflationAnnualised",
];

/**
 * Asserts that `actual` is `reference` with prices scaled by `price`, token
 * amounts by `tokens` and USD amounts by `usd`. Values agree to one part in
 * 1e9 of their own size or of the model's scale for that unit, whichever is
 * larger, so rounding noise around zero does not count as a difference.
 */
function assertScaled(actual, reference, model, factors, label) {
  const genesis = model.token.genesisSupply * factors.tokens;
  const tgePrice = model.token.tgePriceUsd * factors.price;
  const groups = [
    [["priceUsd"], factors.price, tgePrice],
    [usdSeries, factors.usd, reference.series.marketCapUsd[0] * factors.usd],
    [tokenSeries, factors.tokens, genesis],
    [unitlessSeries, 1, 1],
  ];
  for (const [names, factor, scale] of groups) {
    for (const name of names) {
      const got = actual.series[name];
      const want = reference.series[name];
      assert.equal(got.length, want.length, `${label}: ${name} length`);
      for (let t = 0; t < want.length; t++) {
        if (want[t] === null) {
          assert.equal(got[t], null, `${label}: ${name}[${t}]`);
          continue;
        }
        const expected = want[t] * factor;
        assert.ok(
          Math.abs(got[t] - expected) <= 1e-9 * Math.max(Math.abs(expected), scale),
          `${label}: ${name}[${t}] expected ${expected}, got ${got[t]}`,
        );
      }
    }
  }
  assert.deepEqual(actual.flags, reference.flags, `${label}: flags`);
  assert.equal(actual.exhaustedMonth, reference.exhaustedMonth, `${label}: exhausted month`);
}

for (const id of presetIds) {
  test(`${id}: a thousand times the supply at a thousandth of the price changes no USD figure`, () => {
    const model = getPreset(id);
    const scaled = getPreset(id);
    scaled.token.genesisSupply *= 1000;
    scaled.token.tgePriceUsd /= 1000;
    scaled.emissions.tokensPerMonth *= 1000;
    if (scaled.emissions.maxSupply !== null) scaled.emissions.maxSupply *= 1000;
    for (const allocation of scaled.allocations) {
      if (allocation.purchasePriceUsd !== null) allocation.purchasePriceUsd /= 1000;
    }
    assertScaled(
      runDeterministic(scaled),
      runDeterministic(model),
      model,
      { price: 1 / 1000, tokens: 1000, usd: 1 },
      id,
    );
  });

  test(`${id}: seven times every USD input gives seven times the price`, () => {
    const model = getPreset(id);
    const scaled = getPreset(id);
    scaled.token.tgePriceUsd *= 7;
    scaled.utility.spendPerUserUsd *= 7;
    scaled.speculation.baseInflowUsd *= 7;
    scaled.market.minDepthUsd *= 7;
    scaled.treasury.startingUsd *= 7;
    scaled.treasury.monthlyCostUsd *= 7;
    for (const allocation of scaled.allocations) {
      if (allocation.purchasePriceUsd !== null) allocation.purchasePriceUsd *= 7;
    }
    assertScaled(
      runDeterministic(scaled),
      runDeterministic(model),
      model,
      { price: 7, tokens: 1, usd: 7 },
      id,
    );
  });

  test(`${id}: splitting a row in two changes no aggregate`, () => {
    const model = getPreset(id);
    const split = getPreset(id);
    split.allocations = split.allocations.flatMap((allocation) => [
      { ...allocation, id: `${allocation.id}_a`, share: allocation.share * 0.25 },
      { ...allocation, id: `${allocation.id}_b`, share: allocation.share * 0.75 },
    ]);
    const whole = runDeterministic(model);
    const halves = runDeterministic(split);
    assertScaled(halves, whole, model, { price: 1, tokens: 1, usd: 1 }, id);
    for (const [i, allocation] of whole.allocations.entries()) {
      const a = halves.allocations[2 * i];
      const b = halves.allocations[2 * i + 1];
      assertNear(a.tokens + b.tokens, allocation.tokens, 1e-12, `${id}: ${allocation.id} tokens`);
      for (const [t, unlocked] of allocation.unlockedCum.entries()) {
        assertNear(a.unlockedCum[t] + b.unlockedCum[t], unlocked, 1e-12, `${id}: ${allocation.id}[${t}]`);
      }
    }
  });

  test(`${id}: a shorter horizon is the start of the longer run`, () => {
    const long = runDeterministic(getPreset(id));
    const short = runDeterministic({ ...getPreset(id), horizonMonths: 24 });
    assert.deepEqual(short.months, long.months.slice(0, 25));
    for (const name of seriesNames) {
      assert.deepEqual(short.series[name], long.series[name].slice(0, 25), name);
    }
    for (const [i, allocation] of short.allocations.entries()) {
      assert.deepEqual(allocation.unlockedCum, long.allocations[i].unlockedCum.slice(0, 25));
    }
    for (const name of Object.keys(noFlags)) {
      assert.deepEqual(short.flags[name], long.flags[name].filter((month) => month <= 24), name);
    }
  });
}

// ---------------------------------------------------------------------------
// Invariants on random models
// ---------------------------------------------------------------------------

/**
 * A random valid model. USD inputs are sized against the model's own initial
 * market cap so that most models are plausible while some still reach the
 * guards: the price clamp, the depth floor, the burn limit, the supply cap
 * and an empty treasury.
 */
function randomModel(rng) {
  const between = (low, high) => low + (high - low) * rng();
  const logBetween = (low, high) => Math.exp(between(Math.log(low), Math.log(high)));
  const int = (low, high) => Math.min(high, Math.floor(between(low, high + 1)));
  const pick = (items) => items[int(0, items.length - 1)];
  const chance = (probability) => rng() < probability;
  const limit = (value, low, high) => Math.min(high, Math.max(low, value));

  const genesis = logBetween(1e5, 1e11);
  const tgePrice = logBetween(1e-4, 100);

  const weights = Array.from({ length: int(1, 16) }, () => 0.05 + rng());
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const allocations = weights.map((weight, i) => ({
    id: `row_${i}`,
    name: `Row ${i}`,
    // The first row always reaches the float at TGE: a model with nothing
    // circulating at TGE is not valid.
    category: i === 0 ? "public_sale" : pick(allocationCategories),
    share: weight / weightSum,
    tgeUnlock: i === 0 ? between(0.05, 1) : chance(0.35) ? 0 : chance(0.2) ? 1 : rng(),
    cliffMonths: chance(0.05) ? int(60, 120) : int(0, 24),
    vestingMonths: chance(0.15) ? 0 : int(1, 60),
    vestingStepMonths: pick([1, 1, 1, 3, 6, 12]),
    sellPropensity: chance(0.1) ? 0 : chance(0.1) ? 1 : rng(),
    purchasePriceUsd: chance(0.5) ? null : tgePrice * between(0.05, 1.5),
  }));
  const floatShare = allocations
    .filter((allocation) => allocation.category !== "treasury")
    .reduce((sum, allocation) => sum + allocation.share * allocation.tgeUnlock, 0);
  const marketCap = genesis * floatShare * tgePrice;

  const saturationUsers = chance(0.1) ? 0 : logBetween(100, 1e7);
  const initialUsers = chance(0.15) ? saturationUsers : chance(0.1) ? 0 : saturationUsers * rng();
  const burnShare = chance(0.1) ? 1 : rng();
  const treasuryShare = rng() * (1 - burnShare);
  const stakerShare = rng() * (1 - burnShare - treasuryShare);

  return {
    version: 1,
    horizonMonths: int(12, 120),
    token: { name: "", symbol: "RND", genesisSupply: genesis, tgePriceUsd: tgePrice },
    allocations,
    emissions: {
      mode: pick(["none", "inflation", "fixed"]),
      annualInflationRate: chance(0.1) ? 1 : between(0, 0.3),
      tokensPerMonth: genesis * between(0, 0.03),
      decay: pick(["none", "halving", "annual"]),
      halvingEveryMonths: int(1, 48),
      annualDecayRate: between(0, 0.99),
      maxSupply: chance(0.5) ? null : chance(0.2) ? genesis : genesis * between(1, 1.5),
      capBasis: pick(["minted", "outstanding"]),
      sellRate: rng(),
      toStakersShare: rng(),
    },
    staking: {
      initialRatio: chance(0.3) ? 0 : between(0, 0.95),
      targetRatio: chance(0.2) ? 0 : between(0, 0.95),
      rampMonths: chance(0.2) ? 0 : int(1, 60),
    },
    utility: {
      initialUsers,
      saturationUsers,
      monthlyGrowthRate: chance(0.1) ? 1 : between(0, 0.4),
      spendPerUserUsd:
        saturationUsers > 0 ? limit((marketCap * between(0, 0.2)) / saturationUsers, 0, 1e5) : 0,
      holdingMonths: pick([0, 0, 0.25, 1, 3, 12]),
    },
    revenueSplit: { burnShare, treasuryShare, stakerShare },
    speculation: {
      baseInflowUsd: chance(0.1) ? 0 : limit(marketCap * logBetween(1e-4, 1), 0, 1e10),
      monthlyGrowth: between(-0.05, 0.05),
      scenario: pick(["bear", "base", "bull"]),
      scenarioMultipliers: { bear: between(0, 1), base: 1, bull: between(1, 3) },
      momentum: between(0, 2),
    },
    market: {
      depthRatio: logBetween(0.02, 2),
      minDepthUsd: limit(marketCap * logBetween(1e-6, 0.5), 1, 1e9),
      holderSellRate: chance(0.2) ? 0 : between(0, 0.25),
    },
    treasury: {
      startingUsd: limit(marketCap * between(0, 2), 0, 1e11),
      monthlyCostUsd: chance(0.1) ? 0 : limit(marketCap * between(0, 0.1), 0, 1e9),
      annualCostGrowth: between(-0.5, 1),
      sellTokens: chance(0.7),
      bufferMonths: between(0, 24),
      maxMonthlySaleShare: between(0, 0.05),
    },
    monteCarlo: {
      runs: 500,
      seed: 1,
      marketVolatility: 0.25,
      growthVolatility: 0.3,
      sellPropensityVolatility: 0.5,
    },
    outcomeMonths: [12],
  };
}

/** Rates that can be negative by definition; everything else is ≥ 0. */
const signedSeries = new Set(["stakingYieldReal", "netInflationAnnualised"]);
const yieldSeries = new Set(["stakingYieldNominal", "stakingYieldReal"]);

/** Asserts the engine's invariants on one result, month by month. */
function assertInvariants(model, result, label) {
  const { series: s, allocations, flags } = result;
  const horizon = model.horizonMonths;
  const genesis = model.token.genesisSupply;
  const tgePrice = model.token.tgePriceUsd;
  const cap = model.emissions.maxSupply;
  const tokenSlack = 1e-9 * genesis;
  const { staking, market, treasury } = model;
  const stakingTarget = (month) =>
    staking.rampMonths === 0
      ? staking.targetRatio
      : staking.initialRatio +
        (staking.targetRatio - staking.initialRatio) * Math.min(1, month / staking.rampMonths);
  const clampedMonths = new Set(flags.priceClampMonths);
  const check = (condition, what, month) =>
    assert.ok(condition, `${label}${month === undefined ? "" : `, month ${month}`}: ${what}`);

  // Shape, and the TGE snapshot.
  assert.deepEqual(result.months, Array.from({ length: horizon + 1 }, (_, month) => month), label);
  for (const name of seriesNames) check(s[name].length === horizon + 1, `${name} length`);
  check(s.priceUsd[0] === tgePrice, "price at TGE");
  for (const name of monthZeroSeries) check(s[name][0] === 0, `${name} at TGE`, 0);
  for (const months of Object.values(flags)) {
    check(months.every((month) => month >= 1 && month <= horizon), "flagged months in range");
  }

  // Rows: tokens add up to genesis, and each row unlocks along its schedule.
  const shareSum = model.allocations.reduce((sum, allocation) => sum + allocation.share, 0);
  let rowTokens = 0;
  check(allocations.length === model.allocations.length, "one series per row");
  for (const [i, allocation] of model.allocations.entries()) {
    const { id, tokens, unlockedCum } = allocations[i];
    check(id === allocation.id, "row order");
    check(unlockedCum.length === horizon + 1, `${id} length`);
    assertNear(tokens, (genesis * allocation.share) / shareSum, 1e-12, `${label}: ${id} tokens`);
    assertNear(
      unlockedCum[horizon],
      tokens * vestedFraction(allocation, horizon),
      1e-12,
      `${label}: ${id} unlocked at the horizon`,
    );
    for (let t = 1; t <= horizon; t++) {
      check(unlockedCum[t] >= unlockedCum[t - 1], `${id} unlocked falls`, t);
    }
    rowTokens += tokens;
  }
  assertNear(rowTokens, genesis, 1e-9, `${label}: row tokens`);

  for (let t = 0; t <= horizon; t++) {
    const price = s.priceUsd[t];

    // Every value is finite and non-negative; ratios with no base are null.
    for (const name of seriesNames) {
      const value = s[name][t];
      if (yieldSeries.has(name) && s.staked[t] === 0) {
        check(value === null, `${name} without a stake is ${value}`, t);
        continue;
      }
      check(Number.isFinite(value), `${name} is ${value}`, t);
      if (!signedSeries.has(name)) check(value >= 0, `${name} is ${value}`, t);
    }
    check(price > 0, "price is not positive", t);

    // Every token is in exactly one place.
    const held = s.liquid[t] + s.staked[t] + s.locked[t] + s.treasuryTokens[t] + s.burnedCum[t];
    check(Math.abs(held - (genesis + s.emittedCum[t])) <= tokenSlack, "tokens not conserved", t);
    check(s.totalSupply[t] === genesis + s.emittedCum[t] - s.burnedCum[t], "total supply", t);
    assertNear(s.circulating[t], s.liquid[t] + s.staked[t], 1e-12, `${label}, month ${t}: circulating`);
    check(s.circulating[t] <= s.totalSupply[t] + tokenSlack, "circulating above total supply", t);
    check(s.marketCapUsd[t] === s.circulating[t] * price, "market cap", t);
    assertNear(s.fdvUsd[t], price * (cap ?? s.totalSupply[t]), 1e-12, `${label}, month ${t}: FDV`);

    // The cap holds on its own basis.
    if (cap !== null) {
      const capped =
        model.emissions.capBasis === "minted" ? genesis + s.emittedCum[t] : s.totalSupply[t];
      check(capped <= cap * (1 + 1e-12), `supply ${capped} above the cap ${cap}`, t);
    }

    // Staking sits on its target.
    const staked = stakingTarget(t) * s.circulating[t];
    check(Math.abs(s.staked[t] - staked) <= 1e-12 * Math.max(staked, 1), "staked off target", t);

    if (t === 0) continue;
    const priceBefore = s.priceUsd[t - 1];
    const circulatingBefore = s.circulating[t - 1];

    // Cumulative series never fall and move by the month's flow.
    check(s.emittedCum[t] === s.emittedCum[t - 1] + s.emissionTokens[t], "emitted", t);
    check(s.burnedCum[t] === s.burnedCum[t - 1] + s.burnTokens[t], "burned", t);

    // Depth, and the flows that make up the month's buying and selling.
    assertNear(
      s.depthUsd[t],
      Math.max(market.minDepthUsd, market.depthRatio * circulatingBefore * priceBefore),
      1e-12,
      `${label}, month ${t}: depth`,
    );
    assertNear(
      s.buyUsd[t],
      s.speculativeInflowUsd[t] + s.burnUsd[t] + s.workingBalanceBuyUsd[t],
      1e-12,
      `${label}, month ${t}: buying`,
    );
    const listedSells =
      s.sellUnlockTokens[t] + s.sellEmissionTokens[t] + s.sellHolderTokens[t] + s.treasurySaleTokens[t];
    check(
      s.sellPressureUsd[t] >= listedSells * priceBefore * (1 - 1e-12),
      "sell pressure below its parts",
      t,
    );

    // Price: the monthly limit, the absolute bounds, and the pull toward
    // buy ÷ sell in months that traded both ways without a clamp.
    check(price <= priceBefore * 5 && price >= priceBefore / 5, "monthly price limit", t);
    check(price >= tgePrice * 1e-6 && price <= tgePrice * 1e6, "absolute price bounds", t);
    const buy = s.buyUsd[t];
    const sellTokens = s.sellPressureUsd[t] / priceBefore;
    if (buy > 1e-9 && s.sellPressureUsd[t] > 1e-9 && !clampedMonths.has(t)) {
      const target = buy / sellTokens;
      check(
        price >= Math.min(priceBefore, target) * (1 - 1e-9) &&
          price <= Math.max(priceBefore, target) * (1 + 1e-9),
        `price ${price} not between ${priceBefore} and ${target}`,
        t,
      );
    }

    // The pool keeps its product, and pays out nothing negative.
    const depth = s.depthUsd[t];
    const trade = poolTrade(priceBefore, depth, buy, sellTokens);
    check(trade.tokensToBuyers >= 0 && trade.usdToSellers >= 0, "negative pool output", t);
    const product = (depth * depth) / priceBefore;
    const after =
      (depth + buy - trade.usdToSellers) * (depth / priceBefore + sellTokens - trade.tokensToBuyers);
    check(Math.abs(after - product) <= 1e-9 * product, `pool product ${after} against ${product}`, t);
    if (!clampedMonths.has(t)) {
      assertNear(price, trade.price, 1e-9, `${label}, month ${t}: price against the pool`);
    }

    // Treasury: USD and tokens both balance, and sales respect their cap.
    const sale = s.treasurySaleTokens[t];
    const usdScale = Math.max(1, s.treasuryUsd[t - 1], s.treasuryCostUsd[t], s.treasuryRevenueUsd[t]);
    const usdBalance =
      s.treasuryUsd[t - 1] +
      s.treasuryRevenueUsd[t] +
      s.treasurySaleUsd[t] -
      s.treasuryCostUsd[t] +
      s.unpaidCostUsd[t];
    check(Math.abs(s.treasuryUsd[t] - usdBalance) <= 1e-9 * usdScale, "treasury USD", t);
    const tokenBalance = s.treasuryTokens[t - 1] + s.treasuryVestTokens[t] - sale;
    check(Math.abs(s.treasuryTokens[t] - tokenBalance) <= tokenSlack, "treasury tokens", t);
    check(sale <= treasury.maxMonthlySaleShare * circulatingBefore, "treasury sale above its cap", t);
    if (!treasury.sellTokens) check(sale === 0, "treasury sold with selling off", t);

    // A burn takes at most half of the liquid float it draws on.
    const liquidBeforeBurn = s.liquid[t - 1] + s.unlockTokens[t] + s.emissionTokens[t] + sale;
    check(s.burnTokens[t] <= 0.5 * liquidBeforeBurn * (1 + 1e-12), "burn above its limit", t);
  }
}

test("invariants hold every month on 200 random models", () => {
  const rng = mulberry32(20_240_607);
  const reached = {
    priceClamp: 0,
    depthFloor: 0,
    burnLimit: 0,
    treasuryExhausted: 0,
    treasurySale: 0,
    capReached: 0,
    burn: 0,
    staking: 0,
  };

  for (let i = 0; i < 200; i++) {
    const model = randomModel(rng);
    const input = structuredClone(model);
    const result = runDeterministic(model);
    const label = `model ${i}`;

    assert.deepEqual(model, input, `${label}: the model was modified`);
    assert.deepEqual(runDeterministic(model), result, `${label}: a second run differs`);
    assertInvariants(model, result, label);

    const { series: s, flags } = result;
    const last = model.horizonMonths;
    const cap = model.emissions.maxSupply;
    const sum = (values) => values.reduce((total, value) => total + value, 0);
    if (flags.priceClampMonths.length > 0) reached.priceClamp += 1;
    if (flags.minDepthMonths.length > 0) reached.depthFloor += 1;
    if (flags.burnClampMonths.length > 0) reached.burnLimit += 1;
    if (result.exhaustedMonth !== null) reached.treasuryExhausted += 1;
    if (sum(s.treasurySaleTokens) > 0) reached.treasurySale += 1;
    if (cap !== null && s.emittedCum[last] > 0 && s.emissionTokens[last] < 1e-9 * cap) {
      reached.capReached += 1;
    }
    if (s.burnedCum[last] > 0) reached.burn += 1;
    if (s.staked[last] > 0) reached.staking += 1;
  }

  // The invariants only mean something if the models reach the guards.
  for (const [guard, models] of Object.entries(reached)) {
    assert.ok(models >= 5, `only ${models} of 200 models reached: ${guard}`);
  }
});
