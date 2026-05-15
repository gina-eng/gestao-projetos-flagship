import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/store";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { sessao } = useApp();
  const location = useLocation();

  if (!sessao || new Date(sessao.expira_em) < new Date()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
