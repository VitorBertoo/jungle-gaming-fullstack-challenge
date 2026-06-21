import { ApiProperty } from "@nestjs/swagger";

export class WalletResponseDto {
  @ApiProperty({ example: "w1e2f3a4-0000-0000-0000-000000000001" })
  id: string;

  @ApiProperty({ example: "p1e2f3a4-0000-0000-0000-000000000001" })
  playerId: string;

  @ApiProperty({
    description: "Balance in cents (serialised as string for BigInt safety)",
    example: "100000",
  })
  balanceInCents: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: string;
}
