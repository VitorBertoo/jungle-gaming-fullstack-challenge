import { Inject, Injectable } from "@nestjs/common";
import {
  IRoundRepository,
  PaginatedRounds,
  ROUND_REPOSITORY,
} from "@/domain/round/round.repository.interface";

export interface GetRoundHistoryQuery {
  page: number;
  limit: number;
}

@Injectable()
export class GetRoundHistoryUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  async execute(query: GetRoundHistoryQuery): Promise<PaginatedRounds> {
    return this.roundRepository.findHistory({ page: query.page, limit: query.limit });
  }
}
