// normaliseModel: whatever arrives from a share link, browser storage or an uploaded file comes out
// as a model the engine can run, and valid models come out unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS } from "@/simulator/engine/constants";
import { normaliseModel } from "@/simulator/engine/normalise";
import { defaultModel, getPreset, presetIds } from "@/simulator/engine/presets";
import { validateModel } from "@/simulator/engine/validate";

const errors = (model) => validateModel(model).filter((issue) => issue.severity === "error");

test("a valid model passes through unchanged", () => {
  for (const id of presetIds) assert.deepEqual(normaliseModel(getPreset(id)), getPreset(id), id);
});

test("input that is not a model becomes the default model", () => {
  for (const input of [{}, null, undefined, "model", 42, [], [{}]]) {
    assert.deepEqual(normaliseModel(input), defaultModel(), JSON.stringify(input));
  }
  assert.deepEqual(errors(normaliseModel({})), []);
});

test("bad values fall back to defaults and out-of-range values are clamped", () => {
  const defaults = defaultModel();
  const model = normaliseModel({
    horizonMonths: 500,
    token: { genesisSupply: Number.NaN, tgePriceUsd: "0.5", symbol: "   " },
    emissions: { mode: "mint", halvingEveryMonths: 12.6, annualDecayRate: -1, capBasis: null },
    staking: { rampMonths: Number.POSITIVE_INFINITY, targetRatio: 2 },
    speculation: { scenario: "moon", scenarioMultipliers: { bear: -3, bull: 99 } },
    treasury: { sellTokens: "yes", bufferMonths: null },
    monteCarlo: { runs: 3 },
  });

  assert.equal(model.horizonMonths, 120);
  assert.equal(model.token.genesisSupply, defaults.token.genesisSupply, "NaN");
  assert.equal(model.token.tgePriceUsd, defaults.token.tgePriceUsd, "a numeric string is not a number");
  assert.equal(model.token.symbol, "", "a cleared symbol stays cleared, as the form leaves it");
  assert.equal(model.emissions.mode, defaults.emissions.mode);
  assert.equal(model.emissions.halvingEveryMonths, 13, "integer fields are rounded");
  assert.equal(model.emissions.annualDecayRate, 0);
  assert.equal(model.emissions.capBasis, defaults.emissions.capBasis);
  assert.equal(model.staking.rampMonths, defaults.staking.rampMonths, "Infinity");
  assert.equal(model.staking.targetRatio, 0.95);
  assert.equal(model.speculation.scenario, defaults.speculation.scenario);
  assert.deepEqual(model.speculation.scenarioMultipliers, { bear: 0, base: 1, bull: 10 });
  assert.equal(model.treasury.sellTokens, defaults.treasury.sellTokens);
  assert.equal(model.treasury.bufferMonths, defaults.treasury.bufferMonths);
  assert.equal(model.monteCarlo.runs, 50);
  assert.deepEqual(errors(model), []);
});

test("strings are trimmed and cut to their limits", () => {
  const model = normaliseModel({
    token: { name: `  ${"n".repeat(100)}  `, symbol: "SYMBOLTOOLONG" },
    // The 60th UTF-16 unit of this name is the first half of an emoji, which must not be left behind.
    allocations: [{ id: "i".repeat(100), name: `${"x".repeat(59)}😀`, share: 1, tgeUnlock: 1 }],
  });

  assert.equal(model.token.name, "n".repeat(LIMITS.MAX_TOKEN_NAME_LENGTH));
  assert.equal(model.token.symbol, "SYMBOLTOOL");
  assert.equal(model.allocations[0].id, "i".repeat(LIMITS.MAX_ID_LENGTH));
  assert.equal(model.allocations[0].name, "x".repeat(59));
});

