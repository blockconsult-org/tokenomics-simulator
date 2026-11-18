import { ENGINE } from "./constants";
import { fillSellUnlock, prepareModel, runLeanPath } from "./core";
import type { PathDraws, PreparedModel } from "./core";
import { mulberry32, normal, runSeed } from "./rng";
import type {
  Bands,
  Model,
  MonteCarloResult,
  SimulationFailure,
} from "./types";
import { validateModel } from "./validate";

/**
 * Monte Carlo runner.
 *
 * Each run perturbs three things: the user growth rate and every row's sell
 * propensity, drawn once per run, and a market factor on speculative inflow
 * that follows an AR(1) process month by month. The shocks keep the median
 * of each input where it was entered, which is not the same as keeping the
 * median price on the deterministic line.
 *
 * A job is advanced in chunks so a page can stay responsive, and it can be
 * summarised at any point. Every run seeds its own two streams from the job
 * seed and the run number, so results do not depend on the chunk sizes.
 */

/**
 * State of a Monte Carlo job. Treat it as opaque: create it with
 * `createMonteCarlo`, advance it with `advanceMonteCarlo` and read it with
 * `summariseMonteCarlo`.
 */
export interface MonteCarloJob {
  readonly prepared: PreparedModel;
  readonly seed: number;
  /** Runs the job will do in total. */
  readonly runs: number;
  readonly marketVolatility: number;
  readonly growthVolatility: number;
  readonly sellPropensityVolatility: number;
  /** Runs finished so far. */
  completed: number;
  /** Price and market cap of every run, run after run, horizon + 1 values
   *  each. */
  readonly priceUsd: Float64Array;
  readonly marketCapUsd: Float64Array;
  /** 1 where the treasury ran out during the run. */
  readonly exhausted: Uint8Array;
  /** Buffers reused by every run. */
  readonly draws: PathDraws & { marketInnovations: Float64Array };
  readonly propensities: Float64Array;
}

/**
 * A job for a model, or the blocking errors `simulate` reports for it. A
 * model that cannot be simulated gets no bands: with no float, for one, the
 * runs would sit at the price ceiling and read as a result.
 */
export function createMonteCarlo(
  model: Model,
): MonteCarloJob | SimulationFailure {
  const errors = validateModel(model).filter(
    (issue) => issue.severity === "error",
  );
  if (errors.length > 0) return { ok: false, errors };

  const prepared = prepareModel(model);
  const length = prepared.horizon + 1;
  const runs = model.monteCarlo.runs;
  return {
    prepared,
    seed: model.monteCarlo.seed >>> 0,
    runs,
    marketVolatility: model.monteCarlo.marketVolatility,
    growthVolatility: model.monteCarlo.growthVolatility,
    sellPropensityVolatility: model.monteCarlo.sellPropensityVolatility,
    completed: 0,
    priceUsd: new Float64Array(runs * length),
    marketCapUsd: new Float64Array(runs * length),
    exhausted: new Uint8Array(runs),
    draws: {
      growthRate: prepared.growthRate,
      sellUnlock: new Float64Array(length),
      marketInnovations: new Float64Array(length),
    },
    propensities: new Float64Array(prepared.rowCount),
  };
}

/**
 * A sell propensity moved by `shift` on the logit scale, which keeps it
 * between 0 and 1. A propensity of exactly 0 or 1 has no finite logit and
 * stays where it is. A zero shift returns the input itself, so a job without
 * volatility reproduces the deterministic path to the last bit.
 */
function shiftPropensity(propensity: number, shift: number): number {
  if (propensity <= 0 || propensity >= 1 || shift === 0) return propensity;
  const logit = Math.log(propensity / (1 - propensity));
  return 1 / (1 + Math.exp(-(logit + shift)));
}

