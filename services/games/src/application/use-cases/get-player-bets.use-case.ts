import { Inject, Injectable } from "@nestjs/common";
import {
  IRoundRepository,
  PaginatedBets,
  ROUND_REPOSITORY,
} from "@/domain/round/round.repository.interface";

export interface GetPlayerBetsQuery {
  playerId: string;
  page: number;
  limit: number;
}

@Injectable()
export class GetPlayerBetsUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  async execute(query: GetPlayerBetsQuery): Promise<PaginatedBets> {
    return this.roundRepository.findPlayerBets({
      playerId: query.playerId,
      page: query.page,
      limit: query.limit,
    });
  }
}
