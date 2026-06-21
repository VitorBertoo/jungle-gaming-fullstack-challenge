import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useWallet, WALLET_QUERY_KEY } from "@/hooks/useWallet";
import { useSocket } from "@/hooks/useSocket";
import { logout } from "@/services/auth.service";
import { walletApi } from "@/services/api";
import { formatCents, cn } from "@/lib/utils";
import { CrashGraph } from "@/components/CrashGraph";
import { BetControls } from "@/components/BetControls";
import { RoundHistory } from "@/components/RoundHistory";
import { LiveBetsList } from "@/components/LiveBetsList";

type MobileTab = "history" | "bets";

export default function GamePage() {
  const username = useAuthStore((s) => s.username);
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { connected } = useSocket();
  const queryClient = useQueryClient();
  const [mobileTab, setMobileTab] = useState<MobileTab>("bets");

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
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        {/* Logo + connection status */}
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-tight text-white">CRASH</span>
          <span
            className={`w-2 h-2 rounded-full transition-colors ${connected ? "bg-accent" : "bg-muted-foreground"}`}
            title={connected ? "Live" : "Connecting…"}
          />
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          {/* Balance */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:block">Balance</p>
            <div className="flex items-center gap-2">
              <p className="text-sm sm:text-base font-bold text-accent">{balanceDisplay}</p>
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

          {/* Player name — hidden on small screens */}
          <div className="hidden sm:block text-right">
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
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">

        {/* Left column: graph + bet controls + mobile tabs */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">

          {/* Graph */}
          <div className="relative min-h-[40vh] lg:min-h-0 flex-1 min-h-0">
            <CrashGraph />
          </div>

          {/* Bet controls */}
          <div className="shrink-0 border-t border-border bg-card">
            <BetControls />
          </div>

          {/* Mobile tabs — history / live bets (hidden on lg+) */}
          <div className="flex flex-col lg:hidden border-t border-border bg-card" style={{ height: "28vh" }}>
            {/* Tab switcher */}
            <div className="flex shrink-0 border-b border-border">
              <button
                onClick={() => setMobileTab("bets")}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                  mobileTab === "bets"
                    ? "text-foreground border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Live Bets
              </button>
              <button
                onClick={() => setMobileTab("history")}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                  mobileTab === "history"
                    ? "text-foreground border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                History
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {mobileTab === "bets" ? <LiveBetsList /> : <RoundHistory />}
            </div>
          </div>
        </div>

        {/* Desktop sidebar — hidden below lg */}
        <aside className="hidden lg:flex flex-col w-72 border-l border-border bg-card shrink-0">
          {/* Round history — top third */}
          <div className="flex flex-col border-b border-border" style={{ height: "35%" }}>
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border shrink-0">
              Round History
            </p>
            <div className="flex-1 overflow-hidden">
              <RoundHistory />
            </div>
          </div>

          {/* Live bets — bottom two-thirds */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border shrink-0">
              Live Bets
            </p>
            <div className="flex-1 overflow-hidden">
              <LiveBetsList />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
