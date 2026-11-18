"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatPrice,
  formatUsd,
} from "@/simulator/engine/format";
import { rowLabel, type SimulatorUi } from "@/simulator/content";
import type {
  Bands,
  Model,
  SimulationResult,
} from "@/simulator/engine/types";
import { AreaChart } from "../charts/area-chart";
import { BarChart } from "../charts/bar-chart";
import { DonutChart } from "../charts/donut-chart";
import { LineChart } from "../charts/line-chart";
import {
  chartColor,
  type ChartBand,
  type ChartSeries,
  type ChartText,
} from "../charts/types";
import { Segmented } from "../fields/segmented";
import { useResults } from "../store";

/**
 * The eight chart views. Each one turns the result in context into series
 * for a chart of the kit; none of them computes anything the engine has not
 * already computed, apart from splitting a total into its parts.
 */

const CHART_HEIGHT = 340;
const SMALL_CHART_HEIGHT = 240;
/** A pinned baseline is drawn in the text colour, dashed, so it reads as a
 *  reference whatever the colour of the series it shadows. */
const BASELINE_COLOR = "var(--color-muted)";

function useChartText(): ChartText {
  const { ui } = useResults();
  return useMemo(() => {
    const c = ui.results.charts;
    return {
      xValue: (x) => ui.results.month(x),
      xAxisLabel: c.xAxis,
      showSeries: c.showSeries,
      total: c.total,
      keyboardHint: c.keyboardHint,
    };
  }, [ui]);
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
      {children}
    </p>
  );
}

/** Tokens with the model's symbol: "1.2M ABC". */
function useTokenFormat() {
  const { locale, model } = useResults();
  const symbol = model.token.symbol;
  return useMemo(
    () => (value: number) =>
      symbol
        ? `${formatCompact(value, locale)} ${symbol}`
        : formatCompact(value, locale),
    [locale, symbol],
  );
}

/** USD with its sign. The function keeps its identity between renders, so a
 *  chart does not redo its axis for a new function that formats the same. */
function useUsd() {
  const { locale } = useResults();
  return useCallback((value: number) => formatUsd(value, locale), [locale]);
}

/** Month-on-month change of a cumulative series, with nothing at launch. */
function monthly(cumulative: number[]): number[] {
  return cumulative.map((value, t) => (t === 0 ? 0 : value - cumulative[t - 1]));
}

function hasAny(values: (number | null)[]): boolean {
  return values.some((value) => value != null && Math.abs(value) > 1e-9);
}

/**
 * One series per allocation row, in the order and the colours of the inputs.
 * The ids carry a prefix, so a row that happens to have the id of another
 * series of the chart ("emissions") stays a series of its own.
 */
