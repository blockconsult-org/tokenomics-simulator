"use client";

import { useId, useRef, useState } from "react";
import { formatPercent } from "@/simulator/engine/format";
import {
  addRow,
  allocationTotal,
  canAddRow,
  removeRow,
} from "@/simulator/engine/model-edit";
import type { AllocationRow } from "@/simulator/engine/types";
import { buttonClass, figureClass } from "../classes";
import { cx } from "../fields/field-shell";
import { useModel } from "../store";
import { AllocationRowItem } from "./allocation-row";
import { ErrorLine, Note } from "./parts";

/** The row whose fields are showing. */
interface OpenRow {
  id: string;
  /** It was opened by adding it, not by its expand button. */
  isNew: boolean;
}

/**
 * The allocations as a list: one line per row, with the fields of one row at
 * a time open under its line. A table of ten columns does not fit the side
 * column the form sits in, and a row has more fields than a line can hold.
 *
 * The list is a grid of five columns: swatch, name, share, tokens and the
 * expand button. The captions, every row and the total lay their cells on
 * those columns, so the figure columns are as wide as their widest figure in
 * either language and the name takes what is left.
 *
 * Which row is open is kept here by row id. It is the form's business, not
 * the model's, and it starts over when the group is closed and opened again.
 */
export function AllocationsEditor() {
  const { locale, ui, model, issues, edit } = useModel();
  const { allocations } = ui.inputs;
  const [open, setOpen] = useState<OpenRow | null>(null);
  // The expand button of every row, by row id.
  const toggles = useRef(new Map<string, HTMLButtonElement>());
  const rowLimitNoteId = useId();

  const rows = model.allocations;
  // Four decimals, so a total of 99.9999% is not shown as the 100% it fails
  // to be.
  const total = formatPercent(allocationTotal(model), locale, 4);
  const groupErrors = issues.filter(
    (issue) => issue.severity === "error" && issue.field === "allocations",
  );
  const atLimit = !canAddRow(model);

  function handleToggle(id: string) {
    setOpen((current) => (current?.id === id ? null : { id, isNew: false }));
  }

  function handleAdd() {
    if (atLimit) return;
    // The new row's id is made inside addRow, so it is read from a trial run
    // on the model this render shows, which is the one the edit will meet.
    const added = addRow(model, allocations.newRowName).allocations.at(-1);
    edit((current) => addRow(current, allocations.newRowName));
    if (added) setOpen({ id: added.id, isNew: true });
  }

  function handleRemove(id: string) {
    // The remove button goes away with its row. Focus moves to the row after
    // it first, or to the one before the last row, so a keyboard user is not
    // sent back to the top of the page.
    const index = rows.findIndex((row) => row.id === id);
    const neighbour: AllocationRow | undefined =
      rows[index + 1] ?? rows[index - 1];
    if (neighbour) toggles.current.get(neighbour.id)?.focus();
    setOpen(null);
    edit((current) => removeRow(current, id));
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] gap-x-3">
        {/* The captions are for the eye. A screen reader gets the same words
            inside each row, next to the figure they name. */}
        <div
          aria-hidden
          className="label-mono col-span-full grid grid-cols-subgrid pb-2 text-micro"
        >
          <span className="col-start-2">{allocations.columns.name.label}</span>
          <span className="text-right">{allocations.columns.share.label}</span>
          <span className="text-right">{allocations.tokens}</span>
        </div>

        {/* The role is stated because some screen readers drop it from a list
            that is drawn without markers. */}
        <ul
          role="list"
          className="col-span-full grid grid-cols-subgrid border-t border-line"
        >
          {rows.map((row, index) => (
            <AllocationRowItem
              key={row.id}
              row={row}
              index={index}
              open={open?.id === row.id}
              isNew={open?.id === row.id && open.isNew}
              onToggle={() => handleToggle(row.id)}
              onRemove={() => handleRemove(row.id)}
              toggleRef={(button) => {
                if (!button) return;
                const buttons = toggles.current;
                buttons.set(row.id, button);
                return () => {
                  buttons.delete(row.id);
                };
              }}
            />
          ))}
        </ul>

        <p className="col-span-full grid grid-cols-subgrid items-baseline pt-3 text-sm">
          <span className="col-start-2 text-muted">{allocations.total}</span>
          <span className={cx(figureClass, "text-right text-fg")}>{total}</span>
        </p>
      </div>

      {groupErrors.length > 0 ? (
        <div className="flex flex-col gap-2">
          {groupErrors.map((issue) => (
            <ErrorLine
              key={issue.code}
              running={issue.code === "allocations_sum"}
            >
              {issue.code === "allocations_sum"
                ? allocations.totalOff(total)
                : ui.issues[issue.code]}
            </ErrorLine>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={atLimit}
          aria-describedby={atLimit ? rowLimitNoteId : undefined}
          onClick={handleAdd}
          className={buttonClass}
        >
          {allocations.addRow}
        </button>
        {atLimit ? (
          <Note id={rowLimitNoteId}>{allocations.rowLimit}</Note>
        ) : null}
      </div>
    </div>
  );
}
