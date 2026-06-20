import { Injectable } from "@nestjs/common";
import { Wallet } from "@/domain/wallet.entity";
import type { IWalletRepository } from "@/domain/wallet.repository.interface";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaWalletRepository implements IWalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPlayerId(playerId: string): Promise<Wallet | null> {
    const record = await this.prisma.wallet.findUnique({
      where: { playerId },
    });
    if (!record) return null;

    return Wallet.reconstitute({
      id: record.id,
      playerId: record.playerId,
      balanceInCents: record.balanceInCents,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async save(wallet: Wallet): Promise<void> {
    await this.prisma.wallet.upsert({
      where: { playerId: wallet.playerId },
      update: {
        balanceInCents: wallet.balanceInCents,
        updatedAt: wallet.updatedAt,
      },
      create: {
        id: wallet.id,
        playerId: wallet.playerId,
        balanceInCents: wallet.balanceInCents,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    });
  }
}
