import type { AllocationRow } from "./types";

type VestingTerms = Pick<
  AllocationRow,
  "tgeUnlock" | "cliffMonths" | "vestingMonths" | "vestingStepMonths"
>;

/**
 * Fraction of a row that has unlocked by the end of `month`.
 *
 * The TGE share unlocks at month 0. Nothing more unlocks until the cliff has
 * passed, and nothing jumps at the cliff itself: the first tranche lands one
 * step after it. The comparison with vestingMonths comes before the division,
 * so a row with no vesting period unlocks in full at its cliff.
 */
export function vestedFraction(row: VestingTerms, month: number): number {
  if (month < row.cliffMonths) return row.tgeUnlock;
  const elapsed = month - row.cliffMonths;
  if (elapsed >= row.vestingMonths) return 1;
  const steps = Math.floor(elapsed / row.vestingStepMonths);
  return (
    row.tgeUnlock +
    ((1 - row.tgeUnlock) * (steps * row.vestingStepMonths)) / row.vestingMonths
  );
}

/** Tokens of a row that unlock during `month` (at TGE for month 0). */
export function unlockedInMonth(
  row: VestingTerms,
  tokens: number,
  month: number,
): number {
  if (month <= 0) return tokens * vestedFraction(row, 0);
  return tokens * (vestedFraction(row, month) - vestedFraction(row, month - 1));
}
