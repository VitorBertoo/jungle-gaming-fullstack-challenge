export class VerifyRoundResponseDto {
  roundId: string;
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  crashPointMultiplier: number;
  verified: boolean;
}
