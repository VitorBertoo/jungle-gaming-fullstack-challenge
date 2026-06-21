import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { JwtAuthGuard } from "@/infrastructure/auth/jwt-auth.guard";
import { AuthenticatedPlayer } from "@/infrastructure/auth/jwt.strategy";
import { CreateWalletUseCase } from "@/application/use-cases/create-wallet.use-case";
import { GetWalletUseCase } from "@/application/use-cases/get-wallet.use-case";
import { CreditWalletUseCase } from "@/application/use-cases/credit-wallet.use-case";
import { WalletAlreadyExistsError } from "@/domain/errors/wallet-already-exists.error";
import { WalletNotFoundError } from "@/domain/errors/wallet-not-found.error";
import { WalletResponseDto } from "../dtos/wallet-response.dto";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";

interface RequestWithPlayer extends Request {
  user: AuthenticatedPlayer;
}

@Controller()
export class WalletsController {
  constructor(
    private readonly createWallet: CreateWalletUseCase,
    private readonly getWallet: GetWalletUseCase,
    private readonly creditWallet: CreditWalletUseCase,
  ) {}

  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: RequestWithPlayer): Promise<WalletResponseDto> {
    try {
      const wallet = await this.createWallet.execute(req.user.sub);
      return this.toDto(wallet);
    } catch (err) {
      if (err instanceof WalletAlreadyExistsError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: RequestWithPlayer): Promise<WalletResponseDto> {
    try {
      const wallet = await this.getWallet.execute(req.user.sub);
      return this.toDto(wallet);
    } catch (err) {
      if (err instanceof WalletNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  /**
   * Top up the authenticated player's wallet.
   * Body: { amountInCents?: number } — defaults to 100 000 ($1 000.00).
   */
  @Post("topup")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async topup(
    @Request() req: RequestWithPlayer,
    @Body() body: { amountInCents?: number },
  ): Promise<WalletResponseDto> {
    const amount = BigInt(Math.floor(body?.amountInCents ?? 100_000));
    if (amount <= 0n) {
      throw new BadRequestException("amountInCents must be positive");
    }

    try {
      await this.creditWallet.execute({
        playerId: req.user.sub,
        amountInCents: amount,
        correlationId: randomUUID(),
        betId: "topup",
        roundId: "topup",
      });
      const updated = await this.getWallet.execute(req.user.sub);
      return this.toDto(updated);
    } catch (err) {
      if (err instanceof WalletNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  private toDto(wallet: {
    id: string;
    playerId: string;
    balanceInCents: bigint;
    createdAt: Date;
    updatedAt: Date;
  }): WalletResponseDto {
    return {
      id: wallet.id,
      playerId: wallet.playerId,
      balanceInCents: wallet.balanceInCents.toString(),
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }
}
