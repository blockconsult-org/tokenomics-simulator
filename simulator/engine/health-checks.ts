import { sumTrailingYear } from "./kpis";
import { healthCheckIds, insiderCategories } from "./types";
import type {
  CoreResult,
  HealthCheck,
  HealthCheckId,
  HealthStatus,
  Kpis,
  Model,
  MonteCarloResult,
} from "./types";

interface Threshold {
  watchAt: number;
  riskAt: number;
  /** Which direction of the value is the worse one. */
  worse: "higher" | "lower";
  /** Whether a value exactly on a threshold has reached it. */
  inclusive: boolean;
}

const thresholds: Record<HealthCheckId, Threshold> = {
  // A third of supply is a blocking minority, half is a majority.
  insider_share: { watchAt: 1 / 3, riskAt: 1 / 2, worse: "higher", inclusive: false },
  // At float f, holding price through full unlock means absorbing (1/f − 1)
  // times today's market cap.
  low_float: { watchAt: 0.2, riskAt: 0.1, worse: "lower", inclusive: false },
  // The engine's own price impact at default depth with half of the unlock
  // sold: about −21% and −47% before any demand.
  unlock_shock: { watchAt: 0.05, riskAt: 0.15, worse: "higher", inclusive: true },
  // Dilution of a holder who earns none of the new supply.
  net_inflation: { watchAt: 0.05, riskAt: 0.15, worse: "higher", inclusive: false },
  // Months until the treasury runs out: one funding cycle, and a long down
  // market.
  runway: { watchAt: 36, riskAt: 18, worse: "lower", inclusive: true },
  // Costs paid from token sales rise exactly when the token is weak.
  treasury_token_dependence: { watchAt: 0.25, riskAt: 0.5, worse: "higher", inclusive: false },
  // What this share does not cover is absorbed only by the typed speculative
  // inflow.
  structural_demand: { watchAt: 0.35, riskAt: 0.1, worse: "lower", inclusive: false },
  // One flagged month is enough to say so. There is no risk level, so the
  // risk threshold is out of reach.
  model_range: { watchAt: 1, riskAt: Number.POSITIVE_INFINITY, worse: "higher", inclusive: true },
  // One run in four, or in two, fails on the modelled shocks alone.
  treasury_exhaustion_probability: { watchAt: 0.25, riskAt: 0.5, worse: "higher", inclusive: true },
};

/**
 * Values and thresholds are compared after rounding to nine decimals. Most
 * values are ratios of sums, and without the rounding one meant to sit
 * exactly on a threshold lands on either side of it by an ulp, which would
 * make the inclusive and exclusive rules arbitrary.
 */
const COMPARISON_SCALE = 1e9;

function roundForComparison(value: number): number {
  return Math.round(value * COMPARISON_SCALE) / COMPARISON_SCALE;
}

function grade(id: HealthCheckId, value: number): HealthStatus {
  const { watchAt, riskAt, worse, inclusive } = thresholds[id];
  const rounded = roundForComparison(value);
  const reached = (threshold: number): boolean => {
    const limit = roundForComparison(threshold);
    if (rounded === limit) return inclusive;
    return worse === "higher" ? rounded > limit : rounded < limit;
  };
  if (reached(riskAt)) return "risk";
  return reached(watchAt) ? "watch" : "pass";
}

function check(
  id: HealthCheckId,
  status: HealthStatus,
  value: number | null,
  month: number | null,
): HealthCheck {
  const { watchAt, riskAt } = thresholds[id];
  return { id, status, value, watchAt, riskAt, month };
}

function graded(
  id: HealthCheckId,
  value: number,
  month: number | null = null,
): HealthCheck {
  return check(id, grade(id, value), value, month);
}

/** The check has nothing to measure: a zero denominator, or an input that
 *  switches the subject off. */
