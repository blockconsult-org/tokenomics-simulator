"use client";

import { FieldError, cx, describedBy, fieldIds } from "./field-shell";
import { HelpPopover } from "./help";
import type { ToggleProps } from "./types";

/**
 * An on/off switch: a native checkbox that reports itself as a switch, so a
 * screen reader says "on" and "off" instead of "ticked", and Space works as
 * on any checkbox.
 *
 * The label sits beside the switch, not above it, and wraps the input, which
 * makes the whole 44px row the target. The help button stays outside the
 * label, where pressing it does not flip the switch. With `hideLabel` the
 * row is the switch alone and the help text is left to the screen reader.
 */
export function Toggle({
  id,
  label,
  help,
  helpLabel,
  error,
  disabled,
  hideLabel = false,
  className,
  checked,
  onChange,
}: ToggleProps) {
  const ids = fieldIds(id);
  return (
    <div className={cx("min-w-0", className)}>
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 has-[:disabled]:cursor-not-allowed"
        >
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={checked}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(
              error && ids.error,
              help && ids.help,
            )}
            onChange={(event) => onChange(event.target.checked)}
            className="sim-switch"
          />
          <span className={hideLabel ? "sr-only" : "text-sm text-muted"}>
            {label}
          </span>
        </label>
        {help && !hideLabel ? (
          <HelpPopover id={ids.help} label={helpLabel ?? label}>
            {help}
          </HelpPopover>
        ) : null}
      </div>
      {help && hideLabel ? (
        <span id={ids.help} hidden>
          {help}
        </span>
      ) : null}
      <FieldError id={ids.error} error={error} quiet={hideLabel} />
    </div>
  );
}
