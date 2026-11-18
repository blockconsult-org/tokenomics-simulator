import { runDeterministic } from "./core";
import { computeHealthChecks } from "./health-checks";
import { computeKpis } from "./kpis";
import { computeOutcomes } from "./outcomes";
import type { Model, SimulationFailure, SimulationResult } from "./types";
import { validateModel } from "./validate";

/**
 * Run the deterministic simulation for a model.
 *
 * A model with a blocking problem is not run and not repaired: the caller
 * gets the error codes and shows them next to the inputs they point at.
 * Warnings travel with a successful result.
 */
export function simulate(model: Model): SimulationResult | SimulationFailure {
  const issues = validateModel(model);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) return { ok: false, errors };

  const core = runDeterministic(model);
  const kpis = computeKpis(model, core);
  return {
    ok: true,
    months: core.months,
    series: core.series,
    allocations: core.allocations,
    kpis,
    allocationOutcomes: computeOutcomes(model, core),
    healthChecks: computeHealthChecks(model, core, kpis),
    warnings: issues.filter((issue) => issue.severity === "warning"),
    flags: core.flags,
  };
}
