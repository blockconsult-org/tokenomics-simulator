import { ENGINE } from "./constants";
import { poolTrade } from "./pool";
import type {
  AllocationSeries,
  CoreResult,
  EmissionMode,
  Model,
  MonthlySeries,
  SimulationFlags,
} from "./types";
import { unlockedInMonth, vestedFraction } from "./vesting";

/**
 * The monthly loop of the simulator.
 *
 * One month runs in a fixed order: depth, vesting, emissions, users and
 * revenue, speculation, treasury sale sizing, the pool trade, treasury
 * settlement, burn, staking rebalance. Sizing reads last month's values and
 * execution prices come from the month's single trade, so nothing iterates.
 *
 * The functions here assume a model that has already passed validation.
 */

/**
 * The parts of a model that are the same on every path, worked out once.
 * A Monte Carlo job runs thousands of paths over one of these.
 *
 * Tables "by month" have horizon + 1 entries; entry 0 is the TGE and is only
 * meaningful for the unlock, locked and staking tables.
 */
export interface PreparedModel {
  readonly horizon: number;
  readonly genesis: number;
  readonly tgePrice: number;
  /** Absolute price bounds. */
  readonly priceFloor: number;
  readonly priceCeiling: number;

  readonly rowCount: number;
  /** Tokens of each row: genesis × share ÷ the sum of shares. */
  readonly rowTokens: Float64Array;
  /** Sell propensity of each row as entered. */
  readonly rowSellPropensity: Float64Array;
  /** Tokens each row releases into the float, row by row and month by month
   *  (row × (horizon + 1) + month). Zero for treasury rows, whose sell
   *  propensity is ignored. */
  readonly rowFloatUnlock: Float64Array;

  /** Tokens vesting into the float, by month. Entry 0 is the TGE float. */
  readonly floatUnlock: Float64Array;
  /** Tokens vesting into the treasury's balance, by month. */
  readonly treasuryUnlock: Float64Array;
  /** Tokens still locked across all rows, by month, from the closed form. */
  readonly locked: Float64Array;
  /** Staked share of circulating supply the model aims for, by month. */
  readonly stakingTarget: Float64Array;
  /** Operating cost, by month. */
  readonly cost: Float64Array;
  /** Speculative inflow before momentum and the market factor, by month. */
  readonly speculationBase: Float64Array;
  /** Uncapped emission in "fixed" mode, by month; zeros in other modes. */
  readonly fixedEmission: Float64Array;

  readonly emissionMode: EmissionMode;
  /** Monthly rate on total supply in "inflation" mode. */
  readonly monthlyInflation: number;
  readonly maxSupply: number | null;
  /** True when burned tokens make room under the cap again. */
  readonly capOnOutstanding: boolean;
  readonly emissionSellRate: number;
  readonly emissionToStakers: number;

  /** Users at TGE, already limited to the saturation level. */
  readonly initialUsers: number;
  readonly saturationUsers: number;
  readonly growthRate: number;
  readonly spendPerUserUsd: number;
  readonly holdingMonths: number;
  readonly burnShare: number;
  readonly treasuryShare: number;
  readonly stakerShare: number;

  readonly momentum: number;
  readonly depthRatio: number;
  readonly minDepthUsd: number;
  readonly holderSellRate: number;

  readonly startingUsd: number;
  readonly treasurySells: boolean;
  readonly bufferMonths: number;
  readonly maxMonthlySaleShare: number;
}

