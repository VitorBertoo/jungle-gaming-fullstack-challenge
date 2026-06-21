export class InsufficientBalanceError extends Error {
  constructor(balanceInCents: bigint, requiredInCents: bigint) {
    super(
      `Insufficient balance: have $${(Number(balanceInCents) / 100).toFixed(2)}, need $${(Number(requiredInCents) / 100).toFixed(2)}`,
    );
    this.name = "InsufficientBalanceError";
  }
}