test("allocation rows are capped at 16, repaired where broken, and never rescaled", () => {
  const rows = Array.from({ length: 20 }, () => ({ id: "dup", share: 0.04, tgeUnlock: 1 }));
  const model = normaliseModel({ allocations: [null, "row", ...rows] });

  assert.equal(model.allocations.length, LIMITS.MAX_ALLOCATION_ROWS, "entries that are not objects are dropped first");
  assert.equal(new Set(model.allocations.map((entry) => entry.id)).size, 16, "ids are unique");
  assert.deepEqual(model.allocations.slice(0, 3).map((entry) => entry.id), ["dup", "dup-2", "dup-3"]);
  // 16 × 4% is 64%. The shares stay as they came, and the user is told.
  assert.ok(model.allocations.every((entry) => entry.share === 0.04));
  assert.deepEqual(errors(model).map((issue) => issue.code), ["allocations_sum"]);

  const [repaired] = normaliseModel({ allocations: [{ id: "  ", category: "founders", share: 7, cliffMonths: -3, vestingStepMonths: 0 }] }).allocations;
  assert.deepEqual(repaired, {
    id: "row-1",
    name: "",
    category: "community",
    share: 1,
    tgeUnlock: 0,
    cliffMonths: 0,
    vestingMonths: 0,
    vestingStepMonths: 1,
    sellPropensity: 0.5,
    purchasePriceUsd: null,
  });

  assert.deepEqual(normaliseModel({ allocations: [] }).allocations, [], "an empty table stays empty for validation to report");
  assert.equal(normaliseModel({ allocations: [{ id: "a.b" }] }).allocations[0].id, "a-b", "ids sit inside dotted issue paths");
});

test("the seed is coerced to an unsigned 32-bit integer", () => {
  const seedOf = (seed) => normaliseModel({ monteCarlo: { seed } }).monteCarlo.seed;

  assert.equal(seedOf(-1), 4294967295);
  assert.equal(seedOf(2 ** 32 + 7), 7);
  assert.equal(seedOf(1.9), 1);
  assert.equal(seedOf("12"), defaultModel().monteCarlo.seed);
});

test("initial users cannot exceed the saturation level", () => {
  const { utility } = normaliseModel({ utility: { initialUsers: 5_000, saturationUsers: 1_000 } });

  assert.deepEqual([utility.initialUsers, utility.saturationUsers], [1_000, 1_000]);
});

test("a supply cap below genesis supply is kept for validation to report", () => {
  const model = normaliseModel({ token: { genesisSupply: 1e9 }, emissions: { maxSupply: 5e8 } });

  assert.equal(model.emissions.maxSupply, 5e8);
  assert.deepEqual(errors(model).map((issue) => issue.code), ["max_supply_below_genesis"]);
});

test("outcome months are clamped, deduplicated, sorted and capped at four", () => {
  assert.deepEqual(normaliseModel({ outcomeMonths: [36, 12.2, 12, "24", 500, 0, 48] }).outcomeMonths, [1, 12, 36, 120]);
  assert.deepEqual(normaliseModel({ outcomeMonths: [] }).outcomeMonths, []);
});

test("crafted keys cannot reach a prototype, and the result shares nothing with the input", () => {
  const hostile = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"token":{"__proto__":{"genesisSupply":5},"symbol":"X"},"allocations":[{"__proto__":{"share":0.9},"id":"__proto__"}]}',
  );
  const model = normaliseModel(hostile);

  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(model), Object.prototype);
  assert.equal(Object.hasOwn(model, "polluted"), false);
  assert.equal(model.token.genesisSupply, defaultModel().token.genesisSupply, "a value under __proto__ is not model data");
  assert.notEqual(model.allocations, hostile.allocations);
  assert.deepEqual(normaliseModel(model), model, "normalising twice changes nothing");
});

test("normaliseModel does not throw on an object that throws when read", () => {
  const trap = new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error("no"); }, get: () => { throw new Error("no"); } });

  assert.deepEqual(normaliseModel(trap), defaultModel());
});
