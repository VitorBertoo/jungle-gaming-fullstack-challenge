import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Wallet } from "@/domain/wallet.entity";
import type { IWalletRepository } from "@/domain/wallet.repository.interface";
import { WALLET_REPOSITORY } from "@/domain/wallet.repository.interface";
import { WalletAlreadyExistsError } from "@/domain/errors/wallet-already-exists.error";

@Injectable()
export class CreateWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
  ) {}

  async execute(playerId: string): Promise<Wallet> {
    const existing = await this.walletRepository.findByPlayerId(playerId);
    if (existing) {
      throw new WalletAlreadyExistsError(playerId);
    }

    const wallet = Wallet.create(randomUUID(), playerId, 100_000n);
    await this.walletRepository.save(wallet);
    return wallet;
  }
}
