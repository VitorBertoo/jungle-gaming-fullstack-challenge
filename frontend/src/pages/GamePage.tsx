import { useAuthStore } from "@/stores/auth.store";
import { useWallet } from "@/hooks/useWallet";
import { useSocket } from "@/hooks/useSocket";
import { logout } from "@/services/auth.service";
import { formatCents } from "@/lib/utils";

export default function GamePage() {
  const username = useAuthStore((s) => s.username);
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { connected } = useSocket();

  const balanceDisplay = wallet
    ? formatCents(BigInt(wallet.balanceInCents))
    : walletLoading
      ? "…"
      : "$0.00";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-tight text-white">CRASH</span>
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-accent" : "bg-muted-foreground"}`}
            title={connected ? "Live" : "Connecting…"}
          />
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
            <p className="text-base font-bold text-accent">{balanceDisplay}</p>
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

      {/* Main — to be filled in Step 5/6 */}
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Game UI coming in next steps…
        </p>
      </main>
    </div>
  );
}
