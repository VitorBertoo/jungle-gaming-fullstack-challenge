import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useGameStore } from "@/stores/game.store";
import { gameApi } from "@/services/api";

/**
 * Manages the socket.io connection to the games service.
 *
 * Routing: the client connects to Kong (VITE_WS_URL) using
 * path "/games/socket.io". Kong matches the "/games" route,
 * strips the prefix, and the games service receives "/socket.io/..."
 * on its default socket.io path — no extra Kong config required.
 *
 * On (re)connect, syncs state from the REST API to handle any
 * events missed while disconnected.
 */
export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const {
    onRoundBetting,
    onRoundStarted,
    onMultiplierTick,
    onBetPlaced,
    onBetCashout,
    onRoundCrashed,
    onBetCancelled,
    syncFromApi,
  } = useGameStore();

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL ?? "http://localhost:8000";

    const socket = io(wsUrl, {
      path: "/games/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    async function syncState() {
      try {
        const [round, historyResult] = await Promise.all([
          gameApi.getCurrentRound().catch(() => null),
          gameApi.getRoundHistory(1, 20).catch(() => null),
        ]);

        const history = (historyResult?.rounds ?? []).map((r) => ({
          roundId: r.id,
          crashPointMultiplier: r.crashPointMultiplier ?? 0,
          crashedAt: r.crashedAt ?? "",
        }));

        syncFromApi(round, history);
      } catch {
        // Non-fatal: the WS stream will fill in state
      }
    }

    socket.on("connect", () => {
      setConnected(true);
      void syncState();
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("round:betting", onRoundBetting);
    socket.on("round:started", onRoundStarted);
    socket.on("multiplier:tick", onMultiplierTick);
    socket.on("bet:placed", onBetPlaced);
    socket.on("bet:cashout", onBetCashout);
    socket.on("round:crashed", onRoundCrashed);
    socket.on("bet:cancelled", onBetCancelled);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // Store actions are stable references — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connected };
}
