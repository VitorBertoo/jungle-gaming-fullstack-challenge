import { Inject, Injectable } from "@nestjs/common";
import { Bet } from "@/domain/round/bet.entity";
import {
  IRoundRepository,
  ROUND_REPOSITORY,
} from "@/domain/round/round.repository.interface";
import { RoundNotInRunningPhaseError } from "@/domain/round/errors/round-not-in-running-phase.error";
import { computeCurrentMultiplier } from "@/domain/provably-fair/provably-fair";

export interface CashoutCommand {
  playerId: string;
}

@Injectable()
export class CashoutUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  async execute(command: CashoutCommand): Promise<Bet> {
    const round = await this.roundRepository.findCurrent();
    if (!round || !round.startedAt) {
      throw new RoundNotInRunningPhaseError();
    }

    const elapsedMs = Date.now() - round.startedAt.getTime();
    const multiplierInt = computeCurrentMultiplier(elapsedMs);

    const bet = round.cashOut(command.playerId, multiplierInt);
    await this.roundRepository.save(round);
    return bet;
  }
}