function notApplicable(id: HealthCheckId): HealthCheck {
  return check(id, "na", null, null);
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function insiderShare(model: Model): HealthCheck {
  let insiders = 0;
  let all = 0;
  for (const row of model.allocations) {
    all += row.share;
    if (insiderCategories.some((category) => category === row.category)) {
      insiders += row.share;
    }
  }
  if (!(all > 0)) return notApplicable("insider_share");
  return graded("insider_share", insiders / all);
}

function lowFloat(kpis: Kpis): HealthCheck {
  if (!(kpis.initialFdvUsd > 0)) return notApplicable("low_float");
  return graded("low_float", kpis.marketCapToFdv);
}

function unlockShock(core: CoreResult, kpis: Kpis): HealthCheck {
  // The ratio needs a month that follows a non-empty float. With none, there
  // is no ratio; with some but no unlock, the shock is a plain zero.
  const circulating = core.series.circulating;
  const measurable = circulating.slice(0, -1).some((tokens) => tokens > 0);
  if (!measurable) return notApplicable("unlock_shock");
  return graded(
    "unlock_shock",
    kpis.largestUnlock.shareOfCirculating,
    kpis.largestUnlock.month,
  );
}

/** Worst 12-month growth of total supply. Vesting is not inflation, so this
 *  reads total supply, which only emissions and burns move. */
function netInflation(core: CoreResult): HealthCheck {
  const supply = core.series.totalSupply;
  let worst: number | null = null;
  let worstMonth: number | null = null;
  for (let month = 12; month < supply.length; month++) {
    const yearBefore = supply[month - 12];
    if (!(yearBefore > 0)) continue;
    const growth = supply[month] / yearBefore - 1;
    if (worst === null || growth > worst) {
      worst = growth;
      worstMonth = month;
    }
  }
  if (worst === null) return notApplicable("net_inflation");
  return graded("net_inflation", worst, worstMonth);
}

function runway(model: Model, kpis: Kpis): HealthCheck {
  if (!(model.treasury.monthlyCostUsd > 0)) return notApplicable("runway");
  const { exhaustedMonth } = kpis.runway;
  if (exhaustedMonth === null) return check("runway", "pass", null, null);
  return graded("runway", exhaustedMonth, exhaustedMonth);
}

function treasuryTokenDependence(core: CoreResult, kpis: Kpis): HealthCheck {
  if (!(sum(core.series.treasuryCostUsd) > 0)) {
    return notApplicable("treasury_token_dependence");
  }
  return graded("treasury_token_dependence", kpis.treasurySaleShareOfCosts);
}

/** Share of the last year's sell pressure met by demand the token's use
 *  creates: revenue routed to burns, and users building working balances. */
function structuralDemand(core: CoreResult): HealthCheck {
  const { burnUsd, workingBalanceBuyUsd, sellPressureUsd } = core.series;
  const sellPressure = sumTrailingYear(sellPressureUsd);
  if (!(sellPressure > 0)) return notApplicable("structural_demand");
  const structural =
    sumTrailingYear(burnUsd) + sumTrailingYear(workingBalanceBuyUsd);
  return graded("structural_demand", structural / sellPressure);
}

/** Months in which a guard held the run inside the model's valid range. A
 *  month that tripped two guards counts once. */
function modelRange(core: CoreResult): HealthCheck {
  const { priceClampMonths, minDepthMonths, burnClampMonths } = core.flags;
  const flagged = new Set([
    ...priceClampMonths,
    ...minDepthMonths,
    ...burnClampMonths,
  ]);
  const first = flagged.size > 0 ? Math.min(...flagged) : null;
  return graded("model_range", flagged.size, first);
}

type DeterministicCheckId = Exclude<
  HealthCheckId,
  "treasury_exhaustion_probability"
>;

function isDeterministic(id: HealthCheckId): id is DeterministicCheckId {
  return id !== "treasury_exhaustion_probability";
}

/**
 * The eight checks that one deterministic run can answer, in the order of
 * `healthCheckIds`. The ninth needs a Monte Carlo result and comes from
 * monteCarloHealthCheck.
 *
 * These are heuristics with stated thresholds, not verdicts: each check
 * carries its value and both thresholds so the page can show how the status
 * was reached.
 */
export function computeHealthChecks(
  model: Model,
  core: CoreResult,
  kpis: Kpis,
): HealthCheck[] {
  const checks: Record<DeterministicCheckId, HealthCheck> = {
    insider_share: insiderShare(model),
    low_float: lowFloat(kpis),
    unlock_shock: unlockShock(core, kpis),
    net_inflation: netInflation(core),
    runway: runway(model, kpis),
    treasury_token_dependence: treasuryTokenDependence(core, kpis),
    structural_demand: structuralDemand(core),
    model_range: modelRange(core),
  };
  return healthCheckIds.filter(isDeterministic).map((id) => checks[id]);
}

/** Share of Monte Carlo runs in which the treasury ran out. Not applicable
 *  until at least one run has finished. */
export function monteCarloHealthCheck(result: MonteCarloResult): HealthCheck {
  const id = "treasury_exhaustion_probability";
  if (!(result.runs > 0)) return notApplicable(id);
  return graded(id, result.probTreasuryExhausted);
}
