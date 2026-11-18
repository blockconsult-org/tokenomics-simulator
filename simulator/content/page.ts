import type { FormatLocale } from "@/simulator/engine/format";
import { pageDe } from "./page.de";
import { pageEn } from "./page.en";

/** Shape of the page copy around the simulator. English defines it. */
export type SimulatorPage = typeof pageEn;

const pages: Record<FormatLocale, SimulatorPage> = { en: pageEn, de: pageDe };

export function getSimulatorPage(locale: FormatLocale): SimulatorPage {
  return pages[locale];
}
