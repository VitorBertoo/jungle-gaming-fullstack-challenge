import { describe, it, expect, beforeEach } from "bun:test";
import { Wallet } from "../../src/domain/wallet.entity";
import { InsufficientBalanceError } from "../../src/domain/errors/insufficient-balance.error";

describe("Wallet", () => {
  let wallet: Wallet;

  beforeEach(() => {
    wallet = Wallet.create("test-id", "player-1");
  });

  describe("create", () => {
    it("starts with zero balance", () => {
      expect(wallet.balanceInCents).toBe(0n);
    });

    it("assigns the given playerId", () => {
      expect(wallet.playerId).toBe("player-1");
    });
  });

  describe("credit", () => {
    it("increases balance by the given amount", () => {
      wallet.credit(500n);
      expect(wallet.balanceInCents).toBe(500n);
    });

    it("accumulates multiple credits", () => {
      wallet.credit(100n);
      wallet.credit(250n);
      expect(wallet.balanceInCents).toBe(350n);
    });

    it("throws on zero amount", () => {
      expect(() => wallet.credit(0n)).toThrow("Credit amount must be positive");
    });

    it("throws on negative amount", () => {
      expect(() => wallet.credit(-1n)).toThrow("Credit amount must be positive");
    });
  });

  describe("debit", () => {
    beforeEach(() => {
      wallet.credit(1000n);
    });

    it("decreases balance by the given amount", () => {
      wallet.debit(300n);
      expect(wallet.balanceInCents).toBe(700n);
    });

    it("allows debit equal to full balance", () => {
      wallet.debit(1000n);
      expect(wallet.balanceInCents).toBe(0n);
    });

    it("throws InsufficientBalanceError when amount exceeds balance", () => {
      expect(() => wallet.debit(1001n)).toThrow(InsufficientBalanceError);
    });

    it("InsufficientBalanceError message contains formatted balance and required amount", () => {
      let error: Error | null = null;
      try {
        wallet.debit(9999n);
      } catch (err) {
        error = err as Error;
      }
      expect(error).not.toBeNull();
      // balance is $10.00 (1000 cents), required is $99.99 (9999 cents)
      expect(error!.message).toContain("$10.00");
      expect(error!.message).toContain("$99.99");
    });

    it("throws on zero amount", () => {
      expect(() => wallet.debit(0n)).toThrow("Debit amount must be positive");
    });

    it("does not mutate balance after a failed debit", () => {
      try {
        wallet.debit(9999n);
      } catch {
        // expected
      }
      expect(wallet.balanceInCents).toBe(1000n);
    });
  });

  describe("monetary precision", () => {
    it("handles large amounts without floating-point errors", () => {
      wallet.credit(100000000n); // 1,000,000.00 in cents
      wallet.debit(33333333n);
      expect(wallet.balanceInCents).toBe(66666667n);
    });

    it("balance is always a BigInt (never float)", () => {
      wallet.credit(100n);
      expect(typeof wallet.balanceInCents).toBe("bigint");
    });
  });

  describe("reconstitute", () => {
    it("restores all fields from persistence", () => {
      const now = new Date();
      const reconstituted = Wallet.reconstitute({
        id: "some-id",
        playerId: "player-42",
        balanceInCents: 5000n,
        createdAt: now,
        updatedAt: now,
      });

      expect(reconstituted.id).toBe("some-id");
      expect(reconstituted.playerId).toBe("player-42");
      expect(reconstituted.balanceInCents).toBe(5000n);
    });
  });
});
