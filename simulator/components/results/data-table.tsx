"use client";

import { memo, useDeferredValue, useId, useState } from "react";
import type { SimulatorUi } from "@/simulator/content";
import { formatNumber, type FormatLocale } from "@/simulator/engine/format";
import type { SimulationResult } from "@/simulator/engine/types";
import {
  buttonClass,
  figureClass,
  panelIntroClass,
  panelTitleClass,
  textButtonClass,
} from "../classes";
import { downloadText, fileStem } from "../download";
import { useResults } from "../store";
import {
  formatMonthlyValue,
  monthlyColumns,
  monthlyCsv,
} from "./monthly-columns";

/* The header row and the month column stay in place while the rest scrolls
   under them. Their fills are opaque, or the cells passing underneath would
   show through. Borders sit on the cells, and the table keeps them separate,
   because a collapsed border belongs to the table and does not travel with a
   pinned cell. */
const headClass =
  "label-mono sticky top-0 border-b border-line border-b-line-strong bg-elevated px-3 py-2.5 align-bottom text-micro font-normal";
const monthClass =
  "sticky left-0 z-10 border-r border-b border-line bg-surface px-3 py-2 text-left font-normal text-muted";
const cellClass =
  "border-b border-line px-3 py-2 text-right whitespace-nowrap text-fg";

interface MonthlyTableProps {
  result: SimulationResult;
  ui: SimulatorUi;
  locale: FormatLocale;
  /** Id of the heading that names the table. */
  labelledBy: string;
}

/**
 * The table itself: one row per month, one column per series, close to three
 * thousand cells on a ten-year run. It is memoised on the result, so it is
 * built again only when the run changes and not on every tick of the Monte
 * Carlo progress, which reaches the panel through the same context.
 *
 * Each header label sits in a box of fixed width. That gives every column
 * the same minimum, lets a long label wrap, and still leaves a column free
 * to grow when one of its values needs more room.
 */
const MonthlyTable = memo(function MonthlyTable({
  result,
  ui,
  locale,
  labelledBy,
}: MonthlyTableProps) {
  const columns = monthlyColumns(result, ui);
  return (
    <table
      aria-labelledby={labelledBy}
      className={`${figureClass} border-separate border-spacing-0 text-sm`}
    >
      <thead>
        <tr>
          {/* The corner cell is pinned both ways and lies over both. */}
          <th scope="col" className={`${headClass} left-0 z-30 border-r text-left`}>
            <span className="block w-12">{ui.results.table.columns.month}</span>
          </th>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={`${headClass} z-20 text-right`}
            >
              <span className="ml-auto block w-24">{column.label}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.months.map((month, index) => (
          <tr key={month}>
            <th scope="row" className={monthClass}>
              {formatNumber(month, locale, 0)}
            </th>
            {columns.map((column) => (
              <td key={column.key} className={cellClass}>
                {formatMonthlyValue(column.kind, column.values[index], locale)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

/**
 * Every monthly series as a table, and the same data as a CSV file.
 *
 * The table is closed at first and its rows exist only while it is open.
 * While it is open, it follows the inputs one step behind: the result goes
 * through useDeferredValue, so React paints a slider's own movement first
 * and rebuilds the rows afterwards, and it drops a rebuild that a newer
 * result has overtaken. The download always uses the current result.
 *
 * The scroll box takes keyboard focus, so the arrow keys can move through
 * the table without a mouse.
 */
export function DataTable() {
  const { locale, ui, model, result } = useResults();
  const titleId = useId();
  const regionId = useId();
  const [open, setOpen] = useState(false);
  const deferredResult = useDeferredValue(result);
  const copy = ui.results.table;

  return (
    <section aria-labelledby={titleId} className="min-w-0 print:hidden">
      <h3 id={titleId} className={panelTitleClass}>
        {copy.title}
      </h3>
      <p className={panelIntroClass}>{copy.intro}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((value) => !value)}
          className={buttonClass}
        >
          {open ? copy.hide : copy.show}
        </button>
        <button
          type="button"
          onClick={() =>
            downloadText(
              monthlyCsv(result, ui),
              `${fileStem(model)}.csv`,
              "text/csv",
            )
          }
          className={textButtonClass}
        >
          {copy.download}
        </button>
      </div>

      {/* Stays in the page while closed, so the button always has something
          to point at. */}
      <div id={regionId}>
        {open ? (
          <div
            role="group"
            aria-labelledby={titleId}
            tabIndex={0}
            className="mt-5 max-h-112 overflow-auto overscroll-x-contain border border-line bg-surface focus-visible:-outline-offset-2"
          >
            <MonthlyTable
              result={deferredResult}
              ui={ui}
              locale={locale}
              labelledBy={titleId}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
