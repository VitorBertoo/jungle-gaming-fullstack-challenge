import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiSecurity,
} from "@nestjs/swagger";
import { randomUUID } from "crypto";
import { AdminGuard } from "@/infrastructure/auth/admin.guard";
import { KeycloakAdminService, type CreateUserPayload } from "@/infrastructure/keycloak/keycloak-admin.service";
import { GetAllWalletsUseCase } from "@/application/use-cases/get-all-wallets.use-case";
import { CreateWalletUseCase } from "@/application/use-cases/create-wallet.use-case";
import { CreditWalletUseCase } from "@/application/use-cases/credit-wallet.use-case";
import { GetWalletUseCase } from "@/application/use-cases/get-wallet.use-case";
import { WalletNotFoundError } from "@/domain/errors/wallet-not-found.error";
import { WalletResponseDto } from "../dtos/wallet-response.dto";

@ApiTags("Admin")
@ApiSecurity("x-admin-key")
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly getAllWallets: GetAllWalletsUseCase,
    private readonly createWallet: CreateWalletUseCase,
    private readonly creditWallet: CreditWalletUseCase,
    private readonly getWallet: GetWalletUseCase,
  ) {}

  // ─── Keycloak user proxy ────────────────────────────────────────────────────

  @Get("users")
  @ApiOperation({ summary: "List realm users (proxied from Keycloak)" })
  @ApiResponse({ status: 200, description: "User list" })
  @ApiResponse({ status: 401, description: "Invalid admin key" })
  listUsers() {
    return this.keycloakAdmin.listUsers();
  }

  @Post("users")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a realm user (proxied to Keycloak)" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["username", "email", "password"],
      properties: {
        username: { type: "string", example: "newplayer" },
        email: { type: "string", example: "newplayer@example.com" },
        password: { type: "string", example: "secret123" },
        firstName: { type: "string" },
        lastName: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "User created — returns new user ID" })
  @ApiResponse({ status: 401, description: "Invalid admin key" })
  async createUser(@Body() body: CreateUserPayload): Promise<{ userId: string }> {
    const userId = await this.keycloakAdmin.createUser(body);
    await this.createWallet.execute(userId);
    return { userId };
  }

  @Delete("users/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a realm user (proxied to Keycloak)" })
  @ApiParam({ name: "userId", description: "Keycloak user UUID" })
  @ApiResponse({ status: 204, description: "User deleted" })
  @ApiResponse({ status: 401, description: "Invalid admin key" })
  async deleteUser(@Param("userId") userId: string): Promise<void> {
    await this.keycloakAdmin.deleteUser(userId);
  }

  // ─── Wallet management ──────────────────────────────────────────────────────

  @Get("wallets")
  @ApiOperation({ summary: "List all wallets" })
  @ApiResponse({ status: 200, description: "All wallets", type: [WalletResponseDto] })
  @ApiResponse({ status: 401, description: "Invalid admin key" })
  async listWallets(): Promise<WalletResponseDto[]> {
    const wallets = await this.getAllWallets.execute();
    return wallets.map((w) => ({
      id: w.id,
      playerId: w.playerId,
      balanceInCents: w.balanceInCents.toString(),
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }));
  }

  @Post("wallets/:playerId/topup")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Top up any player wallet" })
  @ApiParam({ name: "playerId", description: "Keycloak user sub (UUID)" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        amountInCents: { type: "integer", example: 100000, minimum: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Updated wallet", type: WalletResponseDto })
  @ApiResponse({ status: 400, description: "Invalid amount" })
  @ApiResponse({ status: 401, description: "Invalid admin key" })
  @ApiResponse({ status: 404, description: "Wallet not found" })
  async topupWallet(
    @Param("playerId") playerId: string,
    @Body() body: { amountInCents?: number },
  ): Promise<WalletResponseDto> {
    const amount = BigInt(Math.floor(body?.amountInCents ?? 100_000));
    if (amount <= 0n) throw new BadRequestException("amountInCents must be positive");

    try {
      await this.creditWallet.execute({
        playerId,
        amountInCents: amount,
        correlationId: randomUUID(),
        betId: "admin-topup",
        roundId: "admin-topup",
      });
      const updated = await this.getWallet.execute(playerId);
      return {
        id: updated.id,
        playerId: updated.playerId,
        balanceInCents: updated.balanceInCents.toString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof WalletNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }
}
