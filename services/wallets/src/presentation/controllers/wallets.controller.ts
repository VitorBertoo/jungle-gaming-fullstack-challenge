import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  ConflictException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "@/infrastructure/auth/jwt-auth.guard";
import { AuthenticatedPlayer } from "@/infrastructure/auth/jwt.strategy";
import { CreateWalletUseCase } from "@/application/use-cases/create-wallet.use-case";
import { GetWalletUseCase } from "@/application/use-cases/get-wallet.use-case";
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
  ) {}

  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Post("wallets")
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

  @Get("wallets/me")
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
