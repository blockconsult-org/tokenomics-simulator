"use client";

import { useState, type KeyboardEvent } from "react";
import { clampToSpec, type FieldSpec } from "@/simulator/engine/fields";
import {
  formatFieldValue,
  fromDisplay,
  parseFieldInput,
  toDisplay,
  type FormatLocale,
} from "@/simulator/engine/format";
import {
  FieldShell,
  controlBoxClass,
  cx,
  describedBy,
  fieldIds,
} from "./field-shell";
import type { NumberFieldProps } from "./types";

/* -------------------------------------------------------------------------- */
/* Units                                                                      */
/* -------------------------------------------------------------------------- */

interface Unit {
  text: string;
  position: "before" | "after";
}

/**
 * The unit shown beside a number. Only the units that are symbols come from
 * the spec. A unit that is a word (months, tokens) reads differently in each
 * language, so it comes from the caller, and so does anything that replaces
 * the symbol, such as a token's ticker. A caller's label follows the number.
 */
function unitOf(spec: FieldSpec, unitLabel?: string): Unit | null {
  if (unitLabel) return { text: unitLabel, position: "after" };
  switch (spec.unit) {
    case "percent":
      return { text: "%", position: "after" };
    case "multiplier":
      return { text: "×", position: "after" };
    case "usd":
    case "usdPerToken":
      return { text: "$", position: "before" };
    default:
      return null;
  }
}

/** A stored value as a person would read it out, unit included: "12.5%",
 *  "$0.25", "24 mo". */
export function valueText(
  spec: FieldSpec,
  stored: number | null,
  locale: FormatLocale,
  unitLabel?: string,
): string {
  const text = formatFieldValue(spec, stored, locale);
  const unit = unitOf(spec, unitLabel);
  if (!unit || text === "") return text;
  if (unit.position === "before") return `${unit.text}${text}`;
  // A symbol sits against the number; a word needs the space.
  return unitLabel ? `${text} ${unit.text}` : `${text}${unit.text}`;
}

/* -------------------------------------------------------------------------- */
/* Stepping                                                                   */
/* -------------------------------------------------------------------------- */

/** Float arithmetic leaves noise in the last places (0.1 × 3). Fifteen
 *  significant digits drop it and still hold every value a field can take. */
export function tidy(value: number): number {
  return Number(value.toPrecision(15));
}

/** Whether a field steps and slides by order of magnitude. A log range that
 *  reached below zero has no leading digit to step on the way through, so it
 *  would count as linear; no spec has one. */
export function isLogField(spec: FieldSpec): boolean {
  return spec.log === true && spec.min >= 0;
}

/** Decimal exponent of a positive number's leading digit: 250 000 → 5,
 *  0.004 → −3. It is read from the number's own notation, which is exact
 *  where Math.log10 can miss by one at a power of ten. */
function leadingExponent(value: number): number {
  return Number(value.toExponential().split("e")[1]);
}

/* A linear field moves along the grid of its step, counted from the minimum
   as a native number input counts it. A value typed between two grid lines
   goes to the nearest line in the direction of travel. */
function stepLinear(
  spec: FieldSpec,
  shown: number,
  direction: 1 | -1,
  coarse: boolean,
): number {
  const step = toDisplay(spec, spec.step);
  const origin = toDisplay(spec, spec.min);
  const position = tidy((shown - origin) / step);
  const count = coarse ? 10 : 1;
  const next =
    direction > 0 ? Math.floor(position) + count : Math.ceil(position) - count;
  // The sum is rounded to the decimal places of the grid. A step that lands
  // near zero from a far-off minimum would otherwise keep the rounding error
  // of the larger numbers: −20 + 199 × 0.1 is not quite −0.1.
  const places = Math.max(decimalPlaces(step), decimalPlaces(origin));
  return Number((origin + next * step).toFixed(places));
}

/** Decimal places a number is written with: 0.25 → 2, 20 → 0. */
function decimalPlaces(value: number): number {
  const [digits = "", exponent = "0"] = tidy(value).toExponential().split("e");
  const fraction = digits.split(".")[1] ?? "";
  return Math.max(0, fraction.length - Number(exponent));
}

/* A log field moves its leading digit by one: 250 000 → 300 000 → 400 000,
   and 1 000 000 down to 900 000. A fixed step would do nothing visible at one
   end of the range and jump far too much at the other. The coarse move is a
   whole decade.

   Below the smallest positive value there is no digit left to move. That
   value is the minimum, or one step where the range starts at zero, and from
   there the field goes straight to zero and back. */
function stepLog(
  spec: FieldSpec,
  shown: number,
  direction: 1 | -1,
  coarse: boolean,
): number {
  const smallest = toDisplay(spec, spec.min > 0 ? spec.min : spec.step);
  if (shown <= 0) return direction > 0 ? smallest : 0;

  let next: number;
  if (coarse) {
    next = direction > 0 ? shown * 10 : shown / 10;
  } else {
    const exponent = leadingExponent(shown);
    // Going down from an exact power of ten, the digit below is the one that
    // moves: 1 000 → 900.
    const lower = direction < 0 && shown === Number(`1e${exponent}`);
    const unit = Number(`1e${lower ? exponent - 1 : exponent}`);
    const digit = tidy(shown / unit);
    next =
      (direction > 0 ? Math.floor(digit) + 1 : Math.ceil(digit) - 1) * unit;
  }
  return direction < 0 && next < smallest ? 0 : next;
}

/** A number in the units on screen as the value the field stores: converted,
 *  cleared of float noise (7.2% is 0.072, not 0.07200000000000001) and held
 *  within the spec. */
