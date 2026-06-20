export class BetAlreadyPlacedError extends Error {
  constructor(playerId: string) {
    super(`Player ${playerId} already has a bet in this round`);
    this.name = "BetAlreadyPlacedError";
  }
}
