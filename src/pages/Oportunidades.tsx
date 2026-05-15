import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Filter,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/Layout";
import { OportunidadeKanban } from "@/components/oportunidades/OportunidadeKanban";
import { OportunidadeFormDialog } from "@/components/oportunidades/OportunidadeFormDialog";
import { formatCurrency } from "@/lib/utils";
import {
  type EtapaOportunidade,
  ETAPA_OPORTUNIDADE_LABEL,
  ETAPAS_OPORTUNIDADE,
} from "@/types";

type ViewMode = "kanban" | "lista";

export function OportunidadesPage() {
  const { oportunidades, clientes, produtos, investidores } = useApp();
  const [view, setView] = useState<ViewMode>("kanban");
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtroEtapa, setFiltroEtapa] = useState<EtapaOportunidade | "all">("all");
  const [filtroResp, setFiltroResp] = useState<string>("all");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return oportunidades.filter((o) => {
      if (filtroEtapa !== "all" && o.etapa !== filtroEtapa) return false;
      if (filtroResp !== "all" && o.responsavel_id !== filtroResp) return false;
      if (q) {
        const cli = clientes.find((c) => c.id === o.cliente_id);
        const haystack = [
          o.nome,
          cli?.nome_fantasia,
          cli?.sigla,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [oportunidades, clientes, busca, filtroEtapa, filtroResp]);

  const filtroAtivo = filtroEtapa !== "all" || filtroResp !== "all";

  // Métricas rápidas no header
  const pipelineAtivo = oportunidades
    .filter((o) => o.etapa !== "ganha" && o.etapa !== "perdida")
    .reduce((acc, o) => acc + o.valor_estimado, 0);
  const ganhasTotal = oportunidades
    .filter((o) => o.etapa === "ganha")
    .reduce((acc, o) => acc + o.valor_estimado, 0);

  return (
    <div className="spacing-section">
      <PageHeader
        title="Oportunidades"
        description="Pipeline de cross-sell e upsell para clientes da carteira."
        actions={
          <>
            <div className="flex rounded-md border border-input bg-background p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  view === "kanban" ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                onClick={() => setView("lista")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  view === "lista" ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                Lista
              </button>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova oportunidade
            </Button>
          </>
        }
      />

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Pipeline em aberto
              </p>
              <p className="text-base font-bold tabular-nums">
                {formatCurrency(pipelineAtivo)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {oportunidades.filter((o) => o.etapa !== "ganha" && o.etapa !== "perdida").length} em
                negociação
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Ganhas (TCV total)
              </p>
              <p className="text-base font-bold tabular-nums">
                {formatCurrency(ganhasTotal)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {oportunidades.filter((o) => o.etapa === "ganha").length} oportunidades
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Perdidas
              </p>
              <p className="text-base font-bold tabular-nums">
                {oportunidades.filter((o) => o.etapa === "perdida").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + busca */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, cliente ou sigla"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Filtros:
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Etapa:</span>
            <select
              value={filtroEtapa}
              onChange={(e) =>
                setFiltroEtapa(e.target.value as EtapaOportunidade | "all")
              }
              className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todas</option>
              {ETAPAS_OPORTUNIDADE.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Responsável:</span>
            <select
              value={filtroResp}
              onChange={(e) => setFiltroResp(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos</option>
              {investidores
                .filter((i) => i.status === "ativo")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
            </select>
          </div>
          {filtroAtivo && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={() => {
                setFiltroEtapa("all");
                setFiltroResp("all");
              }}
            >
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-title-card">Nenhuma oportunidade ainda</p>
              <p className="text-body">
                Crie a primeira a partir de um cliente da sua carteira.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova oportunidade
            </Button>
          </CardContent>
        </Card>
      ) : view === "kanban" ? (
        <OportunidadeKanban oportunidades={filtradas} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="table-header p-3 text-left">Nome</th>
                  <th className="table-header p-3 text-left">Cliente</th>
                  <th className="table-header p-3 text-left">Produto</th>
                  <th className="table-header p-3 text-left">Responsável</th>
                  <th className="table-header p-3 text-left">Etapa</th>
                  <th className="table-header p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => {
                  const cli = clientes.find((c) => c.id === o.cliente_id);
                  const prod = produtos.find((p) => p.id === o.produto_id);
                  const resp = investidores.find((i) => i.id === o.responsavel_id);
                  return (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <Link
                          to={`/oportunidades/${o.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {o.nome}
                        </Link>
                      </td>
                      <td className="p-3 text-content">
                        {cli?.nome_fantasia ?? "—"}
                      </td>
                      <td className="p-3 text-content">{prod?.nome ?? "—"}</td>
                      <td className="p-3 text-content">{resp?.nome ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {ETAPA_OPORTUNIDADE_LABEL[o.etapa]}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatCurrency(o.valor_estimado)}
                        {o.modelo_cobranca === "recorrente" && (
                          <span className="text-xs text-muted-foreground">/mês</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <OportunidadeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
