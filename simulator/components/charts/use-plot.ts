"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  clamp,
  isNumber,
  linearScale,
  logScale,
  monthTicks,
  round2,
  type Axis,
  type Scale,
} from "./scales";
import type { ValueFormatter } from "./types";

/**
 * The geometry of one plot: where the plot box sits inside the frame, where
 * each x position and tick lands, and the scales that put values there. One
 * drawing unit is one CSS pixel, so type and hairlines keep their size at
 * every container width.
 */
export interface Plot {
  /** Size of the whole frame, axes included. */
  width: number;
  height: number;
  /** Edges of the plot box, on whole pixels. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Size of the tick type in pixels. */
  fontSize: number;
  /** Pixel x of every x position. */
  xs: number[];
  /** Month number to pixel x, for markers between positions. */
  xAt: Scale;
  /** Distance between neighbouring x positions; the plot width when there
   *  is only one. */
  step: number;
  /** Value to pixel y. */
  y: Scale;
  xTicks: PlotTick[];
  yTicks: PlotTick[];
  /** Pixel y of the zero line, or null when the axis does not cross zero. */
  zero: number | null;
  /** Baselines of the x tick labels and of the caption under them. */
  xLabelY: number;
  captionY: number | null;
  /** Nothing to draw: no x positions, or no value on the y axis. */
  empty: boolean;
}

export interface PlotTick {
  value: number;
  position: number;
  label: string;
}

export interface PlotInput {
  width: number;
  height: number;
  fontSize: number;
  x: readonly number[];
  axis: Axis;
  log?: boolean;
  formatAxis: ValueFormatter;
  /** Bars need half a slot of room at each end of the axis. Lines and areas
   *  run edge to edge. */
  banded?: boolean;
  /** Keeps a row above the plot free for marker labels. */
  markerLabels?: boolean;
  /** Keeps a row under the tick labels free for the axis caption. */
  caption?: boolean;
}

/** Drawn before the container has been measured: on the server and in the
 *  first client render. The frame scales this drawing to fit until then. */
const FIRST_WIDTH = 720;
const FIRST_FONT_SIZE = 11;

/** Advance of one glyph of the mono face in ems, rounded up a little. The
 *  face is monospaced, which is what lets label widths be worked out
 *  without measuring text. */
export const GLYPH = 0.62;
export const TICK_LENGTH = 4;
/** Clear space between a tick label and the plot. */
export const TICK_GAP = 8;

/** How many intervals a y axis of this frame height can label without
 *  crowding. */
export function tickBudget(height: number): number {
  return clamp(Math.floor((height - 60) / 44), 2, 6);
}

export function layoutPlot(input: PlotInput): Plot {
  const { axis, formatAxis } = input;
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const fontSize = input.fontSize > 0 ? input.fontSize : FIRST_FONT_SIZE;
  const glyph = fontSize * GLYPH;

  const finite = input.x.filter(isNumber);
  const first = finite.length ? Math.min(...finite) : 0;
  const last = finite.length ? Math.max(...finite) : 0;
  const count = input.x.length;

  // Margins follow the labels they hold. The left one is capped so a very
  // long tick label cannot squeeze the plot out of a phone-width frame.
  const yLabels = axis.ticks.map(formatAxis);
  const widest = yLabels.reduce((most, label) => Math.max(most, label.length), 0);
  const xLabelWidth = String(Math.round(last)).length * glyph;
  const left = Math.ceil(clamp(widest * glyph + TICK_GAP + 2, 12, width * 0.4));
  const right = Math.max(left + 1, Math.floor(width - Math.max(12, xLabelWidth / 2 + 4)));
  const top = Math.ceil(input.markerLabels ? fontSize * 1.2 + 8 : fontSize / 2 + 3);
  const below = TICK_LENGTH + 4 + fontSize * (input.caption ? 2.9 : 1.2);
  const bottom = Math.max(top + 1, Math.round(height - below));

  const inner = right - left;
  const pad = input.banded && count > 0 ? inner / (2 * count) : 0;
  const xAt = linearScale([first, last], [left + pad, right - pad]);
  const xs = input.x.map((value) => round2(xAt(isNumber(value) ? value : first)));
  let step = inner;
  for (let i = 1; i < xs.length; i += 1) {
    const distance = xs[i] - xs[i - 1];
    if (distance > 0 && distance < step) step = distance;
  }

  const y = input.log
    ? logScale(axis.domain, [bottom, top])
    : linearScale(axis.domain, [bottom, top]);
  const yTicks = axis.ticks.map((value, i) => ({
    value,
    position: round2(y(value)),
    label: yLabels[i],
  }));

  const pitch = Math.max(2, String(Math.round(last)).length) * glyph + 16;
  const xTicks =
    count === 0
      ? []
      : monthTicks(first, last, Math.floor((inner - 2 * pad) / pitch) + 1).map(
          (value) => ({
            value,
            position: round2(xAt(value)),
            label: String(value),
          }),
        );

  const crossesZero =
    !input.log && axis.ticks.length > 0 && axis.domain[0] <= 0 && axis.domain[1] >= 0;
  const xLabelY = round2(bottom + TICK_LENGTH + 4 + fontSize * 0.8);

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    fontSize,
    xs,
    xAt,
    step,
    y,
    xTicks,
    yTicks,
    zero: crossesZero ? round2(y(0)) : null,
    xLabelY,
    captionY: input.caption ? round2(xLabelY + fontSize * 1.7) : null,
    empty: count === 0 || axis.ticks.length === 0,
  };
}

interface Box {
  width: number;
  fontSize: number;
}

const FIRST_BOX: Box = { width: FIRST_WIDTH, fontSize: FIRST_FONT_SIZE };

/**
 * Lays a plot out at the width of the element `frameRef` is attached to.
 *
 * The element is measured before the first paint in the browser and again
 * whenever it resizes. Its font size is read at the same time: the tick type
 * is set in rem, so a reader with a larger default font gets wider margins
 * instead of clipped labels.
 */
export function usePlot(options: Omit<PlotInput, "width" | "fontSize">): {
  frameRef: RefObject<HTMLDivElement | null>;
  plot: Plot;
} {
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(FIRST_BOX);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const width = frame.clientWidth;
      // A hidden frame measures zero; the last real size is still right.
      if (width <= 0) return;
      const fontSize = parseFloat(getComputedStyle(frame).fontSize) || FIRST_FONT_SIZE;
      setBox((current) =>
        current.width === width && current.fontSize === fontSize
          ? current
          : { width, fontSize },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const { height, x, axis, log, formatAxis, banded, markerLabels, caption } = options;
  const plot = useMemo(
    () =>
      layoutPlot({
        width: box.width,
        fontSize: box.fontSize,
        height,
        x,
        axis,
        log,
        formatAxis,
        banded,
        markerLabels,
        caption,
      }),
    [box, height, x, axis, log, formatAxis, banded, markerLabels, caption],
  );

  return { frameRef, plot };
}
