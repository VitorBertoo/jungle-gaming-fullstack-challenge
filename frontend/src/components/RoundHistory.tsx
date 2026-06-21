import { useGameStore } from "@/stores/game.store";
import { formatMultiplier, cn } from "@/lib/utils";

function chipClass(crashPointMultiplier: number): string {
  if (crashPointMultiplier < 200) {
    // < 2x — red
    return "bg-destructive/20 text-destructive border-destructive/30";
  }
  if (crashPointMultiplier < 500) {
    // 2x–4.99x — yellow
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  }
  // ≥ 5x — green
  return "bg-accent/20 text-accent border-accent/30";
}

export function RoundHistory() {
  const history = useGameStore((s) => s.history);

  if (history.length === 0) {
    return (
      <p className="text-muted-foreground text-xs text-center mt-6 px-3">
        No rounds played yet
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-3 content-start overflow-y-auto h-full">
      {history.map((entry) => (
        <span
          key={entry.roundId}
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold tabular-nums",
            chipClass(entry.crashPointMultiplier),
          )}
          title={new Date(entry.crashedAt).toLocaleTimeString()}
        >
          {formatMultiplier(entry.crashPointMultiplier)}
        </span>
      ))}
    </div>
  );
}
