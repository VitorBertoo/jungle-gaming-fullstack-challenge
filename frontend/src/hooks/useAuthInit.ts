import { useEffect, useState } from "react";
import type { User } from "oidc-client-ts";
import { userManager } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Runs once on app mount. Restores an existing OIDC session from storage,
 * attempts a silent token refresh if the session is expired, and wires
 * oidc-client-ts events so the store stays in sync with token renewals.
 *
 * Returns `ready` — false while the initial check is in flight so the app
 * can render a full-screen loader instead of flashing the login page.
 */
export function useAuthInit() {
  const [ready, setReady] = useState(false);
  const { setTokens, clearTokens } = useAuthStore();

  useEffect(() => {
    function applyUser(user: User | null) {
      if (!user || user.expired) {
        clearTokens();
        return;
      }
      const username =
        (user.profile.preferred_username as string | undefined) ??
        (user.profile.sub as string);
      const playerId = user.profile.sub as string;
      setTokens(user.access_token, user.refresh_token ?? "", username, playerId);
    }

    async function init() {
      try {
        let user = await userManager.getUser();

        if (!user || user.expired) {
          // Try silent renew before giving up
          try {
            user = await userManager.signinSilent();
          } catch {
            // No valid session — user must log in
          }
        }

        applyUser(user);
      } catch {
        clearTokens();
      } finally {
        setReady(true);
      }
    }

    // Keep store in sync when oidc-client-ts renews tokens automatically
    const onUserLoaded = (user: Parameters<typeof applyUser>[0]) => applyUser(user);
    const onUserUnloaded = () => clearTokens();
    const onSilentRenewError = () => clearTokens();

    userManager.events.addUserLoaded(onUserLoaded);
    userManager.events.addUserUnloaded(onUserUnloaded);
    userManager.events.addSilentRenewError(onSilentRenewError);

    void init();

    return () => {
      userManager.events.removeUserLoaded(onUserLoaded);
      userManager.events.removeUserUnloaded(onUserUnloaded);
      userManager.events.removeSilentRenewError(onSilentRenewError);
    };
  }, [setTokens, clearTokens]);

  return { ready };
}