/** What makes one path differ from another over the same prepared model. */
export interface PathDraws {
  /** Intrinsic monthly rate of the logistic user curve. */
  growthRate: number;
  /** Tokens sold out of each month's unlocks, by month. */
  sellUnlock: Float64Array;
  /** What each month adds to the log market factor, by month and already
   *  scaled by volatility. Null for a path without market shocks. */
  marketInnovations: Float64Array | null;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Staked share the model aims for at `month`: a straight line from the
 *  initial ratio to the target, or the target throughout when there is no
 *  ramp. */
function stakingTargetAt(staking: Model["staking"], month: number): number {
  if (staking.rampMonths <= 0 || month >= staking.rampMonths) {
    return staking.targetRatio;
  }
  return (
    staking.initialRatio +
    ((staking.targetRatio - staking.initialRatio) * month) / staking.rampMonths
  );
}

/** Share of the month-1 emission still paid in `month` of "fixed" mode. */
function emissionDecayAt(emissions: Model["emissions"], month: number): number {
  if (emissions.decay === "halving") {
    return Math.pow(0.5, Math.floor((month - 1) / emissions.halvingEveryMonths));
  }
  if (emissions.decay === "annual") {
    return Math.pow(1 - emissions.annualDecayRate, Math.floor((month - 1) / 12));
  }
  return 1;
}

export function prepareModel(model: Model): PreparedModel {
  const horizon = model.horizonMonths;
  const months = horizon + 1;
  const genesis = model.token.genesisSupply;
  const tgePrice = model.token.tgePriceUsd;
  const rows = model.allocations;
  const { emissions, utility, speculation, treasury } = model;

  const rowTokens = new Float64Array(rows.length);
  const rowSellPropensity = new Float64Array(rows.length);
  const rowFloatUnlock = new Float64Array(rows.length * months);
  const floatUnlock = new Float64Array(months);
  const treasuryUnlock = new Float64Array(months);
  const locked = new Float64Array(months);

  // Shares are valid when they sum to 1 within a small tolerance. Dividing by
  // the sum makes the row tokens add up to genesis all the same.
  let shareSum = 0;
  for (const row of rows) shareSum += row.share;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tokens = (genesis * row.share) / shareSum;
    const toTreasury = row.category === "treasury";
    rowTokens[i] = tokens;
    rowSellPropensity[i] = row.sellPropensity;
    for (let t = 0; t < months; t++) {
      const unlocked = unlockedInMonth(row, tokens, t);
      if (toTreasury) {
        treasuryUnlock[t] += unlocked;
      } else {
        floatUnlock[t] += unlocked;
        rowFloatUnlock[i * months + t] = unlocked;
      }
      locked[t] += tokens * (1 - vestedFraction(row, t));
    }
  }

  const stakingTarget = new Float64Array(months);
  const cost = new Float64Array(months);
  const speculationBase = new Float64Array(months);
  const fixedEmission = new Float64Array(months);
  const scenarioMultiplier = speculation.scenarioMultipliers[speculation.scenario];

  stakingTarget[0] = stakingTargetAt(model.staking, 0);
  for (let t = 1; t < months; t++) {
    stakingTarget[t] = stakingTargetAt(model.staking, t);
    cost[t] =
      treasury.monthlyCostUsd * Math.pow(1 + treasury.annualCostGrowth, (t - 1) / 12);
    speculationBase[t] =
      speculation.baseInflowUsd *
      Math.pow(1 + speculation.monthlyGrowth, t - 1) *
      scenarioMultiplier;
    if (emissions.mode === "fixed") {
      fixedEmission[t] = emissions.tokensPerMonth * emissionDecayAt(emissions, t);
    }
  }

  return {
    horizon,
    genesis,
    tgePrice,
    priceFloor: tgePrice * ENGINE.PRICE_FLOOR_MULTIPLE,
    priceCeiling: tgePrice * ENGINE.PRICE_CEILING_MULTIPLE,
    rowCount: rows.length,
    rowTokens,
    rowSellPropensity,
    rowFloatUnlock,
    floatUnlock,
    treasuryUnlock,
    locked,
    stakingTarget,
    cost,
    speculationBase,
    fixedEmission,
    emissionMode: emissions.mode,
    monthlyInflation: Math.pow(1 + emissions.annualInflationRate, 1 / 12) - 1,
    maxSupply: emissions.maxSupply,
    capOnOutstanding: emissions.capBasis === "outstanding",
    emissionSellRate: emissions.sellRate,
    emissionToStakers: emissions.toStakersShare,
    initialUsers: Math.min(utility.initialUsers, utility.saturationUsers),
    saturationUsers: utility.saturationUsers,
    growthRate: utility.monthlyGrowthRate,
    spendPerUserUsd: utility.spendPerUserUsd,
    holdingMonths: utility.holdingMonths,
    burnShare: model.revenueSplit.burnShare,
    treasuryShare: model.revenueSplit.treasuryShare,
    stakerShare: model.revenueSplit.stakerShare,
    momentum: speculation.momentum,
    depthRatio: model.market.depthRatio,
    minDepthUsd: model.market.minDepthUsd,
    holderSellRate: model.market.holderSellRate,
    startingUsd: treasury.startingUsd,
    treasurySells: treasury.sellTokens,
    bufferMonths: treasury.bufferMonths,
    maxMonthlySaleShare: treasury.maxMonthlySaleShare,
  };
}

