"use client";

import {
  memo,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChartLegend, type LegendItem, type SeriesMark } from "./legend";
import {
  clamp,
  extent,
  isNumber,
  linearAxis,
  linePath,
  nearestIndex,
  round2,
  type Axis,
  type Stack,
} from "./scales";
import { ChartTooltip, type TooltipRow } from "./tooltip";
import type {
  ChartMarker,
  ChartSeries,
  ChartText,
  ValueFormatter,
} from "./types";
import { GLYPH, TICK_GAP, TICK_LENGTH, type Plot } from "./use-plot";

/** What the tooltip and the live region say about one x position. */
export interface Readout {
  rows: TooltipRow[];
  /** Formatted sum of a stack, or null where a sum would mean nothing. */
  total: string | null;
}

/** A square drawn on a line where the crosshair meets it. */
export interface FocusPoint {
  id: string;
  y: number;
  color: string;
}

interface Cursor {
  index: number;
  /** Only a move made with the keyboard is announced. A pointer user can
   *  see the tooltip, and a screen reader that followed every hover would
   *  never stop talking. */
  keyboard: boolean;
}

/** Extra advance per glyph from the letter-spacing of .sim-chart-label. */
const LABEL_TRACKING = 0.06;
/** Clear space kept between two marker labels. */
const LABEL_GAP = 8;
const POINT = 8;
const NO_NOTES: readonly string[] = [];
const NO_POINTS: readonly FocusPoint[] = [];

/** Centre of the pixel row or column a hairline should fill. */
const crisp = (value: number): number => Math.round(value) + 0.5;

/* -------------------------------------------------------------------------- */
/* Axes, grid and markers                                                     */
/* -------------------------------------------------------------------------- */

interface PlacedMarker {
  x: number;
  /** Null when the label would run into the one before it. The marker is
   *  still drawn, and its label still shows in the tooltip. */
  label: string | null;
  labelX: number;
}

function placeMarkers(
  plot: Plot,
  x: readonly number[],
  markers: readonly ChartMarker[],
): PlacedMarker[] {
  const range = extent(x);
  if (!range || plot.empty) return [];
  const letter = plot.fontSize * (GLYPH + LABEL_TRACKING);
  const inRange = markers
    .filter(
      (marker) =>
        isNumber(marker.x) && marker.x >= range[0] && marker.x <= range[1],
    )
    .sort((a, b) => a.x - b.x);
  const placed: PlacedMarker[] = [];
  let taken = -Infinity;
  for (const marker of inRange) {
    const position = crisp(plot.xAt(marker.x));
    const size = marker.label.length * letter;
    const centre =
      size + 4 >= plot.width
        ? plot.width / 2
        : clamp(position, size / 2 + 2, plot.width - size / 2 - 2);
    const fits = marker.label !== "" && centre - size / 2 >= taken + LABEL_GAP;
    if (fits) taken = centre + size / 2;
    placed.push({
      x: position,
      label: fits ? marker.label : null,
      labelX: round2(centre),
    });
  }
  return placed;
}

interface PlotAxesProps {
  plot: Plot;
  x: readonly number[];
  markers?: readonly ChartMarker[];
  caption: string;
}

/**
 * Everything in the drawing that is not data. It is memoised apart from the
 * crosshair, so moving the crosshair redraws none of it.
 *
 * Grid lines run across only. The line at zero is drawn stronger because the
 * stacks and bars stand on it. An axis that does not reach zero gets a
 * stronger bottom edge to hang the month ticks from.
 */