function rowSeries(
  result: SimulationResult,
  model: Model,
  ui: SimulatorUi,
  values: (unlockedCum: number[]) => number[],
): ChartSeries[] {
  const rows = new Map(model.allocations.map((row) => [row.id, row]));
  return result.allocations.map((allocation, index) => {
    const row = rows.get(allocation.id);
    return {
      id: `row:${allocation.id}`,
      label: row ? rowLabel(ui, row) : allocation.id,
      values: values(allocation.unlockedCum),
      color: chartColor(index),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Supply                                                                     */
/* -------------------------------------------------------------------------- */

type SupplyView = "state" | "holder";

export function SupplyChart() {
  const { ui, locale, model, result, baseline } = useResults();
  const text = useChartText();
  const tokens = useTokenFormat();
  const [view, setView] = useState<SupplyView>("state");
  const c = ui.results.charts;

  const series = useMemo<ChartSeries[]>(() => {
    const s = result.series;
    if (view === "state") {
      return [
        { id: "liquid", label: c.series.liquid, values: s.liquid, color: chartColor(0) },
        { id: "staked", label: c.series.staked, values: s.staked, color: chartColor(1) },
        { id: "treasury", label: c.series.treasuryTokens, values: s.treasuryTokens, color: chartColor(2) },
        { id: "locked", label: c.series.locked, values: s.locked, color: chartColor(3) },
      ];
    }
    const rows = rowSeries(result, model, ui, (unlockedCum) => unlockedCum);
    return hasAny(s.emittedCum)
      ? [
          ...rows,
          {
            id: "emissions",
            label: c.series.emissions,
            values: s.emittedCum,
            color: chartColor(rows.length),
          },
        ]
      : rows;
  }, [view, result, model, ui, c]);

  const lines = useMemo<ChartSeries[]>(
    () =>
      baseline && view === "state"
        ? [
            {
              id: "baseline-circulating",
              label: c.baseline(c.series.circulating),
              values: baseline.result.series.circulating,
              color: BASELINE_COLOR,
              dashed: true,
            },
          ]
        : [],
    [baseline, view, c],
  );

  return (
    <>
      <Segmented<SupplyView>
        id="sim-supply-view"
        label={c.supply.view}
        value={view}
        options={[
          { value: "state", label: c.supply.viewState },
          { value: "holder", label: c.supply.viewHolder },
        ]}
        onChange={setView}
        className="mb-5 max-w-xs print:hidden"
      />
      <AreaChart
        title={view === "state" ? c.supply.byState : c.supply.byHolder}
        x={result.months}
        series={series}
        lines={lines}
        formatValue={tokens}
        formatAxis={(value) => formatCompact(value, locale)}
        text={text}
        height={CHART_HEIGHT}
      />
      <Note>{view === "state" ? c.supply.note : c.supply.holderNote}</Note>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Unlocks                                                                    */
/* -------------------------------------------------------------------------- */

export function UnlocksChart() {
  const { ui, locale, model, result } = useResults();
  const text = useChartText();
  const tokens = useTokenFormat();
  const c = ui.results.charts;

  const series = useMemo<ChartSeries[]>(() => {
    const rows = rowSeries(result, model, ui, monthly);
    const emissions = result.series.emissionTokens;
    return hasAny(emissions)
      ? [
          ...rows,
          {
            id: "emissions",
            label: c.series.emissions,
            values: emissions,
            color: chartColor(rows.length),
          },
        ]
      : rows;
  }, [result, model, ui, c]);

  return (
    <>
      <BarChart
        title={c.unlocks.title}
        x={result.months}
        series={series}
        formatValue={tokens}
        formatAxis={(value) => formatCompact(value, locale)}
        text={text}
        height={CHART_HEIGHT}
      />
      <Note>{c.unlocks.note}</Note>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Allocation                                                                 */
/* -------------------------------------------------------------------------- */

export function AllocationChart() {
  const { ui, locale, model } = useResults();
  const c = ui.results.charts;
  const slices = useMemo(
    () =>
      model.allocations.map((row, index) => ({
        id: row.id,
        label: rowLabel(ui, row),
        value: row.share,
        color: chartColor(index),
      })),
    [model, ui],
  );

  return (
    <DonutChart
      title={c.allocation.title}
      slices={slices}
      formatValue={(value) => formatPercent(value, locale, 2)}
      centerLabel={c.allocation.center}
      centerValue={formatCompact(model.token.genesisSupply, locale)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Price and valuation                                                        */
/* -------------------------------------------------------------------------- */

/** The two shaded ranges of the random runs, when they fit the chart's x. */
function useBands(bands: Bands | undefined, length: number): ChartBand[] {
  const { ui } = useResults();
  const labels = ui.results.charts.series;
  return useMemo(() => {
    // Bands for earlier inputs can outlive a change of horizon by a moment.
    if (!bands || bands.p50.length !== length) return [];
    return [
      { id: "band90", label: labels.band90, lower: bands.p5, upper: bands.p95, color: chartColor(0) },
      { id: "band50", label: labels.band50, lower: bands.p25, upper: bands.p75, color: chartColor(0) },
    ];
  }, [bands, length, labels]);
}

/** One line under the chart on how far the random runs have got. */
function MonteCarloStatus() {
  const { ui, locale, monteCarlo } = useResults();
  const c = ui.results.charts;
  const n = (value: number) => formatNumber(value, locale, 0);
  return (
    <p className="mt-3 font-mono text-micro uppercase tracking-wider text-faint" aria-live="off">
      {monteCarlo.running
        ? c.monteCarloProgress(n(monteCarlo.done), n(monteCarlo.total))
        : c.monteCarloDone(n(monteCarlo.total))}
    </p>
  );
}

type PriceScale = "linear" | "log";

export function PriceChart() {
  const { ui, locale, model, result, baseline, monteCarlo } = useResults();
  const text = useChartText();
  const c = ui.results.charts;
  const [scale, setScale] = useState<PriceScale>("linear");
  const length = result.months.length;
  const bands = useBands(monteCarlo.result?.priceUsd, length);
  const median = monteCarlo.result?.priceUsd.p50;

  const series = useMemo<ChartSeries[]>(() => {
    const lines: ChartSeries[] = [
      { id: "price", label: c.series.price, values: result.series.priceUsd, color: chartColor(0) },
    ];
    if (median && median.length === length) {
      lines.push({ id: "median", label: c.series.median, values: median, color: chartColor(4), dashed: true });
    }
    if (baseline) {
      lines.push({
        id: "baseline-price",
        label: c.baseline(c.series.price),
        values: baseline.result.series.priceUsd,
        color: BASELINE_COLOR,
        dashed: true,
      });
    }
    return lines;
  }, [result, median, length, baseline, c]);

  return (
    <>
      <Segmented<PriceScale>
        id="sim-price-scale"
        label={c.price.scale}
        value={scale}
        options={[
          { value: "linear", label: c.price.linear },
          { value: "log", label: c.price.log },
        ]}
        onChange={setScale}
        className="mb-5 max-w-56 print:hidden"
      />
      <LineChart
        title={c.price.title}
        x={result.months}
        series={series}
        bands={bands}
        referenceLines={[
          { value: model.token.tgePriceUsd, label: c.series.launchPrice },
        ]}
        scale={scale}
        includeZero
        formatValue={(value) => formatPrice(value, locale)}
        text={text}
        height={CHART_HEIGHT}
      />
      <MonteCarloStatus />
      <Note>{c.price.note}</Note>
    </>
  );
}

export function ValuationChart() {
  const { ui, locale, result, baseline, monteCarlo } = useResults();
  const text = useChartText();
  const c = ui.results.charts;
  const bands = useBands(monteCarlo.result?.marketCapUsd, result.months.length);

  const series = useMemo<ChartSeries[]>(() => {
    const lines: ChartSeries[] = [
      { id: "marketCap", label: c.series.marketCap, values: result.series.marketCapUsd, color: chartColor(0) },
      { id: "fdv", label: c.series.fdv, values: result.series.fdvUsd, color: chartColor(1) },
    ];
    if (baseline) {
      lines.push({
        id: "baseline-marketCap",
        label: c.baseline(c.series.marketCap),
        values: baseline.result.series.marketCapUsd,
        color: BASELINE_COLOR,
        dashed: true,
      });
    }
    return lines;
  }, [result, baseline, c]);

  return (
    <>
      <LineChart
        title={c.valuation.title}
        x={result.months}
        series={series}
        bands={bands}
        includeZero
        formatValue={(value) => formatUsd(value, locale)}
        text={text}
        height={CHART_HEIGHT}
      />
      <MonteCarloStatus />
      <Note>{c.valuation.note}</Note>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Flows                                                                      */
/* -------------------------------------------------------------------------- */

export function FlowsChart() {
  const { ui, result } = useResults();
  const text = useChartText();
  const usd = useUsd();
  const c = ui.results.charts;
  // The bars point both ways, so their sum is a net figure and is named so.
  const flowText = useMemo(() => ({ ...text, total: c.flows.net }), [text, c]);

  const series = useMemo<ChartSeries[]>(() => {
    const s = result.series;
    // Selling is valued the way the engine values sell pressure: at the
    // price of the month before. It is drawn below zero.
    const sold = (tokens: number[]) =>
      tokens.map((amount, t) => (t === 0 ? 0 : -amount * s.priceUsd[t - 1]));
    const unlock = sold(s.sellUnlockTokens);
    const emission = sold(s.sellEmissionTokens);
    const holder = sold(s.sellHolderTokens);
    const treasury = sold(s.treasurySaleTokens);
    // What is left of the month's sell pressure is users running down their
    // balances, which has no series of its own.
    const balance = s.sellPressureUsd.map((total, t) => {
      const rest = total + unlock[t] + emission[t] + holder[t] + treasury[t];
      return rest > total * 1e-9 ? -rest : 0;
    });

    const all: ChartSeries[] = [
      { id: "speculative", label: c.series.speculativeBuying, values: s.speculativeInflowUsd, color: chartColor(0) },
      { id: "burn", label: c.series.burnBuying, values: s.burnUsd, color: chartColor(1) },
      { id: "balance-buy", label: c.series.balanceBuying, values: s.workingBalanceBuyUsd, color: chartColor(2) },
      { id: "unlock", label: c.series.unlockSelling, values: unlock, color: chartColor(3) },
      { id: "emission", label: c.series.emissionSelling, values: emission, color: chartColor(4) },
      { id: "holder", label: c.series.holderSelling, values: holder, color: chartColor(5) },
      { id: "treasury", label: c.series.treasurySelling, values: treasury, color: chartColor(6) },
      { id: "balance-sell", label: c.series.balanceSelling, values: balance, color: chartColor(7) },
    ];
    // A source that never trades would only add an empty legend entry.
    return all.filter((entry) => hasAny(entry.values));
  }, [result, c]);

  return (
    <>
      <BarChart
        title={c.flows.title}
        x={result.months}
        series={series}
        formatValue={usd}
        text={flowText}
        height={CHART_HEIGHT}
      />
      <Note>{c.flows.note}</Note>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Staking                                                                    */
/* -------------------------------------------------------------------------- */

export function StakingChart() {
  const { ui, locale, result } = useResults();
  const text = useChartText();
  const c = ui.results.charts;

  const series = useMemo<ChartSeries[]>(() => {
    const s = result.series;
    const all: ChartSeries[] = [
      { id: "netInflation", label: c.series.netInflation, values: s.netInflationAnnualised, color: chartColor(0) },
      { id: "stakedShare", label: c.series.stakedShare, values: s.stakedRatio, color: chartColor(1) },
      { id: "yieldNominal", label: c.series.yieldNominal, values: s.stakingYieldNominal, color: chartColor(2) },
      { id: "yieldReal", label: c.series.yieldReal, values: s.stakingYieldReal, color: chartColor(3) },
    ];
    return all.filter((entry) => hasAny(entry.values));
  }, [result, c]);

  return (
    <>
      <LineChart
        title={c.staking.title}
        x={result.months}
        series={series}
        includeZero
        formatValue={(value) => formatPercent(value, locale, 2)}
        formatAxis={(value) => formatPercent(value, locale, 0)}
        text={text}
        height={CHART_HEIGHT}
      />
      <Note>{c.staking.note}</Note>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Treasury                                                                   */
/* -------------------------------------------------------------------------- */

export function TreasuryChart() {
  const { ui, result, baseline } = useResults();
  const text = useChartText();
  const usd = useUsd();
  const c = ui.results.charts;
  const flowText = useMemo(
    () => ({ ...text, total: c.treasury.net }),
    [text, c],
  );
  const exhausted = result.kpis.runway.exhaustedMonth;

  const reserves = useMemo<ChartSeries[]>(() => {
    const lines: ChartSeries[] = [
      { id: "reserves", label: c.series.reserves, values: result.series.treasuryUsd, color: chartColor(0) },
    ];
    if (baseline) {
      lines.push({
        id: "baseline-reserves",
        label: c.baseline(c.series.reserves),
        values: baseline.result.series.treasuryUsd,
        color: BASELINE_COLOR,
        dashed: true,
      });
    }
    return lines;
  }, [result, baseline, c]);

  const flows = useMemo(() => {
    const s = result.series;
    const bars: ChartSeries[] = [
      { id: "revenue", label: c.series.treasuryRevenue, values: s.treasuryRevenueUsd, color: chartColor(1) },
      { id: "sales", label: c.series.saleProceeds, values: s.treasurySaleUsd, color: chartColor(2) },
      { id: "costs", label: c.series.costs, values: s.treasuryCostUsd.map((cost) => -cost), color: chartColor(3) },
    ];
    const unpaid: ChartSeries[] = hasAny(s.unpaidCostUsd)
      ? [{ id: "unpaid", label: c.series.unpaidCosts, values: s.unpaidCostUsd, color: chartColor(5), dashed: true }]
      : [];
    return { bars: bars.filter((entry) => hasAny(entry.values)), unpaid };
  }, [result, c]);

  return (
    <>
      <p className="label-mono mb-3" data-chart-caption>
        {c.treasury.title}
      </p>
      <LineChart
        title={c.treasury.title}
        x={result.months}
        series={reserves}
        includeZero
        markers={
          exhausted === null ? [] : [{ x: exhausted, label: c.treasury.exhausted }]
        }
        formatValue={usd}
        text={text}
        height={SMALL_CHART_HEIGHT}
      />
      <p className="label-mono mb-3 mt-8" data-chart-caption>
        {c.treasury.flowsTitle}
      </p>
      <BarChart
        title={c.treasury.flowsTitle}
        x={result.months}
        series={flows.bars}
        lines={flows.unpaid}
        formatValue={usd}
        text={flowText}
        height={SMALL_CHART_HEIGHT}
      />
      <Note>{c.treasury.note}</Note>
    </>
  );
}
