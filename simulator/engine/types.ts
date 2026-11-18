/**
 * Types for the tokenomics simulator engine.
 *
 * The engine is pure TypeScript: no React, DOM, Node APIs, Date or
 * Math.random, and nothing that Node's type stripping cannot erase (no enum,
 * namespace or parameter properties), because the tests import these files
 * directly.
 *
 * Conventions: every ratio is a fraction in [0, 1] (the form shows percent).
 * Tokens and USD are plain numbers. Month 0 is the token generation event
 * (TGE). The engine returns codes and numbers only; wording lives in
 * simulator/content.
 */

export const allocationCategories = [
  "team",
  "investors",
  "advisors",
  "treasury",
  "ecosystem",
  "community",
  "public_sale",
  "liquidity",
] as const;
export type AllocationCategory = (typeof allocationCategories)[number];

/** Categories counted as insiders by the insider-share health check. */
export const insiderCategories = ["team", "investors", "advisors"] as const;

/**
 * One allocation row. Its category changes two things only: "treasury" rows
 * vest into the treasury's token balance instead of circulation, and the
 * insider categories feed one health check.
 */
export interface AllocationRow {
  /** Unique within the model, 1–40 characters. */
  id: string;
  /** Display only, up to 60 characters. */
  name: string;
  category: AllocationCategory;
  /** Fraction of genesis supply. Rows must sum to 1 ± 1e-6. */
  share: number;
  /** Fraction of the row unlocked at month 0. */
  tgeUnlock: number;
  /** Whole months before vesting starts, 0–120. */
  cliffMonths: number;
  /** Whole months after the cliff over which the rest vests, 0–120. */
  vestingMonths: number;
  /** Release interval in months, 1–12. 1 is monthly, 3 is quarterly. */
  vestingStepMonths: number;
  /** Share of tokens unlocking in months ≥ 1 that is sold in that month.
   *  Ignored on treasury rows. */
  sellPropensity: number;
  /** USD per token paid by this row's holders, or null. */
  purchasePriceUsd: number | null;
}

export const emissionModes = ["none", "inflation", "fixed"] as const;
export type EmissionMode = (typeof emissionModes)[number];

export const decayModes = ["none", "halving", "annual"] as const;
export type DecayMode = (typeof decayModes)[number];

export const capBases = ["minted", "outstanding"] as const;
export type CapBasis = (typeof capBases)[number];

export const scenarios = ["bear", "base", "bull"] as const;
export type Scenario = (typeof scenarios)[number];

