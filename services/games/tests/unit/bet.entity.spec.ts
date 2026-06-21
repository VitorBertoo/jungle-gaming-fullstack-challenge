import { describe, it, expect, beforeEach } from "bun:test";
import { Bet } from "../../src/domain/round/bet.entity";
import { BetStatus } from "../../src/domain/round/bet-status.enum";
import { AlreadyCashedOutError } from "../../src/domain/round/errors/already-cashed-out.error";

function makeBet(amountInCents = 1000n): Bet {
  return Bet.create("bet-1", "round-1", "player-1", amountInCents);
}

describe("Bet", () => {
  describe("create", () => {
    it("starts in PENDING_DEBIT status", () => {
      expect(makeBet().status).toBe(BetStatus.PENDING_DEBIT);
    });

    it("has no cashout multiplier or payout initially", () => {
      const bet = makeBet();
      expect(bet.cashOutMultiplier).toBeNull();
      expect(bet.payoutInCents).toBeNull();
    });

    it("stores the given amountInCents as BigInt", () => {
      const bet = makeBet(5000n);
      expect(bet.amountInCents).toBe(5000n);
      expect(typeof bet.amountInCents).toBe("bigint");
    });

    it("is not active initially", () => {
      expect(makeBet().isActive).toBe(false);
    });
  });

  describe("confirmDebit", () => {
    it("transitions PENDING_DEBIT → ACTIVE", () => {
      const bet = makeBet();
      bet.confirmDebit();
      expect(bet.status).toBe(BetStatus.ACTIVE);
    });

    it("marks bet as active", () => {
      const bet = makeBet();
      bet.confirmDebit();
      expect(bet.isActive).toBe(true);
    });

    it("updates updatedAt", () => {
      const bet = makeBet();
      const before = bet.updatedAt;
      bet.confirmDebit();
      expect(bet.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe("cancelDebit", () => {
    it("transitions PENDING_DEBIT → CANCELLED", () => {
      const bet = makeBet();
      bet.cancelDebit();
      expect(bet.status).toBe(BetStatus.CANCELLED);
    });

    it("marks bet as not active after cancel", () => {
      const bet = makeBet();
      bet.cancelDebit();
      expect(bet.isActive).toBe(false);
    });
  });

  describe("cashOut", () => {
    let bet: Bet;

    beforeEach(() => {
      bet = makeBet(1000n);
      bet.confirmDebit();
    });

    it("transitions ACTIVE → CASHED_OUT", () => {
      bet.cashOut(250); // 2.50x
      expect(bet.status).toBe(BetStatus.CASHED_OUT);
    });

    it("records cashout multiplier", () => {
      bet.cashOut(250);
      expect(bet.cashOutMultiplier).toBe(250);
    });

    it("calculates payout: floor(amount * multiplier / 100)", () => {
      bet.cashOut(250); // 1000 * 250 / 100 = 2500
      expect(bet.payoutInCents).toBe(2500n);
    });

    it("calculates payout with floor for non-round amounts", () => {
      const oddBet = Bet.create("b2", "r1", "p1", 333n);
      oddBet.confirmDebit();
      oddBet.cashOut(200); // 333 * 200 / 100 = 666
      expect(oddBet.payoutInCents).toBe(666n);
    });

    it("payout is always BigInt", () => {
      bet.cashOut(150);
      expect(typeof bet.payoutInCents).toBe("bigint");
    });

    it("throws AlreadyCashedOutError on double cashout", () => {
      bet.cashOut(200);
      expect(() => bet.cashOut(300)).toThrow(AlreadyCashedOutError);
    });

    it("1.00x payout equals original bet amount", () => {
      bet.cashOut(100);
      expect(bet.payoutInCents).toBe(1000n);
    });
  });

  describe("lose", () => {
    it("transitions ACTIVE → LOST", () => {
      const bet = makeBet();
      bet.confirmDebit();
      bet.lose();
      expect(bet.status).toBe(BetStatus.LOST);
    });

    it("marks bet as not active after losing", () => {
      const bet = makeBet();
      bet.confirmDebit();
      bet.lose();
      expect(bet.isActive).toBe(false);
    });
  });

  describe("confirmWin", () => {
    it("transitions to WON status", () => {
      const bet = makeBet();
      bet.confirmDebit();
      bet.confirmWin();
      expect(bet.status).toBe(BetStatus.WON);
    });
  });

  describe("reconstitute", () => {
    it("restores all fields from persistence", () => {
      const now = new Date();
      const restored = Bet.reconstitute({
        id: "bet-restored",
        roundId: "round-42",
        playerId: "player-99",
        amountInCents: 7500n,
        status: BetStatus.CASHED_OUT,
        cashOutMultiplier: 350,
        payoutInCents: 26250n,
        createdAt: now,
        updatedAt: now,
      });

      expect(restored.id).toBe("bet-restored");
      expect(restored.roundId).toBe("round-42");
      expect(restored.playerId).toBe("player-99");
      expect(restored.amountInCents).toBe(7500n);
      expect(restored.status).toBe(BetStatus.CASHED_OUT);
      expect(restored.cashOutMultiplier).toBe(350);
      expect(restored.payoutInCents).toBe(26250n);
    });
  });

  describe("payout precision", () => {
    it("handles large amounts without floating-point errors", () => {
      const bet = Bet.create("b", "r", "p", 99999n);
      bet.confirmDebit();
      // 99999 * 317 = 31,699,683 → floor(/ 100) = 316,996
      bet.cashOut(317);
      expect(bet.payoutInCents).toBe(316996n);
    });

    it("payout is never negative", () => {
      const bet = makeBet(100n);
      bet.confirmDebit();
      bet.cashOut(100); // min 1.00x — payout = 100
      expect(bet.payoutInCents! >= 0n).toBe(true);
    });
  });
});
