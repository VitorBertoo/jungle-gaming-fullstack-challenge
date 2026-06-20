import { BetStatus } from "./bet-status.enum";
import { AlreadyCashedOutError } from "./errors/already-cashed-out.error";

export interface BetProps {
  id: string;
  roundId: string;
  playerId: string;
  amountInCents: bigint;
  status: BetStatus;
  cashOutMultiplier: number | null;
  payoutInCents: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Bet {
  private constructor(
    public readonly id: string,
    public readonly roundId: string,
    public readonly playerId: string,
    public readonly amountInCents: bigint,
    private _status: BetStatus,
    private _cashOutMultiplier: number | null,
    private _payoutInCents: bigint | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    id: string,
    roundId: string,
    playerId: string,
    amountInCents: bigint,
  ): Bet {
    const now = new Date();
    return new Bet(id, roundId, playerId, amountInCents, BetStatus.PENDING_DEBIT, null, null, now, now);
  }

  static reconstitute(props: BetProps): Bet {
    return new Bet(
      props.id,
      props.roundId,
      props.playerId,
      props.amountInCents,
      props.status,
      props.cashOutMultiplier,
      props.payoutInCents,
      props.createdAt,
      props.updatedAt,
    );
  }

  get status(): BetStatus { return this._status; }
  get cashOutMultiplier(): number | null { return this._cashOutMultiplier; }
  get payoutInCents(): bigint | null { return this._payoutInCents; }
  get updatedAt(): Date { return this._updatedAt; }

  confirmDebit(): void {
    this._status = BetStatus.ACTIVE;
    this._updatedAt = new Date();
  }

  cancelDebit(): void {
    this._status = BetStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  /**
   * cashOutMultiplierInt: integer hundredths, e.g. 150 = 1.50x
   * payout = floor(amountInCents * multiplierInt / 100)
   */
  cashOut(cashOutMultiplierInt: number): void {
    if (this._status === BetStatus.CASHED_OUT) {
      throw new AlreadyCashedOutError(this.playerId);
    }
    this._cashOutMultiplier = cashOutMultiplierInt;
    this._payoutInCents = (this.amountInCents * BigInt(cashOutMultiplierInt)) / 100n;
    this._status = BetStatus.CASHED_OUT;
    this._updatedAt = new Date();
  }

  confirmWin(): void {
    this._status = BetStatus.WON;
    this._updatedAt = new Date();
  }

  lose(): void {
    this._status = BetStatus.LOST;
    this._updatedAt = new Date();
  }

  get isActive(): boolean {
    return this._status === BetStatus.ACTIVE;
  }
}
