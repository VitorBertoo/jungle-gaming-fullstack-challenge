export class InsufficientBalanceError extends Error {
  constructor(balanceInCents: bigint, requiredInCents: bigint) {
    super(
      `Insufficient balance: has ${balanceInCents} cents, needs ${requiredInCents} cents`,
    );
    this.name = "InsufficientBalanceError";
  }
}
