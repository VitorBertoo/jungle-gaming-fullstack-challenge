import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { isAxiosError } from "axios";

export const WALLET_QUERY_KEY = ["wallet", "me"] as const;

/**
 * Fetches the current player's wallet.
 * If the wallet doesn't exist yet (404), automatically creates it so the
 * player never has to do a manual setup step.
 */
export function useWallet() {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    enabled: !!token,
    queryFn: async () => {
      try {
        return await walletApi.getMe();
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          // First login — provision wallet automatically
          return walletApi.create();
        }
        throw err;
      }
    },
    // Refetch frequently so balance stays up-to-date after wins/losses
    refetchInterval: 5_000,
  });
}
