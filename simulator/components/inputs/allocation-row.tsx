"use client";

import { useEffect, useId, type RefCallback } from "react";
import { rowLabel } from "@/simulator/content";
import { LIMITS } from "@/simulator/engine/constants";
import {
  allocationFields,
  type AllocationFieldKey,
  type FieldSpec,
} from "@/simulator/engine/fields";
import { formatCompact, formatPercent } from "@/simulator/engine/format";
import { updateRow } from "@/simulator/engine/model-edit";
import {
  allocationCategories,
  type AllocationRow,
} from "@/simulator/engine/types";
import { chartColor } from "../charts/types";
import { figureClass, textButtonClass } from "../classes";
import { cx } from "../fields/field-shell";
import { Chevron } from "../fields/icons";
import { NumberField } from "../fields/number-field";
import { SelectField } from "../fields/select-field";
import { SliderField } from "../fields/slider-field";
import { TextField } from "../fields/text-field";
import { useModel } from "../store";
import { errorsAt, fieldCopy, optionsOf, unitLabel } from "./model-field";
import { ErrorLine, IssueMarker, Note, SubHeading } from "./parts";

/** The numeric fields of a row that always hold a number. Only the price
 *  paid may be empty. */
type NumericKey = Exclude<AllocationFieldKey, "purchasePriceUsd">;

/** The schedule fields that are typed, two to a line. */
const scheduleKeys = [
  "tgeUnlock",
  "cliffMonths",
  "vestingMonths",
  "vestingStepMonths",
] as const satisfies readonly NumericKey[];

interface AllocationRowItemProps {
  row: AllocationRow;
  /** Position in the list. The charts colour their series by the same
   *  position, which is what ties the swatch to them. */
  index: number;
  open: boolean;
  /** The row was added a moment ago: its name takes the focus. */
  isNew: boolean;
  onToggle: () => void;
  onRemove: () => void;
  /** Hands the expand button to the list, which moves focus to it when the
   *  row next to it is removed. */
  toggleRef: RefCallback<HTMLButtonElement>;
}

/**
 * One allocation: a line of the list, and under it the row's fields while it
 * is open.
 *
 * The line lays its cells on the columns of the list around it, so the shares
 * and the token amounts of all rows stand under each other. The expand button
 * is the last cell, and its hit area is stretched over the whole line: a
 * click anywhere on the line opens the row, while the name and the figures
 * stay plain text that a screen reader can read on its way to the button.
 */
export function AllocationRowItem({
  row,
  index,
  open,
  isNew,
  onToggle,
  onRemove,
  toggleRef,
}: AllocationRowItemProps) {
  const { locale, ui, model, issues, edit } = useModel();
  const { allocations } = ui.inputs;
  const { columns } = allocations;

  // Row ids come from the model and may hold spaces, which an element id may
  // not, so the ids of the row's elements are React's.
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const panelId = `${baseId}-panel`;
  const nameId = `${baseId}-name`;
  const lastRowNoteId = `${baseId}-last-row`;

  // A new row opens with its placeholder name selected, so the first thing
  // typed replaces it.
  useEffect(() => {
    if (!isNew) return;
    const input = document.getElementById(nameId);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }, [isNew, nameId]);

  // A row whose name was cleared is still listed and still has buttons that
  // must say which row they act on, so it goes by its type until it has a
  // name again.
  const name = rowLabel(ui, row);
  const errors = errorsAt(issues, `allocations.${row.id}`);
  const onlyRow = model.allocations.length <= 1;

  function update(patch: Partial<Omit<AllocationRow, "id">>) {
    edit((current) => updateRow(current, row.id, patch));
  }

  function numberProps(key: AllocationFieldKey) {
    const spec: FieldSpec = allocationFields[key];
    return {
      id: `${baseId}-${key}`,
      ...fieldCopy(ui, columns[key]),
      spec,
      locale,
      unitLabel: unitLabel(ui, model, spec),
    };
  }

  // A number field reports null only where its spec allows an empty input,
  // and none of these do.
  function setNumeric(key: NumericKey, value: number | null) {
    if (value !== null) update({ [key]: value });
  }

  return (
    <li className="col-span-full grid grid-cols-subgrid border-b border-line">
      <div className="group/row relative col-span-full grid min-h-11 grid-cols-subgrid items-center py-1.5">
        <span
          aria-hidden
          className="size-2.5"
          style={{ backgroundColor: chartColor(index) }}
        />
        <span className="flex min-w-0 items-center gap-2">
          <span
            id={titleId}
            className={cx(
              "min-w-0 text-sm text-fg wrap-anywhere transition-colors duration-200 ease-out group-hover/row:text-link",
              open && "font-medium",
            )}
          >
            {name}
          </span>
          {errors.length > 0 ? (
            <IssueMarker
              count={errors.length}
              label={ui.inputs.problems(errors.length)}
            />
          ) : null}
        </span>
        <span className={cx(figureClass, "text-right text-sm text-fg")}>
          <span className="sr-only">{columns.share.label} </span>
          {formatPercent(row.share, locale, 2)}
        </span>
        <span className={cx(figureClass, "text-right text-sm text-muted")}>
          <span className="sr-only">{allocations.tokens} </span>
          {formatCompact(row.share * model.token.genesisSupply, locale)}
        </span>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={allocations.editRow(name)}
          onClick={onToggle}
          className="group/toggle inline-grid h-8 w-8 cursor-pointer place-items-center text-faint transition-colors duration-200 ease-out after:absolute after:inset-0 hover:text-fg aria-expanded:text-accent"
        >
          <Chevron className="h-3 w-3 transition-transform duration-300 ease-out-quart group-aria-expanded/toggle:rotate-180" />
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          role="group"
          aria-labelledby={titleId}
          className="col-span-full flex min-w-0 flex-col gap-5 pb-6 pt-2"
        >
          {errors.map((issue) => (
            <ErrorLine key={`${issue.code}:${issue.field}`}>
              {ui.issues[issue.code]}
            </ErrorLine>
          ))}
          <TextField
            id={nameId}
            {...fieldCopy(ui, columns.name)}
            value={row.name}
            maxLength={LIMITS.MAX_NAME_LENGTH}
            onChange={(next) => update({ name: next })}
          />
          <SelectField
            id={`${baseId}-category`}
            {...fieldCopy(ui, columns.category)}
            value={row.category}
            options={optionsOf(allocationCategories, allocations.categories)}
            onChange={(category) => update({ category })}
          />
          <SliderField
            {...numberProps("share")}
            value={row.share}
            onChange={(value) => setNumeric("share", value)}
          />

          <SubHeading>{allocations.schedule}</SubHeading>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {scheduleKeys.map((key) => (
              <NumberField
                key={key}
                {...numberProps(key)}
                value={row[key]}
                onChange={(value) => setNumeric(key, value)}
              />
            ))}
          </div>
          <SliderField
            {...numberProps("sellPropensity")}
            value={row.sellPropensity}
            onChange={(value) => setNumeric("sellPropensity", value)}
          />
          <NumberField
            {...numberProps("purchasePriceUsd")}
            value={row.purchasePriceUsd}
            placeholder={allocations.noPrice}
            onChange={(purchasePriceUsd) => update({ purchasePriceUsd })}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              disabled={onlyRow}
              aria-describedby={onlyRow ? lastRowNoteId : undefined}
              onClick={onRemove}
              className={cx(textButtonClass, "text-left wrap-anywhere")}
            >
              {allocations.removeRow(name)}
            </button>
            {onlyRow ? (
              <Note id={lastRowNoteId}>{allocations.lastRow}</Note>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
