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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
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

@ApiTags("Wallets")
@Controller()
export class WalletsController {
  constructor(
    private readonly createWallet: CreateWalletUseCase,
    private readonly getWallet: GetWalletUseCase,
    private readonly creditWallet: CreditWalletUseCase,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Health check" })
  @ApiResponse({ status: 200, description: "Service is healthy", type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create wallet",
    description: "Creates a wallet for the authenticated player with a $1,000 starting balance. Each player may only have one wallet.",
  })
  @ApiResponse({ status: 201, description: "Wallet created", type: WalletResponseDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 409, description: "Wallet already exists for this player" })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get my wallet", description: "Returns the authenticated player's wallet and current balance." })
  @ApiResponse({ status: 200, description: "Wallet details", type: WalletResponseDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Wallet not found — call POST /wallets first" })
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

  @Post("topup")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Top up wallet",
    description: "Credits the authenticated player's wallet. Defaults to $1,000 (100 000 cents) if no amount is provided.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        amountInCents: {
          type: "integer",
          description: "Amount to credit in cents. Defaults to 100 000 ($1 000.00).",
          example: 100000,
          minimum: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Wallet credited — returns updated wallet", type: WalletResponseDto })
  @ApiResponse({ status: 400, description: "amountInCents must be positive" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Wallet not found" })
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
