import test from "node:test";
import assert from "node:assert/strict";
import {
  arcPath,
  areaPath,
  barsPath,
  extent,
  linePath,
  linearAxis,
  linearScale,
  logAxis,
  logScale,
  monthTicks,
  nearestIndex,
  niceStep,
  pieAngles,
  stackSeries,
} from "@/simulator/components/charts/scales";
import { layoutPlot, tickBudget } from "@/simulator/components/charts/use-plot";

/** Every number in a path or a layout must be finite: "NaN" in an SVG
 *  attribute blanks the element without an error. */
function assertFinite(value, where = "value") {
  if (typeof value === "string") {
    assert.doesNotMatch(value, /NaN|Infinity|undefined/, `${where}: ${value}`);
  } else if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${where} is ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((entry, i) => assertFinite(entry, `${where}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry !== "function") assertFinite(entry, `${where}.${key}`);
    }
  }
}

const months = (count) => Array.from({ length: count }, (_, i) => i);

/* -------------------------------------------------------------------------- */
/* Scales                                                                     */
/* -------------------------------------------------------------------------- */

test("a linear scale maps the domain onto the range, upside down for a y axis", () => {
  const y = linearScale([0, 100], [300, 20]);
  assert.equal(y(0), 300);
  assert.equal(y(100), 20);
  assert.equal(y(50), 160);
});

test("a domain of one value maps to the middle instead of dividing by zero", () => {
  const x = linearScale([7, 7], [40, 240]);
  assert.equal(x(7), 140);
  assert.equal(x(1000), 140);
  const log = logScale([2, 2], [300, 20]);
  assert.equal(log(2), 160);
});

test("a log scale spaces decades evenly and never returns NaN", () => {
  const y = logScale([0.01, 100], [400, 0]);
  assert.ok(Math.abs(y(0.01) - 400) < 1e-9);
  assert.ok(Math.abs(y(1) - 200) < 1e-9);
  assert.ok(Math.abs(y(100)) < 1e-9);
  assert.equal(y(0), 400);
  assert.equal(y(-5), 400);
  assert.equal(logScale([0, 10], [400, 0])(5), 200);
});

/* -------------------------------------------------------------------------- */
/* Linear ticks                                                               */
/* -------------------------------------------------------------------------- */

test("nice steps are 1, 2 or 5 times a power of ten", () => {
  assert.equal(niceStep(100, 5), 20);
  assert.equal(niceStep(1, 5), 0.2);
  assert.equal(niceStep(7, 5), 2);
  assert.equal(niceStep(0.003, 4), 0.001);
  assert.equal(niceStep(1e9, 5), 2e8);
  assert.equal(niceStep(0, 5), 1);
  assert.equal(niceStep(Number.NaN, 5), 1);
});

test("a linear axis covers the data with round ticks", () => {
  assert.deepEqual(linearAxis(0, 1e9, 5), {
    domain: [0, 1e9],
    ticks: [0, 2e8, 4e8, 6e8, 8e8, 1e9],
  });
  assert.deepEqual(linearAxis(0, 937, 5).ticks, [0, 200, 400, 600, 800, 1000]);
  assert.deepEqual(linearAxis(-40, 75, 5).ticks, [-50, 0, 50, 100]);
  assert.deepEqual(linearAxis(-40, 75, 5).domain, [-50, 100]);
});

test("ticks carry no float noise", () => {
  assert.deepEqual(linearAxis(0, 1, 5).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(linearAxis(0.1, 0.3, 4).ticks, [0.1, 0.15, 0.2, 0.25, 0.3]);
  assert.deepEqual(linearAxis(0.0012, 0.0031, 4).ticks, [0.001, 0.0015, 0.002, 0.0025, 0.003, 0.0035]);
  // 0.3 / 0.1 is 2.9999999999999996; the axis must still start at 0.3.
  assert.equal(linearAxis(0.3, 0.9, 6).ticks[0], 0.3);
});

test("flat and empty data get a usable axis", () => {
  assert.deepEqual(linearAxis(0, 0), { domain: [0, 1], ticks: [0] });
  const flat = linearAxis(5, 5, 5);
  assert.ok(flat.domain[0] < 5 && flat.domain[1] > 5);
  assert.ok(flat.ticks.includes(5));
  assert.deepEqual(linearAxis(Number.NaN, 4), { domain: [0, 1], ticks: [] });
  assert.deepEqual(linearAxis(0, Infinity), { domain: [0, 1], ticks: [] });
  assert.ok(Object.is(linearAxis(-1, 1, 4).ticks.find((t) => t === 0), 0));
});

/* -------------------------------------------------------------------------- */
/* Log ticks                                                                  */
/* -------------------------------------------------------------------------- */

test("a log axis of a few decades uses 1-2-5 ticks", () => {
  assert.deepEqual(logAxis(0.08, 1.5, 6), {
    domain: [0.05, 2],
    ticks: [0.05, 0.1, 0.2, 0.5, 1, 2],
  });
});

test("a wide log axis falls back to whole decades", () => {
  const axis = logAxis(0.00003, 250, 6);
  assert.deepEqual(axis.ticks, [1e-5, 1e-3, 1e-1, 1e1, 1e3]);
  assert.deepEqual(axis.domain, [1e-5, 1e3]);
  assert.ok(axis.domain[0] <= 0.00003 && axis.domain[1] >= 250);
});

test("a narrow log axis uses evenly spaced positive ticks", () => {
  const axis = logAxis(1.2, 1.8, 6);
  assert.ok(axis.ticks.length >= 3);
  assert.ok(axis.ticks.every((tick) => tick > 0));
  assert.ok(axis.domain[0] <= 1.2 && axis.domain[1] >= 1.8);
});

test("a log axis with one value or no positive value still works", () => {
  assert.deepEqual(logAxis(1, 1, 6), { domain: [0.5, 2], ticks: [0.5, 1, 2] });
  assert.deepEqual(logAxis(0, 10), { domain: [0, 1], ticks: [] });
  assert.deepEqual(logAxis(-3, -1), { domain: [0, 1], ticks: [] });
});

test("every log axis contains its data", () => {
  for (const [min, max] of [[0.5, 0.7], [3, 4000], [1e-9, 2e-9], [0.99, 1.01], [4, 11], [1, 10], [0.2, 180000]]) {
    for (const maxTicks of [3, 5, 7]) {
      const axis = logAxis(min, max, maxTicks);
      assertFinite(axis, `logAxis(${min}, ${max}, ${maxTicks})`);
      assert.ok(axis.domain[0] <= min * (1 + 1e-9), `low end for ${min}–${max}`);
      assert.ok(axis.domain[1] >= max * (1 - 1e-9), `high end for ${min}–${max}`);
      assert.ok(axis.domain[0] > 0);
      assert.ok(axis.ticks.length >= 2);
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Month ticks                                                                */
/* -------------------------------------------------------------------------- */

test("month ticks step in quarters, half-years and years", () => {
  assert.deepEqual(monthTicks(0, 12, 5), [0, 3, 6, 9, 12]);
  assert.deepEqual(monthTicks(0, 36, 7), [0, 6, 12, 18, 24, 30, 36]);
  assert.deepEqual(monthTicks(0, 60, 6), [0, 12, 24, 36, 48, 60]);
  assert.deepEqual(monthTicks(0, 120, 7), [0, 24, 48, 72, 96, 120]);
  assert.deepEqual(monthTicks(0, 120, 12), [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]);
  assert.deepEqual(monthTicks(0, 120, 2), [0, 120]);
});

test("month ticks are multiples of the step even when the axis starts at 1", () => {
  assert.deepEqual(monthTicks(1, 36, 4), [12, 24, 36]);
  assert.deepEqual(monthTicks(1, 12, 13), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("month ticks handle one month, long horizons and bad input", () => {
  assert.deepEqual(monthTicks(5, 5, 6), [5]);
  assert.deepEqual(monthTicks(0, 0, 6), [0]);
  assert.deepEqual(monthTicks(0, 600, 4), [0, 240, 480]);
  assert.deepEqual(monthTicks(Number.NaN, 12, 6), []);
  assert.ok(monthTicks(0, 120, 0).length <= 2);
});

/* -------------------------------------------------------------------------- */
/* Stacking                                                                   */
/* -------------------------------------------------------------------------- */

test("positive values stack upward in series order", () => {
  const stack = stackSeries([[1, 2], [3, 4], [5, 6]], 2);
  assert.deepEqual(stack.layers.map((l) => l.lower), [[0, 0], [1, 2], [4, 6]]);
  assert.deepEqual(stack.layers.map((l) => l.upper), [[1, 2], [4, 6], [9, 12]]);
  assert.deepEqual(stack.totals, [9, 12]);
  assert.equal(stack.min, 0);
  assert.equal(stack.max, 12);
});

test("negative values stack downward from zero, apart from the positive ones", () => {
  const stack = stackSeries([[10, 10], [-4, -1], [5, 0], [-6, -2]], 2);
  assert.deepEqual(stack.layers[0], { lower: [0, 0], upper: [10, 10], defined: [true, true] });
  assert.deepEqual(stack.layers[1], { lower: [-4, -1], upper: [0, 0], defined: [true, true] });
  assert.deepEqual(stack.layers[2], { lower: [10, 10], upper: [15, 10], defined: [true, true] });
  assert.deepEqual(stack.layers[3], { lower: [-10, -3], upper: [-4, -1], defined: [true, true] });
  assert.deepEqual(stack.totals, [5, 7]);
  assert.equal(stack.min, -10);
  assert.equal(stack.max, 15);
});

test("a missing value takes no room and marks a gap", () => {
  const stack = stackSeries([[1, null, 1], [2, 2, Number.NaN], [4, 4]], 3);
  assert.deepEqual(stack.layers[0].defined, [true, false, true]);
  assert.deepEqual(stack.layers[1].lower, [1, 0, 1]);
  assert.deepEqual(stack.layers[1].defined, [true, true, false]);
  // The third series is one value short: the last position is a gap too.
  assert.deepEqual(stack.layers[2].defined, [true, true, false]);
  assert.deepEqual(stack.totals, [7, 6, 1]);
  assertFinite(stack, "stack");
});

test("an empty stack is all zero", () => {
  assert.deepEqual(stackSeries([], 3), { layers: [], totals: [0, 0, 0], min: 0, max: 0 });
  assert.deepEqual(stackSeries([[1, 2]], 0), {
    layers: [{ lower: [], upper: [], defined: [] }],
    totals: [],
    min: 0,
    max: 0,
  });
});

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

test("extent ignores nulls and non-finite values", () => {
  assert.deepEqual(extent([3, null, -2, Number.NaN, 8, Infinity, undefined]), [-2, 8]);
  assert.equal(extent([null, Number.NaN]), null);
  assert.equal(extent([]), null);
});

test("the nearest index snaps a pointer to the closest month", () => {
  const xs = [50, 60, 70, 80];
  assert.equal(nearestIndex(xs, 0), 0);
  assert.equal(nearestIndex(xs, 54), 0);
  assert.equal(nearestIndex(xs, 56), 1);
  assert.equal(nearestIndex(xs, 74.9), 2);
  assert.equal(nearestIndex(xs, 9999), 3);
  assert.equal(nearestIndex([120], -3), 0);
  assert.equal(nearestIndex([], 10), -1);
  assert.equal(nearestIndex(xs, Number.NaN), -1);
});

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

test("a line breaks at a null and resumes after it", () => {
  assert.equal(linePath([0, 10, 20, 30, 40], [5, 6, null, 8, 9]), "M0,5L10,6M30,8L40,9");
});

test("a lone point becomes a short dash so it stays visible", () => {
  assert.equal(linePath([0, 10, 20], [null, 6, null]), "M8.5,6h3");
  assert.equal(linePath([100], [42]), "M98.5,42h3");
});

test("a line of nothing is an empty path", () => {
  assert.equal(linePath([], []), "");
  assert.equal(linePath([0, 10], [null, null]), "");
  assert.equal(linePath([0, 10], [Number.NaN, Infinity]), "");
});

test("an area closes each unbroken run and skips a run of one", () => {
  assert.equal(
    areaPath([0, 10, 20, 30, 40, 50], [9, 9, null, 9, 9, null], [1, 2, null, 3, 4, null]),
    "M0,1L10,2L10,9L0,9ZM30,3L40,4L40,9L30,9Z",
  );
  assert.equal(areaPath([0, 10, 20], [9, null, 9], [1, null, 3]), "");
  assert.equal(areaPath([5], [9], [1]), "");
});

test("bars land on whole pixels and skip gaps and zero heights", () => {
  assert.equal(
    barsPath([10.4, 30.4, 50.4, 70.4], [100, 100, 100, null], [60, 100, 130.25, 20], 8),
    "M6,60h8v40h-8ZM46,100h8v30.25h-8Z",
  );
  assert.equal(barsPath([10], [100], [90], 0.2), "M10,90h1v10h-1Z");
});

test("pie angles share the turn among the positive values", () => {
  const angles = pieAngles([1, 0, 1, -5, 2, null]);
  assert.equal(angles[1], null);
  assert.equal(angles[3], null);
  assert.equal(angles[5], null);
  assert.deepEqual(angles[0], [0, Math.PI / 2]);
  assert.deepEqual(angles[2], [Math.PI / 2, Math.PI]);
  assert.deepEqual(angles[4], [Math.PI, Math.PI * 2]);
  assert.deepEqual(pieAngles([0, 0]), [null, null]);
  assert.deepEqual(pieAngles([]), []);
  assert.deepEqual(pieAngles([Number.NaN, Infinity]), [null, null]);
});

test("a donut slice starts at twelve o'clock and runs clockwise", () => {
  // A quarter turn from the top to the right-hand side.
  assert.equal(
    arcPath(100, 100, 100, 60, 0, Math.PI / 2),
    "M100,0A100,100 0 0 1 200,100L160,100A60,60 0 0 0 100,40Z",
  );
  // More than half a turn takes the long way round.
  assert.match(arcPath(100, 100, 100, 60, 0, Math.PI * 1.5), /A100,100 0 1 1 /);
});

test("a slice that is the whole turn is drawn as a ring", () => {
  const ring = arcPath(100, 100, 100, 60, 0, Math.PI * 2, 2);
  assert.equal(
    ring,
    "M100,0A100,100 0 1 1 100,200A100,100 0 1 1 100,0ZM100,40A60,60 0 1 0 100,160A60,60 0 1 0 100,40Z",
  );
});

test("a gap narrows both ends of a slice and never inverts a sliver", () => {
  const plain = arcPath(100, 100, 100, 60, 0, Math.PI / 2);
  const gapped = arcPath(100, 100, 100, 60, 0, Math.PI / 2, 2);
  assert.notEqual(gapped, plain);
  // One pixel along the arc at each radius: the outer edge starts 1px in.
  assert.match(gapped, /^M101,0A/);
  const sliver = arcPath(100, 100, 100, 60, 1, 1.001, 2);
  assertFinite(sliver, "sliver");
  assert.match(sliver, /^M.+A.+L.+A.+Z$/);
});

test("degenerate slices draw nothing", () => {
  assert.equal(arcPath(100, 100, 100, 60, 1, 1), "");
  assert.equal(arcPath(100, 100, 100, 60, 2, 1), "");
  assert.equal(arcPath(100, 100, 0, 0, 0, 1), "");
  assert.equal(arcPath(100, 100, 100, 60, Number.NaN, 1), "");
});

test("no path builder emits NaN for hostile input", () => {
  const xs = [0, Number.NaN, 20, 30];
  const ys = [1, 2, Number.NaN, null];
  assertFinite(linePath(xs, ys), "linePath");
  assertFinite(areaPath(xs, ys, ys), "areaPath");
  assertFinite(barsPath(xs, ys, [5, 5, 5, 5], Number.NaN), "barsPath");
  assertFinite(arcPath(Number.NaN, 0, 10, 5, 0, 1), "arcPath");
});

/* -------------------------------------------------------------------------- */
/* Plot layout                                                                */
/* -------------------------------------------------------------------------- */

const compact = (value) =>
  Math.abs(value) >= 1e6 ? `${value / 1e6}M` : String(value);

function layout(overrides = {}) {
  return layoutPlot({
    width: 640,
    height: 320,
    fontSize: 11,
    x: months(121),
    axis: linearAxis(0, 1e9, tickBudget(320)),
    formatAxis: compact,
    caption: true,
    ...overrides,
  });
}

test("the plot box stays inside the frame from phone to desktop widths", () => {
  for (const width of [320, 360, 768, 1024, 1400]) {
    const plot = layout({ width });
    assertFinite(plot, `plot@${width}`);
    assert.ok(plot.left >= 12 && plot.left < plot.right, `left edge @${width}`);
    assert.ok(plot.right <= width - 12, `right edge @${width}`);
    assert.ok(plot.top > 0 && plot.top < plot.bottom && plot.bottom < plot.height);
    assert.ok(plot.captionY !== null && plot.captionY < plot.height);
    assert.equal(plot.xs.length, 121);
    assert.equal(plot.xs[0], plot.left);
    assert.equal(plot.xs[120], plot.right);
    // Tick labels are centred on their tick: the outer ones must not leave
    // the frame, and neighbours must not touch.
    const glyph = 11 * 0.62;
    const first = plot.xTicks[0];
    const last = plot.xTicks[plot.xTicks.length - 1];
    assert.ok(first.position - (first.label.length * glyph) / 2 >= 0);
    assert.ok(last.position + (last.label.length * glyph) / 2 <= width);
    for (let i = 1; i < plot.xTicks.length; i += 1) {
      const room = plot.xTicks[i].position - plot.xTicks[i - 1].position;
      assert.ok(room >= plot.xTicks[i].label.length * glyph + 8, `x labels crowd @${width}`);
    }
    // The widest y label fits in the left margin.
    const widest = Math.max(...plot.yTicks.map((tick) => tick.label.length));
    assert.ok(widest * glyph + 8 <= plot.left, `y labels clip @${width}`);
  }
});

test("y ticks run from the bottom of the plot to the top", () => {
  const plot = layout();
  assert.equal(plot.yTicks[0].position, plot.bottom);
  assert.equal(plot.yTicks[plot.yTicks.length - 1].position, plot.top);
  assert.equal(plot.zero, plot.bottom);
  assert.equal(plot.y(5e8), (plot.top + plot.bottom) / 2);
});

test("bars get half a slot of room at each end", () => {
  const plot = layout({ x: months(12), banded: true, width: 400 });
  const slot = (plot.right - plot.left) / 12;
  assert.ok(Math.abs(plot.xs[0] - (plot.left + slot / 2)) < 0.01);
  assert.ok(Math.abs(plot.xs[11] - (plot.right - slot / 2)) < 0.01);
  assert.ok(Math.abs(plot.step - slot) < 0.02);
});

test("a single month sits in the middle of the plot", () => {
  for (const banded of [false, true]) {
    const plot = layout({ x: [0], banded });
    assertFinite(plot, "single");
    assert.deepEqual(plot.xs, [(plot.left + plot.right) / 2]);
    assert.equal(plot.step, plot.right - plot.left);
    assert.deepEqual(plot.xTicks.map((tick) => tick.value), [0]);
  }
});

test("no data lays out an empty frame", () => {
  const none = layout({ x: [], axis: { domain: [0, 1], ticks: [] } });
  assertFinite(none, "empty");
  assert.equal(none.empty, true);
  assert.deepEqual(none.xs, []);
  assert.deepEqual(none.xTicks, []);
  assert.deepEqual(none.yTicks, []);
  assert.equal(none.zero, null);

  const zeros = layout({ axis: linearAxis(0, 0) });
  assertFinite(zeros, "zeros");
  assert.equal(zeros.empty, false);
  assert.deepEqual(zeros.yTicks.map((tick) => tick.value), [0]);
  assert.equal(zeros.zero, zeros.bottom);
});

test("a log plot has no zero line and keeps every tick inside the box", () => {
  const plot = layout({ axis: logAxis(0.004, 3.2, 7), log: true, formatAxis: String });
  assertFinite(plot, "log");
  assert.equal(plot.zero, null);
  for (const tick of plot.yTicks) {
    assert.ok(tick.position >= plot.top && tick.position <= plot.bottom);
  }
});

test("a long tick label cannot push the plot out of a narrow frame", () => {
  const plot = layout({ width: 320, formatAxis: () => "1,234,567,890.123456 TOKEN" });
  assert.ok(plot.left <= 128);
  assert.ok(plot.right - plot.left >= 150);
});

test("marker labels and the caption reserve their rows", () => {
  const bare = layout({ caption: false });
  const full = layout({ markerLabels: true });
  assert.ok(full.top > bare.top);
  assert.ok(full.bottom < bare.bottom);
  assert.equal(bare.captionY, null);
});

test("a larger reader font widens the margins", () => {
  const normal = layout({ width: 360 });
  const large = layout({ width: 360, fontSize: 22 });
  assert.ok(large.left > normal.left);
  assert.ok(large.bottom < normal.bottom);
  assertFinite(large, "large type");
});

test("the tick budget follows the frame height", () => {
  assert.equal(tickBudget(120), 2);
  assert.equal(tickBudget(240), 4);
  assert.equal(tickBudget(320), 5);
  assert.equal(tickBudget(900), 6);
});
