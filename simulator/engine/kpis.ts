import { ENGINE } from "./constants";
import type { CoreResult, Kpis, Model, MonthlySeries } from "./types";
import { vestedFraction } from "./vesting";

/** Months in the trailing window used by "last 12 months" metrics. */
const TRAILING_MONTHS = 12;

/**
 * Slack on the 50% and 90% unlock thresholds. The unlocked share is a sum of
 * products, so a schedule that reaches a threshold exactly can land a few
 * ulps below it.
 */
const UNLOCK_SHARE_TOLERANCE = 1e-9;

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** A ratio that reads as 0 when there is nothing to divide by. */
function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Sum of a flow series over the last 12 months of the run. Flow series are 0
 * at month 0, so a run shorter than the window simply sums every month.
 */
export function sumTrailingYear(values: number[]): number {
  return sum(values.slice(-TRAILING_MONTHS));
}

/**
 * What the rows with a purchase price paid in total: tokens × price, summed.
 * A row's tokens are its share of genesis supply after dividing by the sum
 * of shares, the same split the monthly loop uses.
 */
export function impliedRaiseUsd(model: Model): number {
  const shareSum = sum(model.allocations.map((row) => row.share));
  let raise = 0;
  for (const row of model.allocations) {
    if (row.purchasePriceUsd === null) continue;
    raise +=
      ratio(model.token.genesisSupply * row.share, shareSum) *
      row.purchasePriceUsd;
  }
  return raise;
}

/**
 * First month by which `threshold` of genesis supply has unlocked, across
 * every row including the treasury's. This reads the vesting schedule only,
 * so it can look past the horizon and does not depend on the run.
 */
function monthsToUnlocked(model: Model, threshold: number): number | null {
  const shareSum = sum(model.allocations.map((row) => row.share));
  if (!(shareSum > 0)) return null;
  for (let month = 0; month <= ENGINE.SCHEDULE_SEARCH_MONTHS; month++) {
    let unlocked = 0;
    for (const row of model.allocations) {
      unlocked += row.share * vestedFraction(row, month);
    }
    if (unlocked / shareSum >= threshold - UNLOCK_SHARE_TOLERANCE) return month;
  }
  return null;
}

/**
 * The month whose vesting into circulation is largest relative to the supply
 * already circulating. A month that follows an empty float has no meaningful
 * ratio and is skipped.
 */
function largestUnlock(series: MonthlySeries): Kpis["largestUnlock"] {
  let largest: Kpis["largestUnlock"] = {
    month: null,
    tokens: 0,
    shareOfCirculating: 0,
  };
  for (let month = 1; month < series.unlockTokens.length; month++) {
    const circulatingBefore = series.circulating[month - 1];
    if (!(circulatingBefore > 0)) continue;
    const share = series.unlockTokens[month] / circulatingBefore;
    if (share > largest.shareOfCirculating) {
      largest = {
        month,
        tokens: series.unlockTokens[month],
        shareOfCirculating: share,
      };
    }
  }
  return largest;
}

/** Headline metrics of one finished run. */
export function computeKpis(model: Model, core: CoreResult): Kpis {
  const { series } = core;
  const { genesisSupply, tgePriceUsd } = model.token;
  const horizon = core.months.length - 1;
  // Every valid model runs for at least 12 months. The clamp only keeps the
  // month-12 metrics defined on a shorter run.
  const month12 = Math.min(12, horizon);

  const initialMarketCapUsd = series.marketCapUsd[0];
  const initialFdvUsd =
    tgePriceUsd * (model.emissions.maxSupply ?? genesisSupply);
  const emittedTrailingYear = sumTrailingYear(series.emissionTokens);

  return {
    initialCirculatingShare: ratio(series.circulating[0], genesisSupply),
    initialMarketCapUsd,
    initialFdvUsd,
    marketCapToFdv: ratio(initialMarketCapUsd, initialFdvUsd),
    circulatingShareMonth12: ratio(
      series.circulating[month12],
      series.totalSupply[month12],
    ),
    largestUnlock: largestUnlock(series),
    inflationYear1:
      genesisSupply > 0 ? series.totalSupply[month12] / genesisSupply - 1 : 0,
    monthsTo50Unlocked: monthsToUnlocked(model, 0.5),
    monthsTo90Unlocked: monthsToUnlocked(model, 0.9),
    lockedAtHorizonShare: ratio(series.locked[horizon], genesisSupply),
    impliedRaiseUsd: impliedRaiseUsd(model),
    runway: {
      staticMonths:
        model.treasury.monthlyCostUsd > 0
          ? model.treasury.startingUsd / model.treasury.monthlyCostUsd
          : null,
      exhaustedMonth: core.exhaustedMonth,
    },
    treasurySaleShareOfCosts: ratio(
      sum(series.treasurySaleUsd),
      sum(series.treasuryCostUsd),
    ),
    burnToEmissionLast12:
      emittedTrailingYear > 0
        ? sumTrailingYear(series.burnTokens) / emittedTrailingYear
        : null,
  };
}