/**
 * Tokens sold out of each month's unlocks for the given per-row sell
 * propensities, written into `out` (horizon + 1 entries). Month 0 stays 0:
 * the TGE price is taken as already cleared, so nothing sells there.
 */
export function fillSellUnlock(
  prepared: PreparedModel,
  propensities: Float64Array,
  out: Float64Array,
): void {
  const months = prepared.horizon + 1;
  out.fill(0);
  for (let i = 0; i < prepared.rowCount; i++) {
    const propensity = propensities[i];
    const base = i * months;
    for (let t = 1; t < months; t++) {
      out[t] += prepared.rowFloatUnlock[base + t] * propensity;
    }
  }
}

/** The draws of the deterministic path: every input as entered, no shocks. */
export function baseDraws(prepared: PreparedModel): PathDraws {
  const sellUnlock = new Float64Array(prepared.horizon + 1);
  fillSellUnlock(prepared, prepared.rowSellPropensity, sellUnlock);
  return { growthRate: prepared.growthRate, sellUnlock, marketInnovations: null };
}

interface PathRecord {
  series: MonthlySeries;
  flags: SimulationFlags;
}

/**
 * Runs one path. Price and market cap for months 0 to horizon are written to
 * the two output arrays starting at `offset`. With a `record` every other
 * series and the range flags are filled in as well; without one the loop
 * skips that work, which is what a Monte Carlo run wants.
 *
 * Returns the first month in which the treasury could not pay its costs, or
 * null.
 */
