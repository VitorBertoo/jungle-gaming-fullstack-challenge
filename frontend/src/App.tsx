import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useAuthInit } from "@/hooks/useAuthInit";
import LoginPage from "@/pages/LoginPage";
import CallbackPage from "@/pages/CallbackPage";
import GamePage from "@/pages/GamePage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-muted-foreground text-sm animate-pulse">
        Loading…
      </span>
    </div>
  );
}

export default function App() {
  const { ready } = useAuthInit();

  if (!ready) return <AppSplash />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/callback" element={<CallbackPage />} />
      <Route
        path="/game"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/game" replace />} />
    </Routes>
  );
}
