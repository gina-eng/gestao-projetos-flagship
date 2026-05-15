import { useMemo, useState } from "react";
import {
  History,
  Plus,
  Pencil,
  Trash2,
  Activity,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AcaoAuditoria, EntidadeAuditavel, RegistroAuditoria } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  registros: RegistroAuditoria[];
  titulo?: string;
  vazio?: string;
  className?: string;
  // Quantos registros mostrar inicialmente; o resto fica em "ver mais".
  limiteInicial?: number;
}

const ACAO_ICON: Record<AcaoAuditoria, typeof Plus> = {
  criar: Plus,
  atualizar: Pencil,
  remover: Trash2,
  evento: Activity,
};

const ACAO_TONE: Record<AcaoAuditoria, string> = {
  criar: "bg-emerald-100 text-emerald-700",
  atualizar: "bg-amber-100 text-amber-800",
  remover: "bg-red-100 text-red-700",
  evento: "bg-blue-100 text-blue-700",
};

const ENT_LABEL: Record<EntidadeAuditavel, string> = {
  cliente: "Cliente",
  projeto: "Projeto",
  investidor: "Investidor",
  produto: "Produto",
  pagamento: "Pagamento",
  parcela: "Parcela",
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  const hoje = new Date();
  const sameDay =
    d.getFullYear() === hoje.getFullYear() &&
    d.getMonth() === hoje.getMonth() &&
    d.getDate() === hoje.getDate();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const isOntem =
    d.getFullYear() === ontem.getFullYear() &&
    d.getMonth() === ontem.getMonth() &&
    d.getDate() === ontem.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `Hoje · ${hh}:${mm}`;
  if (isOntem) return `Ontem · ${hh}:${mm}`;
  return `${d.toLocaleDateString("pt-BR")} · ${hh}:${mm}`;
}

export function HistoricoAuditoria({
  registros,
  titulo = "Histórico de alterações",
  vazio = "Nenhuma alteração registrada ainda.",
  className,
  limiteInicial = 8,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [verTodos, setVerTodos] = useState(false);

  const ordenados = useMemo(
    () => [...registros].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [registros]
  );

  const visiveis = verTodos ? ordenados : ordenados.slice(0, limiteInicial);

  function toggle(id: string) {
    setExpandidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (registros.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-6 text-center", className)}>
        <History className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{vazio}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {titulo && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {titulo}
          </p>
          <Badge variant="outline" className="text-[10px]">
            {registros.length} registros
          </Badge>
        </div>
      )}

      <ol className="space-y-1.5">
        {visiveis.map((r) => {
          const Icon = ACAO_ICON[r.acao];
          const aberto = expandidos.has(r.id);
          const tem = r.mudancas.length > 0;
          return (
            <li
              key={r.id}
              className="overflow-hidden rounded-md border border-border/60 bg-card"
            >
              <button
                type="button"
                onClick={() => tem && toggle(r.id)}
                className={cn(
                  "flex w-full items-start gap-3 p-3 text-left transition-colors",
                  tem && "hover:bg-muted/40 cursor-pointer",
                  !tem && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    ACAO_TONE[r.acao]
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {ENT_LABEL[r.entidade]}
                    </Badge>
                    <span className="truncate text-sm font-semibold text-foreground">
                      {r.entidade_label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-content">{r.resumo}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatTimestamp(r.timestamp)}</span>
                    {r.usuario_nome && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-2.5 w-2.5" />
                        {r.usuario_nome}
                      </span>
                    )}
                    {tem && (
                      <span className="flex items-center gap-1 font-medium">
                        {aberto ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {aberto ? "Ocultar" : "Ver"} alterações
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {tem && aberto && (
                <div className="border-t border-border/60 bg-muted/30 p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1 pr-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                          Campo
                        </th>
                        <th className="py-1 px-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                          De
                        </th>
                        <th className="py-1 pl-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                          Para
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.mudancas.map((m) => (
                        <tr key={m.campo} className="border-b last:border-0">
                          <td className="py-1 pr-2 font-medium text-foreground">
                            {m.label}
                          </td>
                          <td className="py-1 px-2 text-muted-foreground line-through">
                            {m.de || "—"}
                          </td>
                          <td className="py-1 pl-2 font-medium text-foreground">
                            {m.para || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!verTodos && ordenados.length > limiteInicial && (
        <button
          type="button"
          onClick={() => setVerTodos(true)}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          Ver todos os {ordenados.length} registros
        </button>
      )}
    </div>
  );
}
