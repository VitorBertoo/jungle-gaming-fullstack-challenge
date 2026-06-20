export class RoundNotInRunningPhaseError extends Error {
  constructor() {
    super("Cash out is only allowed during an active running round");
    this.name = "RoundNotInRunningPhaseError";
  }
}
