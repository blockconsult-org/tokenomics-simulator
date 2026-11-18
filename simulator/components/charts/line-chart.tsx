"use client";

import { memo, useCallback, useMemo } from "react";
import {
  ChartFrame,
  SeriesFills,
  SeriesLines,
  legendItems,
  linePoints,
  lineRows,
  lineShapes,
  pixelValues,
  seriesValues,
  type Readout,
} from "./chart-frame";
import type { LegendItem } from "./legend";
import {
  areaPath,
  emptyAxis,
  extent,
  isNumber,
  linearAxis,
  logAxis,
} from "./scales";
import type {
  ChartBand,
  ChartReferenceLine,
  LineChartProps,
} from "./types";
import { useHiddenSeries } from "./use-hidden-series";
import { tickBudget, usePlot } from "./use-plot";

const DEFAULT_HEIGHT = 320;
/** Low enough that a narrow band inside a wide one of the same colour
 *  still reads as the darker of the two. */
const BAND_OPACITY = 0.16;
const NO_BANDS: ChartBand[] = [];
const NO_REFERENCES: ChartReferenceLine[] = [];

interface PlacedReference {
  y: number;
  label: string;
  labelY: number;
}

interface ReferencesProps {
  items: readonly PlacedReference[];
  left: number;
  right: number;
}

/** Drawn over the lines. The label has a halo in the surface colour, so a
 *  line that runs behind it does not cut through the letters. */
const References = memo(function References({
  items,
  left,
  right,
}: ReferencesProps) {
  return (
    <g>
      {items.map((item, n) => (
        <line
          key={n}
          className="sim-chart-reference"
          x1={left}
          x2={right}
          y1={item.y}
          y2={item.y}
        />
      ))}
      {items.map((item, n) =>
        item.label === "" ? null : (
          <text
            key={n}
            className="sim-chart-label sim-chart-halo"
            x={right - 4}
            y={item.labelY}
            textAnchor="end"
          >
            {item.label}
          </text>
        ),
      )}
    </g>
  );
});

/**
 * Lines over a month axis, with optional shaded ranges behind them and
 * dashed reference values across them. On a log axis a value of zero or
 * below has no position and leaves a gap in its line.
 */
export function LineChart({
  title,
  description,
  x,
  formatValue,
  formatAxis,
  text,
  height = DEFAULT_HEIGHT,
  markers,
  className,
  series,
  bands = NO_BANDS,
  referenceLines = NO_REFERENCES,
  scale = "linear",
  includeZero = false,
}: LineChartProps) {
  const { hidden, toggle } = useHiddenSeries();
  const count = x.length;
  const log = scale === "log";

  const shown = useMemo(
    () => series.filter((item) => !hidden.has(item.id)),
    [series, hidden],
  );
  const shownBands = useMemo(
    () => bands.filter((item) => !hidden.has(item.id)),
    [bands, hidden],
  );

  const axis = useMemo(() => {
    if (count === 0) return emptyAxis();
    const usable = (value: number | null | undefined): value is number =>
      isNumber(value) && (!log || value > 0);
    const values = seriesValues(shown, count);
    for (const band of shownBands) {
      values.push(...band.lower.slice(0, count), ...band.upper.slice(0, count));
    }
    const range = extent(values.filter(usable));
    if (!range) return emptyAxis();
    let [min, max] = range;
    // A reference value is only worth showing if it is on the axis.
    for (const line of referenceLines) {
      if (!usable(line.value)) continue;
      min = Math.min(min, line.value);
      max = Math.max(max, line.value);
    }
    if (log) return logAxis(min, max, tickBudget(height) + 1);
    return includeZero
      ? linearAxis(Math.min(min, 0), Math.max(max, 0), tickBudget(height))
      : linearAxis(min, max, tickBudget(height));
  }, [count, shown, shownBands, referenceLines, log, includeZero, height]);

  const { frameRef, plot } = usePlot({
    x,
    axis,
    log,
    height,
    formatAxis: formatAxis ?? formatValue,
    markerLabels: Boolean(markers?.length),
    caption: text.xAxisLabel !== "",
  });

  const fills = useMemo(
    () =>
      shownBands.map((band) => ({
        id: band.id,
        d: areaPath(
          plot.xs,
          pixelValues(band.lower, plot, log),
          pixelValues(band.upper, plot, log),
        ),
        color: band.color,
      })),
    [shownBands, plot, log],
  );
  const lines = useMemo(
    () => lineShapes(shown, plot, log),
    [shown, plot, log],
  );
  const references = useMemo(() => {
    if (plot.empty) return [];
    const placed: PlacedReference[] = [];
    for (const line of referenceLines) {
      if (!isNumber(line.value) || (log && line.value <= 0)) continue;
      const y = Math.round(plot.y(line.value)) + 0.5;
      // The label sits on the line, and under it where the line is too
      // close to the top of the plot for the letters to fit above.
      const above = y - plot.top >= plot.fontSize + 8;
      placed.push({
        y,
        label: line.label,
        labelY: above ? y - 5 : y + 5 + plot.fontSize * 0.8,
      });
    }
    return placed;
  }, [referenceLines, plot, log]);

  const legend = useMemo<LegendItem[]>(
    () => [
      ...legendItems(series, "line"),
      ...bands.map((band) => ({
        id: band.id,
        label: band.label,
        color: band.color,
        mark: "band" as const,
      })),
    ],
    [series, bands],
  );

  const readout = useCallback(
    (index: number): Readout => {
      const rows = lineRows(shown, index, formatValue);
      for (const band of shownBands) {
        const low = band.lower[index];
        const high = band.upper[index];
        if (!isNumber(low) || !isNumber(high)) continue;
        rows.push({
          id: band.id,
          label: band.label,
          value: `${formatValue(low)} – ${formatValue(high)}`,
          color: band.color,
        });
      }
      return { rows, total: null };
    },
    [shown, shownBands, formatValue],
  );
  const focusPoints = useCallback(
    (index: number) => linePoints(shown, plot, index, log),
    [shown, plot, log],
  );

  return (
    <ChartFrame
      title={title}
      description={description}
      text={text}
      className={className}
      frameRef={frameRef}
      plot={plot}
      x={x}
      markers={markers}
      readout={readout}
      focusPoints={focusPoints}
      legend={legend}
      hidden={hidden}
      onToggle={toggle}
    >
      <SeriesFills shapes={fills} opacity={BAND_OPACITY} />
      <SeriesLines shapes={lines} />
      <References items={references} left={plot.left} right={plot.right} />
    </ChartFrame>
  );
}
