import { ApiProperty } from "@nestjs/swagger";

export class PlaceBetDto {
  @ApiProperty({
    description: "Bet amount in cents. Min: 100 ($1.00), Max: 100 000 ($1 000.00)",
    example: 1000,
    minimum: 100,
    maximum: 100000,
  })
  amountInCents: number;
}
