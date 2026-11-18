import { LIMITS } from "./constants";
import {
  allocationFields,
  clampToSpec,
  modelFields,
  outcomeMonthField,
  type FieldSpec,
  type ModelFieldPath,
} from "./fields";
import type { AllocationRow, Model } from "./types";

/**
 * Edits to a model, as pure functions that return a new model. The form
 * calls these; nothing here knows about React.
 */

type Bag = Record<string, unknown>;

/** Read the numeric field at a dotted path. */
export function getNumber(model: Model, path: ModelFieldPath): number | null {
  let node: unknown = model;
  for (const key of path.split(".")) node = (node as Bag)[key];
  return typeof node === "number" ? node : null;
}

function clampNullable(spec: FieldSpec, value: number | null): number | null {
  if (value == null) return spec.nullable ? null : spec.default;
  return clampToSpec(spec, value);
}

/** Set the numeric field at a dotted path, clamped to its range. */
export function setNumber(
  model: Model,
  path: ModelFieldPath,
  value: number | null,
): Model {
  const keys = path.split(".");
  const root: Bag = { ...(model as unknown as Bag) };
  let node = root;
  for (const key of keys.slice(0, -1)) {
    const child: Bag = { ...(node[key] as Bag) };
    node[key] = child;
    node = child;
  }
  node[keys[keys.length - 1]] = clampNullable(modelFields[path], value);
  return root as unknown as Model;
}

/** Change fields of one allocation row. Numeric fields are clamped. */
export function updateRow(
  model: Model,
  id: string,
  patch: Partial<Omit<AllocationRow, "id">>,
): Model {
  const clean: Bag = { ...patch };
  for (const [key, spec] of Object.entries(allocationFields)) {
    if (!(key in patch)) continue;
    const value = clean[key];
    clean[key] = clampNullable(spec, typeof value === "number" ? value : null);
  }
  if (typeof patch.name === "string") {
    clean.name = patch.name.slice(0, LIMITS.MAX_NAME_LENGTH);
  }
  return {
    ...model,
    allocations: model.allocations.map((row) =>
      row.id === id ? ({ ...row, ...clean } as AllocationRow) : row,
    ),
  };
}

/** Sum of the allocation shares. */
export function allocationTotal(model: Model): number {
  return model.allocations.reduce((sum, row) => sum + row.share, 0);
}

export function canAddRow(model: Model): boolean {
  return model.allocations.length < LIMITS.MAX_ALLOCATION_ROWS;
}

/**
 * Append a community row that takes whatever share is still unassigned, so
 * that adding a row to a model short of 100% completes it.
 */
export function addRow(model: Model, name: string): Model {
  if (!canAddRow(model)) return model;
  const taken = new Set(model.allocations.map((row) => row.id));
  let n = model.allocations.length + 1;
  while (taken.has(`row_${n}`)) n += 1;
  const remaining = Math.max(0, 1 - allocationTotal(model));
  const row: AllocationRow = {
    id: `row_${n}`,
    name: name.slice(0, LIMITS.MAX_NAME_LENGTH),
    category: "community",
    // Float noise from the subtraction must not show up as 9.999999%.
    share: Math.round(remaining * 1e6) / 1e6,
    tgeUnlock: allocationFields.tgeUnlock.default,
    cliffMonths: allocationFields.cliffMonths.default,
    vestingMonths: 12,
    vestingStepMonths: allocationFields.vestingStepMonths.default,
    sellPropensity: allocationFields.sellPropensity.default,
    purchasePriceUsd: null,
  };
  return { ...model, allocations: [...model.allocations, row] };
}

/** Remove a row. The last row stays: a model needs one. */
export function removeRow(model: Model, id: string): Model {
  if (model.allocations.length <= 1) return model;
  return {
    ...model,
    allocations: model.allocations.filter((row) => row.id !== id),
  };
}

/** Give the rows of a preset their names in the page's language. */
export function nameRows(model: Model, names: Record<string, string>): Model {
  return {
    ...model,
    allocations: model.allocations.map((row) =>
      names[row.id] ? { ...row, name: names[row.id] } : row,
    ),
  };
}

/**
 * Parse the outcome months a person typed ("12, 24, 36"). Returns null when
 * the text is not one to four distinct whole months in range.
 */
export function parseOutcomeMonths(text: string): number[] | null {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > LIMITS.MAX_OUTCOME_MONTHS) return null;
  const months: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const month = Number(part);
    if (month < outcomeMonthField.min || month > outcomeMonthField.max) return null;
    if (months.includes(month)) return null;
    months.push(month);
  }
  return months.sort((a, b) => a - b);
}
