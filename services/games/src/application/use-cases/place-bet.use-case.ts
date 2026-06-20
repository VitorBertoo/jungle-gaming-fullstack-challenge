import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Bet } from "@/domain/round/bet.entity";
import type { IRoundRepository } from "@/domain/round/round.repository.interface";
import { ROUND_REPOSITORY } from "@/domain/round/round.repository.interface";
import { RoundNotInBettingPhaseError } from "@/domain/round/errors/round-not-in-betting-phase.error";

export interface PlaceBetCommand {
  playerId: string;
  amountInCents: bigint;
}

@Injectable()
export class PlaceBetUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  async execute(command: PlaceBetCommand): Promise<Bet> {
    const round = await this.roundRepository.findCurrent();
    if (!round) {
      throw new RoundNotInBettingPhaseError();
    }

    const bet = round.placeBet(randomUUID(), command.playerId, command.amountInCents);
    await this.roundRepository.save(round);
    return bet;
  }
}
