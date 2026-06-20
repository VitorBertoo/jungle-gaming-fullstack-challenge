import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "@/infrastructure/auth/jwt-auth.guard";
import { AuthenticatedPlayer } from "@/infrastructure/auth/jwt.strategy";
import { WalletEventsPublisher } from "@/infrastructure/messaging/wallet-events.publisher";
import { RoundLifecycleService } from "@/application/services/round-lifecycle.service";
import { PlaceBetUseCase } from "@/application/use-cases/place-bet.use-case";
import { CashoutUseCase } from "@/application/use-cases/cashout.use-case";
import { GetCurrentRoundUseCase } from "@/application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "@/application/use-cases/get-round-history.use-case";
import { GetPlayerBetsUseCase } from "@/application/use-cases/get-player-bets.use-case";
import { VerifyRoundUseCase } from "@/application/use-cases/verify-round.use-case";
import { RoundNotInBettingPhaseError } from "@/domain/round/errors/round-not-in-betting-phase.error";
import { RoundNotInRunningPhaseError } from "@/domain/round/errors/round-not-in-running-phase.error";
import { BetAlreadyPlacedError } from "@/domain/round/errors/bet-already-placed.error";
import { NoActiveBetError } from "@/domain/round/errors/no-active-bet.error";
import { AlreadyCashedOutError } from "@/domain/round/errors/already-cashed-out.error";
import { InvalidBetAmountError } from "@/domain/round/errors/invalid-bet-amount.error";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { PlaceBetDto } from "../dtos/place-bet.dto";
import { RoundResponseDto } from "../dtos/round-response.dto";
import { BetResponseDto } from "../dtos/bet-response.dto";
import { VerifyRoundResponseDto } from "../dtos/verify-round-response.dto";
import { Round } from "@/domain/round/round.entity";
import { Bet } from "@/domain/round/bet.entity";
import { RoundStatus } from "@/domain/round/round-status.enum";

interface RequestWithPlayer extends Request {
  user: AuthenticatedPlayer;
}

@Controller()
export class GamesController {
  constructor(
    private readonly placeBetUseCase: PlaceBetUseCase,
    private readonly cashoutUseCase: CashoutUseCase,
    private readonly getCurrentRound: GetCurrentRoundUseCase,
    private readonly getRoundHistory: GetRoundHistoryUseCase,
    private readonly getPlayerBets: GetPlayerBetsUseCase,
    private readonly verifyRound: VerifyRoundUseCase,
    private readonly walletPublisher: WalletEventsPublisher,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get("rounds/current")
  async getCurrent(): Promise<RoundResponseDto | null> {
    const round = await this.getCurrentRound.execute();
    return round ? this.toRoundDto(round) : null;
  }

  @Get("rounds/history")
  async getHistory(
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ): Promise<{ data: RoundResponseDto[]; total: number; page: number; limit: number }> {
    const result = await this.getRoundHistory.execute({
      page: Math.max(1, parseInt(page)),
      limit: Math.min(100, Math.max(1, parseInt(limit))),
    });
    return {
      data: result.rounds.map((r) => this.toRoundDto(r)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get("rounds/:roundId/verify")
  async verify(@Param("roundId") roundId: string): Promise<VerifyRoundResponseDto> {
    return this.verifyRound.execute(roundId);
  }

  @Get("bets/me")
  @UseGuards(JwtAuthGuard)
  async getMyBets(
    @Request() req: RequestWithPlayer,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ): Promise<{ data: BetResponseDto[]; total: number; page: number; limit: number }> {
    const result = await this.getPlayerBets.execute({
      playerId: req.user.sub,
      page: Math.max(1, parseInt(page)),
      limit: Math.min(100, Math.max(1, parseInt(limit))),
    });
    return {
      data: result.bets.map((b) => this.toBetDto(b)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Post("bet")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async placeBet(
    @Request() req: RequestWithPlayer,
    @Body() dto: PlaceBetDto,
  ): Promise<BetResponseDto> {
    if (!dto.amountInCents || typeof dto.amountInCents !== "number") {
      throw new BadRequestException("amountInCents must be a positive integer");
    }

    try {
      const bet = await this.placeBetUseCase.execute({
        playerId: req.user.sub,
        amountInCents: BigInt(Math.floor(dto.amountInCents)),
      });

      // Async: request wallet debit
      this.walletPublisher.requestDebit({
        correlationId: bet.id,
        playerId: req.user.sub,
        amountInCents: Number(bet.amountInCents),
        roundId: bet.roundId,
        betId: bet.id,
      });

      // Notify clients
      await this.lifecycle.notifyBetPlaced(bet.roundId, bet.id, req.user.sub, bet.amountInCents);

      return this.toBetDto(bet);
    } catch (err) {
      if (err instanceof RoundNotInBettingPhaseError) throw new UnprocessableEntityException(err.message);
      if (err instanceof BetAlreadyPlacedError) throw new ConflictException(err.message);
      if (err instanceof InvalidBetAmountError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  @Post("bet/cashout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cashout(@Request() req: RequestWithPlayer): Promise<BetResponseDto> {
    try {
      const bet = await this.cashoutUseCase.execute({ playerId: req.user.sub });

      await this.lifecycle.notifyCashout(
        bet.roundId,
        bet.id,
        req.user.sub,
        bet.cashOutMultiplier!,
        bet.payoutInCents!,
      );

      return this.toBetDto(bet);
    } catch (err) {
      if (err instanceof RoundNotInRunningPhaseError) throw new UnprocessableEntityException(err.message);
      if (err instanceof NoActiveBetError) throw new NotFoundException(err.message);
      if (err instanceof AlreadyCashedOutError) throw new ConflictException(err.message);
      throw err;
    }
  }

  private toRoundDto(round: Round): RoundResponseDto {
    const isCrashed = round.status === RoundStatus.CRASHED;
    return {
      id: round.id,
      status: round.status,
      serverSeedHash: round.serverSeedHash,
      nonce: round.nonce,
      bettingEndsAt: round.bettingEndsAt.toISOString(),
      startedAt: round.startedAt?.toISOString() ?? null,
      crashedAt: round.crashedAt?.toISOString() ?? null,
      // Only reveal crash point after round ends
      crashPointMultiplier: isCrashed ? round.crashPointMultiplier : null,
      bets: round.bets.map((b) => this.toBetDto(b)),
    };
  }

  private toBetDto(bet: Bet): BetResponseDto {
    return {
      id: bet.id,
      roundId: bet.roundId,
      playerId: bet.playerId,
      amountInCents: bet.amountInCents.toString(),
      status: bet.status,
      cashOutMultiplier: bet.cashOutMultiplier,
      payoutInCents: bet.payoutInCents?.toString() ?? null,
      createdAt: bet.createdAt.toISOString(),
    };
  }
}
