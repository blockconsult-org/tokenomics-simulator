"use client";

import type { KeyboardEvent } from "react";
import actions from "../actions/actions.module.css";
import { FieldShell, describedBy, fieldIds } from "./field-shell";
import type { SegmentedProps } from "./types";

/**
 * A row of joined buttons of which one is chosen: a radio group.
 *
 * The buttons carry the radio roles themselves, so the element a person sees
 * and presses is the one that takes focus and reports the choice. The group
 * is one tab stop, on the chosen option. The arrow keys move the choice with
 * the focus and wrap at the ends, and Home and End go to the first and the
 * last option.
 *
 * The chosen option takes the look of the active filter on the article list:
 * the raised fill and the foreground text, here with an accent rule under
 * it. Forced-colours modes replace every fill, so there the choice is shown
 * in the system's highlight colours.
 *
 * The options share the width equally and a long label wraps inside its
 * button, so a row of four still fits a phone.
 */
export function Segmented<T extends string>({
  id,
  label,
  help,
  helpLabel,
  error,
  disabled,
  hideLabel,
  className,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  const ids = fieldIds(id);
  // With a value that matches no option, the first one takes the tab stop.
  const tabStop = options.some((o) => o.value === value)
    ? value
    : options[0]?.value;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const from = radios.findIndex((radio) => radio === document.activeElement);
    const last = options.length - 1;
    let to: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        to = from >= last ? 0 : from + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        to = from <= 0 ? last : from - 1;
        break;
      case "Home":
        to = 0;
        break;
      case "End":
        to = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const option = options[to];
    if (!option) return;
    radios[to]?.focus();
    if (option.value !== value) onChange(option.value);
  }

  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      helpLabel={helpLabel}
      error={error}
      hideLabel={hideLabel}
      group
      className={className}
    >
      <div
        id={id}
        role="radiogroup"
        aria-labelledby={ids.label}
        aria-describedby={describedBy(error && ids.error, help && ids.help)}
        aria-invalid={error ? true : undefined}
        aria-disabled={disabled ? true : undefined}
        onKeyDown={handleKeyDown}
        className={actions.segments}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={option.value === tabStop ? 0 : -1}
              disabled={disabled}
              onClick={() => {
                if (!checked) onChange(option.value);
              }}
              // The focused button is raised so that its ring is drawn over
              // the buttons beside it.
              className={actions.tab}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