function simulatePath(
  p: PreparedModel,
  draws: PathDraws,
  priceOut: Float64Array,
  marketCapOut: Float64Array,
  offset: number,
  record: PathRecord | null,
): number | null {
  const growthFactor = Math.exp(draws.growthRate);
  const sellUnlockByMonth = draws.sellUnlock;
  const innovations = draws.marketInnovations;

  // Month 0: the TGE snapshot. The TGE price is an input and is taken as
  // already cleared, so there are no flows and nothing sells.
  let price = p.tgePrice;
  let circulating = p.floatUnlock[0];
  let staked = p.stakingTarget[0] * circulating;
  let liquid = circulating - staked;
  let treasuryTokens = p.treasuryUnlock[0];
  let treasuryUsd = p.startingUsd;
  let users = p.initialUsers;
  let workingBalance = p.holdingMonths * users * p.spendPerUserUsd;
  let emitted = 0;
  let burned = 0;
  let totalSupply = p.genesis;
  let marketFactor = 0;
  let lastReturn = 0;
  let exhaustedMonth: number | null = null;

  priceOut[offset] = price;
  marketCapOut[offset] = circulating * price;
  if (record !== null) {
    const s = record.series;
    s.fdvUsd[0] = price * (p.maxSupply ?? totalSupply);
    s.totalSupply[0] = totalSupply;
    s.circulating[0] = circulating;
    s.liquid[0] = liquid;
    s.staked[0] = staked;
    s.locked[0] = p.locked[0];
    s.treasuryTokens[0] = treasuryTokens;
    s.treasuryUsd[0] = treasuryUsd;
    s.users[0] = users;
    s.stakedRatio[0] = circulating > 0 ? staked / circulating : 0;
    // Nothing is paid to stakers at TGE: the yield is 0 where there is a
    // stake to earn it and undefined where there is none.
    const tgeYield = staked * price > 0 ? 0 : null;
    s.stakingYieldNominal[0] = tgeYield;
    s.stakingYieldReal[0] = tgeYield;
  }

  for (let t = 1; t <= p.horizon; t++) {
    const priceBefore = price;
    const supplyBefore = totalSupply;

    // 1. Depth is re-anchored to last month's circulating market cap.
    const anchoredDepth = p.depthRatio * circulating * priceBefore;
    const depth = Math.max(p.minDepthUsd, anchoredDepth);

    // 2. Vesting. Treasury rows vest into the treasury's own balance.
    const unlock = p.floatUnlock[t];
    const treasuryVest = p.treasuryUnlock[t];
    const sellUnlock = sellUnlockByMonth[t];
    treasuryTokens += treasuryVest;

    // 3. Emissions, limited by the room left under the cap. The room can
    // come out a hair below zero from rounding, hence the floor at 0.
    let emission =
      p.emissionMode === "inflation" ? supplyBefore * p.monthlyInflation : p.fixedEmission[t];
    if (p.maxSupply !== null) {
      const room = p.maxSupply - (p.capOnOutstanding ? supplyBefore : p.genesis + emitted);
      emission = Math.max(0, Math.min(emission, room));
    }
    const sellEmission = emission * p.emissionSellRate;

    // 4. Users follow a logistic curve. Revenue is split by share, and users
    // top up (or run down) the token balance they hold for spending.
    const crowding = p.saturationUsers + users * (growthFactor - 1);
    users = crowding > 0 ? (p.saturationUsers * users * growthFactor) / crowding : 0;
    const revenue = users * p.spendPerUserUsd;
    const burnUsd = revenue * p.burnShare;
    const treasuryRevenue = revenue * p.treasuryShare;
    const stakerUsd = revenue * p.stakerShare;
    const balanceTarget = p.holdingMonths * revenue;
    const balanceChange = balanceTarget - workingBalance;
    workingBalance = balanceTarget;
    const balanceBuy = Math.max(balanceChange, 0);
    const balanceSell = Math.max(-balanceChange, 0);

    // 5. Speculative inflow reacts to last month's return and to the market
    // factor, an AR(1) process in logs that stays at 0 without innovations.
    if (innovations !== null) {
      marketFactor = clamp(
        ENGINE.MARKET_PERSISTENCE * marketFactor + innovations[t],
        -ENGINE.MARKET_FACTOR_CLAMP,
        ENGINE.MARKET_FACTOR_CLAMP,
      );
    }
    const momentumFactor = clamp(
      1 +
        p.momentum *
          clamp(lastReturn, ENGINE.MOMENTUM_RETURN_MIN, ENGINE.MOMENTUM_RETURN_MAX),
      ENGINE.MOMENTUM_FACTOR_MIN,
      ENGINE.MOMENTUM_FACTOR_MAX,
    );
    const speculativeInflow = p.speculationBase[t] * momentumFactor * Math.exp(marketFactor);

    // 6. Treasury sale sizing. The treasury sells only to restore its buffer
    // of months of cost. The amount is grossed up for the slippage of selling
    // into this month's depth and capped by what it holds and by a share of
    // circulating supply.
    const cost = p.cost[t];
    const treasuryBeforeSale = treasuryUsd + treasuryRevenue - cost;
    let sale = 0;
    if (p.treasurySells) {
      const need = Math.max(0, p.bufferMonths * cost - treasuryBeforeSale);
      const grossUp =
        need < depth
          ? Math.min(ENGINE.SALE_GROSS_UP_CAP, 1 / (1 - need / depth))
          : ENGINE.SALE_GROSS_UP_CAP;
      sale = Math.min(
        (need / priceBefore) * grossUp,
        treasuryTokens,
        p.maxMonthlySaleShare * circulating,
      );
      treasuryTokens -= sale;
    }

    // 7. Flows. Holders sell a share of last month's liquid float, so staked
    // tokens are left out. Only the change in working balances counts as
    // utility buying, because gross spend is sold again by its recipients.
    const sellHolders = p.holderSellRate * liquid;
    const buy = speculativeInflow + burnUsd + balanceBuy;
    const sell = sellUnlock + sellEmission + sale + sellHolders + balanceSell / priceBefore;
    liquid += unlock + emission + sale;

    // 8. Price. A move beyond the monthly limit or the absolute bounds is
    // clamped, and the month then executes at the geometric mean of the two
    // prices because the pool's own averages no longer apply.
    const trade = poolTrade(priceBefore, depth, buy, sell);
    const lowest = Math.max(priceBefore / ENGINE.MAX_MONTHLY_PRICE_RATIO, p.priceFloor);
    const highest = Math.min(priceBefore * ENGINE.MAX_MONTHLY_PRICE_RATIO, p.priceCeiling);
    const clamped = trade.price < lowest || trade.price > highest;
    // A side with no flow has no average price (0 ÷ 0). Each price below is
    // read only when its side traded.
    let buyPrice: number;
    let sellPrice: number;
    if (clamped) {
      price = trade.price < lowest ? lowest : highest;
      buyPrice = Math.sqrt(priceBefore * price);
      sellPrice = buyPrice;
    } else {
      price = trade.price;
      buyPrice = buy / trade.tokensToBuyers;
      sellPrice = trade.usdToSellers / sell;
    }

    // 9. Treasury settlement. Costs the treasury cannot cover are recorded as
    // unpaid; a shortfall counts as running out once it is material.
    const saleUsd = sale > 0 ? sale * sellPrice : 0;
    treasuryUsd = treasuryBeforeSale + saleUsd;
    let unpaid = 0;
    if (treasuryUsd < 0) {
      unpaid = -treasuryUsd;
      treasuryUsd = 0;
    }
    if (exhaustedMonth === null && unpaid > ENGINE.EXHAUSTION_MATERIALITY * cost) {
      exhaustedMonth = t;
    }

    // 10. Burn: revenue routed to burning buys at the month's average buy
    // price, up to a share of the liquid float.
    const burnWanted = burnUsd > 0 ? burnUsd / buyPrice : 0;
    const burnLimit = ENGINE.MAX_BURN_SHARE_OF_LIQUID * liquid;
    const burnTokens = Math.min(burnWanted, burnLimit);
    liquid -= burnTokens;
    burned += burnTokens;

    // 11. Staking rebalance toward this month's target.
    circulating = liquid + staked;
    staked = p.stakingTarget[t] * circulating;
    liquid = circulating - staked;

    // 12. Bookkeeping.
    emitted += emission;
    totalSupply = p.genesis + emitted - burned;
    lastReturn = price / priceBefore - 1;
    const marketCap = circulating * price;
    priceOut[offset + t] = price;
    marketCapOut[offset + t] = marketCap;

    if (record !== null) {
      const s = record.series;
      s.fdvUsd[t] = price * (p.maxSupply ?? totalSupply);
      s.totalSupply[t] = totalSupply;
      s.circulating[t] = circulating;
      s.liquid[t] = liquid;
      s.staked[t] = staked;
      s.locked[t] = p.locked[t];
      s.treasuryTokens[t] = treasuryTokens;
      s.burnedCum[t] = burned;
      s.emittedCum[t] = emitted;
      s.treasuryUsd[t] = treasuryUsd;
      s.users[t] = users;
      s.stakedRatio[t] = circulating > 0 ? staked / circulating : 0;
      s.unlockTokens[t] = unlock;
      s.treasuryVestTokens[t] = treasuryVest;
      s.emissionTokens[t] = emission;
      s.burnTokens[t] = burnTokens;
      s.sellUnlockTokens[t] = sellUnlock;
      s.sellEmissionTokens[t] = sellEmission;
      s.sellHolderTokens[t] = sellHolders;
      s.treasurySaleTokens[t] = sale;
      s.sellPressureUsd[t] = sell * priceBefore;
      s.buyUsd[t] = buy;
      s.speculativeInflowUsd[t] = speculativeInflow;
      s.revenueUsd[t] = revenue;
      s.burnUsd[t] = burnUsd;
      s.workingBalanceBuyUsd[t] = balanceBuy;
      s.depthUsd[t] = depth;
      s.treasuryCostUsd[t] = cost;
      s.treasuryRevenueUsd[t] = treasuryRevenue;
      s.treasurySaleUsd[t] = saleUsd;
      s.unpaidCostUsd[t] = unpaid;

      // Net issuance is emission less burn. Vesting moves tokens that
      // already exist, so it is not inflation.
      const netIssuance = (emission - burnTokens) / supplyBefore;
      s.netInflationAnnualised[t] = 12 * netIssuance;
      const stakedValue = staked * price;
      if (stakedValue > 0) {
        const yieldRate =
          (emission * p.emissionToStakers * price + stakerUsd) / stakedValue;
        s.stakingYieldNominal[t] = 12 * yieldRate;
        s.stakingYieldReal[t] = 12 * ((1 + yieldRate) / (1 + netIssuance) - 1);
      } else {
        s.stakingYieldNominal[t] = null;
        s.stakingYieldReal[t] = null;
      }

      if (anchoredDepth < p.minDepthUsd) record.flags.minDepthMonths.push(t);
      if (clamped) record.flags.priceClampMonths.push(t);
      if (burnWanted > burnLimit) record.flags.burnClampMonths.push(t);
    }
  }

  return exhaustedMonth;
}

