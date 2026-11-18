/**
 * Seeded random numbers for Monte Carlo runs. Math.random cannot be seeded,
 * and a share link has to reproduce the same bands on every device.
 */

/** mulberry32: a 32-bit generator returning uniform values in [0, 1). */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seed for stream `i` of a job. Neighbouring stream numbers are mixed into
 * unrelated 32-bit seeds, so every run can own its streams and the result
 * does not depend on how many runs came before it.
 */
export function runSeed(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * One standard normal draw (Box–Muller), using two uniforms. The first is in
 * [0, 1), so 1 − u is in (0, 1] and the logarithm stays finite.
 */
export function normal(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}
