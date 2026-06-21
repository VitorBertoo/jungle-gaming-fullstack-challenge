import { useEffect } from "react";
import { login } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate("/game", { replace: true });
    }
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--color-background]">
      <div className="flex flex-col items-center gap-8 p-10 rounded-xl border border-[--color-border] bg-[--color-card] shadow-2xl w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl font-black tracking-tight text-white">
            CRASH
          </span>
          <span className="text-sm text-[--color-muted-foreground] tracking-widest uppercase">
            Jungle Gaming
          </span>
        </div>

        <p className="text-sm text-[--color-muted-foreground] text-center">
          Sign in with your account to play.
        </p>

        <button
          onClick={() => login()}
          className="w-full py-3 rounded-lg bg-[--color-primary] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Sign in with Keycloak
        </button>
      </div>
    </div>
  );
}
