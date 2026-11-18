import { ENGINE } from "./constants";
import { impliedRaiseUsd } from "./kpis";
import type { IssueCode, Model, ModelIssue } from "./types";
import { vestedFraction } from "./vesting";

/**
 * Slack on "the revenue split must not exceed 1". Three shares typed as
 * percentages can add up to a few ulps over 1, which is not a mistake the
 * user made.
 */
const REVENUE_SPLIT_TOLERANCE = 1e-9;

/**
 * Check a model for problems the engine will not repair.
 *
 * Errors block the run; warnings travel with the result. Issues come out in
 * the order of `issueCodes`, errors first, and within a code in row order.
 * The model is expected to have been through normaliseModel, so ranges and
 * types are not checked again here.
 */
export function validateModel(model: Model): ModelIssue[] {
  const issues: ModelIssue[] = [];
  const report = (
    severity: ModelIssue["severity"],
    code: IssueCode,
    field: string,
  ) => {
    issues.push({ code, severity, field });
  };

  const rows = model.allocations;
  let shareSum = 0;
  // Share of genesis supply that circulates at month 0. Read from the vesting
  // schedule, not from tgeUnlock, because a row with no cliff and no vesting
  // unlocks in full at TGE whatever its TGE share says. Treasury rows unlock
  // into the treasury, not into circulation.
  let tgeFloatShare = 0;
  for (const row of rows) {
    shareSum += row.share;
    if (row.category !== "treasury") {
      tgeFloatShare += row.share * vestedFraction(row, 0);
    }
  }

  if (rows.length === 0) {
    // The sum and float errors would only repeat this one.
    report("error", "allocations_empty", "allocations");
  } else {
    // Written as a negated "within tolerance" so a NaN sum is an error too.
    if (!(Math.abs(shareSum - 1) <= ENGINE.ALLOCATION_SUM_TOLERANCE)) {
      report("error", "allocations_sum", "allocations");
    }

    const seen = new Set<string>();
    const duplicated = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) duplicated.add(row.id);
      seen.add(row.id);
    }
    for (const id of duplicated) {
      report("error", "duplicate_id", `allocations.${id}.id`);
    }

    if (!(tgeFloatShare > 0)) {
      report("error", "no_initial_float", "allocations");
    }
  }

  const { burnShare, treasuryShare, stakerShare } = model.revenueSplit;
  if (burnShare + treasuryShare + stakerShare > 1 + REVENUE_SPLIT_TOLERANCE) {
    report("error", "revenue_split_over_one", "revenueSplit");
  }

  const { maxSupply } = model.emissions;
  if (maxSupply !== null && maxSupply < model.token.genesisSupply) {
    report("error", "max_supply_below_genesis", "emissions.maxSupply");
  }

  for (const row of rows) {
    if (row.category === "treasury" && row.sellPropensity > 0) {
      report(
        "warning",
        "treasury_row_propensity_ignored",
        `allocations.${row.id}.sellPropensity`,
      );
    }
  }

  for (const row of rows) {
    if (row.cliffMonths === 0 && row.vestingMonths === 0 && row.tgeUnlock < 1) {
      report(
        "warning",
        "row_fully_unlocked_at_tge",
        `allocations.${row.id}.tgeUnlock`,
      );
    }
  }

  // Without a single round price there is no raise to compare against.
  if (
    rows.some((row) => row.purchasePriceUsd !== null) &&
    model.treasury.startingUsd > impliedRaiseUsd(model)
  ) {
    report(
      "warning",
      "starting_usd_exceeds_implied_raise",
      "treasury.startingUsd",
    );
  }

  // The engine starts such a model at the ceiling. A model read from a link
  // or a file never gets here, because normaliseModel lowers the figure; one
  // being typed in does, and the form leaves the figure as it was typed.
  if (model.utility.initialUsers > model.utility.saturationUsers) {
    report("warning", "initial_users_above_ceiling", "utility.initialUsers");
  }

  // Momentum feeds last month's return back into this month's inflow. Month 1
  // gives the size of that loop: an inflow F through a pool of depth D moves
  // price by roughly 2F/D, and momentum multiplies the next inflow by that
  // return. At a product of 1 or more a move can sustain itself.
  const { speculation, market, token } = model;
  const tgeCirculating =
    shareSum > 0 ? (token.genesisSupply * tgeFloatShare) / shareSum : 0;
  const firstDepthUsd = Math.max(
    market.minDepthUsd,
    market.depthRatio * tgeCirculating * token.tgePriceUsd,
  );
  const firstInflowUsd =
    speculation.baseInflowUsd *
    speculation.scenarioMultipliers[speculation.scenario];
  const momentumGain =
    speculation.momentum * Math.min(1, (2 * firstInflowUsd) / firstDepthUsd);
  if (momentumGain >= 1) {
    report("warning", "momentum_gain_high", "speculation.momentum");
  }

  return issues;
}
