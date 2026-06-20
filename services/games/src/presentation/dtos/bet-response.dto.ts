export class BetResponseDto {
  id: string;
  roundId: string;
  playerId: string;
  amountInCents: string;
  status: string;
  cashOutMultiplier: number | null;
  payoutInCents: string | null;
  createdAt: string;
}
