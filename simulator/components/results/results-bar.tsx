"use client";

import { useEffect, useState } from "react";
import { Chevron } from "../fields/icons";
import { useResults } from "../store";
import { checksOf, countStatus } from "./health-checks";
import { runTiles } from "./kpi-tiles";

const cellClass = "grid min-w-0 gap-0.5";
const labelClass = "truncate text-xs text-muted";
const valueClass = "truncate text-sm font-semibold text-fg tabular-nums";

/**
 * Where the results sit under the inputs, they are out of sight while
 * someone edits. This bar stays at the bottom of the window for that time
 * with three figures of the run, and a press on it goes to the results. It
 * leaves once the results are in the window, or above it.
 *
 * `targetId` is the id of the results. The caller hides the bar on screens
 * that show inputs and results side by side.
 */
export function ResultsBar({ targetId }: { targetId: string }) {
  const { locale, ui, model, result, monteCarlo } = useResults();
  const [below, setBelow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0);
      },
      // The bar covers the foot of the window, so the results count as in
      // view only once they show above it.
      { rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (!below) return null;

  const copy = ui.results;
  const tiles = runTiles(model, result, ui, locale);
  const checks = checksOf(result, monteCarlo);
  const flagged = (["risk", "watch"] as const)
    .map((status) => ({ status, count: countStatus(checks, status) }))
    .filter(({ count }) => count > 0);

  return (
    <a
      href={`#${targetId}`}
      className="pointer-events-auto grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-x-4 border-t border-line-strong bg-elevated px-6 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] transition-[opacity,transform] duration-200 ease-out-quart md:px-8 starting:translate-y-full starting:opacity-0"
    >
      <span className="sr-only">{ui.toolbar.skipToResults}. </span>
      <span className={cellClass}>
        <span className={labelClass}>{copy.bar.price}</span>
        <span className={valueClass}>{tiles.priceAtHorizon.figure}</span>
      </span>
      <span className={cellClass}>
        <span className={labelClass}>{copy.bar.unlock}</span>
        <span className={valueClass}>{tiles.largestUnlock.figure}</span>
      </span>
      <span className={cellClass}>
        <span className={labelClass}>{copy.bar.checks}</span>
        <span className="flex gap-3 text-sm font-semibold tabular-nums">
          {flagged.length === 0 ? (
            <span className="sim-status" data-status="pass">
              {copy.health.status.pass}
            </span>
          ) : (
            flagged.map(({ status, count }) => (
              <span key={status} className="sim-status" data-status={status}>
                <span className="sr-only">{copy.health.status[status]}</span>
                {count}
              </span>
            ))
          )}
        </span>
      </span>
      <Chevron className="h-3 w-3 text-faint" />
    </a>
  );
}
