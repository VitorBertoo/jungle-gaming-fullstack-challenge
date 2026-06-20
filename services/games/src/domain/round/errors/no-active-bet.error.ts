export class NoActiveBetError extends Error {
  constructor(playerId: string) {
    super(`Player ${playerId} has no active bet in this round`);
    this.name = "NoActiveBetError";
  }
}
