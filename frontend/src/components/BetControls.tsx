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

  // ── Auto settings ────────────────────────────────────────────────────────
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutTargetStr, setAutoCashoutTargetStr] = useState("2.00");

  // Tracks the roundId we last auto-bet in — prevents firing twice per round
  const autoBetFiredRoundRef = useRef<string | null>(null);
  // Tracks the roundId we last auto-cashed-out in — prevents firing twice per round
  const autoCashoutFiredRoundRef = useRef<string | null>(null);

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

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const isValidAmount = !isNaN(amountCents) && amountCents >= MIN_CENTS && amountCents <= MAX_CENTS;

  // ── Auto Bet ─────────────────────────────────────────────────────────────
  // Fires once at the start of each BETTING phase when enabled.
  useEffect(() => {
    if (!autoBetEnabled) return;
    if (roundStatus !== "BETTING" || !roundId) return;
    if (autoBetFiredRoundRef.current === roundId) return; // already fired this round
    if (myBet) return;        // already have an active bet
    if (!isValidAmount) return;

    autoBetFiredRoundRef.current = roundId;
    // Small delay so the BETTING state fully settles before sending the request
    const t = setTimeout(() => {
      placeBet(amountCents, {
        onError: (err) =>
          showToast(err instanceof Error ? err.message : "Auto bet failed", "error"),
      });
    }, 300);
    return () => clearTimeout(t);
  }, [autoBetEnabled, roundStatus, roundId, myBet, isValidAmount, amountCents, placeBet]);

  // ── Auto Cashout ─────────────────────────────────────────────────────────
  // Fires once per round when the multiplier crosses the configured target.
  useEffect(() => {
    if (!autoCashoutEnabled) return;
    if (roundStatus !== "RUNNING" || !roundId || !myBet || isCashingOut) return;
    if (autoCashoutFiredRoundRef.current === roundId) return; // already fired this round

    const target = Math.round(parseFloat(autoCashoutTargetStr) * 100);
    if (isNaN(target) || target < 101) return; // target must be > 1.00x

    if (currentMultiplier >= target) {
      autoCashoutFiredRoundRef.current = roundId;
      cashout(undefined, {
        onSuccess: () =>
          showToast(`Auto cashed out at ${formatMultiplier(currentMultiplier)}!`, "success"),
        onError: (err) =>
          showToast(err instanceof Error ? err.message : "Auto cashout failed", "error"),
      });
    }
  }, [autoCashoutEnabled, currentMultiplier, roundStatus, roundId, myBet, isCashingOut, autoCashoutTargetStr, cashout]);

  function showToast(msg: string, type: "error" | "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

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
    if (/^\d*\.?\d{0,2}$/.test(val)) setAmountStr(val);
  }

  const inputDisabled = roundStatus === "RUNNING" && !!myBet;

  return (
    <div className="relative px-4 py-3">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "absolute top-2 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-10 whitespace-nowrap",
            toast.type === "error"
              ? "bg-destructive text-white"
              : "bg-accent text-black",
          )}
        >
          {toast.msg}
        </div>
      )}

      {/* Mobile: flex-col · Desktop: flex-row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">

        {/* Amount input + quick amounts */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Bet Amount
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={inputDisabled}
                className={cn(
                  "w-28 pl-7 pr-3 py-2 rounded-lg border text-sm font-mono bg-background text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary transition-colors",
                  !isValidAmount && amountStr !== "" ? "border-destructive" : "border-border",
                  inputDisabled ? "opacity-50 cursor-not-allowed" : "",
                )}
              />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1 flex-wrap">
              {QUICK_AMOUNTS.map((d) => (
                <button
                  key={d}
                  onClick={() => setQuickAmount(d)}
                  disabled={inputDisabled}
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

        {/* Desktop spacer */}
        <div className="hidden sm:block flex-1" />

        {/* Action area */}
        <div className="flex flex-col gap-1 sm:items-end">
          {/* Payout preview */}
          {potentialPayout !== null && (
            <div className="text-left sm:text-right">
              <span className="text-xs text-muted-foreground">Potential payout </span>
              <span className="text-sm font-bold text-accent">
                {formatCents(potentialPayout)}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                @{formatMultiplier(currentMultiplier)}
              </span>
            </div>
          )}

          {/* Countdown */}
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
                "w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all",
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
                "w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all",
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

          {/* Status: bet placed, waiting */}
          {myBet && roundStatus === "BETTING" && (
            <span className="text-xs text-muted-foreground italic">
              Bet placed — waiting for round to start
            </span>
          )}

          {/* Lost / won result */}
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

      {/* ── Auto Controls ─────────────────────────────────────────────────── */}
      <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider shrink-0">
          Auto
        </span>

        {/* Auto Bet toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoBetEnabled}
            onChange={(e) => setAutoBetEnabled(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <span className={cn("text-sm", autoBetEnabled ? "text-foreground font-medium" : "text-muted-foreground")}>
            Auto Bet
          </span>
          {autoBetEnabled && (
            <span className="text-xs text-primary animate-pulse">ON</span>
          )}
        </label>

        {/* Auto Cashout toggle + target */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoCashoutEnabled}
            onChange={(e) => setAutoCashoutEnabled(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <span className={cn("text-sm", autoCashoutEnabled ? "text-foreground font-medium" : "text-muted-foreground")}>
            Auto Cashout at
          </span>
        </label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={autoCashoutTargetStr}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d*\.?\d{0,2}$/.test(v)) setAutoCashoutTargetStr(v);
            }}
            disabled={!autoCashoutEnabled}
            className={cn(
              "w-20 px-2 py-1 rounded-lg border text-sm font-mono bg-background text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary transition-colors",
              !autoCashoutEnabled ? "opacity-40 cursor-not-allowed" : "border-border",
            )}
          />
          <span className="text-sm text-muted-foreground">×</span>
          {autoCashoutEnabled && (
            <span className="text-xs text-primary animate-pulse">ON</span>
          )}
        </div>
      </div>
    </div>
  );
}
