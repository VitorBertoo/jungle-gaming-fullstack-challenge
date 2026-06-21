import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Round } from "@/domain/round/round.entity";
import type { IRoundRepository } from "@/domain/round/round.repository.interface";
import { ROUND_REPOSITORY } from "@/domain/round/round.repository.interface";
import {
  generateServerSeed,
  hashServerSeed,
  computeCrashPoint,
  computeCurrentMultiplier,
  computeCrashTimeMs,
} from "@/domain/provably-fair/provably-fair";

const BETTING_DURATION_MS = parseInt(process.env.BETTING_DURATION_MS ?? "10000");
const POST_CRASH_DELAY_MS = 3000;
const TICK_INTERVAL_MS = 100;

@Injectable()
export class RoundLifecycleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoundLifecycleService.name);

  private gateway: {
    emitRoundBetting(round: Round): void;
    emitRoundStarted(round: Round): void;
    emitMultiplierTick(roundId: string, multiplierInt: number): void;
    emitBetPlaced(roundId: string, betId: string, playerId: string, username: string, amountInCents: bigint): void;
    emitBetCashout(roundId: string, betId: string, playerId: string, cashOutMultiplier: number, payoutInCents: bigint): void;
    emitRoundCrashed(round: Round): void;
  } | null = null;

  private walletPublisher: {
    requestCredit(payload: {
      correlationId: string;
      playerId: string;
      amountInCents: number;
      roundId: string;
      betId: string;
    }): void;
  } | null = null;

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private crashTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
  ) {}

  setGateway(gateway: typeof this.gateway): void {
    this.gateway = gateway;
  }

  setWalletPublisher(publisher: typeof this.walletPublisher): void {
    this.walletPublisher = publisher;
  }

  async onApplicationBootstrap(): Promise<void> {
    // Give DB a moment to be fully ready after migrate deploy
    setTimeout(() => this.startBettingPhase(), 1000);
  }

  async startBettingPhase(): Promise<void> {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const nonce = (await this.roundRepository.getLastNonce()) + 1;
    const crashPointMultiplier = computeCrashPoint(serverSeed, nonce);
    const bettingEndsAt = new Date(Date.now() + BETTING_DURATION_MS);

    const round = Round.create({
      id: randomUUID(),
      serverSeed,
      serverSeedHash,
      nonce,
      crashPointMultiplier,
      bettingEndsAt,
    });

    await this.roundRepository.save(round);
    this.logger.log(`Round ${round.id} — BETTING (crash at ${crashPointMultiplier / 100}x, nonce=${nonce})`);
    this.gateway?.emitRoundBetting(round);

    this.crashTimeout = setTimeout(() => this.startGame(round.id), BETTING_DURATION_MS);
  }

  private async startGame(roundId: string): Promise<void> {
    const round = await this.roundRepository.findById(roundId);
    if (!round) return;

    round.startGame();
    await this.roundRepository.save(round);
    this.logger.log(`Round ${roundId} — RUNNING`);
    this.gateway?.emitRoundStarted(round);

    const startedAt = round.startedAt!.getTime();
    const crashDelayMs = computeCrashTimeMs(round.crashPointMultiplier);

    this.crashTimeout = setTimeout(() => this.crashRound(roundId), crashDelayMs);

    this.tickInterval = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const multiplierInt = computeCurrentMultiplier(elapsedMs);
      this.gateway?.emitMultiplierTick(roundId, multiplierInt);
    }, TICK_INTERVAL_MS);
  }

  private async crashRound(roundId: string): Promise<void> {
    this.clearTimers();

    const round = await this.roundRepository.findById(roundId);
    if (!round) return;

    const losers = round.crash();
    await this.roundRepository.save(round);
    this.logger.log(`Round ${roundId} — CRASHED at ${round.crashPointMultiplier / 100}x`);

    // Persist losing bets
    for (const bet of losers) {
      await this.roundRepository.saveBet(bet);
    }

    this.gateway?.emitRoundCrashed(round);

    setTimeout(() => this.startBettingPhase(), POST_CRASH_DELAY_MS);
  }

  async notifyBetPlaced(roundId: string, betId: string, playerId: string, username: string, amountInCents: bigint): Promise<void> {
    this.gateway?.emitBetPlaced(roundId, betId, playerId, username, amountInCents);
  }

  async notifyCashout(
    roundId: string,
    betId: string,
    playerId: string,
    cashOutMultiplier: number,
    payoutInCents: bigint,
  ): Promise<void> {
    this.gateway?.emitBetCashout(roundId, betId, playerId, cashOutMultiplier, payoutInCents);

    this.walletPublisher?.requestCredit({
      correlationId: betId,
      playerId,
      amountInCents: Number(payoutInCents),
      roundId,
      betId,
    });
  }

  private clearTimers(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.crashTimeout) {
      clearTimeout(this.crashTimeout);
      this.crashTimeout = null;
    }
  }
}
