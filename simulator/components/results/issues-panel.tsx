"use client";

import { rowLabel, type SimulatorUi } from "@/simulator/content";
import type { Model, ModelIssue } from "@/simulator/engine/types";
import { panelTitleClass } from "../classes";
import { useModel } from "../store";

/**
 * The sentence shown for an issue. One that points at a field of an
 * allocation row ("allocations.<row id>.<key>") is prefixed with the row's
 * name, because the message alone does not say which row it means. Row ids
 * hold no dots, so the path always splits into exactly three parts. A row
 * without a name goes by its type, as it does everywhere else on the page.
 */
function issueText(issue: ModelIssue, model: Model, ui: SimulatorUi): string {
  const message = ui.issues[issue.code];
  const path = issue.field.split(".");
  if (path.length !== 3 || path[0] !== "allocations") return message;
  const row = model.allocations.find((candidate) => candidate.id === path[1]);
  return row ? ui.results.issueForRow(rowLabel(ui, row), message) : message;
}

function IssueList({
  issues,
  className,
}: {
  issues: ModelIssue[];
  className: string;
}) {
  const { ui, model } = useModel();
  return (
    <ul
      className={`mt-3 list-[square] space-y-1.5 pl-5 text-sm leading-relaxed marker:text-faint ${className}`}
    >
      {issues.map((issue) => (
        // A code can repeat across rows and a field can carry two codes, but
        // the pair is unique.
        <li key={`${issue.code}:${issue.field}`} className="wrap-anywhere">
          {issueText(issue, model, ui)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Problems with the current inputs, above the results.
 *
 * Errors block the run, so their panel is an alert: a screen reader announces
 * it when it appears and again when its list changes. Warnings travel with a
 * valid result and stay quiet. The site has no error colour, so the alert is
 * set apart the way an invalid field is, by a stronger border.
 *
 * `stale` says that the figures below still show an earlier, valid run.
 */
export function IssuesPanel({ stale }: { stale: boolean }) {
  const { ui, issues } = useModel();
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="grid min-w-0 gap-3">
      {errors.length > 0 ? (
        <div
          role="alert"
          className="min-w-0 border border-fg/60 bg-elevated p-4 sm:p-5"
        >
          <h3 className={panelTitleClass}>{ui.results.invalidTitle}</h3>
          <IssueList issues={errors} className="text-fg" />
          {stale ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {ui.results.invalidStale}
            </p>
          ) : null}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="min-w-0 border border-line p-4 sm:p-5">
          <h3 className={panelTitleClass}>{ui.results.warningsTitle}</h3>
          <IssueList issues={warnings} className="text-muted" />
        </div>
      ) : null}
    </div>
  );
}
