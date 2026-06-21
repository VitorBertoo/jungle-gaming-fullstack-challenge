import { Wallet } from "./wallet.entity";

export interface IWalletRepository {
  findByPlayerId(playerId: string): Promise<Wallet | null>;
  findAll(): Promise<Wallet[]>;
  save(wallet: Wallet): Promise<void>;
}

export const WALLET_REPOSITORY = Symbol("IWalletRepository");
