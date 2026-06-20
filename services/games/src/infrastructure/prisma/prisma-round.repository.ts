import { Injectable } from "@nestjs/common";
import { Round } from "@/domain/round/round.entity";
import { Bet } from "@/domain/round/bet.entity";
import { RoundStatus } from "@/domain/round/round-status.enum";
import { BetStatus } from "@/domain/round/bet-status.enum";
import {
  IRoundRepository,
  PaginatedRounds,
  PaginatedBets,
  RoundHistoryOptions,
  IPlayerBetsOptions,
} from "@/domain/round/round.repository.interface";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaRoundRepository implements IRoundRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Round | null> {
    const record = await this.prisma.round.findUnique({
      where: { id },
      include: { bets: true },
    });
    return record ? this.toRound(record) : null;
  }

  async findCurrent(): Promise<Round | null> {
    const record = await this.prisma.round.findFirst({
      where: { status: { in: ["BETTING", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
      include: { bets: true },
    });
    return record ? this.toRound(record) : null;
  }

  async findHistory(options: RoundHistoryOptions): Promise<PaginatedRounds> {
    const skip = (options.page - 1) * options.limit;
    const [records, total] = await Promise.all([
      this.prisma.round.findMany({
        where: { status: "CRASHED" },
        orderBy: { createdAt: "desc" },
        skip,
        take: options.limit,
        include: { bets: true },
      }),
      this.prisma.round.count({ where: { status: "CRASHED" } }),
    ]);

    return {
      rounds: records.map((r: Parameters<typeof this.toRound>[0]) => this.toRound(r)),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async findPlayerBets(options: IPlayerBetsOptions): Promise<PaginatedBets> {
    const skip = (options.page - 1) * options.limit;
    const [records, total] = await Promise.all([
      this.prisma.bet.findMany({
        where: { playerId: options.playerId },
        orderBy: { createdAt: "desc" },
        skip,
        take: options.limit,
      }),
      this.prisma.bet.count({ where: { playerId: options.playerId } }),
    ]);

    return {
      bets: records.map((b: Parameters<typeof this.toBet>[0]) => this.toBet(b)),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async getLastNonce(): Promise<number> {
    const last = await this.prisma.round.findFirst({
      orderBy: { nonce: "desc" },
      select: { nonce: true },
    });
    return last?.nonce ?? 0;
  }

  async save(round: Round): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.round.upsert({
        where: { id: round.id },
        update: {
          status: round.status as RoundStatus,
          startedAt: round.startedAt,
          crashedAt: round.crashedAt,
          updatedAt: round.updatedAt,
        },
        create: {
          id: round.id,
          status: round.status as RoundStatus,
          serverSeed: round.serverSeed,
          serverSeedHash: round.serverSeedHash,
          nonce: round.nonce,
          crashPointMultiplier: round.crashPointMultiplier,
          bettingEndsAt: round.bettingEndsAt,
          startedAt: round.startedAt,
          crashedAt: round.crashedAt,
          createdAt: round.createdAt,
          updatedAt: round.updatedAt,
        },
      });

      for (const bet of round.bets) {
        await tx.bet.upsert({
          where: { id: bet.id },
          update: {
            status: bet.status as BetStatus,
            cashOutMultiplier: bet.cashOutMultiplier,
            payoutInCents: bet.payoutInCents,
            updatedAt: bet.updatedAt,
          },
          create: {
            id: bet.id,
            roundId: bet.roundId,
            playerId: bet.playerId,
            amountInCents: bet.amountInCents,
            status: bet.status as BetStatus,
            cashOutMultiplier: bet.cashOutMultiplier,
            payoutInCents: bet.payoutInCents,
            createdAt: bet.createdAt,
            updatedAt: bet.updatedAt,
          },
        });
      }
    });
  }

  async saveBet(bet: Bet): Promise<void> {
    await this.prisma.bet.update({
      where: { id: bet.id },
      data: {
        status: bet.status as BetStatus,
        cashOutMultiplier: bet.cashOutMultiplier,
        payoutInCents: bet.payoutInCents,
        updatedAt: bet.updatedAt,
      },
    });
  }

  private toRound(record: {
    id: string;
    status: string;
    serverSeed: string;
    serverSeedHash: string;
    nonce: number;
    crashPointMultiplier: number;
    bettingEndsAt: Date;
    startedAt: Date | null;
    crashedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    bets: {
      id: string;
      roundId: string;
      playerId: string;
      amountInCents: bigint;
      status: string;
      cashOutMultiplier: number | null;
      payoutInCents: bigint | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
  }): Round {
    return Round.reconstitute({
      id: record.id,
      status: record.status as RoundStatus,
      serverSeed: record.serverSeed,
      serverSeedHash: record.serverSeedHash,
      nonce: record.nonce,
      crashPointMultiplier: record.crashPointMultiplier,
      bettingEndsAt: record.bettingEndsAt,
      startedAt: record.startedAt,
      crashedAt: record.crashedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      bets: record.bets.map((b) => this.toBet(b)),
    });
  }

  private toBet(record: {
    id: string;
    roundId: string;
    playerId: string;
    amountInCents: bigint;
    status: string;
    cashOutMultiplier: number | null;
    payoutInCents: bigint | null;
    createdAt: Date;
    updatedAt: Date;
  }): Bet {
    return Bet.reconstitute({
      id: record.id,
      roundId: record.roundId,
      playerId: record.playerId,
      amountInCents: record.amountInCents,
      status: record.status as BetStatus,
      cashOutMultiplier: record.cashOutMultiplier,
      payoutInCents: record.payoutInCents,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
