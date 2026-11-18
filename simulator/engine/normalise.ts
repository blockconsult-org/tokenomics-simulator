import { LIMITS } from "./constants";
import {
  allocationFields,
  clampToSpec,
  modelFields,
  outcomeMonthField,
} from "./fields";
import type { AllocationFieldKey, FieldSpec, ModelFieldPath } from "./fields";
import { defaultModel } from "./presets";
import {
  allocationCategories,
  capBases,
  decayModes,
  emissionModes,
  scenarios,
} from "./types";
import type { AllocationCategory, AllocationRow, Model } from "./types";

/** Category of a row whose category is missing or unknown. It is neither an
 *  insider category nor the treasury, so it changes no special-cased rule. */
const FALLBACK_CATEGORY: AllocationCategory = "community";

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Follow a dotted path through own properties only. */
function read(source: unknown, path: string): unknown {
  let value = source;
  for (const key of path.split(".")) {
    if (!isBag(value) || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOneOf<T extends string>(
  options: readonly T[],
  value: unknown,
): value is T {
  return options.some((option) => option === value);
}

function numberOr(spec: FieldSpec, value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? clampToSpec(spec, value) : fallback;
}

/** For inputs that may be empty: an explicit null is kept as null. */
function nullableNumberOr(
  spec: FieldSpec,
  value: unknown,
  fallback: number | null,
): number | null {
  if (value === null) return null;
  return isFiniteNumber(value) ? clampToSpec(spec, value) : fallback;
}

/** Trim a string and cut it to `maxLength`, or return the fallback when the
 *  value is not a string. */
function textOr(value: unknown, maxLength: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  let cut = trimmed.slice(0, maxLength);
  // A cut that lands between the two halves of a surrogate pair would leave
  // half a character behind.
  const last = cut.charCodeAt(cut.length - 1);
  if (trimmed.length > maxLength && last >= 0xd800 && last <= 0xdbff) {
    cut = cut.slice(0, -1);
  }
  return cut.trimEnd();
}

/**
 * A usable, unique id for the row at `index`. Dots are replaced because the
 * id sits inside dotted issue paths such as "allocations.team.share". An
 * empty id gets a positional one, and a repeated id gets a numeric suffix,
 * shortened where needed to stay within the length limit.
 */
function uniqueRowId(value: unknown, index: number, taken: Set<string>): string {
  const cleaned = textOr(
    typeof value === "string" ? value.replaceAll(".", "-") : value,
    LIMITS.MAX_ID_LENGTH,
    "",
  );
  const base = cleaned === "" ? `row-${index + 1}` : cleaned;
  let id = base;
  for (let copy = 2; taken.has(id); copy++) {
    const suffix = `-${copy}`;
    id = base.slice(0, LIMITS.MAX_ID_LENGTH - suffix.length) + suffix;
  }
  taken.add(id);
  return id;
}

function normaliseRow(
  source: Bag,
  index: number,
  taken: Set<string>,
): AllocationRow {
  const field = (key: AllocationFieldKey): number =>
    numberOr(allocationFields[key], read(source, key), allocationFields[key].default);
  const category = read(source, "category");

  return {
    id: uniqueRowId(read(source, "id"), index, taken),
    name: textOr(read(source, "name"), LIMITS.MAX_NAME_LENGTH, ""),
    category: isOneOf(allocationCategories, category)
      ? category
      : FALLBACK_CATEGORY,
    share: field("share"),
    tgeUnlock: field("tgeUnlock"),
    cliffMonths: field("cliffMonths"),
    vestingMonths: field("vestingMonths"),
    vestingStepMonths: field("vestingStepMonths"),
    sellPropensity: field("sellPropensity"),
    purchasePriceUsd: nullableNumberOr(
      allocationFields.purchasePriceUsd,
      read(source, "purchasePriceUsd"),
      null,
    ),
  };
}

/**
 * The first rows of the list that are objects, up to the row limit. A list
 * that is present but empty stays empty, so validateModel can report it; only
 * a missing or malformed list falls back to the default rows.
 */
function normaliseAllocations(
  value: unknown,
  fallback: AllocationRow[],
): AllocationRow[] {
  if (!Array.isArray(value)) return fallback;
  const entries: unknown[] = value;
  const rows: AllocationRow[] = [];
  const taken = new Set<string>();
  for (const entry of entries) {
    if (rows.length === LIMITS.MAX_ALLOCATION_ROWS) break;
    if (isBag(entry)) rows.push(normaliseRow(entry, rows.length, taken));
  }
  return rows;
}

/** The first distinct months of the list, up to the limit, in ascending
 *  order. */
function normaliseOutcomeMonths(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const entries: unknown[] = value;
  const months = new Set<number>();
  for (const entry of entries) {
    if (months.size === LIMITS.MAX_OUTCOME_MONTHS) break;
    if (isFiniteNumber(entry)) months.add(clampToSpec(outcomeMonthField, entry));
  }
  return [...months].sort((a, b) => a - b);
}

function build(input: unknown): Model {
  const defaults = defaultModel();

  const field = (path: ModelFieldPath): number => {
    const spec = modelFields[path];
    const fallback = read(defaults, path);
    return numberOr(
      spec,
      read(input, path),
      isFiniteNumber(fallback) ? fallback : spec.default,
    );
  };

  const mode = read(input, "emissions.mode");
  const decay = read(input, "emissions.decay");
  const capBasis = read(input, "emissions.capBasis");
  const scenario = read(input, "speculation.scenario");
  const sellTokens = read(input, "treasury.sellTokens");
  const seed = read(input, "monteCarlo.seed");
  const saturationUsers = field("utility.saturationUsers");

  return {
    version: 1,
    horizonMonths: field("horizonMonths"),
    token: {
      name: textOr(
        read(input, "token.name"),
        LIMITS.MAX_TOKEN_NAME_LENGTH,
        defaults.token.name,
      ),
      // A symbol that was cleared stays cleared, as the form leaves it: the
      // page then counts in "tokens". Only a missing one gets the default.
      symbol: textOr(
        read(input, "token.symbol"),
        LIMITS.MAX_TOKEN_SYMBOL_LENGTH,
        defaults.token.symbol,
      ),
      genesisSupply: field("token.genesisSupply"),
      tgePriceUsd: field("token.tgePriceUsd"),
    },
    allocations: normaliseAllocations(
      read(input, "allocations"),
      defaults.allocations,
    ),
    emissions: {
      mode: isOneOf(emissionModes, mode) ? mode : defaults.emissions.mode,
      annualInflationRate: field("emissions.annualInflationRate"),
      tokensPerMonth: field("emissions.tokensPerMonth"),
      decay: isOneOf(decayModes, decay) ? decay : defaults.emissions.decay,
      halvingEveryMonths: field("emissions.halvingEveryMonths"),
      annualDecayRate: field("emissions.annualDecayRate"),
      maxSupply: nullableNumberOr(
        modelFields["emissions.maxSupply"],
        read(input, "emissions.maxSupply"),
        defaults.emissions.maxSupply,
      ),
      capBasis: isOneOf(capBases, capBasis)
        ? capBasis
        : defaults.emissions.capBasis,
      sellRate: field("emissions.sellRate"),
      toStakersShare: field("emissions.toStakersShare"),
    },
    staking: {
      initialRatio: field("staking.initialRatio"),
      targetRatio: field("staking.targetRatio"),
      rampMonths: field("staking.rampMonths"),
    },
    utility: {
      // The logistic curve needs a starting point at or below its ceiling.
      initialUsers: Math.min(field("utility.initialUsers"), saturationUsers),
      saturationUsers,
      monthlyGrowthRate: field("utility.monthlyGrowthRate"),
      spendPerUserUsd: field("utility.spendPerUserUsd"),
      holdingMonths: field("utility.holdingMonths"),
    },
    revenueSplit: {
      burnShare: field("revenueSplit.burnShare"),
      treasuryShare: field("revenueSplit.treasuryShare"),
      stakerShare: field("revenueSplit.stakerShare"),
    },
    speculation: {
      baseInflowUsd: field("speculation.baseInflowUsd"),
      monthlyGrowth: field("speculation.monthlyGrowth"),
      scenario: isOneOf(scenarios, scenario)
        ? scenario
        : defaults.speculation.scenario,
      scenarioMultipliers: {
        bear: field("speculation.scenarioMultipliers.bear"),
        base: field("speculation.scenarioMultipliers.base"),
        bull: field("speculation.scenarioMultipliers.bull"),
      },
      momentum: field("speculation.momentum"),
    },
    market: {
      depthRatio: field("market.depthRatio"),
      minDepthUsd: field("market.minDepthUsd"),
      holderSellRate: field("market.holderSellRate"),
    },
    treasury: {
      startingUsd: field("treasury.startingUsd"),
      monthlyCostUsd: field("treasury.monthlyCostUsd"),
      annualCostGrowth: field("treasury.annualCostGrowth"),
      sellTokens:
        typeof sellTokens === "boolean"
          ? sellTokens
          : defaults.treasury.sellTokens,
      bufferMonths: field("treasury.bufferMonths"),
      maxMonthlySaleShare: field("treasury.maxMonthlySaleShare"),
    },
    monteCarlo: {
      runs: field("monteCarlo.runs"),
      // Wraps to an unsigned 32-bit integer, which is what the generator
      // takes. Clamping would map every out-of-range seed to the same run.
      seed: (isFiniteNumber(seed) ? seed : defaults.monteCarlo.seed) >>> 0,
      marketVolatility: field("monteCarlo.marketVolatility"),
      growthVolatility: field("monteCarlo.growthVolatility"),
      sellPropensityVolatility: field("monteCarlo.sellPropensityVolatility"),
    },
    outcomeMonths: normaliseOutcomeMonths(
      read(input, "outcomeMonths"),
      defaults.outcomeMonths,
    ),
  };
}

/**
 * Turns anything into a structurally valid model. Never throws.
 *
 * A model reaches the page from a share link, browser storage or an uploaded
 * file, so its shape cannot be trusted. Every value is read one known key at
 * a time and copied into a fresh object: nothing from the input is spread or
 * kept by reference, and only own properties are read, so a crafted
 * `__proto__` or `constructor` key has nowhere to land.
 *
 * Numbers are clamped by the same range table the form controls use. What a
 * person has to see and decide is left alone for validateModel to report:
 * allocation shares are not rescaled, and a supply cap below genesis supply
 * stays as typed.
 */
export function normaliseModel(input: unknown): Model {
  try {
    return build(input);
  } catch {
    // Parsed JSON cannot make a property read fail, but the parameter accepts
    // any value, and an exotic object (a throwing getter, a revoked proxy)
    // must not take the page down with it.
    return defaultModel();
  }
}
