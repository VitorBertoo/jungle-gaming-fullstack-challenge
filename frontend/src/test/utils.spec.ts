import { describe, it, expect } from "vitest";
import { formatCents, formatMultiplier } from "@/lib/utils";

describe("formatCents", () => {
  it("formats zero cents", () => {
    expect(formatCents(0n)).toBe("$0.00");
  });

  it("formats whole dollar amounts", () => {
    expect(formatCents(100n)).toBe("$1.00");
    expect(formatCents(1000n)).toBe("$10.00");
    expect(formatCents(100000n)).toBe("$1000.00");
  });

  it("formats fractional dollar amounts", () => {
    expect(formatCents(150n)).toBe("$1.50");
    expect(formatCents(199n)).toBe("$1.99");
    expect(formatCents(5n)).toBe("$0.05");
    expect(formatCents(1n)).toBe("$0.01");
  });

  it("pads cents to two digits", () => {
    expect(formatCents(101n)).toBe("$1.01");
    expect(formatCents(9n)).toBe("$0.09");
  });

  it("handles large amounts without floating-point errors", () => {
    expect(formatCents(100000000n)).toBe("$1000000.00");
    expect(formatCents(33333333n)).toBe("$333333.33");
  });

  it("handles number input (rounds to nearest cent)", () => {
    expect(formatCents(1000)).toBe("$10.00");
    expect(formatCents(150)).toBe("$1.50");
  });

  it("handles negative amounts", () => {
    expect(formatCents(-100n)).toBe("-$1.00");
    expect(formatCents(-50n)).toBe("-$0.50");
  });

  it("returns BigInt-safe result (no float precision loss)", () => {
    // 0.1 + 0.2 in floating point = 0.30000000000000004
    // but with bigint cents there is no such error
    const a = 10n; // $0.10
    const b = 20n; // $0.20
    expect(formatCents(a + b)).toBe("$0.30");
  });
});

describe("formatMultiplier", () => {
  it("formats 1.00x (100)", () => {
    expect(formatMultiplier(100)).toBe("1.00x");
  });

  it("formats 1.50x (150)", () => {
    expect(formatMultiplier(150)).toBe("1.50x");
  });

  it("formats 2.00x (200)", () => {
    expect(formatMultiplier(200)).toBe("2.00x");
  });

  it("formats 10.00x (1000)", () => {
    expect(formatMultiplier(1000)).toBe("10.00x");
  });

  it("pads fractional part to two digits", () => {
    expect(formatMultiplier(105)).toBe("1.05x");
    expect(formatMultiplier(101)).toBe("1.01x");
  });

  it("formats high multipliers correctly", () => {
    expect(formatMultiplier(9999)).toBe("99.99x");
    expect(formatMultiplier(100000)).toBe("1000.00x");
  });

  it("formats crash multiplier of 317 → 3.17x", () => {
    expect(formatMultiplier(317)).toBe("3.17x");
  });
});
