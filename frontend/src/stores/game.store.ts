import { create } from "zustand";
import type { RoundDto } from "@/services/api";

export type LiveBetStatus = "PENDING_DEBIT" | "ACTIVE" | "CASHED_OUT" | "WON" | "LOST" | "CANCELLED";
export type RoundStatus = "BETTING" | "RUNNING" | "CRASHED";

export interface LiveBet {
  betId: string;
  playerId: string;
  amountInCents: string;
  status: LiveBetStatus;
  cashOutMultiplier?: number;
  payoutInCents?: string;
}

export interface HistoryEntry {
  roundId: string;
  crashPointMultiplier: number;
  crashedAt: string;
}

// Payloads matching what the gateway emits
export interface RoundBettingPayload {
  roundId: string;
  serverSeedHash: string;
  nonce: number;
  bettingEndsAt: string;
}

export interface RoundStartedPayload {
  roundId: string;
  startedAt: string;
}

export interface MultiplierTickPayload {
  roundId: string;
  multiplier: number;
}

export interface BetPlacedPayload {
  roundId: string;
  betId: string;
  playerId: string;
  amountInCents: string;
}

export interface BetCashoutPayload {
  roundId: string;
  betId: string;
  playerId: string;
  cashOutMultiplier: number;
  payoutInCents: string;
}

export interface RoundCrashedPayload {
  roundId: string;
  crashPointMultiplier: number;
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  crashedAt: string;
}

interface GameState {
  roundId: string | null;
  roundStatus: RoundStatus | null;
  serverSeedHash: string | null;
  /** Revealed only after crash */
  serverSeed: string | null;
  crashPointMultiplier: number | null;
  nonce: number | null;
  bettingEndsAt: string | null;
  startedAt: string | null;
  /** Current live multiplier as integer — 100 = 1.00x */
  currentMultiplier: number;
  bets: LiveBet[];
  history: HistoryEntry[];

  // Event handlers (called by useSocket)
  onRoundBetting: (p: RoundBettingPayload) => void;
  onRoundStarted: (p: RoundStartedPayload) => void;
  onMultiplierTick: (p: MultiplierTickPayload) => void;
  onBetPlaced: (p: BetPlacedPayload) => void;
  onBetCashout: (p: BetCashoutPayload) => void;
  onRoundCrashed: (p: RoundCrashedPayload) => void;

  /** Sync state from REST API on initial load or reconnect */
  syncFromApi: (round: RoundDto | null, history: HistoryEntry[]) => void;
}

export const useGameStore = create<GameState>()((set) => ({
  roundId: null,
  roundStatus: null,
  serverSeedHash: null,
  serverSeed: null,
  crashPointMultiplier: null,
  nonce: null,
  bettingEndsAt: null,
  startedAt: null,
  currentMultiplier: 100,
  bets: [],
  history: [],

  onRoundBetting: (p) =>
    set({
      roundId: p.roundId,
      roundStatus: "BETTING",
      serverSeedHash: p.serverSeedHash,
      serverSeed: null,
      crashPointMultiplier: null,
      nonce: p.nonce,
      bettingEndsAt: p.bettingEndsAt,
      startedAt: null,
      currentMultiplier: 100,
      bets: [],
    }),

  onRoundStarted: (p) =>
    set({
      roundStatus: "RUNNING",
      startedAt: p.startedAt,
      currentMultiplier: 100,
    }),

  onMultiplierTick: (p) =>
    set((s) =>
      s.roundId === p.roundId ? { currentMultiplier: p.multiplier } : s,
    ),

  onBetPlaced: (p) =>
    set((s) => ({
      bets: s.bets.some((b) => b.betId === p.betId)
        ? s.bets
        : [
            ...s.bets,
            {
              betId: p.betId,
              playerId: p.playerId,
              amountInCents: p.amountInCents,
              status: "PENDING_DEBIT" as LiveBetStatus,
            },
          ],
    })),

  onBetCashout: (p) =>
    set((s) => ({
      bets: s.bets.map((b) =>
        b.betId === p.betId
          ? {
              ...b,
              status: "CASHED_OUT" as LiveBetStatus,
              cashOutMultiplier: p.cashOutMultiplier,
              payoutInCents: p.payoutInCents,
            }
          : b,
      ),
    })),

  onRoundCrashed: (p) =>
    set((s) => ({
      roundStatus: "CRASHED",
      crashPointMultiplier: p.crashPointMultiplier,
      serverSeed: p.serverSeed,
      bets: s.bets.map((b) =>
        b.status === "ACTIVE" || b.status === "PENDING_DEBIT"
          ? { ...b, status: "LOST" as LiveBetStatus }
          : b,
      ),
      history: [
        {
          roundId: p.roundId,
          crashPointMultiplier: p.crashPointMultiplier,
          crashedAt: p.crashedAt,
        },
        ...s.history,
      ].slice(0, 20),
    })),

  syncFromApi: (round, history) => {
    set({
      history,
      roundId: round?.id ?? null,
      roundStatus: (round?.status as RoundStatus) ?? null,
      serverSeedHash: round?.serverSeedHash ?? null,
      serverSeed: null,
      crashPointMultiplier: round?.crashPointMultiplier ?? null,
      nonce: round?.nonce ?? null,
      bettingEndsAt: round?.bettingEndsAt ?? null,
      startedAt: round?.startedAt ?? null,
      currentMultiplier: 100,
      bets: (round?.bets ?? []).map((b) => ({
        betId: b.id,
        playerId: b.playerId,
        amountInCents: b.amountInCents,
        status: b.status as LiveBetStatus,
        cashOutMultiplier: b.cashOutMultiplier,
        payoutInCents: b.payoutInCents ?? undefined,
      })),
    });
  },
}));
