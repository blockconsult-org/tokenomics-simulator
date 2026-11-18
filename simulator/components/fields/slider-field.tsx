"use client";

import type { ChangeEvent, CSSProperties, KeyboardEvent } from "react";
import { clampToSpec, type FieldSpec } from "@/simulator/engine/fields";
import { toDisplay } from "@/simulator/engine/format";
import { FieldShell, describedBy, fieldIds } from "./field-shell";
import {
  NumberInput,
  isLogField,
  stepValue,
  storedFrom,
  tidy,
  valueText,
} from "./number-field";
import type { SliderFieldProps } from "./types";

/** Positions on a log slider's track. A thousand is finer than a pixel on
 *  any track the form draws. */
const TRACK_STEPS = 1000;

type RangeStyle = CSSProperties & { "--sim-range-fill": string };

interface Scale {
  /** Stored value → fraction of the track, 0 to 1. */
  toPosition: (stored: number) => number;
  /** Fraction of the track → stored value, not yet rounded. */
  toValue: (position: number) => number;
}

/**
 * Where a value sits on a log slider's track.
 *
 * A range that starts above zero gets a plain log scale: every decade takes
 * the same length of track.
 *
 * A range that starts at zero cannot, because log 0 has no position. It gets
 * a symlog scale instead, asinh(value / step). That curve runs straight for
 * values around one step and logarithmic above them, so zero sits at the left
 * end of the track like any other minimum, the first step comes right after
 * it, and the rest of the track is decades. One formula covers the range, so
 * no seam between a linear part and a log part can show while dragging.
 */
function logScale(spec: FieldSpec): Scale {
  const { min, max, step } = spec;
  if (min > 0) {
    const span = Math.log(max / min);
    return {
      toPosition: (stored) => Math.log(stored / min) / span,
      toValue: (position) => min * Math.exp(position * span),
    };
  }
  const low = Math.asinh(min / step);
  const span = Math.asinh(max / step) - low;
  return {
    toPosition: (stored) => (Math.asinh(stored / step) - low) / span,
    toValue: (position) => step * Math.sinh(low + position * span),
  };
}

/* The value at a position of a log track. Two significant digits keep a
   dragged value readable: 1.2 billion, not 1 187 904 213. The number field
   takes anything finer. Both ends are returned as they are, since a maximum
   need not survive that rounding. */
function valueAt(spec: FieldSpec, scale: Scale, position: number): number {
  if (position <= 0) return spec.min;
  if (position >= TRACK_STEPS) return spec.max;
  let next = Number(scale.toValue(position / TRACK_STEPS).toPrecision(2));
  // On the straight part of a symlog track two digits would give fractions
  // of a step.
  if (spec.min <= 0) next = Math.round(next / spec.step) * spec.step;
  return clampToSpec(spec, tidy(next));
}

/* A position on a log track is a fixed ratio, and near the low end that
   rounds to no change at all, so an arrow key would do nothing there. The
   keys step the leading digit instead, as they do in the number field, and
   Page Up and Page Down move a decade. Home and End need no help. */
const logKeys = new Map<string, { direction: 1 | -1; coarse: boolean }>([
  ["ArrowRight", { direction: 1, coarse: false }],
  ["ArrowUp", { direction: 1, coarse: false }],
  ["ArrowLeft", { direction: -1, coarse: false }],
  ["ArrowDown", { direction: -1, coarse: false }],
  ["PageUp", { direction: 1, coarse: true }],
  ["PageDown", { direction: -1, coarse: true }],
]);

function fraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * A number field with a slider under it. Both edit the same value and share
 * the one label: the label points at the number input, and the slider is
 * named by the label's id. The error and the help text are wired to the
 * number input only, so a screen reader does not read them twice.
 *
 * A linear slider is the browser's own range over the field's minimum,
 * maximum and step, in the units on screen. A log slider runs over track
 * positions and maps them through `logScale`.
 */
export function SliderField({
  id,
  label,
  help,
  helpLabel,
  error,
  disabled,
  hideLabel,
  className,
  value,
  onChange,
  spec,
  locale,
  unitLabel,
}: SliderFieldProps) {
  const ids = fieldIds(id);
  const log = isLogField(spec);
  const scale = log ? logScale(spec) : null;

  const min = scale ? 0 : tidy(toDisplay(spec, spec.min));
  const max = scale ? TRACK_STEPS : tidy(toDisplay(spec, spec.max));
  const step = scale ? 1 : tidy(toDisplay(spec, spec.step));
  const bounded = clampToSpec(spec, value);
  const position = scale
    ? Math.round(fraction(scale.toPosition(bounded)) * TRACK_STEPS)
    : tidy(toDisplay(spec, bounded));
  const style: RangeStyle = {
    "--sim-range-fill": `${(fraction((position - min) / (max - min)) * 100).toFixed(2)}%`,
  };

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.currentTarget.valueAsNumber;
    if (Number.isNaN(raw)) return;
    const next = scale ? valueAt(spec, scale, raw) : storedFrom(spec, raw);
    if (next !== value) onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const move = scale ? logKeys.get(event.key) : undefined;
    if (!move) return;
    event.preventDefault();
    const next = stepValue(spec, value, move.direction, move.coarse);
    if (next !== value) onChange(next);
  }

  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      helpLabel={helpLabel}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      <NumberInput
        id={id}
        value={value}
        // The slider always holds a number, so the input may not be emptied.
        onChange={(next) => {
          if (next !== null) onChange(next);
        }}
        spec={{ ...spec, nullable: false }}
        locale={locale}
        unitLabel={unitLabel}
        disabled={disabled}
        invalid={Boolean(error)}
        describedBy={describedBy(error && ids.error, help && ids.help)}
      />
      <input
        type="range"
        id={`${id}-range`}
        className="sim-range"
        style={style}
        min={min}
        max={max}
        step={step}
        value={position}
        disabled={disabled}
        aria-labelledby={ids.label}
        aria-valuetext={valueText(spec, bounded, locale, unitLabel)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        // Safari does not move focus to a range that is clicked. A number
        // half typed in the input above would then stay uncommitted during
        // the drag and overwrite the dragged value on its later blur.
        onPointerDown={(event) => event.currentTarget.focus()}
      />
    </FieldShell>
  );
}
