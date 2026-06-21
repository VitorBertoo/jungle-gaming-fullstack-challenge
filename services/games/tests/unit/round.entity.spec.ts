import { describe, it, expect, beforeEach } from "bun:test";
import { Round } from "../../src/domain/round/round.entity";
import { RoundStatus } from "../../src/domain/round/round-status.enum";
import { BetStatus } from "../../src/domain/round/bet-status.enum";
import { RoundNotInBettingPhaseError } from "../../src/domain/round/errors/round-not-in-betting-phase.error";
import { RoundNotInRunningPhaseError } from "../../src/domain/round/errors/round-not-in-running-phase.error";
import { BetAlreadyPlacedError } from "../../src/domain/round/errors/bet-already-placed.error";
import { NoActiveBetError } from "../../src/domain/round/errors/no-active-bet.error";
import { InvalidBetAmountError } from "../../src/domain/round/errors/invalid-bet-amount.error";

function makeRound(status: RoundStatus = RoundStatus.BETTING): Round {
  const round = Round.create({
    id: "round-1",
    serverSeed: "abc123",
    serverSeedHash: "hash123",
    nonce: 1,
    crashPointMultiplier: 200,
    bettingEndsAt: new Date(Date.now() + 10000),
  });
  if (status === RoundStatus.RUNNING) {
    round.startGame();
  } else if (status === RoundStatus.CRASHED) {
    round.startGame();
    round.crash();
  }
  return round;
}

describe("Round", () => {
  describe("create", () => {
    it("starts in BETTING status", () => {
      const round = makeRound();
      expect(round.status).toBe(RoundStatus.BETTING);
    });

    it("has no bets initially", () => {
      expect(makeRound().bets).toHaveLength(0);
    });
  });

  describe("placeBet", () => {
    let round: Round;
    beforeEach(() => { round = makeRound(RoundStatus.BETTING); });

    it("creates a bet in PENDING_DEBIT status", () => {
      const bet = round.placeBet("b1", "player-1", 1000n);
      expect(bet.status).toBe(BetStatus.PENDING_DEBIT);
      expect(bet.amountInCents).toBe(1000n);
      expect(bet.playerId).toBe("player-1");
    });

    it("appends the bet to the round", () => {
      round.placeBet("b1", "player-1", 1000n);
      expect(round.bets).toHaveLength(1);
    });

    it("throws BetAlreadyPlacedError for duplicate player", () => {
      round.placeBet("b1", "player-1", 1000n);
      expect(() => round.placeBet("b2", "player-1", 500n)).toThrow(BetAlreadyPlacedError);
    });

    it("allows a new bet after previous bet was cancelled (e.g. insufficient funds)", () => {
      const bet = round.placeBet("b1", "player-1", 1000n);
      bet.cancelDebit();
      expect(() => round.placeBet("b2", "player-1", 500n)).not.toThrow();
    });

    it("throws RoundNotInBettingPhaseError when RUNNING", () => {
      const running = makeRound(RoundStatus.RUNNING);
      expect(() => running.placeBet("b1", "player-1", 1000n)).toThrow(RoundNotInBettingPhaseError);
    });

    it("throws RoundNotInBettingPhaseError when CRASHED", () => {
      const crashed = makeRound(RoundStatus.CRASHED);
      expect(() => crashed.placeBet("b1", "player-1", 1000n)).toThrow(RoundNotInBettingPhaseError);
    });

    it("throws InvalidBetAmountError below minimum (99 cents)", () => {
      expect(() => round.placeBet("b1", "player-1", 99n)).toThrow(InvalidBetAmountError);
    });

    it("throws InvalidBetAmountError above maximum (100001 cents)", () => {
      expect(() => round.placeBet("b1", "player-1", 100001n)).toThrow(InvalidBetAmountError);
    });

    it("allows minimum bet (100 cents = 1.00)", () => {
      expect(() => round.placeBet("b1", "player-1", 100n)).not.toThrow();
    });

    it("allows maximum bet (100000 cents = 1000.00)", () => {
      expect(() => round.placeBet("b1", "player-1", 100000n)).not.toThrow();
    });
  });

  describe("startGame", () => {
    it("transitions BETTING → RUNNING and sets startedAt", () => {
      const round = makeRound(RoundStatus.BETTING);
      round.startGame();
      expect(round.status).toBe(RoundStatus.RUNNING);
      expect(round.startedAt).not.toBeNull();
    });

    it("throws RoundNotInBettingPhaseError when already RUNNING", () => {
      const round = makeRound(RoundStatus.RUNNING);
      expect(() => round.startGame()).toThrow(RoundNotInBettingPhaseError);
    });
  });

  describe("cashOut", () => {
    let round: Round;

    beforeEach(() => {
      round = makeRound(RoundStatus.BETTING);
      const bet = round.placeBet("b1", "player-1", 1000n);
      bet.confirmDebit(); // activate the bet
      round.startGame();
    });

    it("records cashout multiplier and calculates payout", () => {
      const bet = round.cashOut("player-1", 250); // 2.50x
      expect(bet.status).toBe(BetStatus.CASHED_OUT);
      expect(bet.cashOutMultiplier).toBe(250);
      expect(bet.payoutInCents).toBe(2500n); // 1000 * 250 / 100
    });

    it("throws NoActiveBetError when player has no active bet", () => {
      expect(() => round.cashOut("unknown-player", 150)).toThrow(NoActiveBetError);
    });

    it("throws RoundNotInRunningPhaseError when round is BETTING", () => {
      const betting = makeRound(RoundStatus.BETTING);
      expect(() => betting.cashOut("player-1", 150)).toThrow(RoundNotInRunningPhaseError);
    });
  });

  describe("crash", () => {
    it("transitions RUNNING → CRASHED, sets crashedAt, marks active bets LOST", () => {
      const round = makeRound(RoundStatus.BETTING);
      const bet = round.placeBet("b1", "player-1", 1000n);
      bet.confirmDebit();
      round.startGame();

      const losers = round.crash();

      expect(round.status).toBe(RoundStatus.CRASHED);
      expect(round.crashedAt).not.toBeNull();
      expect(losers).toHaveLength(1);
      expect(losers[0].status).toBe(BetStatus.LOST);
    });

    it("does not mark CASHED_OUT bets as LOST", () => {
      const round = makeRound(RoundStatus.BETTING);
      const bet = round.placeBet("b1", "player-1", 1000n);
      bet.confirmDebit();
      round.startGame();
      round.cashOut("player-1", 150);

      const losers = round.crash();
      expect(losers).toHaveLength(0);
      expect(round.bets[0].status).toBe(BetStatus.CASHED_OUT);
    });

    it("throws RoundNotInRunningPhaseError when BETTING", () => {
      expect(() => makeRound(RoundStatus.BETTING).crash()).toThrow(RoundNotInRunningPhaseError);
    });

    it("throws RoundNotInRunningPhaseError when already CRASHED", () => {
      expect(() => makeRound(RoundStatus.CRASHED).crash()).toThrow(RoundNotInRunningPhaseError);
    });
  });

  describe("payout precision", () => {
    it("computes payout with integer arithmetic (no float errors)", () => {
      const round = makeRound(RoundStatus.BETTING);
      const bet = round.placeBet("b1", "player-1", 99999n);
      bet.confirmDebit();
      round.startGame();

      const cashedOut = round.cashOut("player-1", 317); // 3.17x
      // 99999 * 317 = 31,699,683 → floor(31,699,683 / 100) = 316,996
      expect(cashedOut.payoutInCents).toBe(316996n);
      expect(typeof cashedOut.payoutInCents).toBe("bigint");
    });
  });
});
