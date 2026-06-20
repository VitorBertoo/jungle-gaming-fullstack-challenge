import { RoundStatus } from "./round-status.enum";
import { BetStatus } from "./bet-status.enum";
import { Bet } from "./bet.entity";
import { RoundNotInBettingPhaseError } from "./errors/round-not-in-betting-phase.error";
import { RoundNotInRunningPhaseError } from "./errors/round-not-in-running-phase.error";
import { BetAlreadyPlacedError } from "./errors/bet-already-placed.error";
import { NoActiveBetError } from "./errors/no-active-bet.error";
import { InvalidBetAmountError } from "./errors/invalid-bet-amount.error";

const MIN_BET_CENTS = 100n;   // 1.00
const MAX_BET_CENTS = 100000n; // 1000.00

export interface RoundProps {
  id: string;
  status: RoundStatus;
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  crashPointMultiplier: number;
  bettingEndsAt: Date;
  startedAt: Date | null;
  crashedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bets: Bet[];
}

export class Round {
  private constructor(
    public readonly id: string,
    private _status: RoundStatus,
    public readonly serverSeed: string,
    public readonly serverSeedHash: string,
    public readonly nonce: number,
    public readonly crashPointMultiplier: number,
    public readonly bettingEndsAt: Date,
    private _startedAt: Date | null,
    private _crashedAt: Date | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
    private readonly _bets: Bet[],
  ) {}

  static create(props: {
    id: string;
    serverSeed: string;
    serverSeedHash: string;
    nonce: number;
    crashPointMultiplier: number;
    bettingEndsAt: Date;
  }): Round {
    const now = new Date();
    return new Round(
      props.id,
      RoundStatus.BETTING,
      props.serverSeed,
      props.serverSeedHash,
      props.nonce,
      props.crashPointMultiplier,
      props.bettingEndsAt,
      null,
      null,
      now,
      now,
      [],
    );
  }

  static reconstitute(props: RoundProps): Round {
    return new Round(
      props.id,
      props.status,
      props.serverSeed,
      props.serverSeedHash,
      props.nonce,
      props.crashPointMultiplier,
      props.bettingEndsAt,
      props.startedAt,
      props.crashedAt,
      props.createdAt,
      props.updatedAt,
      props.bets,
    );
  }

  get status(): RoundStatus { return this._status; }
  get startedAt(): Date | null { return this._startedAt; }
  get crashedAt(): Date | null { return this._crashedAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get bets(): ReadonlyArray<Bet> { return this._bets; }

  placeBet(id: string, playerId: string, amountInCents: bigint): Bet {
    if (this._status !== RoundStatus.BETTING) {
      throw new RoundNotInBettingPhaseError();
    }

    if (amountInCents < MIN_BET_CENTS || amountInCents > MAX_BET_CENTS) {
      throw new InvalidBetAmountError(amountInCents);
    }

    const existing = this._bets.find((b) => b.playerId === playerId);
    if (existing) {
      throw new BetAlreadyPlacedError(playerId);
    }

    const bet = Bet.create(id, this.id, playerId, amountInCents);
    this._bets.push(bet);
    this._updatedAt = new Date();
    return bet;
  }

  cashOut(playerId: string, cashOutMultiplierInt: number): Bet {
    if (this._status !== RoundStatus.RUNNING) {
      throw new RoundNotInRunningPhaseError();
    }

    const bet = this._bets.find(
      (b) => b.playerId === playerId && b.status === BetStatus.ACTIVE,
    );
    if (!bet) {
      throw new NoActiveBetError(playerId);
    }

    bet.cashOut(cashOutMultiplierInt);
    this._updatedAt = new Date();
    return bet;
  }

  startGame(): void {
    if (this._status !== RoundStatus.BETTING) {
      throw new RoundNotInBettingPhaseError();
    }
    this._status = RoundStatus.RUNNING;
    this._startedAt = new Date();
    this._updatedAt = new Date();
  }

  crash(): Bet[] {
    if (this._status !== RoundStatus.RUNNING) {
      throw new RoundNotInRunningPhaseError();
    }
    this._status = RoundStatus.CRASHED;
    this._crashedAt = new Date();
    this._updatedAt = new Date();

    const losers: Bet[] = [];
    for (const bet of this._bets) {
      if (bet.status === BetStatus.ACTIVE) {
        bet.lose();
        losers.push(bet);
      }
    }
    return losers;
  }

  getBetByPlayerId(playerId: string): Bet | undefined {
    return this._bets.find((b) => b.playerId === playerId);
  }

  getBetById(betId: string): Bet | undefined {
    return this._bets.find((b) => b.id === betId);
  }
}