/**
 * Runs one path and keeps only price and market cap, written to the two
 * arrays from `offset` on (horizon + 1 entries each). Returns whether the
 * treasury ran out of money on this path.
 */
export function runLeanPath(
  prepared: PreparedModel,
  draws: PathDraws,
  priceOut: Float64Array,
  marketCapOut: Float64Array,
  offset: number,
): boolean {
  return simulatePath(prepared, draws, priceOut, marketCapOut, offset, null) !== null;
}

function emptySeries(length: number): MonthlySeries {
  const zeros = (): number[] => new Array<number>(length).fill(0);
  const nulls = (): (number | null)[] => new Array<number | null>(length).fill(null);
  return {
    priceUsd: zeros(),
    marketCapUsd: zeros(),
    fdvUsd: zeros(),
    totalSupply: zeros(),
    circulating: zeros(),
    liquid: zeros(),
    staked: zeros(),
    locked: zeros(),
    treasuryTokens: zeros(),
    burnedCum: zeros(),
    emittedCum: zeros(),
    treasuryUsd: zeros(),
    users: zeros(),
    stakedRatio: zeros(),
    unlockTokens: zeros(),
    treasuryVestTokens: zeros(),
    emissionTokens: zeros(),
    burnTokens: zeros(),
    sellUnlockTokens: zeros(),
    sellEmissionTokens: zeros(),
    sellHolderTokens: zeros(),
    treasurySaleTokens: zeros(),
    sellPressureUsd: zeros(),
    buyUsd: zeros(),
    speculativeInflowUsd: zeros(),
    revenueUsd: zeros(),
    burnUsd: zeros(),
    workingBalanceBuyUsd: zeros(),
    depthUsd: zeros(),
    treasuryCostUsd: zeros(),
    treasuryRevenueUsd: zeros(),
    treasurySaleUsd: zeros(),
    unpaidCostUsd: zeros(),
    stakingYieldNominal: nulls(),
    stakingYieldReal: nulls(),
    netInflationAnnualised: zeros(),
  };
}

/** The single path with every input as entered and no random shocks. */
export function runDeterministic(model: Model): CoreResult {
  const prepared = prepareModel(model);
  const length = prepared.horizon + 1;
  const record: PathRecord = {
    series: emptySeries(length),
    flags: { priceClampMonths: [], minDepthMonths: [], burnClampMonths: [] },
  };
  const price = new Float64Array(length);
  const marketCap = new Float64Array(length);
  const exhaustedMonth = simulatePath(prepared, baseDraws(prepared), price, marketCap, 0, record);
  record.series.priceUsd = Array.from(price);
  record.series.marketCapUsd = Array.from(marketCap);

  const months = Array.from({ length }, (_, month) => month);
  const allocations: AllocationSeries[] = model.allocations.map((row, i) => {
    const tokens = prepared.rowTokens[i];
    return {
      id: row.id,
      tokens,
      unlockedCum: months.map((month) => tokens * vestedFraction(row, month)),
    };
  });

  return { months, series: record.series, allocations, flags: record.flags, exhaustedMonth };
}
