"use client";

import { useCallback, useMemo } from "react";
import {
  ChartFrame,
  SeriesFills,
  SeriesLines,
  legendItems,
  linePoints,
  lineRows,
  lineShapes,
  stackAxis,
  stackRows,
  type FillShape,
  type Readout,
} from "./chart-frame";
import { barsPath, clamp, emptyAxis, stackSeries, type Stack } from "./scales";
import type { BarChartProps, ChartSeries } from "./types";
import { useHiddenSeries } from "./use-hidden-series";
import { tickBudget, usePlot, type Plot } from "./use-plot";

const DEFAULT_HEIGHT = 320;
/** A few months of data should not turn into slabs. */
const MAX_BAR = 24;
const NO_LINES: ChartSeries[] = [];

/** The bar takes its slot less a gap, and the gap goes first when 120
 *  months have to share a phone screen. */
function barWidth(step: number): number {
  const gap = step >= 8 ? 2 : step >= 4 ? 1 : 0;
  return clamp(Math.floor(step - gap), 1, MAX_BAR);
}

function barShapes(
  stack: Stack,
  series: readonly ChartSeries[],
  plot: Plot,
  width: number,
): FillShape[] {
  const count = plot.xs.length;
  const cut = width >= 6 ? 2 : 1;
  const shapes: FillShape[] = [];
  stack.layers.forEach((layer, n) => {
    const item = series[n];
    if (!item) return;
    const from: (number | null)[] = [];
    const to: (number | null)[] = [];
    for (let i = 0; i < count; i += 1) {
      if (!layer.defined[i]) {
        from.push(null);
        to.push(null);
        continue;
      }
      // Whole pixels, so neighbouring segments meet on the same row.
      let low = Math.round(plot.y(layer.lower[i]));
      let high = Math.round(plot.y(layer.upper[i]));
      const negative = layer.lower[i] < 0;
      const near = negative ? layer.upper[i] : layer.lower[i];
      // Segments of one bar are told apart by a sliver of the surface, not
      // by an outline. Each gives it up at the end nearer zero, and only if
      // enough of the segment is left to see. The segment on the zero line
      // keeps its full height.
      if (near !== 0 && low - high > cut + 1) {
        if (negative) high += cut;
        else low -= cut;
      }
      from.push(low);
      to.push(high);
    }
    shapes.push({
      id: item.id,
      d: barsPath(plot.xs, from, to, width),
      color: item.color,
    });
  });
  return shapes;
}

/**
 * Stacked bars over a month axis, one bar per month. Negative values stack
 * below zero. Optional lines are drawn over the bars and are not part of
 * the stack.
 */
export function BarChart({
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
  lines = NO_LINES,
}: BarChartProps) {
  const { hidden, toggle } = useHiddenSeries();
  const count = x.length;

  const shown = useMemo(
    () => series.filter((item) => !hidden.has(item.id)),
    [series, hidden],
  );
  const shownLines = useMemo(
    () => lines.filter((item) => !hidden.has(item.id)),
    [lines, hidden],
  );
  const stack = useMemo(
    () =>
      stackSeries(
        shown.map((item) => item.values),
        count,
      ),
    [shown, count],
  );
  const axis = useMemo(
    () =>
      count === 0 || shown.length + shownLines.length === 0
        ? emptyAxis()
        : stackAxis(stack, shownLines, count, tickBudget(height)),
    [count, shown, shownLines, stack, height],
  );

  const { frameRef, plot } = usePlot({
    x,
    axis,
    height,
    banded: true,
    formatAxis: formatAxis ?? formatValue,
    markerLabels: Boolean(markers?.length),
    caption: text.xAxisLabel !== "",
  });

  const width = barWidth(plot.step);
  const bars = useMemo(
    () => barShapes(stack, shown, plot, width),
    [stack, shown, plot, width],
  );
  const overlays = useMemo(
    () => lineShapes(shownLines, plot),
    [shownLines, plot],
  );
  const legend = useMemo(
    () => [...legendItems(series, "bar"), ...legendItems(lines, "line")],
    [series, lines],
  );

  const readout = useCallback(
    (index: number): Readout => ({
      rows: [
        ...lineRows(shownLines, index, formatValue),
        ...stackRows(shown, index, formatValue),
      ],
      total: shown.length > 1 ? formatValue(stack.totals[index] ?? 0) : null,
    }),
    [shown, shownLines, stack, formatValue],
  );
  const focusPoints = useCallback(
    (index: number) => linePoints(shownLines, plot, index),
    [shownLines, plot],
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
      column={Math.max(width + 4, Math.round(plot.step))}
      readout={readout}
      focusPoints={focusPoints}
      legend={legend}
      hidden={hidden}
      onToggle={toggle}
    >
      <SeriesFills shapes={bars} />
      <SeriesLines shapes={overlays} />
    </ChartFrame>
  );
}
