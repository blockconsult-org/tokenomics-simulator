/**
 * Pure geometry for the simulator's charts: scales, tick generation,
 * stacking, and the SVG path strings built from them. Nothing here touches
 * React or the DOM, so all of it runs under node:test.
 *
 * Every function returns finite numbers for finite input and treats null,
 * NaN and ±Infinity as "no value", so a hole in the data can never reach an
 * SVG attribute as "NaN".
 */

export type Domain = readonly [number, number];
export type Scale = (value: number) => number;
/** Pixel positions with a null wherever nothing is drawn. */
export type Pixels = readonly (number | null)[];

export interface Axis {
  /** The value range the axis covers, widened to the outer ticks. */
  domain: [number, number];
  ticks: number[];
}

/** Absorbs float noise such as 0.3 / 0.1 = 2.9999999999999996. */
const EPSILON = 1e-9;
const TAU = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Rounds a coordinate to two places. Path strings stay short, and server
 * and browser cannot disagree in the last digit of trig output.
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Smallest and largest finite value, or null when there is none. */
export function extent(
  values: Iterable<number | null | undefined>,
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!isNumber(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return min <= max ? [min, max] : null;
}

/** Index of the position closest to `target`, or -1 for an empty list.
 *  Positions must ascend. */
export function nearestIndex(
  positions: readonly number[],
  target: number,
): number {
  if (positions.length === 0 || !isNumber(target)) return -1;
  let low = 0;
  let high = positions.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (positions[middle] <= target) low = middle;
    else high = middle;
  }
  return Math.abs(positions[low] - target) <= Math.abs(positions[high] - target)
    ? low
    : high;
}

/* -------------------------------------------------------------------------- */
/* Scales                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Maps a value range onto a pixel range. A domain of one value (a single
 * data point) has no slope to divide by, so it maps to the middle.
 */
export function linearScale(domain: Domain, range: Domain): Scale {
  const [from, to] = range;
  const span = domain[1] - domain[0];
  if (!isNumber(span) || span === 0) {
    const middle = (from + to) / 2;
    return () => middle;
  }
  const slope = (to - from) / span;
  return (value) => from + (value - domain[0]) * slope;
}

/**
 * The same on a logarithmic axis. Zero and negative values have no
 * logarithm; callers leave them out, and one that slips through lands on the
 * start of the range instead of producing NaN.
 */
export function logScale(domain: Domain, range: Domain): Scale {
  const [from, to] = range;
  if (!(domain[0] > 0) || !(domain[1] > 0) || domain[0] === domain[1]) {
    const middle = (from + to) / 2;
    return () => middle;
  }
  const base = Math.log(domain[0]);
  const slope = (to - from) / (Math.log(domain[1]) - base);
  return (value) => (value > 0 ? from + (Math.log(value) - base) * slope : from);
}

/* -------------------------------------------------------------------------- */
/* Ticks                                                                      */
/* -------------------------------------------------------------------------- */

/** Parsed from a decimal literal, so 5e-7 is the double nearest 5e-7 and
 *  not 5 × 1e-7 with its rounding error. */
function decimal(mantissa: number, exponent: number): number {
  return Number(`${mantissa}e${exponent}`);
}

/** An axis with nothing on it, for a chart that has no data. */
export function emptyAxis(): Axis {
  return { domain: [0, 1], ticks: [] };
}

/** The 1, 2 or 5 × 10ⁿ step that splits `span` into at most `intervals`
 *  parts. */
export function niceStep(span: number, intervals: number): number {
  if (!isNumber(span) || span <= 0) return 1;
  const raw = span / Math.max(1, intervals);
  const exponent = Math.floor(Math.log10(raw) + EPSILON);
  const fraction = raw / 10 ** exponent;
  const mantissa =
    fraction <= 1 + EPSILON ? 1 : fraction <= 2 + EPSILON ? 2 : fraction <= 5 + EPSILON ? 5 : 10;
  return decimal(mantissa, exponent);
}