const PlotAxes = memo(function PlotAxes({
  plot,
  x,
  markers,
  caption,
}: PlotAxesProps) {
  const { left, right, top, bottom, width, fontSize } = plot;
  const placed = placeMarkers(plot, x, markers ?? []);
  const captionSize = caption.length * fontSize * (GLYPH + LABEL_TRACKING);
  const captionX =
    captionSize >= width
      ? width / 2
      : clamp((left + right) / 2, captionSize / 2, width - captionSize / 2);

  return (
    <g>
      {plot.yTicks.map((tick) => (
        <line
          key={tick.value}
          className={
            plot.zero !== null && tick.value === 0
              ? "sim-chart-axis"
              : "sim-chart-grid"
          }
          x1={left}
          x2={right}
          y1={crisp(tick.position)}
          y2={crisp(tick.position)}
        />
      ))}
      {plot.zero === null ? (
        <line
          className="sim-chart-axis"
          x1={left}
          x2={right}
          y1={bottom + 0.5}
          y2={bottom + 0.5}
        />
      ) : null}
      {placed.map((marker, n) => (
        <line
          key={n}
          className="sim-chart-marker"
          x1={marker.x}
          x2={marker.x}
          y1={top}
          y2={bottom}
        />
      ))}
      {plot.yTicks.map((tick) => (
        <text
          key={tick.value}
          className="sim-chart-tick"
          x={left - TICK_GAP}
          y={round2(tick.position + fontSize * 0.34)}
          textAnchor="end"
        >
          {tick.label}
        </text>
      ))}
      {plot.xTicks.map((tick) => (
        <g key={tick.value}>
          <line
            className="sim-chart-axis"
            x1={crisp(tick.position)}
            x2={crisp(tick.position)}
            y1={bottom}
            y2={bottom + TICK_LENGTH}
          />
          <text
            className="sim-chart-tick"
            x={tick.position}
            y={plot.xLabelY}
            textAnchor="middle"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {caption !== "" && plot.captionY !== null ? (
        <text
          className="sim-chart-label"
          x={round2(captionX)}
          y={plot.captionY}
          textAnchor="middle"
        >
          {caption}
        </text>
      ) : null}
      {placed.map((marker, n) =>
        marker.label === null ? null : (
          <text
            key={n}
            className="sim-chart-label"
            x={marker.labelX}
            y={top - 6}
            textAnchor="middle"
          >
            {marker.label}
          </text>
        ),
      )}
    </g>
  );
});

/* -------------------------------------------------------------------------- */
/* Frame                                                                      */
/* -------------------------------------------------------------------------- */

interface ChartFrameProps {
  title: string;
  description?: string;
  text: ChartText;
  className?: string;
  /** From usePlot: the element whose width the plot was laid out for. */
  frameRef: RefObject<HTMLDivElement | null>;
  plot: Plot;
  x: readonly number[];
  markers?: readonly ChartMarker[];
  /** Width of the slot to light up behind the bars at the pointer. Charts
   *  without bars leave it out and get a hairline crosshair. */
  column?: number;
  readout: (index: number) => Readout;
  focusPoints?: (index: number) => FocusPoint[];
  legend: readonly LegendItem[];
  hidden: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** The marks, drawn between the grid and the crosshair. */
  children: ReactNode;
}

/**
 * The shell every chart with a month axis shares: the drawing, the
 * crosshair, the tooltip, the text for assistive technology and the legend.
 *
 * The crosshair position is state of this component and of nothing above
 * it. The marks arrive as children, which React leaves alone while only
 * this state changes, so tracking the pointer over 120 months of 12 series
 * rebuilds no path.
 *
 * The plot is one focusable element. It has the application role because
 * that is what makes a screen reader pass the arrow keys through. Its name
 * is the chart title, its description is the caller's summary followed by
 * the keyboard hint, and the values at the crosshair are spoken by a live
 * region next to it. The drawing itself is hidden from assistive technology:
 * a hundred unlabelled paths say nothing.
 */
export function ChartFrame({
  title,
  description,
  text,
  className,
  frameRef,
  plot,
  x,
  markers,
  column,
  readout,
  focusPoints,
  legend,
  hidden,
  onToggle,
  children,
}: ChartFrameProps) {
  const id = useId();
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const count = plot.empty ? 0 : plot.xs.length;
  // The data can get shorter while the crosshair sits near the end.
  const current = cursor !== null && cursor.index < count ? cursor.index : null;
  const open = current !== null;

  // A tooltip opened by hover must be dismissable without moving the
  // pointer, so Escape is heard on the document, not only on a focused plot.
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCursor(null);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);

  /** Marker labels by the index of the x position nearest to each marker. */
  const notes = useMemo(() => {
    const byIndex = new Map<number, string[]>();
    const range = extent(x);
    if (!range || !markers) return byIndex;
    for (const marker of markers) {
      if (
        marker.label === "" ||
        !isNumber(marker.x) ||
        marker.x < range[0] ||
        marker.x > range[1]
      ) {
        continue;
      }
      const index = nearestIndex(x, marker.x);
      const labels = byIndex.get(index);
      if (!labels) byIndex.set(index, [marker.label]);
      else if (!labels.includes(marker.label)) labels.push(marker.label);
    }
    return byIndex;
  }, [x, markers]);

  const moveTo = (index: number, keyboard: boolean) => {
    setCursor((previous) =>
      previous !== null &&
      previous.index === index &&
      previous.keyboard === keyboard
        ? previous
        : { index, keyboard },
    );
  };

  const track = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    const index = nearestIndex(
      plot.xs,
      ((event.clientX - box.left) / box.width) * plot.width,
    );
    if (index >= 0) moveTo(index, false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (count === 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    if (event.key === "ArrowRight") {
      next = current === null ? 0 : Math.min(count - 1, current + 1);
    } else if (event.key === "ArrowLeft") {
      next = current === null ? count - 1 : Math.max(0, current - 1);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = count - 1;
    } else {
      return;
    }
    // Keeps the arrow keys and Home and End from scrolling the page.
    event.preventDefault();
    moveTo(next, true);
  };

  const view = current === null ? null : readout(current);
  const heading = current === null ? "" : text.xValue(x[current]);
  const currentNotes =
    current === null ? NO_NOTES : (notes.get(current) ?? NO_NOTES);
  const points =
    current !== null && focusPoints ? focusPoints(current) : NO_POINTS;
  const announcement =
    view !== null && cursor?.keyboard
      ? [
          heading,
          ...currentNotes,
          ...view.rows.map((row) => `${row.label} ${row.value}`),
          ...(view.total === null ? [] : [`${text.total} ${view.total}`]),
        ].join(", ")
      : "";

  const descriptionId = `${id}-description`;
  const hintId = `${id}-hint`;
  const anchor = current === null ? 0 : plot.xs[current];
  const columnFrom =
    column === undefined ? 0 : Math.max(plot.left, Math.round(anchor - column / 2));
  const columnTo =
    column === undefined ? 0 : Math.min(plot.right, Math.round(anchor + column / 2));

  // The frame takes its height from the first variable on screen and its
  // proportions from the second in print, where the page can be narrower
  // than the width the drawing was laid out for.
  const frameStyle = {
    "--sim-chart-height": `${plot.height}px`,
    "--sim-chart-ratio": `${plot.width} / ${plot.height}`,
  } as CSSProperties;

  return (
    <div className={className ? `sim-chart ${className}` : "sim-chart"}>
      <div
        ref={frameRef}
        className="sim-chart-frame"
        style={frameStyle}
        role="application"
        tabIndex={0}
        aria-label={title}
        aria-describedby={description ? `${descriptionId} ${hintId}` : hintId}
        onPointerDown={track}
        onPointerMove={track}
        onPointerLeave={(event) => {
          // A finger leaves the screen when it lifts. The readout stays up
          // until the reader taps somewhere else.
          if (event.pointerType !== "touch") setCursor(null);
        }}
        onBlur={() => setCursor(null)}
        onKeyDown={onKeyDown}
      >
        {/* One drawing unit is one CSS pixel once the frame is measured.
            Before that, and in print, the viewBox scales the drawing to
            the frame. */}
        <svg
          className="sim-chart-svg"
          data-chart-plot=""
          viewBox={`0 0 ${plot.width} ${plot.height}`}
          preserveAspectRatio="xMinYMin meet"
          aria-hidden="true"
          focusable="false"
        >
          <PlotAxes
            plot={plot}
            x={x}
            markers={markers}
            caption={text.xAxisLabel}
          />
          {current !== null && column !== undefined ? (
            <rect
              className="sim-chart-column sim-chart-cursor"
              data-export="skip"
              x={columnFrom}
              y={plot.top}
              width={Math.max(0, columnTo - columnFrom)}
              height={plot.bottom - plot.top}
            />
          ) : null}
          {children}
          {current !== null ? (
            <g className="sim-chart-cursor" data-export="skip">
              {column === undefined ? (
                <line
                  className="sim-chart-crosshair"
                  x1={crisp(anchor)}
                  x2={crisp(anchor)}
                  y1={plot.top}
                  y2={plot.bottom}
                />
              ) : null}
              {points.map((point) => (
                <rect
                  key={point.id}
                  className="sim-chart-point"
                  x={round2(anchor - POINT / 2)}
                  y={round2(point.y - POINT / 2)}
                  width={POINT}
                  height={POINT}
                  fill={point.color}
                />
              ))}
            </g>
          ) : null}
        </svg>
        {view !== null ? (
          <ChartTooltip
            heading={heading}
            notes={currentNotes}
            rows={view.rows}
            total={
              view.total === null
                ? null
                : { label: text.total, value: view.total }
            }
            anchor={anchor}
            offset={column === undefined ? 12 : Math.min(column / 2, 20) + 8}
            top={plot.top}
            width={plot.width}
            height={plot.height}
          />
        ) : null}
      </div>
      {description ? (
        <p id={descriptionId} hidden>
          {description}
        </p>
      ) : null}
      <p id={hintId} hidden>
        {text.keyboardHint}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {/* One series is named by the chart title, and switching it off
          would leave an empty chart. */}
      {legend.length > 1 ? (
        <ChartLegend
          label={title}
          items={legend}
          hidden={hidden}
          text={text}
          onToggle={onToggle}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Marks and readouts the charts share                                        */
/* -------------------------------------------------------------------------- */

export const LINE_WIDTH = 2;
const DASH = "6 4";

export interface LineShape {
  id: string;
  d: string;
  color: string;
  dashed: boolean;
}

export interface FillShape {
  id: string;
  d: string;
  color: string;
}

/**
 * Pixel y of each value, one per x position. An array shorter than the x
 * axis, such as a band left over from the previous run, ends early and the
 * rest stays empty. `positiveOnly` is for a log axis, which has no place for
 * zero or below.
 */
export function pixelValues(
  values: readonly (number | null | undefined)[],
  plot: Plot,
  positiveOnly = false,
): (number | null)[] {
  return plot.xs.map((_, i) => {
    const value = values[i];
    return isNumber(value) && (!positiveOnly || value > 0)
      ? plot.y(value)
      : null;
  });
}

export function lineShapes(
  series: readonly ChartSeries[],
  plot: Plot,
  positiveOnly = false,
): LineShape[] {
  return series.map((item) => ({
    id: item.id,
    d: linePath(plot.xs, pixelValues(item.values, plot, positiveOnly)),
    color: item.color,
    dashed: Boolean(item.dashed),
  }));
}

interface SeriesLinesProps {
  shapes: readonly LineShape[];
  width?: number;
}

/** Bevelled joins keep a spike in the data from growing a long mitre and
 *  keep the corners square. */
export const SeriesLines = memo(function SeriesLines({
  shapes,
  width = LINE_WIDTH,
}: SeriesLinesProps) {
  return (
    <g fill="none" strokeWidth={width} strokeLinejoin="bevel">
      {shapes.map((shape) =>
        shape.d === "" ? null : (
          <path
            key={shape.id}
            d={shape.d}
            stroke={shape.color}
            strokeDasharray={shape.dashed ? DASH : undefined}
          />
        ),
      )}
    </g>
  );
});

interface SeriesFillsProps {
  shapes: readonly FillShape[];
  opacity?: number;
}

export const SeriesFills = memo(function SeriesFills({
  shapes,
  opacity = 1,
}: SeriesFillsProps) {
  return (
    <g fillOpacity={opacity}>
      {shapes.map((shape) =>
        shape.d === "" ? null : (
          <path key={shape.id} d={shape.d} fill={shape.color} />
        ),
      )}
    </g>
  );
});

/** Where each line crosses one x position. */
export function linePoints(
  series: readonly ChartSeries[],
  plot: Plot,
  index: number,
  positiveOnly = false,
): FocusPoint[] {
  const points: FocusPoint[] = [];
  for (const item of series) {
    const value = item.values[index];
    if (isNumber(value) && (!positiveOnly || value > 0)) {
      points.push({ id: item.id, y: plot.y(value), color: item.color });
    }
  }
  return points;
}

/** One tooltip row per series that has a value at the position. */
export function lineRows(
  series: readonly ChartSeries[],
  index: number,
  formatValue: ValueFormatter,
): TooltipRow[] {
  const rows: TooltipRow[] = [];
  for (const item of series) {
    const value = item.values[index];
    if (isNumber(value)) {
      rows.push({
        id: item.id,
        label: item.label,
        value: formatValue(value),
        color: item.color,
        dashed: Boolean(item.dashed),
      });
    }
  }
  return rows;
}

/** The same for a stack, top layer first, the way the stack reads on
 *  screen. */
export function stackRows(
  series: readonly ChartSeries[],
  index: number,
  formatValue: ValueFormatter,
): TooltipRow[] {
  return lineRows(series, index, formatValue).reverse();
}

/** Every value the series hold for the first `count` positions. */
export function seriesValues(
  series: readonly ChartSeries[],
  count: number,
): (number | null)[] {
  return series.flatMap((item) => item.values.slice(0, count));
}

/** A y axis that holds a stack and the lines drawn over it. */
export function stackAxis(
  stack: Stack,
  lines: readonly ChartSeries[],
  count: number,
  intervals: number,
): Axis {
  const over = extent(seriesValues(lines, count));
  return linearAxis(
    Math.min(stack.min, over ? over[0] : 0),
    Math.max(stack.max, over ? over[1] : 0),
    intervals,
  );
}

export function legendItems(
  series: readonly ChartSeries[],
  mark: SeriesMark,
): LegendItem[] {
  return series.map((item) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    mark,
    dashed: mark === "line" && Boolean(item.dashed),
  }));
}
