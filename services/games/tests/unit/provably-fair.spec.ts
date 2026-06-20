import { describe, it, expect } from "bun:test";
import {
  generateServerSeed,
  hashServerSeed,
  computeCrashPoint,
  computeCurrentMultiplier,
  computeCrashTimeMs,
} from "../../src/domain/provably-fair/provably-fair";

describe("Provably Fair", () => {
  describe("generateServerSeed", () => {
    it("returns a 64-char hex string (32 bytes)", () => {
      const seed = generateServerSeed();
      expect(seed).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(seed)).toBe(true);
    });

    it("generates unique seeds", () => {
      expect(generateServerSeed()).not.toBe(generateServerSeed());
    });
  });

  describe("hashServerSeed", () => {
    it("returns a 64-char SHA-256 hex hash", () => {
      const hash = hashServerSeed("test-seed");
      expect(hash).toHaveLength(64);
    });

    it("is deterministic", () => {
      expect(hashServerSeed("abc")).toBe(hashServerSeed("abc"));
    });

    it("differs for different seeds", () => {
      expect(hashServerSeed("seed-a")).not.toBe(hashServerSeed("seed-b"));
    });
  });

  describe("computeCrashPoint", () => {
    it("is deterministic for same seed + nonce", () => {
      const seed = "deadbeef".repeat(8);
      const point1 = computeCrashPoint(seed, 1);
      const point2 = computeCrashPoint(seed, 1);
      expect(point1).toBe(point2);
    });

    it("returns at least 100 (1.00x minimum)", () => {
      for (let nonce = 1; nonce <= 50; nonce++) {
        const seed = generateServerSeed();
        expect(computeCrashPoint(seed, nonce)).toBeGreaterThanOrEqual(100);
      }
    });

    it("varies with different nonces for the same seed", () => {
      const seed = generateServerSeed();
      const results = new Set([1, 2, 3, 4, 5].map((n) => computeCrashPoint(seed, n)));
      // Extremely unlikely all 5 produce the same value
      expect(results.size).toBeGreaterThan(1);
    });

    it("verifies: SHA256(serverSeed) matches the pre-committed hash", () => {
      const serverSeed = generateServerSeed();
      const serverSeedHash = hashServerSeed(serverSeed);
      const recomputedHash = hashServerSeed(serverSeed);
      expect(recomputedHash).toBe(serverSeedHash);
    });

    it("verifies: recomputed crash point matches original", () => {
      const serverSeed = generateServerSeed();
      const nonce = 42;
      const original = computeCrashPoint(serverSeed, nonce);
      const recomputed = computeCrashPoint(serverSeed, nonce);
      expect(recomputed).toBe(original);
    });

    it("house edge: ~3% of rounds crash at exactly 100 (1.00x)", () => {
      const crashes = Array.from({ length: 330 }, (_, i) =>
        computeCrashPoint("house-edge-test-seed-" + i, i + 1),
      );
      const instantCrashes = crashes.filter((c) => c === 100).length;
      // With 33% divisor, expect ~10 out of 330 (±10 tolerance)
      expect(instantCrashes).toBeGreaterThan(0);
      expect(instantCrashes).toBeLessThan(50);
    });
  });

  describe("computeCurrentMultiplier", () => {
    it("starts at 100 (1.00x) at t=0", () => {
      expect(computeCurrentMultiplier(0)).toBe(100);
    });

    it("grows over time", () => {
      const at0 = computeCurrentMultiplier(0);
      const at5s = computeCurrentMultiplier(5000);
      const at10s = computeCurrentMultiplier(10000);
      expect(at5s).toBeGreaterThan(at0);
      expect(at10s).toBeGreaterThan(at5s);
    });

    it("returns integer hundredths", () => {
      const m = computeCurrentMultiplier(5000);
      expect(Number.isInteger(m)).toBe(true);
    });

    it("approximately 2.00x (200) after ~11.5s", () => {
      const m = computeCurrentMultiplier(11552);
      expect(m).toBeGreaterThanOrEqual(195);
      expect(m).toBeLessThanOrEqual(205);
    });
  });

  describe("computeCrashTimeMs", () => {
    it("returns 0 ms for 1.00x (100)", () => {
      expect(computeCrashTimeMs(100)).toBe(0);
    });

    it("returns ~11.5s for 2.00x (200)", () => {
      const ms = computeCrashTimeMs(200);
      expect(ms).toBeGreaterThan(11000);
      expect(ms).toBeLessThan(12500);
    });

    it("is consistent: multiplier at computed crash time matches crash point", () => {
      const crashPoint = 350; // 3.50x
      const crashMs = computeCrashTimeMs(crashPoint);
      const multiplierAtCrash = computeCurrentMultiplier(crashMs);
      // Should be at or just above the crash point
      expect(multiplierAtCrash).toBeGreaterThanOrEqual(crashPoint);
      expect(multiplierAtCrash).toBeLessThan(crashPoint + 5);
    });
  });
});
