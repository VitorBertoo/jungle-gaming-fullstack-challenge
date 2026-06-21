import { useState, useEffect, useCallback } from "react";
import { formatCents, cn } from "@/lib/utils";
import {
  validateAdminKey,
  listUsers,
  createUser,
  deleteUser,
  listWallets,
  adminTopup,
  type KeycloakUser,
  type AdminWallet,
} from "@/services/admin.service";

// ─── Login screen ─────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: (adminKey: string) => void }) {
  const [adminKey, setAdminKey] = useState("admin-secret");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await validateAdminKey(adminKey);
      onLogin(adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid admin key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 space-y-6">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">Admin Panel</h1>
          <p className="text-xs text-muted-foreground mt-1">User &amp; wallet management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Admin API Key</label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Verifying…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Create user form ─────────────────────────────────────────────────────────

function CreateUserForm({ adminKey, onCreated }: { adminKey: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createUser(adminKey, { username, email, password });
      setUsername(""); setEmail(""); setPassword("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        + New User
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Create User</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Username</label>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Topup modal ──────────────────────────────────────────────────────────────

function TopupModal({
  playerId,
  username,
  adminKey,
  onDone,
  onClose,
}: {
  playerId: string;
  username: string;
  adminKey: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("100000");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminTopup(adminKey, playerId, parseInt(amount));
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Topup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div>
          <p className="font-semibold text-foreground">Top Up Wallet</p>
          <p className="text-xs text-muted-foreground mt-0.5">{username}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Amount (cents)</label>
            <input
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">= {formatCents(BigInt(parseInt(amount) || 0))}</p>
          </div>
          {/* Quick amounts */}
          <div className="flex gap-2 flex-wrap">
            {[1000, 10000, 100000, 1000000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:border-primary hover:text-white transition-colors"
              >
                {formatCents(BigInt(v))}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-accent text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Crediting…" : "Credit"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main admin panel ─────────────────────────────────────────────────────────

interface Session {
  adminKey: string;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<KeycloakUser[]>([]);
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");
  const [topupTarget, setTopupTarget] = useState<{ playerId: string; username: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async (s: Session) => {
    setLoadingData(true);
    setError("");
    try {
      const [u, w] = await Promise.all([
        listUsers(s.adminKey),
        listWallets(s.adminKey),
      ]);
      setUsers(u);
      setWallets(w);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (session) refresh(session);
  }, [session, refresh]);

  async function handleDelete(userId: string) {
    if (!session) return;
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeletingId(userId);
    try {
      await deleteUser(session.adminKey, userId);
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (!session) {
    return <LoginForm onLogin={(adminKey) => setSession({ adminKey })} />;
  }

  // Build a map of playerId → wallet for quick lookup
  const walletByPlayer = new Map(wallets.map((w) => [w.playerId, w]));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <a href="/game" className="text-xs text-muted-foreground hover:text-white transition-colors">
            ← Game
          </a>
          <span className="text-muted-foreground/40">|</span>
          <span className="font-black text-lg tracking-tight text-white">Admin</span>
        </div>
        <button
          onClick={() => setSession(null)}
          className="text-xs text-muted-foreground hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Users section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">
              Users
              <span className="ml-2 text-xs font-normal text-muted-foreground">({users.length})</span>
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refresh(session)}
                disabled={loadingData}
                className="text-xs text-muted-foreground hover:text-white transition-colors disabled:opacity-40"
              >
                {loadingData ? "Refreshing…" : "Refresh"}
              </button>
              <CreateUserForm
                adminKey={session.adminKey}
                onCreated={() => refresh(session)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Email</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">
                      {loadingData ? "Loading…" : "No users found"}
                    </td>
                  </tr>
                )}
                {users.map((user) => {
                  const wallet = walletByPlayer.get(user.id);
                  return (
                    <tr key={user.id} className="hover:bg-card/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{user.username}</div>
                        <div className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {user.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {wallet ? (
                          <span className="font-bold text-accent tabular-nums">
                            {formatCents(BigInt(wallet.balanceInCents))}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">no wallet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {wallet && (
                            <button
                              onClick={() => setTopupTarget({ playerId: user.id, username: user.username })}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-accent hover:text-black transition-colors"
                            >
                              Top Up
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deletingId === user.id}
                            className={cn(
                              "px-3 py-1 rounded-lg text-xs font-semibold border transition-colors",
                              deletingId === user.id
                                ? "border-border text-muted-foreground opacity-50"
                                : "border-destructive/50 text-destructive hover:bg-destructive hover:text-white",
                            )}
                          >
                            {deletingId === user.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Wallets section */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground">
            All Wallets
            <span className="ml-2 text-xs font-normal text-muted-foreground">({wallets.length})</span>
          </h2>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Player ID</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Updated</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wallets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">
                      {loadingData ? "Loading…" : "No wallets found"}
                    </td>
                  </tr>
                )}
                {wallets.map((wallet) => {
                  const user = users.find((u) => u.id === wallet.playerId);
                  return (
                    <tr key={wallet.id} className="hover:bg-card/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{user?.username ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{wallet.playerId.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-accent tabular-nums">
                        {formatCents(BigInt(wallet.balanceInCents))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(wallet.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setTopupTarget({ playerId: wallet.playerId, username: user?.username ?? wallet.playerId })}
                          className="px-3 py-1 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-accent hover:text-black transition-colors"
                        >
                          Top Up
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Topup modal */}
      {topupTarget && (
        <TopupModal
          playerId={topupTarget.playerId}
          username={topupTarget.username}
          adminKey={session.adminKey}
          onDone={() => refresh(session)}
          onClose={() => setTopupTarget(null)}
        />
      )}
    </div>
  );
}
