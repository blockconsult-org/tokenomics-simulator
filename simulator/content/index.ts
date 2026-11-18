import type { FormatLocale } from "@/simulator/engine/format";
import type { AllocationRow } from "@/simulator/engine/types";
import { de } from "./ui.de";
import { en } from "./ui.en";

export type {
  ChartTabId,
  ChoiceCopy,
  FieldCopy,
  KpiId,
  SectionId,
} from "./ui.en";
export { chartTabIds, kpiIds, sectionIds } from "./ui.en";

/** Shape of the simulator's interface text. English defines it. */
export type SimulatorUi = typeof en;

const ui: Record<FormatLocale, SimulatorUi> = { en, de };

export function getSimulatorUi(locale: FormatLocale): SimulatorUi {
  return ui[locale];
}

/**
 * What an allocation row goes by on the page. A row whose name was cleared
 * goes by its type, so the charts, the tables and the buttons that act on it
 * still have something to call it.
 */
export function rowLabel(
  ui: SimulatorUi,
  row: Pick<AllocationRow, "name" | "category">,
): string {
  return row.name.trim() || ui.inputs.allocations.categories[row.category];
}
