import { ApiProperty } from "@nestjs/swagger";

export class VerifyRoundResponseDto {
  @ApiProperty({ example: "r1e2f3a4-0000-0000-0000-000000000001" })
  roundId: string;

  @ApiProperty({
    description: "The server seed revealed after the round ends",
    example: "deadbeefdeadbeefdeadbeefdeadbeef",
  })
  serverSeed: string;

  @ApiProperty({
    description: "SHA-256(serverSeed) — matches the hash committed before bets opened",
    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  })
  serverSeedHash: string;

  @ApiProperty({ example: 42 })
  nonce: number;

  @ApiProperty({
    description: "Crash point in integer hundredths (e.g. 250 = 2.50x)",
    example: 250,
  })
  crashPointMultiplier: number;

  @ApiProperty({
    description: "True if HMAC(serverSeed, nonce) reproduces the declared crash point",
    example: true,
  })
  verified: boolean;
}
