import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server } from "socket.io";
import { Round } from "@/domain/round/round.entity";

@WebSocketGateway({ cors: { origin: "*" } })
export class GameGateway implements OnGatewayInit {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  afterInit(): void {
    this.logger.log("WebSocket gateway initialized");
  }

  emitRoundBetting(round: Round): void {
    this.server.emit("round:betting", {
      roundId: round.id,
      serverSeedHash: round.serverSeedHash,
      nonce: round.nonce,
      bettingEndsAt: round.bettingEndsAt.toISOString(),
    });
  }

  emitRoundStarted(round: Round): void {
    this.server.emit("round:started", {
      roundId: round.id,
      startedAt: round.startedAt!.toISOString(),
    });
  }

  emitMultiplierTick(roundId: string, multiplierInt: number): void {
    this.server.emit("multiplier:tick", {
      roundId,
      multiplier: multiplierInt,
    });
  }

  emitBetPlaced(
    roundId: string,
    betId: string,
    playerId: string,
    username: string,
    amountInCents: bigint,
  ): void {
    this.server.emit("bet:placed", {
      roundId,
      betId,
      playerId,
      username,
      amountInCents: amountInCents.toString(),
    });
  }

  emitBetCashout(
    roundId: string,
    betId: string,
    playerId: string,
    cashOutMultiplier: number,
    payoutInCents: bigint,
  ): void {
    this.server.emit("bet:cashout", {
      roundId,
      betId,
      playerId,
      cashOutMultiplier,
      payoutInCents: payoutInCents.toString(),
    });
  }

  emitRoundCrashed(round: Round): void {
    this.server.emit("round:crashed", {
      roundId: round.id,
      crashPointMultiplier: round.crashPointMultiplier,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      nonce: round.nonce,
      crashedAt: round.crashedAt!.toISOString(),
    });
  }

  emitBetCancelled(betId: string, playerId: string, reason: string): void {
    this.server.emit("bet:cancelled", { betId, playerId, reason });
  }
}
