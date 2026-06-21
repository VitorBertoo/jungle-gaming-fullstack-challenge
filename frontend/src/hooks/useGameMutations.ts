import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gameApi } from "@/services/api";
import { WALLET_QUERY_KEY } from "./useWallet";

export function useGameMutations() {
  const queryClient = useQueryClient();

  const invalidateWallet = () => {
    void queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
  };

  const placeBet = useMutation({
    mutationFn: (amountInCents: number) => gameApi.placeBet(amountInCents),
    onSuccess: invalidateWallet,
  });

  const cashout = useMutation({
    mutationFn: () => gameApi.cashout(),
    onSuccess: invalidateWallet,
  });

  return {
    placeBet: placeBet.mutate,
    cashout: cashout.mutate,
    isPlacingBet: placeBet.isPending,
    isCashingOut: cashout.isPending,
    placeBetError: placeBet.error,
    cashoutError: cashout.error,
    resetPlaceBet: placeBet.reset,
    resetCashout: cashout.reset,
  };
}
