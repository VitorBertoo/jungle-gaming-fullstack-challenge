import { Controller, Inject, Logger } from "@nestjs/common";
import { ClientProxy, EventPattern, Payload } from "@nestjs/microservices";
import { DebitWalletUseCase } from "@/application/use-cases/debit-wallet.use-case";
import { CreditWalletUseCase } from "@/application/use-cases/credit-wallet.use-case";
import { InsufficientBalanceError } from "@/domain/errors/insufficient-balance.error";
import { WalletNotFoundError } from "@/domain/errors/wallet-not-found.error";

export interface DebitRequestedPayload {
  correlationId: string;
  playerId: string;
  amountInCents: number;
  roundId: string;
  betId: string;
}

export interface CreditRequestedPayload {
  correlationId: string;
  playerId: string;
  amountInCents: number;
  roundId: string;
  betId: string;
}

@Controller()
export class WalletEventsConsumer {
  private readonly logger = new Logger(WalletEventsConsumer.name);

  constructor(
    private readonly debitWallet: DebitWalletUseCase,
    private readonly creditWallet: CreditWalletUseCase,
    @Inject("GAME_EVENTS_CLIENT")
    private readonly gameEventsClient: ClientProxy,
  ) {}

  @EventPattern("wallet.debit.requested")
  async onDebitRequested(@Payload() payload: DebitRequestedPayload): Promise<void> {
    const { correlationId, playerId, amountInCents, roundId, betId } = payload;
    this.logger.log(`Debit requested: betId=${betId} amount=${amountInCents}`);

    try {
      const result = await this.debitWallet.execute({
        playerId,
        amountInCents: BigInt(amountInCents),
        correlationId,
        betId,
        roundId,
      });

      this.gameEventsClient.emit("wallet.debited", {
        correlationId,
        playerId,
        amountInCents,
        newBalanceInCents: result.newBalanceInCents.toString(),
        betId,
        roundId,
      });
    } catch (err) {
      const reason =
        err instanceof InsufficientBalanceError || err instanceof WalletNotFoundError
          ? err.message
          : "Internal error";

      this.logger.warn(`Debit failed: betId=${betId} reason=${reason}`);

      this.gameEventsClient.emit("wallet.debit.failed", {
        correlationId,
        playerId,
        betId,
        roundId,
        reason,
      });
    }
  }

  @EventPattern("wallet.credit.requested")
  async onCreditRequested(@Payload() payload: CreditRequestedPayload): Promise<void> {
    const { correlationId, playerId, amountInCents, roundId, betId } = payload;
    this.logger.log(`Credit requested: betId=${betId} amount=${amountInCents}`);

    try {
      const result = await this.creditWallet.execute({
        playerId,
        amountInCents: BigInt(amountInCents),
        correlationId,
        betId,
        roundId,
      });

      this.gameEventsClient.emit("wallet.credited", {
        correlationId,
        playerId,
        amountInCents,
        newBalanceInCents: result.newBalanceInCents.toString(),
        betId,
        roundId,
      });
    } catch (err) {
      this.logger.error(`Credit failed: betId=${betId}`, err);
    }
  }
}
