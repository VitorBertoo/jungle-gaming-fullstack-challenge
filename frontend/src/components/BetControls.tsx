import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/stores/game.store";
import { useAuthStore } from "@/stores/auth.store";
import { useGameMutations } from "@/hooks/useGameMutations";
import { formatCents, formatMultiplier, cn } from "@/lib/utils";

const QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500];
const MIN_CENTS = 100;    // $1.00
const MAX_CENTS = 100_000; // $1,000.00

export function BetControls() {
  const [amountStr, setAmountStr] = useState("10.00");
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roundStatus = useGameStore((s) => s.roundStatus);
  const currentMultiplier = useGameStore((s) => s.currentMultiplier);
  const bettingEndsAt = useGameStore((s) => s.bettingEndsAt);
  const bets = useGameStore((s) => s.bets);
  const roundId = useGameStore((s) => s.roundId);
  const debitFailed = useGameStore((s) => s.debitFailed);
  const clearDebitFailed = useGameStore((s) => s.clearDebitFailed);

  const playerId = useAuthStore((s) => s.playerId);

  const { placeBet, cashout, isPlacingBet, isCashingOut, placeBetError, cashoutError } = useGameMutations();

  // Countdown seconds
  const [secsLeft, setSecsLeft] = useState(0);
  useEffect(() => {
    if (!bettingEndsAt) { setSecsLeft(0); return; }
    const tick = () =>
      setSecsLeft(Math.max(0, Math.ceil((new Date(bettingEndsAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [bettingEndsAt]);

  // Clear my local bet tracking when round changes
  const myBet = bets.find(
    (b) =>
      b.playerId === playerId &&
      (b.status === "PENDING_DEBIT" || b.status === "ACTIVE"),
  );

  // Show toast on REST errors
  useEffect(() => {
    const err = placeBetError ?? cashoutError;
    if (!err) return;
    showToast(err instanceof Error ? err.message : "Something went wrong", "error");
  }, [placeBetError, cashoutError]);

  // Show toast when wallet debit fails (async, via WebSocket)
  useEffect(() => {
    if (!debitFailed || debitFailed.playerId !== playerId) return;
    showToast(debitFailed.reason ?? "Insufficient balance", "error");
    clearDebitFailed();
  }, [debitFailed, playerId, clearDebitFailed]);

  // Clear toast on round change
  useEffect(() => {
    setToast(null);
  }, [roundId]);

  function showToast(msg: string, type: "error" | "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const isValidAmount = !isNaN(amountCents) && amountCents >= MIN_CENTS && amountCents <= MAX_CENTS;

  const canBet = roundStatus === "BETTING" && !myBet && isValidAmount && !isPlacingBet;
  const canCashout = roundStatus === "RUNNING" && !!myBet && !isCashingOut;

  const potentialPayout =
    myBet && roundStatus === "RUNNING"
      ? (BigInt(myBet.amountInCents) * BigInt(currentMultiplier)) / 100n
      : null;

  function handleBet() {
    if (!canBet) return;
    placeBet(amountCents, {
      onError: (err) =>
        showToast(err instanceof Error ? err.message : "Bet failed", "error"),
    });
  }

  function handleCashout() {
    if (!canCashout) return;
    cashout(undefined, {
      onSuccess: () => showToast("Cashed out!", "success"),
      onError: (err) =>
        showToast(err instanceof Error ? err.message : "Cashout failed", "error"),
    });
  }

  function setQuickAmount(dollars: number) {
    setAmountStr(dollars.toFixed(2));
  }

  function handleAmountChange(val: string) {
    // Allow digits and at most one dot
    if (/^\d*\.?\d{0,2}$/.test(val)) setAmountStr(val);
  }

  return (
    <div className="relative flex flex-col gap-3 px-4 py-3 h-full justify-center">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "absolute top-2 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-10 transition-all",
            toast.type === "error"
              ? "bg-destructive text-white"
              : "bg-accent text-black",
          )}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Amount input */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Bet Amount
          </label>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={roundStatus === "RUNNING" && !!myBet}
                className={cn(
                  "w-28 pl-7 pr-3 py-2 rounded-lg border text-sm font-mono bg-background text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary transition-colors",
                  !isValidAmount && amountStr !== ""
                    ? "border-destructive"
                    : "border-border",
                  roundStatus === "RUNNING" && myBet ? "opacity-50 cursor-not-allowed" : "",
                )}
              />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1 flex-wrap">
              {QUICK_AMOUNTS.map((d) => (
                <button
                  key={d}
                  onClick={() => setQuickAmount(d)}
                  disabled={roundStatus === "RUNNING" && !!myBet}
                  className="px-2 py-1 rounded text-xs border border-border text-muted-foreground
                    hover:border-primary hover:text-white transition-colors disabled:opacity-40"
                >
                  ${d}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            Min $1.00 · Max $1,000.00
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action area */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* Payout preview while running with active bet */}
          {potentialPayout !== null && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Potential payout </span>
              <span className="text-sm font-bold text-accent">
                {formatCents(potentialPayout)}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                @{formatMultiplier(currentMultiplier)}
              </span>
            </div>
          )}

          {/* Countdown during betting */}
          {roundStatus === "BETTING" && secsLeft > 0 && (
            <span className="text-xs text-muted-foreground">
              Betting closes in{" "}
              <span className="font-bold text-foreground">{secsLeft}s</span>
            </span>
          )}

          {/* BET button */}
          {(!myBet || roundStatus === "BETTING") && (
            <button
              onClick={handleBet}
              disabled={!canBet}
              className={cn(
                "px-8 py-3 rounded-xl font-bold text-sm transition-all",
                canBet
                  ? "bg-primary text-white hover:opacity-90 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60",
              )}
            >
              {isPlacingBet ? "Placing…" : "BET"}
            </button>
          )}

          {/* CASH OUT button */}
          {myBet && roundStatus === "RUNNING" && (
            <button
              onClick={handleCashout}
              disabled={!canCashout}
              className={cn(
                "px-8 py-3 rounded-xl font-bold text-sm transition-all",
                canCashout
                  ? "bg-accent text-black hover:opacity-90 active:scale-95 animate-pulse"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60",
              )}
            >
              {isCashingOut
                ? "Cashing out…"
                : potentialPayout !== null
                  ? `CASH OUT ${formatCents(potentialPayout)}`
                  : "CASH OUT"}
            </button>
          )}

          {/* Status when bet is active but round not yet running */}
          {myBet && roundStatus === "BETTING" && (
            <span className="text-xs text-muted-foreground italic">
              Bet placed — waiting for round to start
            </span>
          )}

          {/* Lost / cashed out indicator */}
          {myBet && roundStatus === "CRASHED" && (
            <span
              className={cn(
                "text-sm font-bold",
                myBet.status === "CASHED_OUT" || myBet.status === "WON"
                  ? "text-accent"
                  : "text-destructive",
              )}
            >
              {myBet.status === "CASHED_OUT" || myBet.status === "WON"
                ? `Won ${formatCents(BigInt(myBet.payoutInCents ?? "0"))}`
                : "Lost"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
