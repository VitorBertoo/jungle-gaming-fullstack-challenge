export class RoundNotInBettingPhaseError extends Error {
  constructor() {
    super("Bets can only be placed during the betting phase");
    this.name = "RoundNotInBettingPhaseError";
  }
}
