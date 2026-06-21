/**
 * E2E tests for the Games Service API.
 * Requires `bun run docker:up` to be running.
 *
 * Run: cd services/games && bun test tests/e2e
 */

import { describe, it, expect, beforeAll } from "bun:test";

const BASE_URL = process.env.GAMES_URL ?? "http://localhost:4001";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
const WALLETS_URL = process.env.WALLETS_URL ?? "http://localhost:4002";

const REALM = "crash-game";
const CLIENT_ID = "crash-game-client";
const TEST_USER = "player";
const TEST_PASS = "player123";

// ─── helpers ────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const res = await fetch(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: CLIENT_ID,
        username: TEST_USER,
        password: TEST_PASS,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Keycloak token error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

async function ensureWallet(token: string): Promise<void> {
  const res = await fetch(`${WALLETS_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    await fetch(`${WALLETS_URL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/** Poll until the current round reaches the desired status (or timeout). */
async function waitForRoundStatus(
  status: "BETTING" | "RUNNING" | "CRASHED",
  timeoutMs = 120_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/rounds/current`);
    if (res.ok) {
      const round = await res.json() as Record<string, unknown>;
      if (round?.status === status) return round;
    }
    await Bun.sleep(500);
  }
  throw new Error(`Timed out waiting for round status: ${status}`);
}

// ─── suite ──────────────────────────────────────────────────────────────────

let token: string;

beforeAll(async () => {
  token = await getToken();
  await ensureWallet(token);
});

describe("GET /health", () => {
  it("returns 200 with service name", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("games");
  });
});

describe("GET /rounds/current", () => {
  it("returns the current round", async () => {
    const res = await fetch(`${BASE_URL}/rounds/current`);
    expect(res.status).toBe(200);
    const round = await res.json() as Record<string, unknown>;
    expect(round).not.toBeNull();
    expect(["BETTING", "RUNNING", "CRASHED"]).toContain(round.status as string);
    expect(round.id).toBeDefined();
    expect(round.serverSeedHash).toBeDefined();
    // Crash point must be hidden while round is not finished
    if (round.status !== "CRASHED") {
      expect(round.crashPointMultiplier).toBeNull();
    }
  });
});

describe("GET /rounds/history", () => {
  it("returns a paginated list", async () => {
    const res = await fetch(`${BASE_URL}/rounds/history?page=1&limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json() as { rounds: unknown[]; total: number; page: number; limit: number };
    expect(Array.isArray(body.rounds)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.page).toBe(1);
    expect(body.limit).toBe(5);
  });
});

describe("POST /bet — validation errors", () => {
  it("rejects missing amountInCents", async () => {
    const res = await fetch(`${BASE_URL}/bet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects bet below minimum (50 cents)", async () => {
    const round = await waitForRoundStatus("BETTING");
    const res = await fetch(`${BASE_URL}/bet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amountInCents: 50 }),
    });
    // Either 400 (invalid amount) or 422 (not in betting phase if phase changed)
    expect([400, 422]).toContain(res.status);
    void round; // used for phase sync
  }, 120_000);

  it("rejects bet above maximum (200001 cents)", async () => {
    await waitForRoundStatus("BETTING");
    const res = await fetch(`${BASE_URL}/bet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amountInCents: 200001 }),
    });
    expect([400, 422]).toContain(res.status);
  }, 120_000);

  it("requires authentication", async () => {
    const res = await fetch(`${BASE_URL}/bet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountInCents: 1000 }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /bet/cashout — validation errors", () => {
  it("requires authentication", async () => {
    const res = await fetch(`${BASE_URL}/bet/cashout`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when player has no active bet", async () => {
    // Wait for a RUNNING round, then try cashout without a bet
    await waitForRoundStatus("RUNNING");
    const res = await fetch(`${BASE_URL}/bet/cashout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    // 404 = no active bet; 422 = round not running (race condition) — both valid
    expect([404, 422]).toContain(res.status);
  }, 120_000);
});

describe("Happy path: place bet → cashout", () => {
  it("places a bet during BETTING phase and cashes out during RUNNING phase", async () => {
    // 1. Wait for a BETTING round
    await waitForRoundStatus("BETTING");

    // 2. Place bet
    const betRes = await fetch(`${BASE_URL}/bet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amountInCents: 1000 }), // $10.00
    });

    // If we missed the betting window, skip gracefully
    if (betRes.status === 422) {
      console.log("Missed betting window — skipping happy path bet test");
      return;
    }

    expect(betRes.status).toBe(201);
    const bet = await betRes.json() as Record<string, unknown>;
    expect(bet.status).toBe("PENDING_DEBIT");
    expect(bet.amountInCents).toBe("1000");

    // 3. Attempt double-bet in same round — should fail
    const dupRes = await fetch(`${BASE_URL}/bet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amountInCents: 500 }),
    });
    expect([409, 422]).toContain(dupRes.status); // 409 = duplicate, 422 = not betting phase

    // 4. Wait for RUNNING phase
    await waitForRoundStatus("RUNNING");

    // 5. Cash out
    const cashoutRes = await fetch(`${BASE_URL}/bet/cashout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // 200 = cashed out, 404 = round already crashed before cashout (race), 422 = not running
    expect([200, 404, 422]).toContain(cashoutRes.status);

    if (cashoutRes.status === 200) {
      const cashedOut = await cashoutRes.json() as Record<string, unknown>;
      expect(["CASHED_OUT", "WON"]).toContain(cashedOut.status as string);
      expect(cashedOut.cashOutMultiplier).not.toBeNull();
      expect(Number(cashedOut.payoutInCents)).toBeGreaterThanOrEqual(1000);
    }
  }, 300_000); // 5 min: waits BETTING (120s) + RUNNING (120s) + margin
});

describe("GET /rounds/:id/verify", () => {
  it("returns 404 for unknown round", async () => {
    const res = await fetch(`${BASE_URL}/rounds/non-existent-id/verify`);
    expect(res.status).toBe(404);
  });
});

describe("GET /bets/me", () => {
  it("requires authentication", async () => {
    const res = await fetch(`${BASE_URL}/bets/me`);
    expect(res.status).toBe(401);
  });

  it("returns paginated bet history for authenticated player", async () => {
    const res = await fetch(`${BASE_URL}/bets/me?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");
  });
});
