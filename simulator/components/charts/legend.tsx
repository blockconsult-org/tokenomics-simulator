"use client";

import type { ChartText } from "./types";

/** How a series is drawn, which the legend swatch mirrors. */
export type SeriesMark = "area" | "bar" | "line" | "band";

export interface LegendItem {
  id: string;
  label: string;
  color: string;
  mark: SeriesMark;
  dashed?: boolean;
}

/**
 * The key beside a series name: a stroke for a line, a block for an area or
 * a bar, and a tinted block with an outline for a shaded range. The shape
 * says what to look for in the plot before the colour does.
 */
export function LegendSwatch({
  color,
  mark,
  dashed,
}: Pick<LegendItem, "color" | "mark" | "dashed">) {
  return (
    <svg
      className="sim-chart-swatch"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      {mark === "line" ? (
        <line
          x1="0"
          x2="12"
          y1="6"
          y2="6"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? "4 2" : undefined}
        />
      ) : mark === "band" ? (
        <rect
          x="1.5"
          y="1.5"
          width="9"
          height="9"
          fill={color}
          fillOpacity="0.3"
          stroke={color}
        />
      ) : (
        <rect x="1" y="1" width="10" height="10" fill={color} />
      )}
    </svg>
  );
}

interface ChartLegendProps {
  /** Names the list, so a screen-reader user knows which chart the buttons
   *  belong to. */
  label: string;
  items: readonly LegendItem[];
  hidden: ReadonlySet<string>;
  text: Pick<ChartText, "showSeries">;
  onToggle: (id: string) => void;
}

/**
 * The series of a chart as toggle buttons. A pressed button is a series that
 * is shown. A hidden one keeps its place and its colour, struck through, so
 * the colours of the others never move. The button's name does not change
 * with its state: a name that flipped as well would be read as "Hide Team,
 * pressed", which says the opposite of what a press does.
 */
export function ChartLegend({
  label,
  items,
  hidden,
  text,
  onToggle,
}: ChartLegendProps) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label={label}>
      {items.map((item) => {
        const shown = !hidden.has(item.id);
        return (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              className="sim-chart-toggle"
              aria-pressed={shown}
              aria-label={text.showSeries(item.label)}
              onClick={() => onToggle(item.id)}
            >
              <LegendSwatch
                color={item.color}
                mark={item.mark}
                dashed={item.dashed}
              />
              <span className="sim-chart-toggle-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
