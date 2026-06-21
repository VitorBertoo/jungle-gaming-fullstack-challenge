import { useGameStore } from "@/stores/game.store";
import { useAuthStore } from "@/stores/auth.store";
import { formatCents, formatMultiplier, cn } from "@/lib/utils";
import type { LiveBet } from "@/stores/game.store";

function statusBadge(bet: LiveBet, isMe: boolean) {
  switch (bet.status) {
    case "PENDING_DEBIT":
      return (
        <span className="text-muted-foreground text-xs italic">pending</span>
      );
    case "ACTIVE":
      return (
        <span className={cn("text-xs font-medium", isMe ? "text-primary" : "text-foreground/70")}>
          active
        </span>
      );
    case "CASHED_OUT":
    case "WON":
      return (
        <span className="text-xs font-bold text-accent">
          {formatMultiplier(bet.cashOutMultiplier ?? 100)}
        </span>
      );
    case "LOST":
      return (
        <span className="text-xs font-medium text-destructive">lost</span>
      );
    case "CANCELLED":
      return (
        <span className="text-xs text-muted-foreground line-through">cancelled</span>
      );
  }
}

function formatPlayer(playerId: string, username: string | undefined, isMe: boolean): string {
  if (isMe) return "You";
  return username ?? playerId.slice(0, 6) + "…";
}

export function LiveBetsList() {
  const bets = useGameStore((s) => s.bets);
  const roundStatus = useGameStore((s) => s.roundStatus);
  const playerId = useAuthStore((s) => s.playerId);

  if (roundStatus === null || (roundStatus === "BETTING" && bets.length === 0)) {
    return (
      <p className="text-muted-foreground text-xs text-center mt-6 px-3">
        Waiting for bets…
      </p>
    );
  }

  if (bets.length === 0) {
    return (
      <p className="text-muted-foreground text-xs text-center mt-6 px-3">
        No bets this round
      </p>
    );
  }

  // Sort: my bet first, then cashouts, then active, then lost/cancelled
  const sorted = [...bets].sort((a, b) => {
    const rank = (bet: LiveBet) => {
      if (bet.playerId === playerId) return 0;
      if (bet.status === "CASHED_OUT" || bet.status === "WON") return 1;
      if (bet.status === "ACTIVE") return 2;
      return 3;
    };
    return rank(a) - rank(b);
  });

  return (
    <div className="flex flex-col divide-y divide-border overflow-y-auto h-full">
      {sorted.map((bet) => {
        const isMe = bet.playerId === playerId;
        const isCashedOut = bet.status === "CASHED_OUT" || bet.status === "WON";

        return (
          <div
            key={bet.betId}
            className={cn(
              "flex items-center justify-between px-4 py-2 text-sm transition-colors",
              isMe && "bg-primary/5",
              isCashedOut && "bg-accent/5",
              bet.status === "LOST" && "opacity-50",
            )}
          >
            {/* Player + amount */}
            <div className="flex flex-col min-w-0">
              <span
                className={cn(
                  "font-medium text-xs truncate",
                  isMe ? "text-primary" : "text-foreground",
                )}
              >
                {formatPlayer(bet.playerId, bet.username, isMe)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCents(BigInt(bet.amountInCents))}
              </span>
            </div>

            {/* Status / payout */}
            <div className="text-right shrink-0 ml-2">
              {statusBadge(bet, isMe)}
              {isCashedOut && bet.payoutInCents && (
                <p className="text-xs text-accent font-bold tabular-nums">
                  {formatCents(BigInt(bet.payoutInCents))}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
