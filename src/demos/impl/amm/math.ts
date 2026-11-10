// Constant-product AMM math (x × y = k) for the AMM demo.
// Kept free of React so it can be unit-tested (see math.test.ts).

/** Input amount that actually enters the pool after the swap fee is taken. */
export function amountAfterFee(amountIn: number, feePercent: number): number {
  return amountIn * (1 - feePercent / 100);
}

/**
 * Output of a constant-product swap: the pool keeps reserveIn × reserveOut = k,
 * so out = reserveOut − k / (reserveIn + amountInAfterFee).
 */
export function swapOutput(reserveIn: number, reserveOut: number, amountIn: number, feePercent: number): number {
  if (amountIn <= 0) return 0;
  const k = reserveIn * reserveOut;
  return reserveOut - k / (reserveIn + amountAfterFee(amountIn, feePercent));
}

/**
 * How much worse the execution price is than the spot price, in percent (always ≥ 0).
 * Prices are expressed as "input paid per unit of output".
 */
export function priceImpactPercent(reserveIn: number, reserveOut: number, amountIn: number, amountOut: number): number {
  if (amountIn <= 0 || amountOut <= 0) return 0;
  const executionPrice = amountIn / amountOut;
  const spotPrice = reserveIn / reserveOut;
  return Math.abs(((executionPrice - spotPrice) / spotPrice) * 100);
}

/**
 * Impermanent loss in percent (≤ 0) of an LP position vs simply holding,
 * for a given ratio between the current and initial price: 2√r / (1 + r) − 1.
 */
export function impermanentLossPercent(priceRatio: number): number {
  return ((2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1) * 100;
}
