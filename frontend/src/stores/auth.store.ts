import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  username: string | null;
  /** Keycloak `sub` claim — used by the backend as playerId */
  playerId: string | null;
  setTokens: (accessToken: string, refreshToken: string, username: string, playerId: string) => void;
  clearTokens: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      username: null,
      playerId: null,
      setTokens: (accessToken, refreshToken, username, playerId) =>
        set({ accessToken, refreshToken, username, playerId }),
      clearTokens: () =>
        set({ accessToken: null, refreshToken: null, username: null, playerId: null }),
    }),
    {
      name: "crash-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        username: state.username,
        playerId: state.playerId,
      }),
    },
  ),
);
