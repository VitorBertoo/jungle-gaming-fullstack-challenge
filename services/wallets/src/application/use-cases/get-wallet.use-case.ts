import { Inject, Injectable } from "@nestjs/common";
import { Wallet } from "@/domain/wallet.entity";
import {
  IWalletRepository,
  WALLET_REPOSITORY,
} from "@/domain/wallet.repository.interface";
import { WalletNotFoundError } from "@/domain/errors/wallet-not-found.error";

@Injectable()
export class GetWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
  ) {}

  async execute(playerId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findByPlayerId(playerId);
    if (!wallet) {
      throw new WalletNotFoundError(playerId);
    }
    return wallet;
  }
}
