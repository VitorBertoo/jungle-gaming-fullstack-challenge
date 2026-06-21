import { Inject, Injectable } from "@nestjs/common";
import { Wallet } from "@/domain/wallet.entity";
import type { IWalletRepository } from "@/domain/wallet.repository.interface";
import { WALLET_REPOSITORY } from "@/domain/wallet.repository.interface";

@Injectable()
export class GetAllWalletsUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
  ) {}

  async execute(): Promise<Wallet[]> {
    return this.walletRepository.findAll();
  }
}