/**
 * Round ticks that cover min to max, with the domain widened to the outer
 * ticks. All-zero data keeps a single tick at zero, so the frame reads as
 * empty and no scale is invented for it.
 */
export function linearAxis(min: number, max: number, intervals = 5): Axis {
  if (!isNumber(min) || !isNumber(max)) return emptyAxis();
  let low = Math.min(min, max);
  let high = Math.max(min, max);
  if (low === high) {
    if (low === 0) return { domain: [0, 1], ticks: [0] };
    const pad = Math.abs(low) / 2;
    low -= pad;
    high += pad;
  }
  const step = niceStep(high - low, intervals);
  const first = Math.floor(low / step + EPSILON);
  const last = Math.ceil(high / step - EPSILON);
  const digits = clamp(-Math.floor(Math.log10(step) + EPSILON), 0, 20);
  const ticks: number[] = [];
  // The "+ 0" turns a negative zero from toFixed into a plain zero.
  for (let i = first; i <= last; i += 1) {
    ticks.push(Number((i * step).toFixed(digits)) + 0);
  }
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

/**
 * Ticks for a logarithmic axis. A range of a few decades gets 1-2-5 ticks,
 * a wider one whole decades, and a range too narrow for either falls back
 * to evenly spaced values, which the log scale still positions correctly.
 */
export function logAxis(min: number, max: number, maxTicks = 6): Axis {
  if (!isNumber(min) || !isNumber(max) || min <= 0 || max <= 0) {
    return emptyAxis();
  }
  let low = Math.min(min, max);
  let high = Math.max(min, max);
  if (low === high) {
    low /= 2;
    high *= 2;
  }
  const firstDecade = Math.floor(Math.log10(low) + EPSILON);
  const lastDecade = Math.ceil(Math.log10(high) - EPSILON);

  const fine: number[] = [];
  for (let exponent = firstDecade; exponent <= lastDecade; exponent += 1) {
    for (const mantissa of [1, 2, 5]) fine.push(decimal(mantissa, exponent));
  }
  let start = 0;
  while (start + 1 < fine.length && fine[start + 1] <= low * (1 + EPSILON)) {
    start += 1;
  }
  let end = fine.length - 1;
  while (end > start && fine[end - 1] >= high * (1 - EPSILON)) end -= 1;
  const steps = fine.slice(start, end + 1);

  if (steps.length >= 3 && steps.length <= maxTicks) {
    return { domain: [steps[0], steps[steps.length - 1]], ticks: steps };
  }
  if (steps.length < 3) {
    const linear = linearAxis(low, high, Math.max(2, maxTicks - 1));
    const ticks = linear.ticks.filter((tick) => tick > 0);
    if (ticks.length >= 2) {
      return {
        domain: [Math.min(low, ticks[0]), Math.max(high, ticks[ticks.length - 1])],
        ticks,
      };
    }
  }
  const decades = Math.max(1, lastDecade - firstDecade);
  const stride = Math.ceil(decades / Math.max(1, maxTicks - 1));
  const ticks: number[] = [];
  for (let i = 0; i <= Math.ceil(decades / stride); i += 1) {
    ticks.push(decimal(1, firstDecade + i * stride));
  }
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

/** Steps a reader counts in: quarters, half-years, years. */
const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 36, 48, 60, 120];

/**
 * Month numbers to label on an x axis that runs from `first` to `last`: the
 * multiples of the smallest step that needs no more than `maxTicks` labels.
 */
export function monthTicks(
  first: number,
  last: number,
  maxTicks: number,
): number[] {
  if (!isNumber(first) || !isNumber(last)) return [];
  const low = Math.min(first, last);
  const high = Math.max(first, last);
  const limit = Math.max(2, Math.floor(maxTicks));
  for (let i = 0; ; i += 1) {
    // Past ten years the steps continue in decades: 240, 360, …
    const step =
      i < MONTH_STEPS.length ? MONTH_STEPS[i] : 120 * (i - MONTH_STEPS.length + 2);
    const start = Math.ceil(low / step - EPSILON) * step + 0;
    const count =
      start > high ? 0 : Math.floor((high - start) / step + EPSILON) + 1;
    if (count <= limit) {
      return Array.from({ length: count }, (_, n) => start + n * step);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Stacking                                                                   */
/* -------------------------------------------------------------------------- */

export interface StackLayer {
  /** Edge nearer to minus infinity, in data units. */
  lower: number[];
  /** Edge nearer to plus infinity. */
  upper: number[];
  /** False where the series has no value; the layer is not drawn there. */
  defined: boolean[];
}

export interface Stack {
  layers: StackLayer[];
  /** Net sum of every series at each position. */
  totals: number[];
  /** Lowest and highest edge of the whole stack. Both include zero. */
  min: number;
  max: number;
}

/**
 * Stacks series in array order. Positive values pile up from zero and
 * negative values pile down from it, so buys and sells diverge around the
 * zero line. A missing value takes no room and leaves a gap in its layer.
 */
export function stackSeries(
  rows: readonly (readonly (number | null)[])[],
  length: number,
): Stack {
  const layers: StackLayer[] = rows.map(() => ({
    lower: new Array<number>(length),
    upper: new Array<number>(length),
    defined: new Array<boolean>(length),
  }));
  const totals = new Array<number>(length);
  let min = 0;
  let max = 0;
  for (let i = 0; i < length; i += 1) {
    let above = 0;
    let below = 0;
    for (let row = 0; row < rows.length; row += 1) {
      const value = rows[row][i];
      const layer = layers[row];
      if (!isNumber(value)) {
        layer.lower[i] = above;
        layer.upper[i] = above;
        layer.defined[i] = false;
      } else if (value >= 0) {
        layer.lower[i] = above;
        above += value;
        layer.upper[i] = above;
        layer.defined[i] = true;
      } else {
        layer.upper[i] = below;
        below += value;
        layer.lower[i] = below;
        layer.defined[i] = true;
      }
    }
    totals[i] = above + below;
    if (above > max) max = above;
    if (below < min) min = below;
  }
  return { layers, totals, min, max };
}

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

/** Width of the dash that stands in for a point with a gap on either side. */
const LONE_POINT = 3;

const at = (x: number, y: number): string => `${round2(x)},${round2(y)}`;

/** First and last index of every unbroken run of drawable positions. */
function runs(
  length: number,
  drawable: (index: number) => boolean,
): [number, number][] {
  const found: [number, number][] = [];
  let index = 0;
  while (index < length) {
    if (!drawable(index)) {
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < length && drawable(end + 1)) end += 1;
    found.push([index, end]);
    index = end + 1;
  }
  return found;
}

/**
 * A polyline through the drawable points, broken wherever `ys` is null. A
 * point with a gap on both sides has no segment to draw, so it becomes a
 * short dash and stays visible.
 */
export function linePath(xs: readonly number[], ys: Pixels): string {
  const length = Math.min(xs.length, ys.length);
  const drawable = (i: number) => isNumber(xs[i]) && isNumber(ys[i]);
  let path = "";
  for (const [start, end] of runs(length, drawable)) {
    if (start === end) {
      path += `M${at(xs[start] - LONE_POINT / 2, Number(ys[start]))}h${LONE_POINT}`;
      continue;
    }
    path += `M${at(xs[start], Number(ys[start]))}`;
    for (let i = start + 1; i <= end; i += 1) {
      path += `L${at(xs[i], Number(ys[i]))}`;
    }
  }
  return path;
}

/**
 * The filled region between two edges, one closed shape per unbroken run.
 * A run of one point has no width and is left out.
 */
export function areaPath(
  xs: readonly number[],
  lower: Pixels,
  upper: Pixels,
): string {
  const length = Math.min(xs.length, lower.length, upper.length);
  const drawable = (i: number) =>
    isNumber(xs[i]) && isNumber(lower[i]) && isNumber(upper[i]);
  let path = "";
  for (const [start, end] of runs(length, drawable)) {
    if (start === end) continue;
    path += `M${at(xs[start], Number(upper[start]))}`;
    for (let i = start + 1; i <= end; i += 1) {
      path += `L${at(xs[i], Number(upper[i]))}`;
    }
    for (let i = end; i >= start; i -= 1) {
      path += `L${at(xs[i], Number(lower[i]))}`;
    }
    path += "Z";
  }
  return path;
}

/**
 * One rectangle per position, all in a single path, so a series of 120 bars
 * is one DOM node. Bars sit on whole pixels horizontally to keep their edges
 * sharp. Positions where either end is null, or the bar has no height, are
 * skipped.
 */
export function barsPath(
  xs: readonly number[],
  from: Pixels,
  to: Pixels,
  width: number,
): string {
  const length = Math.min(xs.length, from.length, to.length);
  const size = isNumber(width) ? Math.max(1, Math.round(width)) : 1;
  let path = "";
  for (let i = 0; i < length; i += 1) {
    const a = from[i];
    const b = to[i];
    if (!isNumber(xs[i]) || !isNumber(a) || !isNumber(b)) continue;
    const height = round2(Math.abs(b - a));
    if (height === 0) continue;
    const left = Math.round(xs[i] - size / 2);
    path += `M${left},${round2(Math.min(a, b))}h${size}v${height}h${-size}Z`;
  }
  return path;
}

/**
 * Start and end angle of each slice, in radians clockwise from twelve
 * o'clock. Zero, negative and missing values get no slice. Every entry is
 * null when nothing is positive.
 */
export function pieAngles(
  values: readonly (number | null)[],
): ([number, number] | null)[] {
  const sizes = values.map((value) => (isNumber(value) && value > 0 ? value : 0));
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (!isNumber(total) || total <= 0) return values.map(() => null);
  let turned = 0;
  return sizes.map((size) => {
    if (size === 0) return null;
    const start = (turned / total) * TAU;
    turned += size;
    return [start, (turned / total) * TAU];
  });
}

/**
 * One donut slice. `gap` is the clear width in pixels between neighbouring
 * slices: each side gives up half of it, measured along the arc, which keeps
 * the two cut edges parallel. A slice that spans the full turn is drawn as a
 * ring, because an arc cannot start and end on the same point.
 */
export function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
  gap = 0,
): string {
  const span = end - start;
  if (!isNumber(span) || span <= 0 || !isNumber(outer) || outer <= 0) return "";
  if (!isNumber(cx) || !isNumber(cy)) return "";
  const hole = isNumber(inner) ? clamp(inner, 0, outer) : 0;
  const clear = isNumber(gap) && gap > 0 ? gap : 0;
  const on = (radius: number, angle: number) =>
    at(cx + radius * Math.sin(angle), cy - radius * Math.cos(angle));
  const arc = (radius: number, sweep: 0 | 1, large: 0 | 1, to: string) =>
    `A${round2(radius)},${round2(radius)} 0 ${large} ${sweep} ${to}`;

  if (span >= TAU - EPSILON) {
    const ring = (radius: number, sweep: 0 | 1) =>
      `M${on(radius, 0)}${arc(radius, sweep, 1, on(radius, Math.PI))}${arc(radius, sweep, 1, on(radius, 0))}Z`;
    // The hole runs the other way round, so the non-zero fill rule cuts it out.
    return ring(outer, 1) + (hole > 0 ? ring(hole, 0) : "");
  }

  // A sliver thinner than the gap keeps some arc at both radii.
  const padOuter = Math.min(clear / 2 / outer, span * 0.45);
  const padInner = hole > 0 ? Math.min(clear / 2 / hole, span * 0.45) : 0;
  const large = (pad: number): 0 | 1 => (span - 2 * pad > Math.PI ? 1 : 0);
  const head = `M${on(outer, start + padOuter)}${arc(outer, 1, large(padOuter), on(outer, end - padOuter))}`;
  if (hole === 0) return `${head}L${at(cx, cy)}Z`;
  return `${head}L${on(hole, end - padInner)}${arc(hole, 0, large(padInner), on(hole, start + padInner))}Z`;
}
