import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IRoundRepository } from "@/domain/round/round.repository.interface";
import { ROUND_REPOSITORY } from "@/domain/round/round.repository.interface";
import { computeCrashPoint, hashServerSeed } from "@/domain/provably-fair/provably-fair";

export interface VerifyRoundResult {
  roundId: string;
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  crashPointMultiplier: number;
  verified: boolean;
}

@Injectable()
export class VerifyRoundUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  async execute(roundId: string): Promise<VerifyRoundResult> {
    const round = await this.roundRepository.findById(roundId);
    if (!round) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }

    const recomputedHash = hashServerSeed(round.serverSeed);
    const recomputedCrashPoint = computeCrashPoint(round.serverSeed, round.nonce);
    const verified =
      recomputedHash === round.serverSeedHash &&
      recomputedCrashPoint === round.crashPointMultiplier;

    return {
      roundId: round.id,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      nonce: round.nonce,
      crashPointMultiplier: round.crashPointMultiplier,
      verified,
    };
  }
}
