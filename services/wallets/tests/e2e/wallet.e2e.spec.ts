/**
 * E2E tests for the Wallets Service API.
 * Requires `bun run docker:up` to be running.
 *
 * Run: cd services/wallets && bun test tests/e2e
 */

import { describe, it, expect, beforeAll } from "bun:test";

const BASE_URL = process.env.WALLETS_URL ?? "http://localhost:4002";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";

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
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ─── suite ──────────────────────────────────────────────────────────────────

let token: string;

beforeAll(async () => {
  token = await getToken();
});

describe("GET /health", () => {
  it("returns 200 with service name", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("wallets");
  });
});

describe("POST / (create wallet)", () => {
  it("requires authentication", async () => {
    const res = await fetch(`${BASE_URL}/`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("creates a wallet and returns it with $1,000 starting balance", async () => {
    // Delete any existing wallet state by trying to create — may already exist
    const res = await fetch(`${BASE_URL}/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // 201 = created, 409 = already exists — both are valid depending on prior state
    expect([201, 409]).toContain(res.status);

    if (res.status === 201) {
      const wallet = await res.json() as Record<string, unknown>;
      expect(wallet.id).toBeDefined();
      expect(wallet.playerId).toBeDefined();
      // Starting balance is $1,000 = 100,000 cents
      expect(Number(wallet.balanceInCents)).toBeGreaterThanOrEqual(100_000);
      expect(wallet.createdAt).toBeDefined();
      expect(wallet.updatedAt).toBeDefined();
    }
  });

  it("returns 409 on duplicate wallet creation", async () => {
    // First call may create or conflict — either way a second call must conflict
    await fetch(`${BASE_URL}/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await fetch(`${BASE_URL}/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(409);
  });
});

describe("GET /me", () => {
  it("requires authentication", async () => {
    const res = await fetch(`${BASE_URL}/me`);
    expect(res.status).toBe(401);
  });

  it("returns the authenticated player's wallet", async () => {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const wallet = await res.json() as Record<string, unknown>;
    expect(wallet.id).toBeDefined();
    expect(wallet.playerId).toBeDefined();
    expect(typeof wallet.balanceInCents).toBe("string"); // serialized bigint
    expect(Number(wallet.balanceInCents)).toBeGreaterThanOrEqual(0);
    expect(wallet.createdAt).toBeDefined();
    expect(wallet.updatedAt).toBeDefined();
  });

  it("balance is serialized as a string (bigint safe)", async () => {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const wallet = await res.json() as Record<string, unknown>;
    // Must be a string, not a number, to avoid JS precision loss on large values
    expect(typeof wallet.balanceInCents).toBe("string");
  });
});

describe("POST /topup", () => {
  it("requires authentication", async () => {
    const res = await fetch(`${BASE_URL}/topup`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("credits $1,000 by default and returns updated wallet", async () => {
    const before = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const beforeWallet = await before.json() as { balanceInCents: string };
    const balanceBefore = BigInt(beforeWallet.balanceInCents);

    const res = await fetch(`${BASE_URL}/topup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const wallet = await res.json() as { balanceInCents: string };
    const balanceAfter = BigInt(wallet.balanceInCents);

    expect(balanceAfter).toBe(balanceBefore + 100_000n);
  });

  it("credits a custom amount", async () => {
    const before = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const beforeWallet = await before.json() as { balanceInCents: string };
    const balanceBefore = BigInt(beforeWallet.balanceInCents);

    const res = await fetch(`${BASE_URL}/topup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amountInCents: 500 }), // $5.00
    });

    expect(res.status).toBe(200);
    const wallet = await res.json() as { balanceInCents: string };
    expect(BigInt(wallet.balanceInCents)).toBe(balanceBefore + 500n);
  });

  it("rejects zero or negative amount", async () => {
    const res = await fetch(`${BASE_URL}/topup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amountInCents: 0 }),
    });
    expect(res.status).toBe(400);
  });
});
