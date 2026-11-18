import { ENGINE } from "./constants";

export interface PoolTradeResult {
  /** Price at the end of the month. */
  price: number;
  /** Tokens the month's buyers received for `buyUsd`. */
  tokensToBuyers: number;
  /** USD the month's sellers received for `sellTokens`. */
  usdToSellers: number;
}

/**
 * Trades one month of buying (USD) and selling (tokens) through a
 * constant-product pool whose USD reserve is `depthUsd` at `priceBefore`.
 *
 * Both flows arrive evenly over the month. The result is the exact limit of
 * cutting them into ever smaller alternating slices, so there is no sub-step
 * error and no dependence on which side trades first. With u = √price and
 * √k = depth ÷ u, the pool holds √k·u USD and √k ÷ u tokens, and u moves by
 * du = (buy − sell·u²) ÷ √k over the month. It therefore heads from the
 * starting price toward buy ÷ sell and never passes it.
 */
export function poolTrade(
  priceBefore: number,
  depthUsd: number,
  buyUsd: number,
  sellTokens: number,
): PoolTradeResult {
  const u0 = Math.sqrt(priceBefore);
  const rootK = depthUsd / u0;
  // A flow too small to matter takes the one-sided branch, which keeps
  // √(buy ÷ sell) away from a zero denominator.
  const buy = buyUsd > ENGINE.FLOW_EPSILON_USD ? buyUsd : 0;
  const sell = sellTokens * priceBefore > ENGINE.FLOW_EPSILON_USD ? sellTokens : 0;

  if (buy === 0 && sell === 0) {
    return { price: priceBefore, tokensToBuyers: 0, usdToSellers: 0 };
  }
  if (sell === 0) {
    const uT = u0 + buy / rootK;
    return { price: uT * uT, tokensToBuyers: rootK * (1 / u0 - 1 / uT), usdToSellers: 0 };
  }
  if (buy === 0) {
    const uT = u0 / (1 + (sell * u0) / rootK);
    return { price: uT * uT, tokensToBuyers: 0, usdToSellers: rootK * (u0 - uT) };
  }

  const uStar = Math.sqrt(buy / sell);
  const th = Math.tanh(Math.sqrt(buy * sell) / rootK);
  const uT = (uStar * (u0 + uStar * th)) / (uStar + u0 * th);
  // Each output is a flow minus the change in the pool's reserve. When one
  // flow is tiny next to the reserve the subtraction can round a hair below
  // zero, so both are held at zero.
  return {
    price: uT * uT,
    tokensToBuyers: Math.max(0, sell - rootK * (1 / uT - 1 / u0)),
    usdToSellers: Math.max(0, buy - rootK * (uT - u0)),
  };
}
