"use client";

import { useId } from "react";
import { kpiIds, type KpiId, type SimulatorUi } from "@/simulator/content";
import { ENGINE } from "@/simulator/engine/constants";
import {
  EMPTY,
  formatMultiple,
  formatNumber,
  formatPercent,
  formatPrice,
  formatUsd,
  orEmpty,
  type FormatLocale,
} from "@/simulator/engine/format";
import type { Model, SimulationResult } from "@/simulator/engine/types";
import { figureClass, panelTitleClass } from "../classes";
import { Help } from "../fields/help";
import { useResults, type MonteCarloState } from "../store";

interface Tile {
  figure: string;
  /** The figure is a number, not a state such as "No costs entered" or the
   *  empty mark. Only a number is set against the baseline. */
  numeric: boolean;
  /** The line under the figure. */
  sub?: string;
}

/** The tiles one run can fill. The eighth needs the Monte Carlo job. */
type RunKpiId = Exclude<KpiId, "belowLaunch">;

/** A tile for a value that may be missing or not finite. */
function numberTile(
  value: number | null | undefined,
  format: (value: number) => string,
  sub?: string,
): Tile {
  if (value == null || !Number.isFinite(value)) {
    return { figure: EMPTY, numeric: false };
  }
  return { figure: format(value), numeric: true, sub };
}

/**
 * The tiles read from one run. The baseline goes through the same function,
 * so its figures are worded and rounded exactly like the current ones.
 */
export function runTiles(
  model: Model,
  result: SimulationResult,
  ui: SimulatorUi,
  locale: FormatLocale,
): Record<RunKpiId, Tile> {
  const { kpis, series } = result;
  const copy = ui.results.kpis;
  const usd = (value: number) => formatUsd(value, locale);
  const percent = (value: number) => formatPercent(value, locale);
  const multiple = (value: number) => formatMultiple(value, locale);

  const lastPrice = series.priceUsd.at(-1);
  const { largestUnlock, monthsTo50Unlocked, monthsTo90Unlocked } = kpis;
  const { staticMonths, exhaustedMonth } = kpis.runway;

  return {
    initialMarketCap: numberTile(
      kpis.initialMarketCapUsd,
      usd,
      copy.fdv(orEmpty(kpis.initialFdvUsd, usd)),
    ),
    initialFloat: numberTile(
      kpis.initialCirculatingShare,
      percent,
      copy.marketCapToFdv(orEmpty(kpis.marketCapToFdv, percent)),
    ),
    priceAtHorizon: numberTile(
      lastPrice,
      (value) => formatPrice(value, locale),
      copy.timesLaunch(
        orEmpty(
          lastPrice === undefined
            ? null
            : lastPrice / model.token.tgePriceUsd,
          multiple,
        ),
      ),
    ),
    largestUnlock:
      largestUnlock.month === null
        ? { figure: EMPTY, numeric: false, sub: copy.noUnlocks }
        : numberTile(
            largestUnlock.shareOfCirculating,
            percent,
            copy.atMonth(largestUnlock.month),
          ),
    inflationYear1: numberTile(kpis.inflationYear1, percent),
    halfUnlocked:
      monthsTo50Unlocked === null
        ? {
            figure: EMPTY,
            numeric: false,
            sub: copy.notWithin(ENGINE.SCHEDULE_SEARCH_MONTHS),
          }
        : {
            figure:
              monthsTo50Unlocked === 0
                ? copy.atLaunch
                : ui.months(monthsTo50Unlocked),
            numeric: monthsTo50Unlocked !== 0,
            sub:
              monthsTo90Unlocked === null
                ? undefined
                : copy.ninetyAfter(monthsTo90Unlocked),
          },
    runway:
      staticMonths === null
        ? { figure: copy.noCost, numeric: false }
        : {
            figure:
              exhaustedMonth === null
                ? copy.runwayBeyond
                : ui.results.month(exhaustedMonth),
            numeric: exhaustedMonth !== null,
            sub: copy.runwayStatic(formatNumber(staticMonths, locale, 1)),
          },
  };
}

/** The Monte Carlo tile, which waits for the first batch of runs. */
function belowLaunchTile(
  monteCarlo: MonteCarloState,
  ui: SimulatorUi,
  locale: FormatLocale,
): Tile {
  const probability = monteCarlo.result?.probPriceBelowTge.m12 ?? null;
  if (probability === null) {
    return { figure: ui.results.kpis.waiting, numeric: false };
  }
  return {
    figure: formatPercent(probability, locale),
    numeric: true,
    sub: ui.results.kpis.atMonth12,
  };
}

/**
 * The headline figures of the run, as a description list: each cell is a
 * term, its figure and up to two lines under it.
 *
 * In the results column a cell is often no wider than ten characters of the
 * figure, so every line may break inside a word before it would push the
 * cell wider than its grid track.
 */
export function KpiTiles() {
  const { locale, ui, model, result, baseline, monteCarlo } = useResults();
  const titleId = useId();
  const copy = ui.results.kpis;

  const tiles: Record<KpiId, Tile> = {
    ...runTiles(model, result, ui, locale),
    belowLaunch: belowLaunchTile(monteCarlo, ui, locale),
  };
  const baselineTiles = baseline
    ? runTiles(baseline.model, baseline.result, ui, locale)
    : null;

  return (
    <section aria-labelledby={titleId} className="@container min-w-0">
      <h3 id={titleId} className={panelTitleClass}>
        {copy.title}
      </h3>
      {/* One panel ruled into cells. Each cell draws its right and bottom
          rule and reaches one pixel past its track, so the rules of the last
          column and the last row fall outside the panel and are cut off. */}
      <dl className="card mt-4 grid grid-cols-2 overflow-hidden @2xl:grid-cols-4">
        {kpiIds.map((id) => {
          const { label, help } = copy[id];
          const tile = tiles[id];
          // No Monte Carlo job runs for the baseline, so that tile has
          // nothing to compare against.
          const baselineFigure =
            id === "belowLaunch" || !tile.numeric
              ? undefined
              : baselineTiles?.[id].figure;

          return (
            <div
              key={id}
              className="-mr-px -mb-px row-span-4 grid min-w-0 grid-rows-subgrid border-r border-b border-line p-4 sm:p-5"
            >
              {/* Room for two lines of label, so that the figures of a row
                  line up when one label wraps and its neighbour does not. */}
              <dt className="flex min-h-10 items-start justify-between gap-2 text-sm text-muted">
                <span className="min-w-0 wrap-anywhere hyphens-auto">
                  {label}
                </span>
                <Help label={ui.inputs.helpAbout(label)}>{help}</Help>
              </dt>
              {/* A number is the largest thing in its cell. A state in words,
                  such as "Beyond the horizon", is set smaller, so that it
                  takes two lines at most. */}
              <dd
                className={`${figureClass} row-start-2 mt-2 leading-tight font-semibold tracking-tight wrap-anywhere text-fg ${
                  tile.numeric ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
                }`}
              >
                {tile.figure}
              </dd>
              {tile.sub ? (
                <dd className="row-start-3 mt-1.5 text-sm leading-snug wrap-anywhere text-muted">
                  {tile.sub}
                </dd>
              ) : null}
              {baselineFigure ? (
                <dd className="row-start-4 mt-1.5 text-xs leading-snug wrap-anywhere text-faint">
                  {ui.results.baselineValue(baselineFigure)}
                </dd>
              ) : null}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
