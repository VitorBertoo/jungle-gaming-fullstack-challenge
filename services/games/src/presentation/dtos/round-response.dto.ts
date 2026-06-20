import { BetResponseDto } from "./bet-response.dto";

export class RoundResponseDto {
  id: string;
  status: string;
  serverSeedHash: string;
  nonce: number;
  bettingEndsAt: string;
  startedAt: string | null;
  crashedAt: string | null;
  crashPointMultiplier: number | null;
  bets: BetResponseDto[];
}
