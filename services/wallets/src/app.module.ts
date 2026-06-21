import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import { AdminController } from "./presentation/controllers/admin.controller";
import { PrismaService } from "./infrastructure/prisma/prisma.service";
import { PrismaWalletRepository } from "./infrastructure/prisma/prisma-wallet.repository";
import { JwtStrategy } from "./infrastructure/auth/jwt.strategy";
import { WalletEventsConsumer } from "./infrastructure/messaging/wallet-events.consumer";
import { CreateWalletUseCase } from "./application/use-cases/create-wallet.use-case";
import { GetWalletUseCase } from "./application/use-cases/get-wallet.use-case";
import { DebitWalletUseCase } from "./application/use-cases/debit-wallet.use-case";
import { CreditWalletUseCase } from "./application/use-cases/credit-wallet.use-case";
import { GetAllWalletsUseCase } from "./application/use-cases/get-all-wallets.use-case";
import { KeycloakAdminService } from "./infrastructure/keycloak/keycloak-admin.service";
import { WALLET_REPOSITORY } from "./domain/wallet.repository.interface";

@Module({
  imports: [
    PassportModule,
    ClientsModule.register([
      {
        name: "GAME_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL!],
          queue: "game_events_queue",
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [WalletsController, AdminController, WalletEventsConsumer],
  providers: [
    PrismaService,
    JwtStrategy,
    {
      provide: WALLET_REPOSITORY,
      useClass: PrismaWalletRepository,
    },
    CreateWalletUseCase,
    GetWalletUseCase,
    DebitWalletUseCase,
    CreditWalletUseCase,
    GetAllWalletsUseCase,
    KeycloakAdminService,
  ],
})
export class AppModule {}
