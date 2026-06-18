import { InsufficientBalanceError } from "./errors/insufficient-balance.error";

export interface WalletProps {
  id: string;
  playerId: string;
  balanceInCents: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    private _balanceInCents: bigint,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(id: string, playerId: string): Wallet {
    const now = new Date();
    return new Wallet(id, playerId, 0n, now, now);
  }

  static reconstitute(props: WalletProps): Wallet {
    return new Wallet(
      props.id,
      props.playerId,
      props.balanceInCents,
      props.createdAt,
      props.updatedAt,
    );
  }

  get balanceInCents(): bigint {
    return this._balanceInCents;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  credit(amountInCents: bigint): void {
    if (amountInCents <= 0n) {
      throw new Error("Credit amount must be positive");
    }
    this._balanceInCents += amountInCents;
    this._updatedAt = new Date();
  }

  debit(amountInCents: bigint): void {
    if (amountInCents <= 0n) {
      throw new Error("Debit amount must be positive");
    }
    if (this._balanceInCents < amountInCents) {
      throw new InsufficientBalanceError(this._balanceInCents, amountInCents);
    }
    this._balanceInCents -= amountInCents;
    this._updatedAt = new Date();
  }
}
