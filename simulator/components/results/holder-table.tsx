"use client";

import { useId, useState } from "react";
import { rowLabel } from "@/simulator/content";
import {
  EMPTY,
  formatCompact,
  formatMultiple,
  formatUsd,
  orEmpty,
} from "@/simulator/engine/format";
import type { AllocationOutcome } from "@/simulator/engine/types";
import { figureClass, panelIntroClass, panelTitleClass } from "../classes";
import { Segmented } from "../fields/segmented";
import { useResults } from "../store";

/* A table header does not inherit the page's alignment and weight, so both
   are set here. */
const headClass =
  "label-mono border-b border-line-strong px-3 py-2.5 align-bottom text-micro font-normal print:px-1.5";
const cellClass = "border-b border-line px-3 py-2.5 align-top print:px-1.5";
const numberClass = `${figureClass} text-right whitespace-nowrap`;

/* The month picker shares its width equally between its options. Capping it
   at 7rem an option keeps a single month from stretching across the panel. */
const pickerWidths = ["max-w-28", "max-w-56", "max-w-84", "max-w-112"];

/**
 * What each allocation holds and what it is worth at one of the months the
 * model asks about.
 *
 * The four value columns belong to the chosen month. Every row reports the
 * same months, so the first row supplies the list. The choice is kept as a
 * position in that list: when an edit shortens the list past it, the table
 * shows the first month again.
 *
 * With the month columns the table is wider than a phone, so it scrolls
 * inside its own box. The box takes keyboard focus, or the arrow keys could
 * not reach the columns that are out of view.
 */
export function HolderTable() {
  const { locale, ui, model, result } = useResults();
  const titleId = useId();
  const captionId = useId();
  const pickerId = useId();
  const [choice, setChoice] = useState(0);
  const copy = ui.results.holders;

  const outcomes = result.allocationOutcomes;
  const months = outcomes[0]?.atMonths.map((entry) => entry.month) ?? [];
  const hasMonths = months.length > 0;
  const chosen = choice < months.length ? choice : 0;

  const names = new Map(
    model.allocations.map((row) => [row.id, rowLabel(ui, row)]),
  );
  const usd = (value: number) => formatUsd(value, locale);
  const multiple = (value: number) => formatMultiple(value, locale);

  return (
    <section aria-labelledby={titleId} className="sim-print-keep min-w-0">
      <h3 id={titleId} className={panelTitleClass}>
        {copy.title}
      </h3>
      <p className={panelIntroClass}>{copy.intro}</p>

      {hasMonths ? (
        <Segmented
          id={pickerId}
          label={copy.monthSelect}
          value={String(chosen)}
          options={months.map((month, index) => ({
            value: String(index),
            label: ui.results.month(month),
          }))}
          onChange={(value) => setChoice(Number(value))}
          className={`mt-5 ${pickerWidths[Math.min(months.length, pickerWidths.length) - 1]}`}
        />
      ) : null}

      {/* Positioned, so the hidden caption stays inside the scroll box. */}
      <div
        role="group"
        aria-labelledby={titleId}
        tabIndex={0}
        className="sim-scroll-x relative mt-5 focus-visible:-outline-offset-2"
      >
        <table
          aria-labelledby={hasMonths ? `${titleId} ${captionId}` : titleId}
          className={`w-full border-collapse text-sm print:text-xs ${hasMonths ? "min-w-2xl print:min-w-0" : ""}`}
        >
          {hasMonths ? (
            <caption id={captionId} className="sr-only">
              {ui.results.month(months[chosen])}
            </caption>
          ) : null}
          <thead>
            <tr>
              <th scope="col" className={`${headClass} text-left`}>
                {copy.group}
              </th>
              <th scope="col" className={`${headClass} text-right`}>
                {copy.tokens}
              </th>
              <th scope="col" className={`${headClass} text-right`}>
                {copy.costBasis}
              </th>
              {hasMonths ? (
                <>
                  <th scope="col" className={`${headClass} text-right`}>
                    {copy.unlockedValue}
                  </th>
                  <th scope="col" className={`${headClass} text-right`}>
                    {copy.lockedValue}
                  </th>
                  <th scope="col" className={`${headClass} text-right`}>
                    {copy.paperMultiple}
                  </th>
                  <th scope="col" className={`${headClass} text-right`}>
                    {copy.liquidMultiple}
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {outcomes.map((outcome) => {
              const at: AllocationOutcome["atMonths"][number] | undefined =
                outcome.atMonths[chosen];
              return (
                <tr key={outcome.id}>
                  <th
                    scope="row"
                    className={`${cellClass} min-w-36 text-left font-normal wrap-anywhere text-fg`}
                  >
                    {names.get(outcome.id) ?? EMPTY}
                  </th>
                  <td className={`${cellClass} ${numberClass}`}>
                    {formatCompact(outcome.tokens, locale)}
                  </td>
                  <td className={`${cellClass} ${numberClass}`}>
                    {orEmpty(outcome.costBasisUsd, usd)}
                  </td>
                  {hasMonths ? (
                    <>
                      <td className={`${cellClass} ${numberClass}`}>
                        {orEmpty(at?.unlockedValueUsd, usd)}
                      </td>
                      <td className={`${cellClass} ${numberClass}`}>
                        {orEmpty(at?.lockedValueUsd, usd)}
                      </td>
                      <td className={`${cellClass} ${numberClass}`}>
                        {orEmpty(at?.paperMultiple, multiple)}
                      </td>
                      <td className={`${cellClass} ${numberClass}`}>
                        {orEmpty(at?.liquidMultiple, multiple)}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
