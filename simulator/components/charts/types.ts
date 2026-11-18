/**
 * Props shared by the simulator's charts. The charts are hand-written SVG,
 * themed through CSS variables, and take every visible string from the
 * caller so they stay locale-free.
 */

/** Categorical series colours, defined for both themes in
 *  simulator/styles/charts.css. */
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
] as const;

/**
 * Colour for the n-th series. After the palette runs out it starts again as
 * a tint toward the text colour, so a ninth series is not mistaken for the
 * first. An allocation table holds at most sixteen rows, which two passes
 * cover.
 */
export function chartColor(index: number): string {
  const base = CHART_COLORS[index % CHART_COLORS.length];
  const secondPass = Math.floor(index / CHART_COLORS.length) % 2 === 1;
  return secondPass
    ? `color-mix(in oklab, ${base} 55%, var(--color-fg))`
    : base;
}

export type ValueFormatter = (value: number) => string;

export interface ChartSeries {
  id: string;
  label: string;
  /** One value per x position. Null leaves a gap. */
  values: (number | null)[];
  /** A CSS colour, normally one of CHART_COLORS or a site token. */
  color: string;
  /** Drawn dashed: a pinned baseline or a reference series. */
  dashed?: boolean;
}

/** A shaded range between two series, such as a percentile band. */
export interface ChartBand {
  id: string;
  label: string;
  lower: number[];
  upper: number[];
  color: string;
}

/** A vertical marker at an x position, such as a cliff. */
export interface ChartMarker {
  x: number;
  label: string;
}

/** A horizontal reference line, such as the TGE price. */
export interface ChartReferenceLine {
  value: number;
  label: string;
}

/** Every string a chart renders or announces. */
export interface ChartText {
  /** Heading of the tooltip for one x position: "Month 12". */
  xValue: (x: number) => string;
  /** Caption under the x axis: "Months since TGE". */
  xAxisLabel: string;
  /** Accessible name of a legend toggle: "Show Team". It stays the same in
   *  both states, and the pressed state says whether the series is shown. */
  showSeries: (label: string) => string;
  /** Tooltip row for the sum of a stacked chart. */
  total: string;
  /** Instructions announced to keyboard users on focus. */
  keyboardHint: string;
}

interface CartesianChartProps {
  /** Accessible name of the chart. */
  title: string;
  /** One-sentence summary for assistive technology. */
  description?: string;
  /** X positions, in month numbers. All series share them. */
  x: number[];
  /** Formats values in the tooltip. */
  formatValue: ValueFormatter;
  /** Formats axis ticks; defaults to formatValue. */
  formatAxis?: ValueFormatter;
  text: ChartText;
  /** Height of the drawing in CSS pixels, axes included. The width follows
   *  the container. */
  height?: number;
  markers?: ChartMarker[];
  className?: string;
}

/** Stacked areas, with optional unstacked lines drawn over them. */
export interface AreaChartProps extends CartesianChartProps {
  /** Stacked bottom to top in array order. */
  series: ChartSeries[];
  lines?: ChartSeries[];
}

/** One or more lines, with optional shaded bands behind them. */
export interface LineChartProps extends CartesianChartProps {
  series: ChartSeries[];
  bands?: ChartBand[];
  referenceLines?: ChartReferenceLine[];
  /** A log axis suits prices that move across orders of magnitude. */
  scale?: "linear" | "log";
  /** Force the y axis to start at zero. Ignored on a log scale. */
  includeZero?: boolean;
}

/** Stacked bars. Negative values stack below the zero line, so a chart of
 *  buys (positive) and sells (negative) diverges around it. */
export interface BarChartProps extends CartesianChartProps {
  series: ChartSeries[];
  lines?: ChartSeries[];
}

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  title: string;
  description?: string;
  slices: DonutSlice[];
  formatValue: ValueFormatter;
  /** Two short lines of text in the hole. */
  centerLabel?: string;
  centerValue?: string;
  /** Diameter in CSS pixels. */
  size?: number;
  className?: string;
}
