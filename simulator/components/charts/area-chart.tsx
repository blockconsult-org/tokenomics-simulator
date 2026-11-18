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
  type LineShape,
  type Readout,
} from "./chart-frame";
import {
  areaPath,
  emptyAxis,
  linePath,
  stackSeries,
  type Stack,
} from "./scales";
import type { AreaChartProps, ChartSeries } from "./types";
import { useHiddenSeries } from "./use-hidden-series";
import { tickBudget, usePlot, type Plot } from "./use-plot";

const DEFAULT_HEIGHT = 320;
/** Light enough for the grid to show through twelve layers, with a full
 *  strength edge on each layer to carry its colour. */
const FILL_OPACITY = 0.3;
const EDGE_WIDTH = 1.5;
const NO_LINES: ChartSeries[] = [];

function layerShapes(
  stack: Stack,
  series: readonly ChartSeries[],
  plot: Plot,
): { fills: FillShape[]; edges: LineShape[] } {
  const count = plot.xs.length;
  const fills: FillShape[] = [];
  const edges: LineShape[] = [];
  stack.layers.forEach((layer, n) => {
    const item = series[n];
    if (!item) return;
    const thick = (i: number) =>
      i >= 0 && i < count && layer.defined[i] && layer.upper[i] !== layer.lower[i];
    const lower: (number | null)[] = [];
    const upper: (number | null)[] = [];
    const edge: (number | null)[] = [];
    for (let i = 0; i < count; i += 1) {
      if (!layer.defined[i]) {
        lower.push(null);
        upper.push(null);
        edge.push(null);
        continue;
      }
      const low = plot.y(layer.lower[i]);
      const high = plot.y(layer.upper[i]);
      lower.push(low);
      upper.push(high);
      // A layer that is zero for a stretch, such as an allocation before
      // its cliff, has no edge of its own there. Drawing one would paint
      // its colour over the edge of the layer below. The edge that counts
      // is the one away from zero.
      edge.push(
        thick(i) || thick(i - 1) || thick(i + 1)
          ? layer.lower[i] < 0
            ? low
            : high
          : null,
      );
    }
    fills.push({
      id: item.id,
      d: areaPath(plot.xs, lower, upper),
      color: item.color,
    });
    edges.push({
      id: item.id,
      d: linePath(plot.xs, edge),
      color: item.color,
      dashed: false,
    });
  });
  return { fills, edges };
}

/**
 * Stacked areas over a month axis, with optional lines that are not part of
 * the stack drawn over them. Hiding a series in the legend takes it out of
 * the stack, and the y axis is worked out again for what is left.
 */
export function AreaChart({
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
}: AreaChartProps) {
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
    formatAxis: formatAxis ?? formatValue,
    markerLabels: Boolean(markers?.length),
    caption: text.xAxisLabel !== "",
  });

  const layers = useMemo(
    () => layerShapes(stack, shown, plot),
    [stack, shown, plot],
  );
  const overlays = useMemo(
    () => lineShapes(shownLines, plot),
    [shownLines, plot],
  );
  const legend = useMemo(
    () => [...legendItems(series, "area"), ...legendItems(lines, "line")],
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
      readout={readout}
      focusPoints={focusPoints}
      legend={legend}
      hidden={hidden}
      onToggle={toggle}
    >
      <SeriesFills shapes={layers.fills} opacity={FILL_OPACITY} />
      <SeriesLines shapes={layers.edges} width={EDGE_WIDTH} />
      <SeriesLines shapes={overlays} />
    </ChartFrame>
  );
}
