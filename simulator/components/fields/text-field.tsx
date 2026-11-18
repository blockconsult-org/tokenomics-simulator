"use client";

import { FieldShell, controlClass, describedBy, fieldIds } from "./field-shell";
import type { TextFieldProps } from "./types";

/** A one-line text input for a short name, such as an allocation's label.
 *  Autocomplete and spell checking are off: the entries are names of the
 *  person's own making, and a browser's suggestions for them are noise. */
export function TextField({
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
  maxLength,
  placeholder,
  compact,
}: TextFieldProps) {
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
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error && ids.error, help && ids.help)}
        onChange={(event) => onChange(event.target.value)}
        className={controlClass(compact)}
      />
    </FieldShell>
  );
}
