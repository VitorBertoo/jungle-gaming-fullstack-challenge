import { Inject, Injectable } from "@nestjs/common";
import { Round } from "@/domain/round/round.entity";
import {
  IRoundRepository,
  ROUND_REPOSITORY,
} from "@/domain/round/round.repository.interface";

@Injectable()
export class GetCurrentRoundUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  async execute(): Promise<Round | null> {
    return this.roundRepository.findCurrent();
  }
}
