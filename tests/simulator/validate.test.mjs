// validateModel: every blocking error and every warning on the smallest model that triggers it.
import test from "node:test";
import assert from "node:assert/strict";
import { getPreset, presetIds } from "@/simulator/engine/presets";
import { simulate } from "@/simulator/engine/simulate";
import { issueCodes } from "@/simulator/engine/types";
import { validateModel } from "@/simulator/engine/validate";
import { assertClose, fixtureModel, row } from "./derived-fixtures.mjs";

const codes = (model) => validateModel(model).map((issue) => issue.code);
const errors = (model) => validateModel(model).filter((issue) => issue.severity === "error");
const withShares = (first, second) =>
  fixtureModel({ allocations: [row({ id: "a", share: first, tgeUnlock: 1 }), row({ id: "b", share: second, tgeUnlock: 1 })] });

test("the quiet base model and every preset are free of blocking errors", () => {
  assert.deepEqual(validateModel(fixtureModel()), []);
  for (const id of presetIds) assert.deepEqual(errors(getPreset(id)), [], id);
});

test("allocation shares must sum to 1 within 1e-6", () => {
  assert.deepEqual(validateModel(withShares(0.5, 0.49)), [{ code: "allocations_sum", severity: "error", field: "allocations" }]);
  assert.deepEqual(validateModel(withShares(0.5, 0.5 + 5e-7)), []);
  assert.deepEqual(codes(withShares(0.5, 0.5 + 2e-6)), ["allocations_sum"]);
});

test("shares inside the tolerance run, and the rows still add up to genesis supply", () => {
  const result = simulate(withShares(0.5, 0.5 + 5e-7));
  assert.equal(result.ok, true);
  assertClose(result.allocations.reduce((total, allocation) => total + allocation.tokens, 0), 1_000_000, "row tokens");
  assertClose(result.series.circulating[0], 1_000_000, "circulating at launch");
});

test("a cliff past the horizon runs and reports the supply still locked", () => {
  const model = fixtureModel({
    horizonMonths: 60,
    allocations: [
      row({ id: "public", share: 0.8, tgeUnlock: 1 }),
      row({ id: "team", category: "team", share: 0.2, cliffMonths: 80, vestingMonths: 12 }),
    ],
  });
  const result = simulate(model);
  assert.equal(result.ok, true);
  assertClose(result.kpis.lockedAtHorizonShare, 0.2, "locked at the horizon");
  assertClose(result.series.locked[60], 200_000, "locked tokens");
});

test("an empty allocation table is one error, not three", () => {
  assert.deepEqual(validateModel(fixtureModel({ allocations: [] })), [{ code: "allocations_empty", severity: "error", field: "allocations" }]);
});

test("a repeated row id is reported once per id", () => {
  const model = fixtureModel({
    allocations: [row({ id: "a", share: 0.5, tgeUnlock: 1 }), row({ id: "a", share: 0.25, tgeUnlock: 1 }), row({ id: "a", share: 0.25, tgeUnlock: 1 })],
  });

  assert.deepEqual(validateModel(model), [{ code: "duplicate_id", severity: "error", field: "allocations.a.id" }]);
});

test("a model needs non-treasury tokens in circulation at TGE", () => {
  const onlyTreasury = fixtureModel({ allocations: [row({ id: "dao", category: "treasury", tgeUnlock: 1 })] });
  assert.deepEqual(validateModel(onlyTreasury), [{ code: "no_initial_float", severity: "error", field: "allocations" }]);

  const allCliffed = fixtureModel({ allocations: [row({ id: "team", category: "team", cliffMonths: 12, vestingMonths: 12 })] });
  assert.deepEqual(codes(allCliffed), ["no_initial_float"]);
});

test("the revenue split may reach 1 and not pass it", () => {
  assert.deepEqual(validateModel(fixtureModel({ revenueSplit: { burnShare: 0.5, treasuryShare: 0.3, stakerShare: 0.3 } })), [
    { code: "revenue_split_over_one", severity: "error", field: "revenueSplit" },
  ]);
  assert.deepEqual(validateModel(fixtureModel({ revenueSplit: { burnShare: 0.1, treasuryShare: 0.2, stakerShare: 0.7 } })), []);
});

