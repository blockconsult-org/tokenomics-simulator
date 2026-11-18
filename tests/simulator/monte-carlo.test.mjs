import test from "node:test";
import assert from "node:assert/strict";
import { runDeterministic } from "@/simulator/engine/core";
import {
  advanceMonteCarlo,
  createMonteCarlo,
  quantile,
  summariseMonteCarlo,
} from "@/simulator/engine/monte-carlo";
import { getPreset } from "@/simulator/engine/presets";
import { mulberry32, normal, runSeed } from "@/simulator/engine/rng";
import { simulate } from "@/simulator/engine/simulate";
import { assertDecimals, assertNear, baseModel } from "./fixtures.mjs";

const bandNames = ["p5", "p25", "p50", "p75", "p95"];
const noVolatility = { marketVolatility: 0, growthVolatility: 0, sellPropensityVolatility: 0 };

/** The DeFi governance preset with some Monte Carlo settings replaced. */
function preset(monteCarlo) {
  const model = getPreset("defi_governance");
  Object.assign(model.monteCarlo, monteCarlo);
  return model;
}

/** Runs a job to the end in one call and summarises it. */
function summarise(model) {
  const job = createMonteCarlo(model);
  assert.equal(advanceMonteCarlo(job, model.monteCarlo.runs), model.monteCarlo.runs);
  return summariseMonteCarlo(job);
}

test("the generator, the stream seeds and the normal draw reproduce their reference values", () => {
  const uniform = mulberry32(1);
  assertDecimals(uniform(), 0.6270739406, 10, "first uniform");
  assertDecimals(uniform(), 0.0027357212, 10, "second uniform");
  assertDecimals(uniform(), 0.52744704, 10, "third uniform");

  assert.equal(runSeed(1, 0), 2980047484);
  assert.equal(runSeed(1, 1), 232174035);

  // Run 0 of seed 1 draws its market shocks from stream 0 and its parameters
  // from stream 1.
  assertDecimals(normal(mulberry32(runSeed(1, 0))), -1.7655838942, 10, "first market normal");
  assertDecimals(normal(mulberry32(runSeed(1, 1))), -2.3809893016, 10, "first parameter normal");
});

test("quantiles interpolate linearly between neighbours", () => {
  const sorted = [1, 2, 3, 4, 10];
  assertNear(quantile(sorted, 0.05), 1.2, 1e-12, "p5");
  assert.equal(quantile(sorted, 0.25), 2);
  assert.equal(quantile(sorted, 0.5), 3);
  assert.equal(quantile(sorted, 0.75), 4);
  assertNear(quantile(sorted, 0.95), 8.8, 1e-12, "p95");
  assert.equal(quantile([7], 0.95), 7);
});

test("without volatility every band is the deterministic series", () => {
  const model = preset({ runs: 50, ...noVolatility });
  const { series, exhaustedMonth } = runDeterministic(model);
  const summary = summarise(model);

  assert.equal(summary.runs, 50);
  assert.equal(summary.seed, 1);
  assert.deepEqual(summary.months, Array.from({ length: 61 }, (_, month) => month));
  for (const band of bandNames) {
    assert.deepEqual(summary.priceUsd[band], series.priceUsd, `price ${band}`);
    assert.deepEqual(summary.marketCapUsd[band], series.marketCapUsd, `market cap ${band}`);
  }
  assert.equal(exhaustedMonth, null);
  assert.equal(summary.probTreasuryExhausted, 0);
});

test("the bands do not depend on how the runs are chunked", () => {
  const model = preset({ runs: 400 });
  const whole = summarise(model);

  const job = createMonteCarlo(model);
  assert.equal(summariseMonteCarlo(job).runs, 0);
  assert.deepEqual(summariseMonteCarlo(job).priceUsd.p50, []);
  const finishedAfter = [1, 7, 50, 113, 1000].map((chunk) => advanceMonteCarlo(job, chunk));
  assert.deepEqual(finishedAfter, [1, 8, 58, 171, 400]);
  assert.equal(advanceMonteCarlo(job, 50), 400);
  assert.deepEqual(summariseMonteCarlo(job), whole);
});

