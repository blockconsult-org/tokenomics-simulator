"use client";

import { rowLabel, sectionIds, type SectionId } from "@/simulator/content";
import {
  allocationFields,
  modelFields,
  type AllocationFieldKey,
  type FieldSpec,
  type ModelFieldPath,
} from "@/simulator/engine/fields";
import { EMPTY, formatFieldValue } from "@/simulator/engine/format";
import { getNumber } from "@/simulator/engine/model-edit";
import { useModel } from "./store";

/** Which group of the form a field of the model belongs to. */
function sectionOf(path: ModelFieldPath): SectionId {
  const head = path.split(".")[0];
  switch (head) {
    case "horizonMonths":
    case "token":
      return "token";
    case "revenueSplit":
      return "utility";
    case "monteCarlo":
      return "simulation";
    case "emissions":
    case "staking":
    case "utility":
    case "speculation":
    case "market":
    case "treasury":
      return head;
    default:
      return "simulation";
  }
}

const paths = Object.keys(modelFields) as ModelFieldPath[];
const rowKeys = Object.keys(allocationFields) as AllocationFieldKey[];

const cellClass = "border-b border-line py-1 pr-3 align-top";
const figureCellClass = `${cellClass} text-right font-mono whitespace-nowrap tabular-nums`;

/**
 * The inputs behind a printed report, as plain tables. Hidden on screen,
 * where the form shows the same values. A report without its assumptions
 * would pass a scenario off as a result.
 */
export function PrintInputs() {
  const { ui, locale, model } = useModel();
  const copy = ui.inputs;
  const tokenUnit = model.token.symbol || copy.units.tokens;

  const shown = (spec: FieldSpec, value: number | null) => {
    if (value == null) return EMPTY;
    const unit = spec.unit === "tokens" ? tokenUnit : copy.units[spec.unit];
    const text = formatFieldValue(spec, value, locale);
    return unit ? `${text} ${unit}` : text;
  };

  /** Choices and switches, which the table of numeric fields does not hold. */
  const choices: Record<SectionId, [string, string][]> = {
    token: [
      [copy.tokenName.label, model.token.name || EMPTY],
      [copy.tokenSymbol.label, model.token.symbol || EMPTY],
    ],
    allocations: [],
    emissions: [
      [copy.emissionMode.label, copy.emissionMode.options[model.emissions.mode]],
      [copy.decay.label, copy.decay.options[model.emissions.decay]],
      [copy.capBasis.label, copy.capBasis.options[model.emissions.capBasis]],
    ],
    staking: [],
    utility: [],
    speculation: [
      [copy.scenario.label, ui.toolbar.scenarios[model.speculation.scenario]],
    ],
    market: [],
    treasury: [
      [copy.sellTokens.label, model.treasury.sellTokens ? "☑" : "☐"],
    ],
    simulation: [
      [copy.outcomeMonths.label, model.outcomeMonths.join(", ") || EMPTY],
    ],
  };

  return (
    <div className="sim-print-break hidden text-xs text-fg print:block">
      <p className="text-lg font-semibold tracking-tight">{ui.print.inputs}</p>

      <p className="mt-5 font-semibold">{copy.sections.allocations.title}</p>
      <table className="mt-2 w-full border-collapse text-left">
        <thead>
          <tr>
            <th scope="col" className={cellClass}>
              {copy.allocations.columns.name.label}
            </th>
            <th scope="col" className={cellClass}>
              {copy.allocations.columns.category.label}
            </th>
            {rowKeys.map((key) => (
              <th key={key} scope="col" className={`${cellClass} text-right`}>
                {copy.allocations.columns[key].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.allocations.map((row) => (
            <tr key={row.id}>
              <th scope="row" className={`${cellClass} font-normal`}>
                {rowLabel(ui, row)}
              </th>
              <td className={cellClass}>
                {copy.allocations.categories[row.category]}
              </td>
              {rowKeys.map((key) => (
                <td key={key} className={figureCellClass}>
                  {shown(allocationFields[key], row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 columns-2 gap-8">
        {sectionIds
          .filter((id) => id !== "allocations")
          .map((id) => (
            <div key={id} className="sim-print-keep mb-4">
              <p className="font-semibold">{copy.sections[id].title}</p>
              <table className="mt-1 w-full border-collapse text-left">
                <tbody>
                  {choices[id].map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row" className={`${cellClass} font-normal`}>
                        {label}
                      </th>
                      <td className={`${cellClass} text-right`}>{value}</td>
                    </tr>
                  ))}
                  {paths
                    .filter((path) => sectionOf(path) === id)
                    .map((path) => (
                      <tr key={path}>
                        <th scope="row" className={`${cellClass} font-normal`}>
                          {copy.fields[path].label}
                        </th>
                        <td className={figureCellClass}>
                          {shown(modelFields[path], getNumber(model, path))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