test("a supply cap below genesis supply is an error; a cap equal to it is not", () => {
  assert.deepEqual(validateModel(fixtureModel({ emissions: { maxSupply: 999_999 } })), [
    { code: "max_supply_below_genesis", severity: "error", field: "emissions.maxSupply" },
  ]);
  assert.deepEqual(validateModel(fixtureModel({ emissions: { maxSupply: 1_000_000 } })), []);
});

test("a sell propensity on a treasury row is flagged as ignored", () => {
  const model = fixtureModel({
    allocations: [row({ id: "public", share: 0.8, tgeUnlock: 1 }), row({ id: "dao", category: "treasury", share: 0.2, vestingMonths: 12, sellPropensity: 0.3 })],
  });

  assert.deepEqual(validateModel(model), [{ code: "treasury_row_propensity_ignored", severity: "warning", field: "allocations.dao.sellPropensity" }]);
});

test("a row with no cliff and no vesting unlocks in full at TGE whatever its TGE share says", () => {
  const model = fixtureModel({ allocations: [row({ id: "airdrop", tgeUnlock: 0.2 })] });

  // The row still provides the initial float, so there is a warning and no error.
  assert.deepEqual(validateModel(model), [{ code: "row_fully_unlocked_at_tge", severity: "warning", field: "allocations.airdrop.tgeUnlock" }]);
});

test("starting cash above the implied raise is flagged only when a round has a price", () => {
  // 1,000,000 tokens at $0.50 imply a raise of $500,000.
  const priced = (startingUsd) =>
    fixtureModel({ treasury: { startingUsd }, allocations: [row({ id: "public", tgeUnlock: 1, purchasePriceUsd: 0.5 })] });

  assert.deepEqual(validateModel(priced(500_001)), [{ code: "starting_usd_exceeds_implied_raise", severity: "warning", field: "treasury.startingUsd" }]);
  assert.deepEqual(validateModel(priced(500_000)), []);
  assert.deepEqual(validateModel(fixtureModel({ treasury: { startingUsd: 500_001 } })), [], "no priced round, nothing to compare with");
});

test("users at launch above the ceiling are flagged, because the engine starts at the ceiling", () => {
  const users = (initialUsers) => fixtureModel({ utility: { initialUsers, saturationUsers: 1_000 } });

  assert.deepEqual(validateModel(users(1_001)), [{ code: "initial_users_above_ceiling", severity: "warning", field: "utility.initialUsers" }]);
  assert.deepEqual(validateModel(users(1_000)), []);
  assert.equal(simulate(users(5_000)).series.users[0], 1_000);
});

test("momentum_gain_high fires when momentum × min(1, 2 × inflow ÷ depth) reaches 1", () => {
  // Depth at month 1 is 0.1 × 1,000,000 tokens × $1 = $100,000. With momentum 2 the gain reaches 1
  // at an inflow of $25,000.
  const withInflow = (speculation, market = {}) => fixtureModel({ speculation: { momentum: 2, ...speculation }, market });
  const warning = [{ code: "momentum_gain_high", severity: "warning", field: "speculation.momentum" }];

  assert.deepEqual(validateModel(withInflow({ baseInflowUsd: 25_000 })), warning);
  assert.deepEqual(validateModel(withInflow({ baseInflowUsd: 24_999 })), []);
  assert.deepEqual(validateModel(withInflow({ baseInflowUsd: 12_500, scenario: "bull" })), warning, "the active scenario multiplier counts");
  assert.deepEqual(validateModel(withInflow({ baseInflowUsd: 25_000 }, { minDepthUsd: 1_000_000 })), [], "the depth floor counts");
  assert.deepEqual(validateModel(withInflow({ baseInflowUsd: 1e9, momentum: 0.99 })), [], "the inflow term is capped at 1");
});

test("errors come before warnings and every code is a known one", () => {
  const model = fixtureModel({
    emissions: { maxSupply: 1 },
    allocations: [row({ id: "public", share: 0.5, tgeUnlock: 0.5 }), row({ id: "dao", category: "treasury", share: 0.4, sellPropensity: 1, tgeUnlock: 1 })],
  });
  const issues = validateModel(model);

  assert.deepEqual(
    issues.map((issue) => [issue.code, issue.severity]),
    [
      ["allocations_sum", "error"],
      ["max_supply_below_genesis", "error"],
      ["treasury_row_propensity_ignored", "warning"],
      ["row_fully_unlocked_at_tge", "warning"],
    ],
  );
  for (const issue of issues) assert.ok(issueCodes.includes(issue.code), issue.code);
});
