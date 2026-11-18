"use client";

import { useId, useMemo, useState } from "react";
import { LegendSwatch } from "./legend";
import { arcPath, clamp, isNumber, pieAngles, round2 } from "./scales";
import type { DonutChartProps } from "./types";
import { GLYPH } from "./use-plot";

const DEFAULT_SIZE = 200;
/** Clear width between two slices. The surface shows through it, which
 *  separates the slices without an outline. */
const SLICE_GAP = 2;
const DIMMED = 0.35;
/** Size of the label type in drawing units, and its advance per glyph with
 *  the letter-spacing of .sim-chart-label. */
const LABEL_SIZE = 11;
const LABEL_LETTER = LABEL_SIZE * (GLYPH + 0.06);
/** Rough advance per glyph of the sans figures, in ems. */
const FIGURE_LETTER = 0.62;
/** Height of a capital in ems, near enough for both faces. */
const CAP = 0.72;

/** Cuts a label to the room it has, marking the cut. */
function fitLabel(label: string, room: number): string {
  const most = Math.max(1, Math.floor(room / LABEL_LETTER));
  return label.length <= most
    ? label
    : `${label.slice(0, Math.max(1, most - 1))}…`;
}

/**
 * A ring of shares with a list beside it that gives every share its name
 * and value, so nothing has to be read off an angle or matched by colour.
 * Pointing at a slice or at its row dims the others and shows that share in
 * the hole. The same values are always in the list, so the pointer adds
 * nothing a keyboard or screen-reader user is missing.
 */
export function DonutChart({
  title,
  description,
  slices,
  formatValue,
  centerLabel,
  centerValue,
  size = DEFAULT_SIZE,
  className,
}: DonutChartProps) {
  const id = useId();
  const [active, setActive] = useState<string | null>(null);

  const diameter = isNumber(size) && size > 0 ? size : DEFAULT_SIZE;
  const radius = diameter / 2;
  const thickness = clamp(Math.round(diameter * 0.14), 10, 32);
  const inner = Math.max(0, radius - thickness);

  const arcs = useMemo(() => {
    const angles = pieAngles(slices.map((slice) => slice.value));
    return slices.flatMap((slice, i) => {
      const span = angles[i];
      return span
        ? [
            {
              id: slice.id,
              color: slice.color,
              d: arcPath(radius, radius, radius, inner, span[0], span[1], SLICE_GAP),
            },
          ]
        : [];
    });
  }, [slices, radius, inner]);

  const focused = slices.find((slice) => slice.id === active) ?? null;
  const room = Math.max(0, inner * 2 - 16);
  const label = fitLabel(focused ? focused.label : (centerLabel ?? ""), room);
  const figure = !focused
    ? (centerValue ?? "")
    : isNumber(focused.value)
      ? formatValue(focused.value)
      : "";
  const figureSize = round2(
    Math.min(
      clamp(diameter * 0.11, 14, 28),
      room / (Math.max(1, figure.length) * FIGURE_LETTER),
    ),
  );

  // The two lines are centred on the hole as one block.
  const labelHeight = label === "" ? 0 : LABEL_SIZE * CAP;
  const figureHeight = figure === "" ? 0 : figureSize * CAP;
  const between = label !== "" && figure !== "" ? 7 : 0;
  const blockTop = radius - (labelHeight + between + figureHeight) / 2;
  const descriptionId = `${id}-description`;

  return (
    <div className={className ? `sim-chart ${className}` : "sim-chart"}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <svg
          className="block h-auto max-w-full shrink-0"
          data-chart-plot=""
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
          role="img"
          aria-label={title}
          aria-describedby={description ? descriptionId : undefined}
          focusable="false"
        >
          {arcs.length === 0 ? (
            <circle
              className="sim-chart-track"
              cx={radius}
              cy={radius}
              r={radius - thickness / 2}
              strokeWidth={thickness}
            />
          ) : (
            arcs.map((arc) => (
              <path
                key={arc.id}
                className="sim-chart-slice"
                d={arc.d}
                fill={arc.color}
                style={{
                  opacity: active !== null && active !== arc.id ? DIMMED : 1,
                }}
                onPointerEnter={() => setActive(arc.id)}
                onPointerLeave={() => setActive(null)}
              />
            ))
          )}
          {label === "" ? null : (
            <text
              className="sim-chart-label"
              x={radius}
              y={round2(blockTop + labelHeight)}
              textAnchor="middle"
            >
              {label}
            </text>
          )}
          {figure === "" || room === 0 ? null : (
            <text
              className="sim-chart-figure"
              x={radius}
              y={round2(blockTop + labelHeight + between + figureHeight)}
              fontSize={figureSize}
              textAnchor="middle"
            >
              {figure}
            </text>
          )}
        </svg>
        {/* The width is capped so a value stays within reach of its name. */}
        <ul
          className="sim-chart-key max-w-72 min-w-40 flex-1 space-y-1.5"
          aria-label={title}
        >
          {slices.map((slice) => (
            <li
              key={slice.id}
              className="flex items-center gap-2"
              onPointerEnter={() => setActive(slice.id)}
              onPointerLeave={() => setActive(null)}
            >
              <LegendSwatch color={slice.color} mark="bar" />
              <span className="min-w-0 flex-1">{slice.label}</span>
              {isNumber(slice.value) ? (
                <span className="text-fg tabular-nums">
                  {formatValue(slice.value)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      {description ? (
        <p id={descriptionId} hidden>
          {description}
        </p>
      ) : null}
    </div>
  );
}
