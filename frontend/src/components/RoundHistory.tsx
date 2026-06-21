import { useState } from "react";
import { useGameStore, type HistoryEntry } from "@/stores/game.store";
import { formatMultiplier, cn } from "@/lib/utils";

function chipClass(crashPointMultiplier: number): string {
  if (crashPointMultiplier < 200) return "bg-destructive/20 text-destructive border-destructive/30";
  if (crashPointMultiplier < 500) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-accent/20 text-accent border-accent/30";
}

function RoundDetailModal({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const rows: { label: string; value: string; copyable?: boolean }[] = [
    { label: "Round ID", value: entry.roundId, copyable: true },
    { label: "Crash Point", value: formatMultiplier(entry.crashPointMultiplier) },
    { label: "Crashed At", value: new Date(entry.crashedAt).toLocaleString() },
    { label: "Nonce", value: String(entry.nonce) },
    { label: "Seed Hash", value: entry.serverSeedHash, copyable: true },
    ...(entry.serverSeed
      ? [{ label: "Server Seed", value: entry.serverSeed, copyable: true }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground">Round Details</p>
            <p className="text-xs text-muted-foreground mt-0.5">Provably Fair Verification</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Crash point badge */}
        <div className="flex justify-center py-2">
          <span className={cn(
            "text-3xl font-black px-6 py-2 rounded-xl border-2",
            chipClass(entry.crashPointMultiplier),
          )}>
            {formatMultiplier(entry.crashPointMultiplier)}
          </span>
        </div>

        {/* Data rows */}
        <div className="space-y-2">
          {rows.map(({ label, value, copyable }) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-foreground font-mono break-all text-right">{value}</span>
                {copyable && (
                  <button
                    onClick={() => copy(label, value)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-white transition-colors"
                    title="Copy"
                  >
                    {copied === label ? "✓" : "⎘"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Verify note */}
        {!entry.serverSeed && (
          <p className="text-xs text-muted-foreground text-center border-t border-border pt-3">
            Server seed revealed after round completion
          </p>
        )}
        {entry.serverSeed && (
          <p className="text-xs text-muted-foreground text-center border-t border-border pt-3">
            Verify: <code className="text-foreground">HMAC-SHA256(serverSeed, nonce)</code> → crash point
          </p>
        )}
      </div>
    </div>
  );
}

export function RoundHistory() {
  const history = useGameStore((s) => s.history);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  if (history.length === 0) {
    return (
      <p className="text-muted-foreground text-xs text-center mt-6 px-3">
        No rounds played yet
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 p-3 content-start overflow-y-auto h-full">
        {history.map((entry) => (
          <button
            key={entry.roundId}
            onClick={() => setSelected(entry)}
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold tabular-nums",
              "hover:opacity-80 transition-opacity cursor-pointer",
              chipClass(entry.crashPointMultiplier),
            )}
          >
            {formatMultiplier(entry.crashPointMultiplier)}
          </button>
        ))}
      </div>

      {selected && (
        <RoundDetailModal entry={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