export interface Model {
  version: 1;
  /** Whole months simulated after TGE, 12–120. */
  horizonMonths: number;
  token: {
    /** Display only, up to 40 characters. May be empty. */
    name: string;
    /** Display only, up to 10 characters. */
    symbol: string;
    genesisSupply: number;
    tgePriceUsd: number;
  };
  /** 1–16 rows. */
  allocations: AllocationRow[];
  emissions: {
    mode: EmissionMode;
    /** On current total supply, compounded monthly. */
    annualInflationRate: number;
    /** Tokens emitted in month 1 in "fixed" mode. */
    tokensPerMonth: number;
    decay: DecayMode;
    halvingEveryMonths: number;
    /** Applied once per 12 months. */
    annualDecayRate: number;
    /** Hard cap in tokens, at least genesis supply, or null for none. */
    maxSupply: number | null;
    /** "minted": genesis + emitted ≤ cap. "outstanding": genesis + emitted −
     *  burned ≤ cap, so burning makes room to mint again. */
    capBasis: CapBasis;
    /** Share of emitted tokens sold in the month they are emitted. */
    sellRate: number;
    /** Share of emissions paid to stakers. Affects yield only. */
    toStakersShare: number;
  };
  staking: {
    /** Staked share of circulating supply at month 0. */
    initialRatio: number;
    targetRatio: number;
    /** Months of linear ramp from initial to target. */
    rampMonths: number;
  };
  utility: {
    initialUsers: number;
    saturationUsers: number;
    /** Intrinsic rate of the logistic growth curve, per month. */
    monthlyGrowthRate: number;
    /** USD spent per user per month. */
    spendPerUserUsd: number;
    /** Months of spend a user keeps as a token balance. */
    holdingMonths: number;
  };
  /** Shares of protocol revenue. The sum must not exceed 1; the remainder
   *  leaves the model (providers, liquidity providers, costs). */
  revenueSplit: {
    /** Bought on the market and burned. */
    burnShare: number;
    /** Paid to the treasury in USD. */
    treasuryShare: number;
    /** Paid to stakers in USD. */
    stakerShare: number;
  };
  speculation: {
    /** Gross discretionary buying in month 1, USD. */
    baseInflowUsd: number;
    /** Monthly growth of that inflow, −0.2 to 0.2. */
    monthlyGrowth: number;
    scenario: Scenario;
    scenarioMultipliers: Record<Scenario, number>;
    /** Sensitivity of inflow to last month's return. */
    momentum: number;
  };
  market: {
    /** USD side of the depth pool as a share of last month's circulating
     *  market cap. */
    depthRatio: number;
    minDepthUsd: number;
    /** Share of last month's liquid float sold by existing holders. */
    holderSellRate: number;
  };
  treasury: {
    startingUsd: number;
    /** Operating cost in month 1, USD. */
    monthlyCostUsd: number;
    annualCostGrowth: number;
    /** Whether the treasury sells its vested tokens to cover costs. */
    sellTokens: boolean;
    /** Sell tokens when stablecoins fall below this many months of cost. */
    bufferMonths: number;
    /** Cap on a month's sale, as a share of last month's circulating supply. */
    maxMonthlySaleShare: number;
  };
  monteCarlo: {
    runs: number;
    /** Unsigned 32-bit seed. */
    seed: number;
    /** Monthly standard deviation of the log market factor's innovations. */
    marketVolatility: number;
    /** Standard deviation of the per-run log multiplier on user growth. */
    growthVolatility: number;
    /** Standard deviation of the per-run logit shift on each row's sell
     *  propensity. */
    sellPropensityVolatility: number;
  };
  /** Up to four distinct months at which holder outcomes are reported. */
  outcomeMonths: number[];
}

/**
 * Monthly time series. Every array has horizonMonths + 1 entries. Index 0 is
 * the TGE snapshot, where every flow series is 0.
 */
export interface MonthlySeries {
  // State at month end.
  priceUsd: number[];
  marketCapUsd: number[];
  fdvUsd: number[];
  totalSupply: number[];
  circulating: number[];
  liquid: number[];
  staked: number[];
  locked: number[];
  treasuryTokens: number[];
  burnedCum: number[];
  emittedCum: number[];
  treasuryUsd: number[];
  users: number[];
  stakedRatio: number[];
  // Flows during the month.
  /** Vesting into circulation from non-treasury rows. */
  unlockTokens: number[];
  treasuryVestTokens: number[];
  emissionTokens: number[];
  burnTokens: number[];
  sellUnlockTokens: number[];
  sellEmissionTokens: number[];
  sellHolderTokens: number[];
  treasurySaleTokens: number[];
  /** Every token offered for sale, valued at last month's price. */
  sellPressureUsd: number[];
  buyUsd: number[];
  speculativeInflowUsd: number[];
  revenueUsd: number[];
  burnUsd: number[];
  workingBalanceBuyUsd: number[];
  depthUsd: number[];
  treasuryCostUsd: number[];
  treasuryRevenueUsd: number[];
  treasurySaleUsd: number[];
  unpaidCostUsd: number[];
  // Rates, simple annualised (monthly rate × 12). Null when nothing is staked.
  stakingYieldNominal: (number | null)[];
  stakingYieldReal: (number | null)[];
  netInflationAnnualised: number[];
}

export interface AllocationSeries {
  id: string;
  tokens: number;
  /** Cumulative unlocked tokens per month. */
  unlockedCum: number[];
}

export interface SimulationFlags {
  /** Months in which the price move hit the per-month clamp. */
  priceClampMonths: number[];
  /** Months in which market depth sat on its floor. */
  minDepthMonths: number[];
  /** Months in which the burn hit its share-of-float clamp. */
  burnClampMonths: number[];
}

