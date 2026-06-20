import { createHmac, createHash, randomBytes } from "crypto";

/**
 * Provably Fair algorithm for the Crash game.
 *
 * Flow:
 *  1. Before betting opens: generate serverSeed (random), compute serverSeedHash = SHA256(serverSeed).
 *     Reveal serverSeedHash to players so they know the seed is locked.
 *  2. CrashPoint = computeCrashPoint(serverSeed, nonce) — computed deterministically before bets.
 *  3. After round crashes: reveal serverSeed.
 *  4. Players verify: SHA256(serverSeed) === serverSeedHash, then recompute crash point.
 *
 * Crash point formula:
 *  h    = HMAC-SHA256(key=serverSeed, data=nonce.toString()) → hex string
 *  e    = first 8 hex chars interpreted as 32-bit uint
 *  House edge: if e % 33 === 0 → crash at 1.00x (≈3% house edge)
 *  else: result = floor(max(100, 9900 / (1 - e / 0xFFFFFFFF))) / 100
 *                = crash multiplier as float
 *  Store as integer hundredths: e.g. 1.50x → 150
 */

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/**
 * Returns crash point as integer hundredths (e.g. 150 = 1.50x, 100 = 1.00x).
 */
export function computeCrashPoint(serverSeed: string, nonce: number): number {
  const hmac = createHmac("sha256", serverSeed);
  hmac.update(nonce.toString());
  const hash = hmac.digest("hex");

  const e = parseInt(hash.slice(0, 8), 16); // 32-bit uint: 0 .. 0xFFFFFFFF

  // House edge: ~3% of rounds crash at 1.00x
  if (e % 33 === 0) return 100;

  // Scale to multiplier >= 1.00x
  // Formula: 99 / (1 - e/0xFFFFFFFF) gives range [99, ∞)
  // We add 1 and floor to get integer hundredths
  const divisor = 1 - e / 0xffffffff;
  const raw = 99 / divisor; // e.g. 49.5 → 1.50x range
  return Math.max(100, Math.floor(raw + 100));
}

/**
 * Current multiplier at `elapsedMs` ms after round start.
 * Uses continuous exponential growth: e^(k*t)
 * k = 0.00006 gives ~2x at 11.5s, ~10x at 38.4s
 * Returns integer hundredths (e.g. 150 = 1.50x).
 */
export function computeCurrentMultiplier(elapsedMs: number): number {
  const raw = Math.pow(Math.E, 0.00006 * elapsedMs);
  return Math.max(100, Math.floor(raw * 100));
}

/**
 * Time in ms from round start until the crash point is reached.
 */
export function computeCrashTimeMs(crashPointMultiplier: number): number {
  // Inverse of computeCurrentMultiplier: t = ln(multiplier/100) / 0.00006
  const multiplierFloat = crashPointMultiplier / 100;
  return Math.ceil(Math.log(multiplierFloat) / 0.00006);
}
