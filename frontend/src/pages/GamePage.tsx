import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useWallet, WALLET_QUERY_KEY } from "@/hooks/useWallet";
import { useSocket } from "@/hooks/useSocket";
import { logout } from "@/services/auth.service";
import { walletApi } from "@/services/api";
import { formatCents, cn } from "@/lib/utils";
import { CrashGraph } from "@/components/CrashGraph";
import { BetControls } from "@/components/BetControls";

export default function GamePage() {
  const username = useAuthStore((s) => s.username);
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { connected } = useSocket();
  const queryClient = useQueryClient();

  const topup = useMutation({
    mutationFn: () => walletApi.topup(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });

  const balanceDisplay = wallet
    ? formatCents(BigInt(wallet.balanceInCents))
    : walletLoading
      ? "…"
      : "$0.00";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-tight text-white">CRASH</span>
          <span
            className={`w-2 h-2 rounded-full transition-colors ${connected ? "bg-accent" : "bg-muted-foreground"}`}
            title={connected ? "Live" : "Connecting…"}
          />
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-accent">{balanceDisplay}</p>
              <button
                onClick={() => topup.mutate()}
                disabled={topup.isPending}
                title="Add $1,000"
                className={cn(
                  "text-xs px-2 py-0.5 rounded border transition-colors",
                  topup.isPending
                    ? "border-border text-muted-foreground cursor-not-allowed"
                    : "border-primary text-primary hover:bg-primary hover:text-white",
                )}
              >
                {topup.isPending ? "…" : "+ $1k"}
              </button>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Player</p>
            <p className="text-sm font-semibold">{username ?? "—"}</p>
          </div>

          <button
            onClick={() => logout()}
            className="text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph — left / top on mobile */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="relative flex-1 min-h-0">
            <CrashGraph />
          </div>

          {/* Bet controls */}
          <div className="shrink-0 h-32 border-t border-border bg-card">
            <BetControls />
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:flex flex-col w-72 border-l border-border bg-card shrink-0">
          {/* Round history — top half */}
          <div className="flex-1 border-b border-border overflow-hidden flex flex-col">
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
              Round History
            </p>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-muted-foreground text-xs text-center mt-4">
                History — step 6
              </p>
            </div>
          </div>

          {/* Live bets — bottom half */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
              Live Bets
            </p>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-muted-foreground text-xs text-center mt-4">
                Bets — step 6
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
