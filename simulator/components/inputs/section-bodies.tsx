"use client";

import { LIMITS } from "@/simulator/engine/constants";
import { formatPercent } from "@/simulator/engine/format";
import {
  capBases,
  decayModes,
  emissionModes,
  scenarios,
  type Model,
} from "@/simulator/engine/types";
import { Segmented } from "../fields/segmented";
import { TextField } from "../fields/text-field";
import { Toggle } from "../fields/toggle";
import { useModel } from "../store";
import {
  ModelNumberField,
  ModelSliderField,
  fieldCopy,
  fieldId,
  optionsOf,
} from "./model-field";
import { OutcomeMonthsField } from "./outcome-months-field";
import { ErrorLine, Note, SubHeading } from "./parts";

/**
 * The fields of each input group, in the order the form shows them. A body
 * returns its fields side by side in a fragment; the panel stacks them and
 * puts the group's introduction on top.
 *
 * A slider goes with the percentages and the ranges a person explores by
 * dragging. A value that is typed once and left alone gets the number field
 * on its own.
 */

/** The groups of the model that hold a field which is not a number. */
type PatchableGroup = "token" | "emissions" | "speculation" | "treasury";

/** Changes the fields of one group that are not numbers: a name, a choice, a
 *  switch. Numbers go through `setNumber`, which clamps them to their range. */
function useGroupPatch<K extends PatchableGroup>(group: K) {
  const { edit } = useModel();
  return (patch: Partial<Model[K]>) =>
    edit((model) => ({ ...model, [group]: { ...model[group], ...patch } }));
}

export function TokenInputs() {
  const { ui, model } = useModel();
  const patch = useGroupPatch("token");
  const { inputs } = ui;

  return (
    <>
      {/* The symbol is at most ten characters, so it takes the narrow side. */}
      <div className="grid grid-cols-5 gap-3">
        <TextField
          id={fieldId("token.name")}
          {...fieldCopy(ui, inputs.tokenName)}
          className="col-span-3"
          value={model.token.name}
          maxLength={LIMITS.MAX_TOKEN_NAME_LENGTH}
          placeholder={inputs.tokenNamePlaceholder}
          onChange={(name) => patch({ name })}
        />
        <TextField
          id={fieldId("token.symbol")}
          {...fieldCopy(ui, inputs.tokenSymbol)}
          className="col-span-2"
          value={model.token.symbol}
          maxLength={LIMITS.MAX_TOKEN_SYMBOL_LENGTH}
          onChange={(symbol) => patch({ symbol })}
        />
      </div>
      <ModelSliderField path="token.genesisSupply" />
      <ModelSliderField path="token.tgePriceUsd" />
      <ModelSliderField path="horizonMonths" />
    </>
  );
}

/**
 * Only the fields of the chosen emission model are shown, so the group never
 * holds a control that does nothing. The maximum supply is the exception: it
 * stays, because a cap below genesis supply is a blocking problem whatever
 * the emission model, and the person needs the field to clear it.
 */
export function EmissionsInputs() {
  const { ui, model } = useModel();
  const patch = useGroupPatch("emissions");
  const { inputs } = ui;
  const { emissions } = model;
  const emitting = emissions.mode !== "none";

  return (
    <>
      <Segmented
        id={fieldId("emissions.mode")}
        {...fieldCopy(ui, inputs.emissionMode)}
        value={emissions.mode}
        options={optionsOf(emissionModes, inputs.emissionMode.options)}
        onChange={(mode) => patch({ mode })}
      />
      {emissions.mode === "inflation" ? (
        <ModelSliderField path="emissions.annualInflationRate" />
      ) : null}
      {emissions.mode === "fixed" ? (
        <>
          <ModelSliderField path="emissions.tokensPerMonth" />
          <Segmented
            id={fieldId("emissions.decay")}
            {...fieldCopy(ui, inputs.decay)}
            value={emissions.decay}
            options={optionsOf(decayModes, inputs.decay.options)}
            onChange={(decay) => patch({ decay })}
          />
          {emissions.decay === "halving" ? (
            <ModelSliderField path="emissions.halvingEveryMonths" />
          ) : null}
          {emissions.decay === "annual" ? (
            <ModelSliderField path="emissions.annualDecayRate" />
          ) : null}
        </>
      ) : null}
      <ModelNumberField
        path="emissions.maxSupply"
        placeholder={inputs.maxSupplyPlaceholder}
      />
      {emitting && emissions.maxSupply !== null ? (
        <Segmented
          id={fieldId("emissions.capBasis")}
          {...fieldCopy(ui, inputs.capBasis)}
          value={emissions.capBasis}
          options={optionsOf(capBases, inputs.capBasis.options)}
          onChange={(capBasis) => patch({ capBasis })}
        />
      ) : null}
      {emitting ? (
        <>
          <ModelSliderField path="emissions.sellRate" />
          <ModelSliderField path="emissions.toStakersShare" />
        </>
      ) : null}
    </>
  );
}

