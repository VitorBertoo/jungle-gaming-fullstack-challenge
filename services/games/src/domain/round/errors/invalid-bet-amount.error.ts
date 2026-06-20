export class InvalidBetAmountError extends Error {
  constructor(amountInCents: bigint) {
    super(
      `Bet amount ${amountInCents} cents is invalid. Must be between 100 and 100000 cents (1.00 to 1000.00)`,
    );
    this.name = "InvalidBetAmountError";
  }
}
