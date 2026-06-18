import { Inject, Injectable } from "@nestjs/common";
import {
  IWalletRepository,
  WALLET_REPOSITORY,
} from "@/domain/wallet.repository.interface";
import { WalletNotFoundError } from "@/domain/errors/wallet-not-found.error";

export interface CreditWalletCommand {
  playerId: string;
  amountInCents: bigint;
  correlationId: string;
  betId: string;
  roundId: string;
}

export interface CreditWalletResult {
  success: true;
  newBalanceInCents: bigint;
}

@Injectable()
export class CreditWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
  ) {}

  async execute(command: CreditWalletCommand): Promise<CreditWalletResult> {
    const wallet = await this.walletRepository.findByPlayerId(command.playerId);
    if (!wallet) {
      throw new WalletNotFoundError(command.playerId);
    }

    wallet.credit(command.amountInCents);
    await this.walletRepository.save(wallet);

    return { success: true, newBalanceInCents: wallet.balanceInCents };
  }
}
