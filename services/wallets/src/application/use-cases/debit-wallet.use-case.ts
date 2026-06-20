import { Inject, Injectable } from "@nestjs/common";
import type { IWalletRepository } from "@/domain/wallet.repository.interface";
import { WALLET_REPOSITORY } from "@/domain/wallet.repository.interface";
import { WalletNotFoundError } from "@/domain/errors/wallet-not-found.error";

export interface DebitWalletCommand {
  playerId: string;
  amountInCents: bigint;
  correlationId: string;
  betId: string;
  roundId: string;
}

export interface DebitWalletResult {
  success: true;
  newBalanceInCents: bigint;
}

@Injectable()
export class DebitWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
  ) {}

  async execute(command: DebitWalletCommand): Promise<DebitWalletResult> {
    const wallet = await this.walletRepository.findByPlayerId(command.playerId);
    if (!wallet) {
      throw new WalletNotFoundError(command.playerId);
    }

    wallet.debit(command.amountInCents);
    await this.walletRepository.save(wallet);

    return { success: true, newBalanceInCents: wallet.balanceInCents };
  }
}
