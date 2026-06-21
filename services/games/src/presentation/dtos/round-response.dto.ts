import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BetResponseDto } from "./bet-response.dto";

export class RoundResponseDto {
  @ApiProperty({ example: "r1e2f3a4-0000-0000-0000-000000000001" })
  id: string;

  @ApiProperty({
    description: "Round phase",
    enum: ["BETTING", "RUNNING", "CRASHED"],
    example: "BETTING",
  })
  status: string;

  @ApiProperty({
    description: "SHA-256 hash of the server seed — committed before bets open",
    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  })
  serverSeedHash: string;

  @ApiProperty({ description: "Monotonically increasing round counter", example: 42 })
  nonce: number;

  @ApiProperty({ description: "ISO-8601 timestamp when the betting phase ends", example: "2024-01-01T00:00:10.000Z" })
  bettingEndsAt: string;

  @ApiPropertyOptional({ description: "ISO-8601 timestamp when the round started (null during BETTING)", nullable: true, example: "2024-01-01T00:00:10.000Z" })
  startedAt: string | null;

  @ApiPropertyOptional({ description: "ISO-8601 timestamp when the round crashed (null until CRASHED)", nullable: true, example: "2024-01-01T00:00:22.000Z" })
  crashedAt: string | null;

  @ApiPropertyOptional({
    description: "Crash point in integer hundredths (e.g. 250 = 2.50x). Hidden (null) until round crashes.",
    nullable: true,
    example: 250,
  })
  crashPointMultiplier: number | null;

  @ApiProperty({ type: [BetResponseDto] })
  bets: BetResponseDto[];
}
