import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

export interface DebitRequest {
  correlationId: string;
  playerId: string;
  amountInCents: number;
  roundId: string;
  betId: string;
}

export interface CreditRequest {
  correlationId: string;
  playerId: string;
  amountInCents: number;
  roundId: string;
  betId: string;
}

@Injectable()
export class WalletEventsPublisher {
  constructor(
    @Inject("WALLET_EVENTS_CLIENT")
    private readonly client: ClientProxy,
  ) {}

  requestDebit(payload: DebitRequest): void {
    this.client.emit("wallet.debit.requested", payload);
  }

  requestCredit(payload: CreditRequest): void {
    this.client.emit("wallet.credit.requested", payload);
  }
}