export function StakingInputs() {
  return (
    <>
      <ModelSliderField path="staking.initialRatio" />
      <ModelSliderField path="staking.targetRatio" />
      <ModelSliderField path="staking.rampMonths" />
    </>
  );
}

export function UtilityInputs() {
  const { locale, ui, model, issues } = useModel();
  const { burnShare, treasuryShare, stakerShare } = model.revenueSplit;
  // The engine decides when the split is too large, with a little slack for
  // float noise, so the form asks it and does not repeat the sum check.
  const overOne = issues.some(
    (issue) => issue.code === "revenue_split_over_one",
  );
  const remainder = Math.max(0, 1 - (burnShare + treasuryShare + stakerShare));

  return (
    <>
      <ModelSliderField path="utility.initialUsers" />
      <ModelSliderField path="utility.saturationUsers" />
      <ModelSliderField path="utility.monthlyGrowthRate" />
      <ModelSliderField path="utility.spendPerUserUsd" />
      <ModelSliderField path="utility.holdingMonths" />
      <SubHeading>{ui.inputs.revenueSplitTitle}</SubHeading>
      <ModelSliderField path="revenueSplit.burnShare" />
      <ModelSliderField path="revenueSplit.treasuryShare" />
      <ModelSliderField path="revenueSplit.stakerShare" />
      {overOne ? (
        <ErrorLine>{ui.issues.revenue_split_over_one}</ErrorLine>
      ) : (
        <Note>
          {ui.inputs.revenueRemainder(formatPercent(remainder, locale))}
        </Note>
      )}
    </>
  );
}

export function SpeculationInputs() {
  const { ui, model } = useModel();
  const patch = useGroupPatch("speculation");

  return (
    <>
      <ModelSliderField path="speculation.baseInflowUsd" />
      <ModelSliderField path="speculation.monthlyGrowth" />
      <Segmented
        id={fieldId("speculation.scenario")}
        {...fieldCopy(ui, ui.inputs.scenario)}
        value={model.speculation.scenario}
        options={optionsOf(scenarios, ui.toolbar.scenarios)}
        onChange={(scenario) => patch({ scenario })}
      />
      {/* One multiplier under each scenario of the control above. A third of
          a phone is narrower than a long one-word label with its help button
          beside it, so here a label may break inside a word, and the inputs
          line up along the bottom when one label wraps and the next does
          not. */}
      <div className="grid grid-cols-3 items-end gap-2 [&_label]:min-w-0 [&_label]:wrap-anywhere [&_label]:hyphens-auto">
        {scenarios.map((scenario) => (
          <ModelNumberField
            key={scenario}
            path={`speculation.scenarioMultipliers.${scenario}`}
            compact
          />
        ))}
      </div>
      <ModelSliderField path="speculation.momentum" />
    </>
  );
}

export function MarketInputs() {
  return (
    <>
      <ModelSliderField path="market.depthRatio" />
      <ModelNumberField path="market.minDepthUsd" />
      <ModelSliderField path="market.holderSellRate" />
    </>
  );
}

export function TreasuryInputs() {
  const { ui, model } = useModel();
  const patch = useGroupPatch("treasury");
  const { sellTokens } = model.treasury;

  return (
    <>
      <ModelSliderField path="treasury.startingUsd" />
      <ModelSliderField path="treasury.monthlyCostUsd" />
      <ModelSliderField path="treasury.annualCostGrowth" />
      <Toggle
        id={fieldId("treasury.sellTokens")}
        {...fieldCopy(ui, ui.inputs.sellTokens)}
        checked={sellTokens}
        onChange={(next) => patch({ sellTokens: next })}
      />
      {/* The two rules of a sale stay in view while the switch is off, so the
          person can see what switching it on would bring into play. */}
      <ModelSliderField path="treasury.bufferMonths" disabled={!sellTokens} />
      <ModelSliderField
        path="treasury.maxMonthlySaleShare"
        disabled={!sellTokens}
      />
    </>
  );
}

export function SimulationInputs() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <ModelNumberField path="monteCarlo.runs" />
        <ModelNumberField path="monteCarlo.seed" />
      </div>
      <ModelSliderField path="monteCarlo.marketVolatility" />
      <ModelSliderField path="monteCarlo.growthVolatility" />
      <ModelSliderField path="monteCarlo.sellPropensityVolatility" />
      <OutcomeMonthsField />
    </>
  );
}
