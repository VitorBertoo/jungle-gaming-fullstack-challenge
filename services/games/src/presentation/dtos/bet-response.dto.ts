import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BetResponseDto {
  @ApiProperty({ example: "b1e2f3a4-0000-0000-0000-000000000001" })
  id: string;

  @ApiProperty({ example: "r1e2f3a4-0000-0000-0000-000000000001" })
  roundId: string;

  @ApiProperty({ example: "p1e2f3a4-0000-0000-0000-000000000001" })
  playerId: string;

  @ApiProperty({
    description: "Bet amount in cents (serialised as string for BigInt safety)",
    example: "1000",
  })
  amountInCents: string;

  @ApiProperty({
    description: "Bet status",
    enum: ["PENDING_DEBIT", "ACTIVE", "CASHED_OUT", "WON", "LOST", "CANCELLED"],
    example: "ACTIVE",
  })
  status: string;

  @ApiPropertyOptional({
    description: "Multiplier at which the player cashed out (integer hundredths, e.g. 250 = 2.50x)",
    example: 250,
    nullable: true,
  })
  cashOutMultiplier: number | null;

  @ApiPropertyOptional({
    description: "Payout in cents (serialised as string for BigInt safety)",
    example: "2500",
    nullable: true,
  })
  payoutInCents: string | null;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: string;
}
