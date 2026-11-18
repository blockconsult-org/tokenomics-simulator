"use client";

import type { FieldCopy, SimulatorUi } from "@/simulator/content";
import {
  modelFields,
  type FieldSpec,
  type ModelFieldPath,
} from "@/simulator/engine/fields";
import { getNumber } from "@/simulator/engine/model-edit";
import type { Model, ModelIssue } from "@/simulator/engine/types";
import { NumberField } from "../fields/number-field";
import { SliderField } from "../fields/slider-field";
import type { Option } from "../fields/types";
import { issuesAt, useModel } from "../store";

/**
 * How a control of the form is tied to the model: where its id, wording, unit
 * and error come from. The two components at the end do this for a numeric
 * field named by its dotted path. The helpers above them serve the fields
 * that are not numbers and the rows of the allocations editor, so every
 * control in the form follows the same rules.
 */

/** Id of the control for a field of the model. A path names one field, so
 *  the id is unique on the page and the same on every render. */
export function fieldId(path: string): string {
  return `sim-${path.replaceAll(".", "-")}`;
}

/** Blocking problems at `field` or inside it. Warnings are left out: they do
 *  not stop a run, and the results list them. */
export function errorsAt(issues: ModelIssue[], field: string): ModelIssue[] {
  return issuesAt(issues, field).filter((issue) => issue.severity === "error");
}

/** The sentence for the first blocking problem at `field`, if it has one. */
export function errorMessage(
  ui: SimulatorUi,
  issues: ModelIssue[],
  field: string,
): string | undefined {
  const first = errorsAt(issues, field)[0];
  return first ? ui.issues[first.code] : undefined;
}

/** The label of a field, its help text and the name of its help button. */
export function fieldCopy(ui: SimulatorUi, copy: FieldCopy) {
  return {
    label: copy.label,
    help: copy.help,
    helpLabel: ui.inputs.helpAbout(copy.label),
  };
}

/** The unit shown beside a number. Token amounts carry the token's own
 *  symbol once it has one, so a supply reads "1,000,000 ABC". */
export function unitLabel(
  ui: SimulatorUi,
  model: Model,
  spec: FieldSpec,
): string | undefined {
  if (spec.unit === "tokens") {
    const symbol = model.token.symbol.trim();
    if (symbol !== "") return symbol;
  }
  // A plain count has an empty unit, which the controls take as none.
  return ui.inputs.units[spec.unit] || undefined;
}

/** The choices of a select or a segmented control, in the engine's order. */
export function optionsOf<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): Option<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

function useModelField(path: ModelFieldPath) {
  const { locale, ui, model, issues, setNumber } = useModel();
  const spec: FieldSpec = modelFields[path];
  return {
    id: fieldId(path),
    ...fieldCopy(ui, ui.inputs.fields[path]),
    error: errorMessage(ui, issues, path),
    spec,
    locale,
    unitLabel: unitLabel(ui, model, spec),
    value: getNumber(model, path),
    onChange: (value: number | null) => setNumber(path, value),
  };
}

interface ModelFieldProps {
  /** Dotted path of the field in the model. */
  path: ModelFieldPath;
  disabled?: boolean;
  className?: string;
}

interface ModelNumberFieldProps extends ModelFieldProps {
  /** Tighter padding and no unit, for fields that share a row. */
  compact?: boolean;
  /** Shown while a field that may be empty is empty. */
  placeholder?: string;
}

/** A number input for one numeric field of the model. */
export function ModelNumberField({
  path,
  compact,
  placeholder,
  disabled,
  className,
}: ModelNumberFieldProps) {
  const field = useModelField(path);
  return (
    <NumberField
      {...field}
      compact={compact}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}

/** A number input with a slider for one numeric field of the model. */
export function ModelSliderField({
  path,
  disabled,
  className,
}: ModelFieldProps) {
  const { value, ...field } = useModelField(path);
  return (
    <SliderField
      {...field}
      // A slider has no empty position. Only a field that may be empty can
      // hold null, and such a field belongs in a ModelNumberField.
      value={value ?? field.spec.default}
      disabled={disabled}
      className={className}
    />
  );
}