export function storedFrom(spec: FieldSpec, shown: number): number {
  return clampToSpec(spec, tidy(fromDisplay(spec, tidy(shown))));
}

/**
 * The value one arrow-key press away from `stored`, in stored units and
 * within the spec. `coarse` is the larger move: ten steps, or a decade on a
 * log field. An empty field starts from the spec's default.
 */
export function stepValue(
  spec: FieldSpec,
  stored: number | null,
  direction: 1 | -1,
  coarse: boolean,
): number {
  if (stored === null || !Number.isFinite(stored)) {
    return clampToSpec(spec, spec.default);
  }
  const shown = toDisplay(spec, stored);
  const next = isLogField(spec)
    ? stepLog(spec, shown, direction, coarse)
    : stepLinear(spec, shown, direction, coarse);
  return storedFrom(spec, next);
}

/* -------------------------------------------------------------------------- */
/* The input                                                                  */
/* -------------------------------------------------------------------------- */

interface NumberInputProps {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  spec: FieldSpec;
  locale: FormatLocale;
  compact?: boolean;
  placeholder?: string;
  unitLabel?: string;
  disabled?: boolean;
  invalid: boolean;
  /** Ids of the error and help text of the field around the input. */
  describedBy?: string;
}

/**
 * The number input on its own, without a label row: the box, the unit and
 * the editing rules. `NumberField` and `SliderField` put it in a field.
 *
 * It is a text input, not `type="number"`: a number input rejects grouped
 * thousands, a typed "%" and the "1.5m" short forms, and changes its value
 * when the page is scrolled with the pointer over it.
 *
 * The input shows the formatted value until the person types. From then on
 * it shows exactly what they typed, whatever happens to the value meanwhile,
 * and commits on blur or Enter. A field that has focus but has not been typed
 * in keeps following the value, so the number stays in step with a slider
 * dragged beside it.
 */
export function NumberInput({
  id,
  value,
  onChange,
  spec,
  locale,
  compact = false,
  placeholder,
  unitLabel,
  disabled = false,
  invalid,
  describedBy: described,
}: NumberInputProps) {
  // What the person has typed since the last commit, or null when nothing.
  const [draft, setDraft] = useState<string | null>(null);

  // A field disabled in the middle of an edit gets no blur event, so the
  // edit is dropped here.
  if (disabled && draft !== null) setDraft(null);

  const formatted = formatFieldValue(spec, value, locale);
  // A table cell has no room for a unit column; the header carries the unit.
  const unit = compact ? null : unitOf(spec, unitLabel);
  const unitId = fieldIds(id).unit;

  /* The stored value a typed text stands for. Undefined means the text is
     not an entry the field can take, and the field keeps what it had. */
  function read(text: string): number | null | undefined {
    if (text.trim() === "") return spec.nullable ? null : undefined;
    const parsed = parseFieldInput(spec, text, locale);
    return parsed === null ? undefined : clampToSpec(spec, tidy(parsed));
  }

  function commit(text: string) {
    // The formatted text is rounded for display. Typing it back unchanged
    // must not replace the value with its rounded form.
    if (text === formatted) return;
    const next = read(text);
    if (next !== undefined && next !== value) onChange(next);
  }

  function handleBlur() {
    if (draft !== null) commit(draft);
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (event.key === "Enter") {
      // Enter commits this field. It must not also submit a form around it.
      event.preventDefault();
      handleBlur();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    // Step from what is on screen: a typed number counts before it is
    // committed.
    const typed = draft === null ? undefined : read(draft);
    const next = stepValue(
      spec,
      typed === undefined ? value : typed,
      event.key === "ArrowUp" ? 1 : -1,
      event.shiftKey,
    );
    if (next !== value) onChange(next);
    setDraft(null);
  }

  const unitClass = cx(
    "flex max-w-1/2 shrink-0 items-center font-mono text-sm text-faint select-none",
    unit?.position === "before" ? "pl-3" : "pr-3",
  );

  return (
    <div className={controlBoxClass(compact)}>
      {unit?.position === "before" ? (
        <span id={unitId} className={unitClass}>
          {unit.text}
        </span>
      ) : null}
      <input
        id={id}
        type="text"
        // The decimal keypad of a phone has no minus key.
        inputMode={spec.min < 0 ? "text" : "decimal"}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={draft ?? formatted}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy(unit ? unitId : undefined, described)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cx(
          "min-w-0 flex-1 bg-transparent text-base text-fg tabular-nums outline-none placeholder:text-faint disabled:cursor-not-allowed",
          compact ? "py-1 md:text-sm" : "py-2 md:text-body",
          unit?.position === "before" ? "pl-1.5" : compact ? "pl-2" : "pl-3",
          unit?.position === "after" ? "pr-1.5" : compact ? "pr-2" : "pr-3",
        )}
      />
      {unit?.position === "after" ? (
        <span id={unitId} className={unitClass}>
          <span className="min-w-0 truncate">{unit.text}</span>
        </span>
      ) : null}
    </div>
  );
}

export function NumberField({
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
  compact,
  placeholder,
  unitLabel,
}: NumberFieldProps) {
  const ids = fieldIds(id);
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
        onChange={onChange}
        spec={spec}
        locale={locale}
        compact={compact}
        placeholder={placeholder}
        unitLabel={unitLabel}
        disabled={disabled}
        invalid={Boolean(error)}
        describedBy={describedBy(error && ids.error, help && ids.help)}
      />
    </FieldShell>
  );
}
