import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/store";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { sessao, isLoading, loadError } = useApp();
  const location = useLocation();

  if (!sessao || new Date(sessao.expira_em) < new Date()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Carregando dados…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-base font-semibold text-destructive">
            Erro ao carregar dados
          </p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <p className="text-xs text-muted-foreground">
            Verifique se o schema do Supabase foi aplicado e se você tem
            permissão (e-mail @v4company.com).
          </p>
        </div>
      </div>
    );
  }

  return children;
}
