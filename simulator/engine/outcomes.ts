import type {
  AllocationOutcome,
  AllocationSeries,
  CoreResult,
  Model,
} from "./types";

/**
 * What each allocation row holds, and what it is worth, at the months the
 * model asks about.
 *
 * Unlocked tokens are valued at the month's price whether or not the holder
 * has sold any, so "liquid" here means free to sell, not still held. A month
 * past the horizon has no price and is left out. Rows are matched to the
 * run's series by id; a row the run does not know is left out too.
 */
export function computeOutcomes(
  model: Model,
  core: CoreResult,
): AllocationOutcome[] {
  const horizon = core.months.length - 1;
  const months = model.outcomeMonths.filter(
    (month) => Number.isInteger(month) && month >= 0 && month <= horizon,
  );
  const seriesById = new Map<string, AllocationSeries>(
    core.allocations.map((allocation) => [allocation.id, allocation]),
  );

  const outcomes: AllocationOutcome[] = [];
  for (const row of model.allocations) {
    const allocation = seriesById.get(row.id);
    if (!allocation) continue;

    const { tokens } = allocation;
    const purchasePriceUsd = row.purchasePriceUsd;
    const costBasisUsd =
      purchasePriceUsd === null ? null : tokens * purchasePriceUsd;

    outcomes.push({
      id: row.id,
      tokens,
      costBasisUsd,
      atMonths: months.map((month) => {
        const priceUsd = core.series.priceUsd[month];
        const unlockedTokens = allocation.unlockedCum[month];
        const unlockedValueUsd = unlockedTokens * priceUsd;
        return {
          month,
          unlockedTokens,
          unlockedValueUsd,
          lockedValueUsd: (tokens - unlockedTokens) * priceUsd,
          paperMultiple:
            purchasePriceUsd !== null && purchasePriceUsd > 0
              ? priceUsd / purchasePriceUsd
              : null,
          liquidMultiple:
            costBasisUsd !== null && costBasisUsd > 0
              ? unlockedValueUsd / costBasisUsd
              : null,
        };
      }),
    });
  }
  return outcomes;
}
