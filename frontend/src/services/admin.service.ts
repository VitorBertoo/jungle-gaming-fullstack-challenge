const WALLETS_URL = import.meta.env.VITE_WALLETS_URL ?? "http://localhost:8000/wallets";

// ─── types ───────────────────────────────────────────────────────────────────

export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp: number;
}

export interface AdminWallet {
  id: string;
  playerId: string;
  balanceInCents: string;
  createdAt: string;
  updatedAt: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function adminFetch(adminKey: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${WALLETS_URL}/admin${path}`, {
    ...init,
    headers: {
      "x-admin-key": adminKey,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res;
}

// ─── auth ─────────────────────────────────────────────────────────────────────

/** Validates the admin key by calling a protected endpoint. */
export async function validateAdminKey(adminKey: string): Promise<void> {
  await adminFetch(adminKey, "/wallets");
}

// ─── users (proxied through wallets service) ──────────────────────────────────

export async function listUsers(adminKey: string): Promise<KeycloakUser[]> {
  const res = await adminFetch(adminKey, "/users");
  return res.json() as Promise<KeycloakUser[]>;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export async function createUser(adminKey: string, payload: CreateUserPayload): Promise<string> {
  const res = await adminFetch(adminKey, "/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json() as { userId: string };
  return data.userId;
}

export async function deleteUser(adminKey: string, userId: string): Promise<void> {
  await adminFetch(adminKey, `/users/${userId}`, { method: "DELETE" });
}

// ─── wallets ─────────────────────────────────────────────────────────────────

export async function listWallets(adminKey: string): Promise<AdminWallet[]> {
  const res = await adminFetch(adminKey, "/wallets");
  return res.json() as Promise<AdminWallet[]>;
}

export async function adminTopup(
  adminKey: string,
  playerId: string,
  amountInCents: number,
): Promise<AdminWallet> {
  const res = await adminFetch(adminKey, `/wallets/${playerId}/topup`, {
    method: "POST",
    body: JSON.stringify({ amountInCents }),
  });
  return res.json() as Promise<AdminWallet>;
}
