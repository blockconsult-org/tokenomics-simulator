/**
 * Fixed constants of the monthly loop. They are guards and conventions, not
 * user inputs; the methodology section of the page documents each one.
 */
export const ENGINE = {
  /** AR(1) persistence of the log market factor in Monte Carlo runs. */
  MARKET_PERSISTENCE: 0.9,
  /** The log market factor is held within ± this value. */
  MARKET_FACTOR_CLAMP: 4,
  /** Last month's return is clamped to this range before momentum reads it. */
  MOMENTUM_RETURN_MIN: -0.5,
  MOMENTUM_RETURN_MAX: 1,
  /** The momentum multiplier on speculative inflow stays in this range. */
  MOMENTUM_FACTOR_MIN: 0.5,
  MOMENTUM_FACTOR_MAX: 2,
  /** Price may move by at most this factor, up or down, in one month. */
  MAX_MONTHLY_PRICE_RATIO: 5,
  /** Absolute price bounds, as multiples of the TGE price. */
  PRICE_FLOOR_MULTIPLE: 1e-6,
  PRICE_CEILING_MULTIPLE: 1e6,
  /** A month's burn takes at most this share of the liquid float. */
  MAX_BURN_SHARE_OF_LIQUID: 0.5,
  /** Ceiling on the slippage gross-up applied to a treasury sale. */
  SALE_GROSS_UP_CAP: 2,
  /** A shortfall below this share of the month's cost does not count as the
   *  treasury running out. */
  EXHAUSTION_MATERIALITY: 0.01,
  /** Flows smaller than this, in USD, are treated as zero. */
  FLOW_EPSILON_USD: 1e-9,
  /** Allocation shares must sum to 1 within this tolerance. */
  ALLOCATION_SUM_TOLERANCE: 1e-6,
  /** How far the unlock KPIs search the vesting schedule, in months. */
  SCHEDULE_SEARCH_MONTHS: 240,
  /** Per-run cap on the user growth rate in Monte Carlo runs. */
  MAX_RUN_GROWTH_RATE: 3,
} as const;

/** Model limits that are not single-field ranges. */
export const LIMITS = {
  MAX_ALLOCATION_ROWS: 16,
  MAX_OUTCOME_MONTHS: 4,
  MAX_ID_LENGTH: 40,
  MAX_NAME_LENGTH: 60,
  MAX_TOKEN_NAME_LENGTH: 40,
  MAX_TOKEN_SYMBOL_LENGTH: 10,
} as const;
