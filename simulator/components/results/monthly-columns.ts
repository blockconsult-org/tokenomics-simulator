import type { SimulatorUi } from "@/simulator/content";
import { seriesToCsv } from "@/simulator/engine/csv";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatPrice,
  formatUsd,
  orEmpty,
  type FormatLocale,
} from "@/simulator/engine/format";
import type { MonthlySeries, SimulationResult } from "@/simulator/engine/types";

/**
 * The columns of the monthly data table, shared by the table on the page and
 * the CSV export so the two cannot drift apart.
 */

export type MonthlyColumnKind = "price" | "usd" | "tokens" | "count" | "percent";

type ColumnKey = Exclude<
  keyof SimulatorUi["results"]["table"]["columns"],
  "month"
>;

export interface MonthlyColumn {
  key: ColumnKey;
  label: string;
  kind: MonthlyColumnKind;
  values: (number | null)[];
}

/** Every table column is a series of the result under the same name. */
const kinds = {
  priceUsd: "price",
  marketCapUsd: "usd",
  fdvUsd: "usd",
  totalSupply: "tokens",
  circulating: "tokens",
  liquid: "tokens",
  staked: "tokens",
  locked: "tokens",
  treasuryTokens: "tokens",
  burnedCum: "tokens",
  emittedCum: "tokens",
  unlockTokens: "tokens",
  emissionTokens: "tokens",
  burnTokens: "tokens",
  buyUsd: "usd",
  sellPressureUsd: "usd",
  treasuryUsd: "usd",
  users: "count",
  stakedRatio: "percent",
  netInflationAnnualised: "percent",
  stakingYieldNominal: "percent",
  stakingYieldReal: "percent",
} as const satisfies Record<ColumnKey & keyof MonthlySeries, MonthlyColumnKind>;

export function monthlyColumns(
  result: SimulationResult,
  ui: SimulatorUi,
): MonthlyColumn[] {
  const labels = ui.results.table.columns;
  return (Object.keys(kinds) as ColumnKey[]).map((key) => ({
    key,
    label: labels[key],
    kind: kinds[key],
    values: result.series[key],
  }));
}

/** A cell of the table on the page. */
export function formatMonthlyValue(
  kind: MonthlyColumnKind,
  value: number | null,
  locale: FormatLocale,
): string {
  switch (kind) {
    case "price":
      return orEmpty(value, (v) => formatPrice(v, locale));
    case "usd":
      return orEmpty(value, (v) => formatUsd(v, locale));
    case "tokens":
      return orEmpty(value, (v) => formatCompact(v, locale));
    case "count":
      return orEmpty(value, (v) => formatNumber(v, locale, 0));
    case "percent":
      return orEmpty(value, (v) => formatPercent(v, locale, 2));
  }
}

/** The whole table as CSV, with unrounded values. */
export function monthlyCsv(result: SimulationResult, ui: SimulatorUi): string {
  return seriesToCsv(
    result.months,
    monthlyColumns(result, ui),
    ui.results.table.columns.month,
  );
}