function runOne(job: MonteCarloJob, run: number): void {
  const { prepared, draws, propensities } = job;
  const length = prepared.horizon + 1;
  // Two streams per run: adding an allocation row changes how many parameter
  // draws a run makes, and must not disturb its market path.
  const marketStream = mulberry32(runSeed(job.seed, 2 * run));
  const parameterStream = mulberry32(runSeed(job.seed, 2 * run + 1));

  draws.growthRate = Math.min(
    ENGINE.MAX_RUN_GROWTH_RATE,
    prepared.growthRate * Math.exp(job.growthVolatility * normal(parameterStream)),
  );
  // One draw per row, used or not, so the draw a row gets depends only on
  // its position.
  for (let i = 0; i < prepared.rowCount; i++) {
    const shift = job.sellPropensityVolatility * normal(parameterStream);
    propensities[i] = shiftPropensity(prepared.rowSellPropensity[i], shift);
  }
  fillSellUnlock(prepared, propensities, draws.sellUnlock);

  for (let t = 1; t < length; t++) {
    draws.marketInnovations[t] = job.marketVolatility * normal(marketStream);
  }

  const offset = run * length;
  job.exhausted[run] = runLeanPath(prepared, draws, job.priceUsd, job.marketCapUsd, offset)
    ? 1
    : 0;
}

/**
 * Does up to `maxRuns` more runs and returns how many are finished in total.
 * The job is complete when that equals its `runs`.
 */
export function advanceMonteCarlo(job: MonteCarloJob, maxRuns: number): number {
  const budget = maxRuns > 0 ? Math.floor(maxRuns) : 0;
  const end = Math.min(job.runs, job.completed + budget);
  for (let run = job.completed; run < end; run++) runOne(job, run);
  job.completed = end;
  return end;
}

/**
 * Quantile of an ascending list by linear interpolation at (n − 1) × p.
 * NaN for an empty list.
 */
export function quantile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  const position = (n - 1) * Math.min(1, Math.max(0, p));
  const below = Math.floor(position);
  const above = Math.min(below + 1, n - 1);
  return sorted[below] + (position - below) * (sorted[above] - sorted[below]);
}

function emptyBands(): Bands {
  return { p5: [], p25: [], p50: [], p75: [], p95: [] };
}

/** Percentile bands by month over the first `runs` runs stored in `values`. */
function bandsOf(values: Float64Array, runs: number, length: number): Bands {
  const bands = emptyBands();
  const column = new Float64Array(runs);
  for (let t = 0; t < length; t++) {
    for (let run = 0; run < runs; run++) column[run] = values[run * length + t];
    column.sort();
    bands.p5.push(quantile(column, 0.05));
    bands.p25.push(quantile(column, 0.25));
    bands.p50.push(quantile(column, 0.5));
    bands.p75.push(quantile(column, 0.75));
    bands.p95.push(quantile(column, 0.95));
  }
  return bands;
}

/**
 * Summary of the runs finished so far. Before the first run there is nothing
 * to summarise: the bands are empty, the price probabilities are null and
 * the treasury probability is 0.
 */
export function summariseMonteCarlo(job: MonteCarloJob): MonteCarloResult {
  const { prepared, completed } = job;
  const length = prepared.horizon + 1;
  const months = Array.from({ length }, (_, month) => month);

  if (completed === 0) {
    return {
      runs: 0,
      seed: job.seed,
      months,
      priceUsd: emptyBands(),
      marketCapUsd: emptyBands(),
      probPriceBelowTge: { m12: null, m24: null, m36: null },
      probTreasuryExhausted: 0,
    };
  }

  const shareBelowTge = (month: number): number | null => {
    if (month > prepared.horizon) return null;
    let below = 0;
    for (let run = 0; run < completed; run++) {
      if (job.priceUsd[run * length + month] < prepared.tgePrice) below += 1;
    }
    return below / completed;
  };

  let exhaustedRuns = 0;
  for (let run = 0; run < completed; run++) exhaustedRuns += job.exhausted[run];

  return {
    runs: completed,
    seed: job.seed,
    months,
    priceUsd: bandsOf(job.priceUsd, completed, length),
    marketCapUsd: bandsOf(job.marketCapUsd, completed, length),
    probPriceBelowTge: {
      m12: shareBelowTge(12),
      m24: shareBelowTge(24),
      m36: shareBelowTge(36),
    },
    probTreasuryExhausted: exhaustedRuns / completed,
  };
}
