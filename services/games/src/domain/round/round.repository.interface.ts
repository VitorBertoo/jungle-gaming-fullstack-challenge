import { Round } from "./round.entity";
import { Bet } from "./bet.entity";

export interface RoundHistoryOptions {
  page: number;
  limit: number;
}

export interface PaginatedRounds {
  rounds: Round[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedBets {
  bets: Bet[];
  total: number;
  page: number;
  limit: number;
}

export interface IPlayerBetsOptions {
  playerId: string;
  page: number;
  limit: number;
}

export interface ILastNonce {
  nonce: number;
}

export interface IRoundRepository {
  findById(id: string): Promise<Round | null>;
  findCurrent(): Promise<Round | null>;
  findHistory(options: RoundHistoryOptions): Promise<PaginatedRounds>;
  findPlayerBets(options: IPlayerBetsOptions): Promise<PaginatedBets>;
  getLastNonce(): Promise<number>;
  save(round: Round): Promise<void>;
  saveBet(bet: Bet): Promise<void>;
}

export const ROUND_REPOSITORY = Symbol("IRoundRepository");
