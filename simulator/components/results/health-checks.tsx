"use client";

import { useId } from "react";
import type { SimulatorUi } from "@/simulator/content";
import {
  EMPTY,
  formatNumber,
  formatPercent,
  orEmpty,
  type FormatLocale,
} from "@/simulator/engine/format";
import { monteCarloHealthCheck } from "@/simulator/engine/health-checks";
import type {
  HealthCheck,
  HealthCheckId,
  HealthStatus,
  Kpis,
  SimulationResult,
} from "@/simulator/engine/types";
import { figureClass, panelIntroClass, panelTitleClass } from "../classes";
import { Help } from "../fields/help";
import { useResults, type MonteCarloState } from "../store";

/** What a check found, ready to show. */
interface Finding {
  text: string;
  /** The text is a figure and takes the figure font. A sentence does not. */
  figure: boolean;
  /** Words after a figure on the same line, such as "in month 13". */
  suffix?: string;
  /** A further sentence under the value. */
  note?: string;
}

interface Row extends Finding {
  id: HealthCheckId;
  status: HealthStatus;
  /** Where the status changes. Absent while the check has not run. */
  thresholds?: string;
}

/** Whether a check's thresholds are shares, shown as percentages, or whole
 *  numbers of months. */
const thresholdUnits = {
  insider_share: "share",
  low_float: "share",
  unlock_shock: "share",
  net_inflation: "share",
  runway: "months",
  treasury_token_dependence: "share",
  structural_demand: "share",
  model_range: "months",
  treasury_exhaustion_probability: "share",
} as const satisfies Record<HealthCheckId, "share" | "months">;

function finding(
  check: HealthCheck,
  kpis: Kpis,
  ui: SimulatorUi,
  locale: FormatLocale,
): Finding {
  const copy = ui.results.health;
  const { value, month } = check;
  // A check with nothing to measure has no value, and shows the empty mark.
  const share: Finding =
    value === null
      ? { text: EMPTY, figure: true }
      : { text: formatPercent(value, locale), figure: true };

  switch (check.id) {
    case "unlock_shock":
      return value !== null && month !== null
        ? { ...share, suffix: ui.results.inMonth(month) }
        : share;
    case "net_inflation":
      return kpis.burnToEmissionLast12 === null
        ? share
        : {
            ...share,
            note: copy.burnedOfEmitted(
              formatPercent(kpis.burnToEmissionLast12, locale),
            ),
          };
    case "runway":
      // Without costs there is no runway to grade. With costs, a missing
      // month means the reserves outlast the run.
      if (check.status === "na") {
        return { text: ui.results.kpis.noCost, figure: false };
      }
      return {
        text:
          month === null ? copy.neverExhausted : copy.exhaustedIn(month),
        figure: false,
      };
    case "model_range":
      return value === null
        ? { text: EMPTY, figure: true }
        : { text: copy.monthsFlagged(value), figure: false };
    default:
      return share;
  }
}

/**
 * The line that says where a check turns to watch and to risk. The percent
 * formatter drops a trailing zero, so 20% stays short and a third still
 * reads 33.3%. The check on model limits has no risk level: its risk
 * threshold is infinite and its wording uses neither number.
 */
function thresholdsLine(
  check: HealthCheck,
  ui: SimulatorUi,
  locale: FormatLocale,
): string {
  const format =
    thresholdUnits[check.id] === "share"
      ? (value: number) => formatPercent(value, locale)
      : (value: number) => formatNumber(value, locale, 0);
  return ui.results.health.checks[check.id].thresholds(
    orEmpty(check.watchAt, format),
    orEmpty(check.riskAt, format),
  );
}

/**
 * Every check that has run. The ninth needs the Monte Carlo job and is
 * missing until its first batch is in.
 */
export function checksOf(
  result: SimulationResult,
  monteCarlo: MonteCarloState,
): HealthCheck[] {
  return monteCarlo.result
    ? [...result.healthChecks, monteCarloHealthCheck(monteCarlo.result)]
    : result.healthChecks;
}

/** How many of the checks stand at one status. */
export function countStatus(
  checks: readonly { status: HealthStatus }[],
  status: HealthStatus,
): number {
  return checks.filter((check) => check.status === status).length;
}

/**
 * The rule-based checks of the run, one row each, set like the rows of a
 * table: the status, what was checked and where its status changes, and the
 * value found. Where the results column is narrow, on a phone and beside the
 * inputs on a small laptop, the value moves under the title, beside the
 * status.
 *
 * A status is a word with a mark of its own shape (`.sim-status`), so it
 * does not depend on colour. The long explanation of a check sits behind
 * the same "?" button as every other explanation on the page, which keeps
 * the nine rows short enough to compare at a glance.
 *
 * Until the first batch of the Monte Carlo job is in, the ninth row says
 * that it is waiting.
 */
export function HealthChecks() {
  const { locale, ui, result, monteCarlo } = useResults();
  const titleId = useId();
  const copy = ui.results.health;

  const rows: Row[] = checksOf(result, monteCarlo).map((check) => ({
    id: check.id,
    status: check.status,
    thresholds: thresholdsLine(check, ui, locale),
    ...finding(check, result.kpis, ui, locale),
  }));
  if (!monteCarlo.result) {
    rows.push({
      id: "treasury_exhaustion_probability",
      status: "na",
      text: copy.pending,
      figure: false,
    });
  }

  return (
    <section aria-labelledby={titleId} className="@container min-w-0">
      <h3 id={titleId} className={panelTitleClass}>
        {copy.title}
      </h3>
      <p className={panelIntroClass}>{copy.intro}</p>
      <p className="mt-4 text-sm font-medium text-fg">
        {copy.summary(countStatus(rows, "risk"), countStatus(rows, "watch"))}
      </p>
      <ul className="mt-3 border-t border-line">
        {rows.map((row) => {
          const { title, detail } = copy.checks[row.id];
          return (
            <li
              key={row.id}
              className="sim-print-keep grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-6 gap-y-2 border-b border-line py-3.5 @xl:grid-cols-[8.5rem_minmax(0,1fr)_auto]"
            >
              {/* As tall as the title beside it, so the two share a line. */}
              <span
                data-status={row.status}
                className="sim-status min-h-6 text-sm font-medium"
              >
                {copy.status[row.status]}
              </span>
              <div className="order-first col-span-2 min-w-0 @xl:order-none @xl:col-span-1">
                <div className="flex min-h-6 items-start gap-2">
                  <h4 className="min-w-0 text-body leading-6 font-medium wrap-anywhere text-fg">
                    {title}
                  </h4>
                  <Help label={ui.inputs.helpAbout(title)}>{detail}</Help>
                </div>
                {row.thresholds ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-faint">
                    {row.thresholds}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 text-right @xl:max-w-56">
                <p className="text-body leading-6 wrap-anywhere text-fg">
                  {row.figure ? (
                    <span className={`${figureClass} font-medium`}>
                      {row.text}
                    </span>
                  ) : (
                    row.text
                  )}
                  {row.suffix ? (
                    <span className="text-muted"> {row.suffix}</span>
                  ) : null}
                </p>
                {row.note ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    {row.note}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
