import axios from "axios";
import { getAccessToken } from "./auth.service";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Wallet ---

export interface WalletDto {
  playerId: string;
  balanceInCents: string; // serialized bigint
}

export const walletApi = {
  getMe: () => api.get<WalletDto>("/wallets/me").then((r) => r.data),
  create: () => api.post<WalletDto>("/wallets").then((r) => r.data),
};

// --- Game ---

export type RoundStatus = "BETTING" | "RUNNING" | "CRASHED";
export type BetStatus =
  | "PENDING_DEBIT"
  | "ACTIVE"
  | "CASHED_OUT"
  | "WON"
  | "LOST"
  | "CANCELLED";

export interface BetDto {
  id: string;
  playerId: string;
  username?: string;
  amountInCents: string;
  status: BetStatus;
  cashOutMultiplier?: number;
  payoutInCents?: string;
}

export interface RoundDto {
  id: string;
  status: RoundStatus;
  serverSeedHash: string;
  serverSeed?: string;
  crashPoint?: number;
  nonce: number;
  bets: BetDto[];
  createdAt: string;
}

export interface PaginatedRoundsDto {
  rounds: RoundDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedBetsDto {
  bets: BetDto[];
  total: number;
  page: number;
  limit: number;
}

export const gameApi = {
  getCurrentRound: () =>
    api.get<RoundDto>("/games/rounds/current").then((r) => r.data),

  getRoundHistory: (page = 1, limit = 20) =>
    api
      .get<PaginatedRoundsDto>("/games/rounds/history", {
        params: { page, limit },
      })
      .then((r) => r.data),

  verifyRound: (roundId: string) =>
    api.get(`/games/rounds/${roundId}/verify`).then((r) => r.data),

  getMyBets: (page = 1, limit = 20) =>
    api
      .get<PaginatedBetsDto>("/games/bets/me", { params: { page, limit } })
      .then((r) => r.data),

  placeBet: (amountInCents: number) =>
    api.post<BetDto>("/games/bet", { amountInCents }).then((r) => r.data),

  cashout: () =>
    api.post<BetDto>("/games/bet/cashout").then((r) => r.data),
};
