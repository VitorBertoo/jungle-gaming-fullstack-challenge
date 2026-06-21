import { useRef, useEffect } from "react";
import { useGameStore } from "@/stores/game.store";
import type { RoundStatus } from "@/stores/game.store";
import { formatMultiplier } from "@/lib/utils";

interface DataPoint {
  elapsed: number;   // ms since round started
  multiplier: number; // integer, 100 = 1.00x
}

interface GraphState {
  roundStatus: RoundStatus | null;
  currentMultiplier: number;
  crashPointMultiplier: number | null;
  serverSeedHash: string | null;
  serverSeed: string | null;
  bettingEndsAt: string | null;
  startedAt: string | null;
  roundId: string | null;
  points: DataPoint[];
}

const PAD = { top: 24, right: 24, bottom: 40, left: 60 };

const COLOR_ACCENT = "#06d6a0";
const COLOR_CRASH = "#ef4444";
const COLOR_BG = "#0a0a0f";
const COLOR_GRID = "rgba(255,255,255,0.06)";
const COLOR_LABEL = "rgba(255,255,255,0.35)";

/** Return grid line multiplier values that fit under maxM */
function gridLines(maxM: number): number[] {
  return [100, 150, 200, 300, 500, 1000, 2000, 5000, 10000].filter(
    (m) => m <= maxM,
  );
}

export function CrashGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const stateRef = useRef<GraphState>({
    roundStatus: null,
    currentMultiplier: 100,
    crashPointMultiplier: null,
    serverSeedHash: null,
    serverSeed: null,
    bettingEndsAt: null,
    startedAt: null,
    roundId: null,
    points: [],
  });

  /**
   * Subscribe to the Zustand store directly so multiplier ticks never
   * trigger a React re-render — only the canvas RAF loop reads the data.
   */
  useEffect(() => {
    let prevRoundId: string | null = null;
    let prevStatus: RoundStatus | null = null;

    const unsub = useGameStore.subscribe((state) => {
      const s = stateRef.current;
      const { roundId, roundStatus, currentMultiplier, startedAt } = state;

      // New round: wipe old curve data
      if (roundId !== prevRoundId) {
        prevRoundId = roundId;
        s.points = [];
      }

      if (roundStatus === "RUNNING") {
        if (prevStatus !== "RUNNING") {
          // First tick of a new running phase — anchor at 1.00x
          s.points = [{ elapsed: 0, multiplier: 100 }];
        } else if (startedAt) {
          s.points.push({
            elapsed: Date.now() - new Date(startedAt).getTime(),
            multiplier: currentMultiplier,
          });
        }
      }

      prevStatus = roundStatus;
      s.roundStatus = roundStatus;
      s.currentMultiplier = currentMultiplier;
      s.crashPointMultiplier = state.crashPointMultiplier;
      s.serverSeedHash = state.serverSeedHash;
      s.serverSeed = state.serverSeed;
      s.bettingEndsAt = state.bettingEndsAt;
      s.startedAt = startedAt;
      s.roundId = roundId;
    });

    return unsub;
  }, []);

  /** Single RAF loop + ResizeObserver — no dependency on store values */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const W = canvas.width;
      const H = canvas.height;
      const gW = W - PAD.left - PAD.right;
      const gH = H - PAD.top - PAD.bottom;

      const {
        roundStatus,
        currentMultiplier,
        crashPointMultiplier,
        serverSeedHash,
        serverSeed,
        bettingEndsAt,
        points,
      } = stateRef.current;

      // ── Background ─────────────────────────────────────────────
      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, W, H);

      // ── Axis bounds ────────────────────────────────────────────
      const displayM =
        roundStatus === "CRASHED"
          ? (crashPointMultiplier ?? currentMultiplier)
          : currentMultiplier;
      const maxM = Math.max(displayM * 1.2, 220);
      const minM = 100;
      const maxElapsed =
        points.length > 0
          ? Math.max(points[points.length - 1].elapsed + 3000, 8000)
          : 10000;

      const toX = (e: number) => PAD.left + (e / maxElapsed) * gW;
      const toY = (m: number) =>
        PAD.top + gH - ((m - minM) / (maxM - minM)) * gH;

      // ── Grid lines + labels ────────────────────────────────────
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      gridLines(maxM).forEach((m) => {
        const y = toY(m);
        if (y < PAD.top || y > PAD.top + gH) return;
        ctx.strokeStyle = COLOR_GRID;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + gW, y);
        ctx.stroke();
        ctx.fillStyle = COLOR_LABEL;
        ctx.fillText(formatMultiplier(m), PAD.left - 8, y + 4);
      });

      // ── Curve ──────────────────────────────────────────────────
      if (points.length > 1) {
        const color =
          roundStatus === "CRASHED" ? COLOR_CRASH : COLOR_ACCENT;
        const last = points[points.length - 1];

        // Gradient fill under the curve
        const grad = ctx.createLinearGradient(
          0, PAD.top, 0, PAD.top + gH,
        );
        grad.addColorStop(0, color + "40");
        grad.addColorStop(1, color + "00");

        ctx.beginPath();
        ctx.moveTo(toX(points[0].elapsed), toY(points[0].multiplier));
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(toX(points[i].elapsed), toY(points[i].multiplier));
        }
        ctx.lineTo(toX(last.elapsed), PAD.top + gH);
        ctx.lineTo(toX(points[0].elapsed), PAD.top + gH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Curve line
        ctx.beginPath();
        ctx.moveTo(toX(points[0].elapsed), toY(points[0].multiplier));
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(toX(points[i].elapsed), toY(points[i].multiplier));
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();

        // Endpoint dot
        ctx.beginPath();
        ctx.arc(toX(last.elapsed), toY(last.multiplier), 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── Center overlay ─────────────────────────────────────────
      ctx.textAlign = "center";
      const cx = PAD.left + gW / 2;
      const cy = PAD.top + gH / 2;

      if (roundStatus === "CRASHED") {
        ctx.fillStyle = COLOR_CRASH;
        ctx.font = "bold 16px system-ui";
        ctx.fillText("CRASHED AT", cx, cy - 24);

        ctx.font = "bold 68px system-ui";
        ctx.fillText(formatMultiplier(crashPointMultiplier ?? 100), cx, cy + 48);

        if (serverSeed) {
          ctx.fillStyle = COLOR_LABEL;
          ctx.font = "10px monospace";
          ctx.fillText(`Seed: ${serverSeed}`, cx, H - 10);
        }
      } else if (roundStatus === "RUNNING") {
        ctx.fillStyle = COLOR_ACCENT;
        ctx.font = "bold 68px system-ui";
        ctx.fillText(formatMultiplier(currentMultiplier), cx, cy + 32);
      } else {
        // BETTING or initial load
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 18px system-ui";
        ctx.fillText("Place your bets", cx, cy - 20);

        if (bettingEndsAt) {
          const secsLeft = Math.max(
            0,
            Math.ceil(
              (new Date(bettingEndsAt).getTime() - Date.now()) / 1000,
            ),
          );
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.font = "15px system-ui";
          ctx.fillText(`Starting in ${secsLeft}s`, cx, cy + 10);
        }

        if (serverSeedHash) {
          ctx.fillStyle = COLOR_LABEL;
          ctx.font = "10px monospace";
          const hash = serverSeedHash.slice(0, 48);
          ctx.fillText(`Hash: ${hash}`, cx, cy + 42);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
