export class WalletAlreadyExistsError extends Error {
  constructor(playerId: string) {
    super(`Wallet already exists for player: ${playerId}`);
    this.name = "WalletAlreadyExistsError";
  }
}
