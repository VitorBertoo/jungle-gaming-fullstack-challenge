import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { GamesController } from "./presentation/controllers/games.controller";
import { PrismaService } from "./infrastructure/prisma/prisma.service";
import { PrismaRoundRepository } from "./infrastructure/prisma/prisma-round.repository";
import { JwtStrategy } from "./infrastructure/auth/jwt.strategy";
import { GameGateway } from "./infrastructure/websocket/game.gateway";
import { WalletEventsPublisher } from "./infrastructure/messaging/wallet-events.publisher";
import { GameEventsConsumer } from "./infrastructure/messaging/game-events.consumer";
import { PlaceBetUseCase } from "./application/use-cases/place-bet.use-case";
import { CashoutUseCase } from "./application/use-cases/cashout.use-case";
import { GetCurrentRoundUseCase } from "./application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "./application/use-cases/get-round-history.use-case";
import { GetPlayerBetsUseCase } from "./application/use-cases/get-player-bets.use-case";
import { VerifyRoundUseCase } from "./application/use-cases/verify-round.use-case";
import { RoundLifecycleService } from "./application/services/round-lifecycle.service";
import { ROUND_REPOSITORY } from "./domain/round/round.repository.interface";

@Module({
  imports: [
    PassportModule,
    ClientsModule.register([
      {
        name: "WALLET_EVENTS_CLIENT",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL!],
          queue: "wallet_events_queue",
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [GamesController, GameEventsConsumer],
  providers: [
    PrismaService,
    JwtStrategy,
    GameGateway,
    WalletEventsPublisher,
    RoundLifecycleService,
    {
      provide: ROUND_REPOSITORY,
      useClass: PrismaRoundRepository,
    },
    PlaceBetUseCase,
    CashoutUseCase,
    GetCurrentRoundUseCase,
    GetRoundHistoryUseCase,
    GetPlayerBetsUseCase,
    VerifyRoundUseCase,
  ],
})
export class AppModule {
  constructor(lifecycle: RoundLifecycleService, gateway: GameGateway, walletPublisher: WalletEventsPublisher) {
    lifecycle.setGateway(gateway);
    lifecycle.setWalletPublisher(walletPublisher);
  }
}
