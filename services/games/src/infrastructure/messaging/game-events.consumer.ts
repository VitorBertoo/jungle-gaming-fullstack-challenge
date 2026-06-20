import { Controller, Inject, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import type { IRoundRepository } from "@/domain/round/round.repository.interface";
import { ROUND_REPOSITORY } from "@/domain/round/round.repository.interface";
import { BetStatus } from "@/domain/round/bet-status.enum";

interface WalletDebitedPayload {
  correlationId: string;
  playerId: string;
  betId: string;
  roundId: string;
  newBalanceInCents: string;
}

interface WalletDebitFailedPayload {
  correlationId: string;
  playerId: string;
  betId: string;
  roundId: string;
  reason: string;
}

interface WalletCreditedPayload {
  correlationId: string;
  playerId: string;
  betId: string;
  roundId: string;
  newBalanceInCents: string;
}

@Controller()
export class GameEventsConsumer {
  private readonly logger = new Logger(GameEventsConsumer.name);

  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  @EventPattern("wallet.debited")
  async onWalletDebited(@Payload() payload: WalletDebitedPayload): Promise<void> {
    const { betId, roundId } = payload;
    this.logger.log(`Wallet debited: betId=${betId}`);

    const round = await this.roundRepository.findById(roundId);
    if (!round) return;

    const bet = round.getBetById(betId);
    if (!bet || bet.status !== BetStatus.PENDING_DEBIT) return;

    bet.confirmDebit();
    await this.roundRepository.saveBet(bet);
  }

  @EventPattern("wallet.debit.failed")
  async onWalletDebitFailed(@Payload() payload: WalletDebitFailedPayload): Promise<void> {
    const { betId, roundId, reason } = payload;
    this.logger.warn(`Wallet debit failed: betId=${betId} reason=${reason}`);

    const round = await this.roundRepository.findById(roundId);
    if (!round) return;

    const bet = round.getBetById(betId);
    if (!bet || bet.status !== BetStatus.PENDING_DEBIT) return;

    bet.cancelDebit();
    await this.roundRepository.saveBet(bet);
  }

  @EventPattern("wallet.credited")
  async onWalletCredited(@Payload() payload: WalletCreditedPayload): Promise<void> {
    const { betId, roundId } = payload;
    this.logger.log(`Wallet credited: betId=${betId}`);

    const round = await this.roundRepository.findById(roundId);
    if (!round) return;

    const bet = round.getBetById(betId);
    if (!bet || bet.status !== BetStatus.CASHED_OUT) return;

    bet.confirmWin();
    await this.roundRepository.saveBet(bet);
  }
}