test("the first 200 runs of a 400-run job are a 200-run job", () => {
  const partial = createMonteCarlo(preset({ runs: 400 }));
  assert.equal(advanceMonteCarlo(partial, 200), 200);
  const summary = summariseMonteCarlo(partial);
  assert.equal(summary.runs, 200);
  assert.deepEqual(summary, summarise(preset({ runs: 200 })));
});

test("bands are ordered, start at the TGE values and spread out afterwards", () => {
  const model = preset({ runs: 400 });
  const summary = summarise(model);
  const { series } = runDeterministic(model);

  for (const [name, bands] of [
    ["price", summary.priceUsd],
    ["market cap", summary.marketCapUsd],
  ]) {
    for (const band of bandNames) assert.equal(bands[band].length, 61, `${name} ${band} length`);
    for (let t = 0; t <= 60; t++) {
      for (let i = 1; i < bandNames.length; i++) {
        assert.ok(
          bands[bandNames[i - 1]][t] <= bands[bandNames[i]][t],
          `${name}: ${bandNames[i - 1]} above ${bandNames[i]} in month ${t}`,
        );
      }
    }
    assert.ok(bands.p95[12] > bands.p5[12], `${name}: no spread in month 12`);
  }
  for (const band of bandNames) {
    assert.equal(summary.priceUsd[band][0], model.token.tgePriceUsd, `price ${band} at TGE`);
    assert.equal(summary.marketCapUsd[band][0], series.marketCapUsd[0], `market cap ${band} at TGE`);
  }
  for (const probability of [
    ...Object.values(summary.probPriceBelowTge),
    summary.probTreasuryExhausted,
  ]) {
    assert.ok(probability >= 0 && probability <= 1, `probability ${probability}`);
  }
});

test("each of the three shock sources moves the outcome on its own", () => {
  for (const source of Object.keys(noVolatility)) {
    const summary = summarise(preset({ runs: 50, ...noVolatility, [source]: 0.5 }));
    assert.ok(summary.priceUsd.p95[60] > summary.priceUsd.p5[60], `${source} has no effect`);
  }
});

test("a model with selling and no buying ends below the TGE price in every run", () => {
  const summary = summarise(
    baseModel({ market: { holderSellRate: 0.05 }, monteCarlo: { runs: 100 } }),
  );
  // The horizon is 24 months, so month 36 has no probability.
  assert.deepEqual(summary.probPriceBelowTge, { m12: 1, m24: 1, m36: null });
});

test("a model that cannot be simulated gets its errors and no job", () => {
  const model = preset({ runs: 50 });
  model.allocations = [];
  assert.deepEqual(createMonteCarlo(model), {
    ok: false,
    errors: [{ code: "allocations_empty", severity: "error", field: "allocations" }],
  });
  assert.deepEqual(createMonteCarlo(model), simulate(model));
});

test("a seeded job reproduces its recorded bands", () => {
  // Recorded from this engine, not worked out by hand. The values pin what
  // the tests above leave free inside a run: which stream feeds which draw,
  // the order of the parameter draws, and the market factor's persistence
  // and clamp.
  const summary = summarise(preset({ runs: 50 }));
  assertNear(summary.priceUsd.p5[12], 0.1562442758, 1e-6, "p5 at month 12");
  assertNear(summary.priceUsd.p50[12], 0.2840514654, 1e-6, "p50 at month 12");
  assertNear(summary.priceUsd.p95[12], 0.5113014956, 1e-6, "p95 at month 12");
  assertNear(summary.priceUsd.p50[60], 0.2897461607, 1e-6, "p50 at month 60");
  assertNear(summary.marketCapUsd.p50[12], 59_423_080.75, 1e-6, "market cap p50 at month 12");
  assert.deepEqual(summary.probPriceBelowTge, { m12: 0.4, m24: 0.82, m36: 0.84 });
  assert.equal(summary.probTreasuryExhausted, 0);
});

test("the treasury probability counts the runs that run out", () => {
  // Reserves for about four months of cost and no token sales: no shock in
  // the model can pay the fifth month.
  const model = preset({ runs: 50 });
  Object.assign(model.treasury, { startingUsd: 2_000_000, sellTokens: false });
  assert.equal(summarise(model).probTreasuryExhausted, 1);
});