/** What one run of the monthly loop produces, before any derived metrics. */
export interface CoreResult {
  months: number[];
  series: MonthlySeries;
  allocations: AllocationSeries[];
  flags: SimulationFlags;
  /** First month in which the treasury could not pay its costs, or null. */
  exhaustedMonth: number | null;
}

export interface Kpis {
  /** circulating[0] ÷ genesis supply. */
  initialCirculatingShare: number;
  initialMarketCapUsd: number;
  /** TGE price × (max supply, or genesis supply when there is no cap). */
  initialFdvUsd: number;
  marketCapToFdv: number;
  /** circulating[12] ÷ totalSupply[12]. */
  circulatingShareMonth12: number;
  /** Largest month of vesting into circulation, relative to the circulating
   *  supply at the end of the month before. */
  largestUnlock: {
    month: number | null;
    tokens: number;
    shareOfCirculating: number;
  };
  /** totalSupply[12] ÷ genesis − 1. */
  inflationYear1: number;
  /** From the vesting schedule alone, searched to month 240. */
  monthsTo50Unlocked: number | null;
  monthsTo90Unlocked: number | null;
  lockedAtHorizonShare: number;
  /** Σ row tokens × purchase price, over rows that have one. */
  impliedRaiseUsd: number;
  runway: {
    /** startingUsd ÷ monthlyCostUsd; null when cost is 0. */
    staticMonths: number | null;
    exhaustedMonth: number | null;
  };
  /** Share of total operating cost that was paid from token sales. */
  treasurySaleShareOfCosts: number;
  /** Burned ÷ emitted over the last 12 months; null when nothing was
   *  emitted. */
  burnToEmissionLast12: number | null;
}

export interface AllocationOutcome {
  id: string;
  tokens: number;
  costBasisUsd: number | null;
  atMonths: {
    month: number;
    unlockedTokens: number;
    unlockedValueUsd: number;
    lockedValueUsd: number;
    /** Price at the month ÷ purchase price. */
    paperMultiple: number | null;
    /** Unlocked value ÷ cost basis. */
    liquidMultiple: number | null;
  }[];
}

export const healthCheckIds = [
  "insider_share",
  "low_float",
  "unlock_shock",
  "net_inflation",
  "runway",
  "treasury_token_dependence",
  "structural_demand",
  "model_range",
  "treasury_exhaustion_probability",
] as const;
export type HealthCheckId = (typeof healthCheckIds)[number];

export type HealthStatus = "pass" | "watch" | "risk" | "na";

export interface HealthCheck {
  id: HealthCheckId;
  status: HealthStatus;
  value: number | null;
  watchAt: number;
  riskAt: number;
  /** The month the value refers to, where one applies. */
  month: number | null;
}

export const issueCodes = [
  "allocations_sum",
  "allocations_empty",
  "duplicate_id",
  "no_initial_float",
  "revenue_split_over_one",
  "max_supply_below_genesis",
  "treasury_row_propensity_ignored",
  "row_fully_unlocked_at_tge",
  "starting_usd_exceeds_implied_raise",
  "initial_users_above_ceiling",
  "momentum_gain_high",
] as const;
export type IssueCode = (typeof issueCodes)[number];

export interface ModelIssue {
  code: IssueCode;
  severity: "error" | "warning";
  /** Dotted path of the input the issue points at, e.g. "allocations" or
   *  "allocations.team.sellPropensity". */
  field: string;
}

export interface SimulationResult {
  ok: true;
  months: number[];
  series: MonthlySeries;
  allocations: AllocationSeries[];
  kpis: Kpis;
  allocationOutcomes: AllocationOutcome[];
  /** Every check except the Monte Carlo one, which needs a finished job. */
  healthChecks: HealthCheck[];
  warnings: ModelIssue[];
  flags: SimulationFlags;
}

export interface SimulationFailure {
  ok: false;
  errors: ModelIssue[];
}

export interface Bands {
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
}

export interface MonteCarloResult {
  /** Runs completed so far. */
  runs: number;
  seed: number;
  months: number[];
  priceUsd: Bands;
  marketCapUsd: Bands;
  /** Share of runs with price strictly below the TGE price; null when the
   *  month is beyond the horizon. */
  probPriceBelowTge: { m12: number | null; m24: number | null; m36: number | null };
  probTreasuryExhausted: number;
}
