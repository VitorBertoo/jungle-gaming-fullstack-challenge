import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { handleCallback } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

export default function CallbackPage() {
  const navigate = useNavigate();
  const { setTokens } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    handleCallback()
      .then((user) => {
        const username =
          (user.profile.preferred_username as string | undefined) ??
          (user.profile.sub as string);
        const playerId = user.profile.sub as string;
        setTokens(user.access_token, user.refresh_token ?? "", username, playerId);
        navigate("/game", { replace: true });
      })
      .catch(() => {
        navigate("/login", { replace: true });
      });
  }, [navigate, setTokens]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-muted-foreground text-sm animate-pulse">
        Signing in…
      </span>
    </div>
  );
}
