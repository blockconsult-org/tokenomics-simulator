import test from "node:test";
import assert from "node:assert/strict";
import { poolTrade } from "@/simulator/engine/pool";
import { assertDecimals, assertNear } from "./fixtures.mjs";

/**
 * The pool starts with `depth` USD and depth ÷ price tokens. After the trade
 * it holds what came in less what went out, and the product of the two
 * reserves must be what it was before.
 */
function assertConstantProduct(priceBefore, depth, buyUsd, sellTokens) {
  const trade = poolTrade(priceBefore, depth, buyUsd, sellTokens);
  assert.ok(trade.tokensToBuyers >= 0, "tokens to buyers must not be negative");
  assert.ok(trade.usdToSellers >= 0, "USD to sellers must not be negative");
  const usdReserve = depth + buyUsd - trade.usdToSellers;
  const tokenReserve = depth / priceBefore + sellTokens - trade.tokensToBuyers;
  const product = (depth * depth) / priceBefore;
  assert.ok(
    Math.abs(usdReserve * tokenReserve - product) <= 1e-9 * product,
    `reserve product drifted: ${usdReserve * tokenReserve} against ${product}`,
  );
  // The end price is the ratio of the two reserves.
  assertNear(trade.price, usdReserve / tokenReserve, 1e-9, "price from reserves");
  return trade;
}

test("a one-sided trade moves the price by the closed form", () => {
  const buy = poolTrade(1, 100, 10, 0);
  assertNear(buy.price, 1.21, 1e-12, "price after a buy");
  assertNear(buy.tokensToBuyers, 100 / 11, 1e-12, "tokens bought");
  assertDecimals(buy.tokensToBuyers, 9.090909, 6, "tokens bought");
  assert.equal(buy.usdToSellers, 0);

  const sell = poolTrade(1, 100, 0, 25);
  assertNear(sell.price, 0.64, 1e-12, "price after a sell");
  assertNear(sell.usdToSellers, 20, 1e-12, "USD to sellers");
  assert.equal(sell.tokensToBuyers, 0);
});

test("no flow, or flow below the epsilon, leaves the pool untouched", () => {
  assert.deepEqual(poolTrade(2.5, 1000, 0, 0), {
    price: 2.5,
    tokensToBuyers: 0,
    usdToSellers: 0,
  });
  assert.deepEqual(poolTrade(2.5, 1000, 1e-10, 1e-11), {
    price: 2.5,
    tokensToBuyers: 0,
    usdToSellers: 0,
  });
});

test("balanced two-sided flow at the current price leaves it unchanged", () => {
  const trade = assertConstantProduct(1, 100, 30, 30);
  assert.equal(trade.price, 1);
  assertNear(trade.tokensToBuyers, 30, 1e-12, "tokens bought");
  assertNear(trade.usdToSellers, 30, 1e-12, "USD to sellers");
});

test("a two-sided trade matches 200,000 alternating constant-product slices", () => {
  const trade = assertConstantProduct(1, 100, 50, 20);
  assertDecimals(trade.price, 1.545762, 6, "price");
  assertDecimals(trade.tokensToBuyers, 39.568, 4, "tokens bought");
  assertDecimals(trade.usdToSellers, 25.6713, 4, "USD to sellers");

  const slices = 200_000;
  let usd = 100;
  let tokens = 100;
  const product = usd * tokens;
  let tokensOut = 0;
  let usdOut = 0;
  for (let i = 0; i < slices; i++) {
    usd += 50 / slices;
    tokensOut += tokens - product / usd;
    tokens = product / usd + 20 / slices;
    usdOut += usd - product / tokens;
    usd = product / tokens;
  }
  // Buying always goes first within a slice, which biases the reference by
  // about one slice relative to the reserve: 50 ÷ 200,000 ÷ 100 = 2.5e-6.
  const sliceError = 5e-6;
  assertNear(usd / tokens, trade.price, sliceError, "sliced price");
  assertNear(tokensOut, trade.tokensToBuyers, sliceError, "sliced tokens bought");
  assertNear(usdOut, trade.usdToSellers, sliceError, "sliced USD to sellers");
});

test("flows far larger than the pool settle at buy ÷ sell", () => {
  const trade = assertConstantProduct(2, 1e5, 5e6, 4e6);
  assertNear(trade.price, 1.25, 1e-12, "price");
});

test("the price moves toward buy ÷ sell and never passes it", () => {
  for (const [priceBefore, depth, buyUsd, sellTokens] of [
    [1, 100, 50, 20],
    [1, 100, 20, 50],
    [0.02, 5e6, 3e5, 4e7],
    [300, 2e4, 9e6, 10],
  ]) {
    const { price } = assertConstantProduct(priceBefore, depth, buyUsd, sellTokens);
    const target = buyUsd / sellTokens;
    // One part in 1e12 of slack: squaring √(buy ÷ sell) can land one
    // rounding step past buy ÷ sell.
    const low = Math.min(priceBefore, target) * (1 - 1e-12);
    const high = Math.max(priceBefore, target) * (1 + 1e-12);
    assert.ok(
      price >= low && price <= high,
      `price ${price} left the range between ${priceBefore} and ${target}`,
    );
  }
});
