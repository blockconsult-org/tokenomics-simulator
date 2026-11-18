"use client";

import { Fragment, useLayoutEffect, useRef } from "react";
import { clamp } from "./scales";

export interface TooltipRow {
  id: string;
  label: string;
  /** Already formatted. */
  value: string;
  color: string;
  dashed?: boolean;
}

interface ChartTooltipProps {
  heading: string;
  /** Labels of the markers that fall on this x position. */
  notes: readonly string[];
  rows: readonly TooltipRow[];
  total: { label: string; value: string } | null;
  /** Pixel x of the crosshair, and how far to stand off from it. */
  anchor: number;
  offset: number;
  /** Preferred pixel y of the top edge. */
  top: number;
  /** Size of the frame the tooltip must stay inside. */
  width: number;
  height: number;
}

/**
 * The readout for one x position: every series, value first.
 *
 * It is hidden from assistive technology, which gets the same text from the
 * chart's live region, and it ignores the pointer, so it never takes the
 * hover away from the plot under it.
 *
 * Its size depends on the text, so it is placed after it has rendered: to
 * the right of the crosshair, to the left when that would leave the frame,
 * and over the crosshair only when neither side has room. The position is
 * written straight to the element. That runs before the browser paints and
 * costs no second render.
 */
export function ChartTooltip({
  heading,
  notes,
  rows,
  total,
  anchor,
  offset,
  top,
  width,
  height,
}: ChartTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const own = element.offsetWidth;
    const right = anchor + offset;
    const left = anchor - offset - own;
    const x =
      right + own <= width
        ? right
        : left >= 0
          ? left
          : clamp(anchor - own / 2, 0, Math.max(0, width - own));
    const y = clamp(top, 0, Math.max(0, height - element.offsetHeight));
    element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    element.style.visibility = "visible";
  });

  return (
    <div
      ref={ref}
      className="sim-chart-tooltip"
      style={{ maxWidth: width }}
      aria-hidden="true"
    >
      <p className="tracking-wider text-faint uppercase">{heading}</p>
      {notes.map((note) => (
        <p key={note} className="text-faint">
          {note}
        </p>
      ))}
      <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
        {rows.map((row) => (
          <Fragment key={row.id}>
            {/* A short stroke, not a block: at this size a block reads as
                data. */}
            <svg width="10" height="8" viewBox="0 0 10 8" focusable="false">
              <line
                x1="0"
                x2="10"
                y1="4"
                y2="4"
                stroke={row.color}
                strokeWidth="2"
                strokeDasharray={row.dashed ? "3 2" : undefined}
              />
            </svg>
            <span className="truncate">{row.label}</span>
            <span className="text-right text-fg tabular-nums">{row.value}</span>
          </Fragment>
        ))}
        {total ? (
          <>
            <span className="col-span-3 my-1 border-t border-line" />
            <span />
            <span className="truncate">{total.label}</span>
            <span className="text-right text-fg tabular-nums">{total.value}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
