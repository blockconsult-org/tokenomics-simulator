"use client";

import { useId, type ComponentType } from "react";
import {
  sectionIds,
  type SectionId,
  type SimulatorUi,
} from "@/simulator/content";
import { modelFields } from "@/simulator/engine/fields";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatPrice,
  formatUsd,
  type FormatLocale,
} from "@/simulator/engine/format";
import { allocationTotal } from "@/simulator/engine/model-edit";
import type { Model, ModelIssue } from "@/simulator/engine/types";
import { Section, Sections } from "../fields/section";
import { useModel } from "../store";
import { AllocationsEditor } from "./allocations-editor";
import { errorsAt, unitLabel } from "./model-field";
import {
  EmissionsInputs,
  MarketInputs,
  SimulationInputs,
  SpeculationInputs,
  StakingInputs,
  TokenInputs,
  TreasuryInputs,
  UtilityInputs,
} from "./section-bodies";

const sectionBodies: Record<SectionId, ComponentType> = {
  token: TokenInputs,
  allocations: AllocationsEditor,
  emissions: EmissionsInputs,
  staking: StakingInputs,
  utility: UtilityInputs,
  speculation: SpeculationInputs,
  market: MarketInputs,
  treasury: TreasuryInputs,
  simulation: SimulationInputs,
};

/** The parts of the model each group edits, as the first segments of the
 *  issue paths that point into them. */
const sectionFields: Record<SectionId, readonly string[]> = {
  token: ["token", "horizonMonths"],
  allocations: ["allocations"],
  emissions: ["emissions"],
  staking: ["staking"],
  utility: ["utility", "revenueSplit"],
  speculation: ["speculation"],
  market: ["market"],
  treasury: ["treasury"],
  simulation: ["monteCarlo", "outcomeMonths"],
};

/** Sits between the parts of a summary, as it does inside the allocations
 *  summary that the interface text supplies whole. */
const SUMMARY_SEPARATOR = " · ";

/** How many blocking problems sit in a group. A closed group shows nothing
 *  of its fields, so its header has to say that something inside is wrong. */
function countErrors(issues: ModelIssue[], id: SectionId): number {
  return sectionFields[id].reduce(
    (count, field) => count + errorsAt(issues, field).length,
    0,
  );
}

/**
 * One line per group for its closed header: the few values that tell one
 * model from another, in the order of the fields they come from.
 */
function sectionSummaries(
  ui: SimulatorUi,
  model: Model,
  locale: FormatLocale,
): Record<SectionId, string> {
  const { inputs } = ui;
  const { summaries } = inputs;
  const join = (...parts: string[]) => parts.join(SUMMARY_SEPARATOR);
  const percent = (fraction: number) => formatPercent(fraction, locale);
  const usd = (amount: number) => formatUsd(amount, locale);
  // Token amounts carry the unit their fields show: the symbol, or the word.
  const tokenUnit = unitLabel(ui, model, modelFields["token.genesisSupply"]);
  const tokens = (amount: number) =>
    [formatCompact(amount, locale), tokenUnit].filter(Boolean).join(" ");

  const { emissions, staking, utility, speculation, market, treasury } = model;

  return {
    token: join(
      tokens(model.token.genesisSupply),
      formatPrice(model.token.tgePriceUsd, locale),
      summaries.horizon(model.horizonMonths),
    ),
    // Four decimals, for the reason given at the total under the rows.
    allocations: summaries.allocations(
      model.allocations.length,
      formatPercent(allocationTotal(model), locale, 4),
    ),
    // Without emissions a cap limits nothing, so it is left out.
    emissions:
      emissions.mode === "none"
        ? summaries.noEmissions
        : join(
            inputs.emissionMode.options[emissions.mode],
            emissions.maxSupply === null
              ? summaries.noCap
              : tokens(emissions.maxSupply),
          ),
    staking: join(
      percent(staking.initialRatio),
      percent(staking.targetRatio),
      ui.months(staking.rampMonths),
    ),
    utility: join(
      formatCompact(utility.initialUsers, locale),
      percent(utility.monthlyGrowthRate),
      usd(utility.spendPerUserUsd),
    ),
    speculation: join(
      usd(speculation.baseInflowUsd),
      ui.toolbar.scenarios[speculation.scenario],
    ),
    market: join(percent(market.depthRatio), usd(market.minDepthUsd)),
    treasury: join(usd(treasury.startingUsd), usd(treasury.monthlyCostUsd)),
    simulation: summaries.runs(formatNumber(model.monteCarlo.runs, locale, 0)),
  };
}

/**
 * The input form: every field of the model in nine collapsible groups. The
 * first group is open on arrival and the others show a one-line summary, so
 * the whole model can be read off the closed headers before any of it is
 * changed.
 */
export function InputsPanel() {
  const { locale, ui, model, issues } = useModel();
  const headingId = useId();
  const { sections } = ui.inputs;
  const summaries = sectionSummaries(ui, model, locale);

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h2
        id={headingId}
        className="text-2xl font-semibold tracking-tight text-fg"
      >
        {ui.inputs.title}
      </h2>
      <div className="mt-4">
        <Sections defaultOpen={["token"]}>
          {sectionIds.map((id) => {
            const Body = sectionBodies[id];
            const errorCount = countErrors(issues, id);
            return (
              <Section
                key={id}
                value={id}
                title={sections[id].title}
                summary={summaries[id]}
                issues={errorCount}
                issuesLabel={ui.inputs.problems(errorCount)}
              >
                <div className="flex flex-col gap-5">
                  <p className="text-sm leading-relaxed text-muted">
                    {sections[id].intro}
                  </p>
                  <Body />
                </div>
              </Section>
            );
          })}
        </Sections>
      </div>
    </section>
  );
}
