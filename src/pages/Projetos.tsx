import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  Filter,
  LayoutGrid,
  List as ListIcon,
  GanttChart,
  X,
  Columns,
  Search,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/Layout";
import { ProjetoFormDialog } from "@/components/projetos/ProjetoFormDialog";
import { ProjetoKanban } from "@/components/projetos/ProjetoKanban";
import { ProjetoGantt } from "@/components/projetos/ProjetoGantt";
import { FasesManagerDialog } from "@/components/projetos/FasesManagerDialog";
import {
  categoriasDoProjeto,
  ehFaseEncerramento,
  formatCurrency,
  formatDate,
  produtosDoProjeto,
  variantCategoria,
} from "@/lib/utils";
import {
  CATEGORIAS,
  Projeto,
  SAUDE_LABEL,
  TIERS,
  type CategoriaV4,
  type SaudeProjeto,
  type Tier,
} from "@/types";

const saudeVariant: Record<SaudeProjeto, "saudavel" | "alerta" | "cuidado" | "critico"> = {
  saudavel: "saudavel",
  alerta: "alerta",
  cuidado: "cuidado",
  critico: "critico",
};

type ViewMode = "kanban" | "lista" | "gantt";

export function ProjetosPage() {
  const { projetos, clientes, produtos, fases } = useApp();
  const [params] = useSearchParams();

  const [view, setView] = useState<ViewMode>("kanban");
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fasesDialogOpen, setFasesDialogOpen] = useState(false);
  const [clientePreSelect, setClientePreSelect] = useState<string | undefined>();

  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaV4 | "all">("all");
  const [filtroTier, setFiltroTier] = useState<Tier | "all">("all");
  const [filtroSaude, setFiltroSaude] = useState<SaudeProjeto | "all">("all");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const clienteParam = params.get("cliente");
    if (clienteParam) {
      setClientePreSelect(clienteParam);
      setEditando(null);
      setDialogOpen(true);
    }
  }, [params]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return projetos.filter((p) => {
      // Mostra projetos ativos/pausados normalmente. Para concluido/churn,
      // só mostra se estiverem na fase de encerramento correspondente —
      // soft-deletes (status="concluido" mas em fase qualquer) ficam ocultos.
      const faseObj = fases.find((f) => f.id === p.fase_atual);
      if (p.status === "ativo" || p.status === "pausado") {
        // ok, segue
      } else if (
        (p.status === "concluido" || p.status === "churn") &&
        ehFaseEncerramento(faseObj?.nome)
      ) {
        // ok, mostra na coluna de encerramento do kanban
      } else {
        return false;
      }
      const cli = clientes.find((c) => c.id === p.cliente_id);
      const cats = categoriasDoProjeto(p, produtos);
      const prods = produtosDoProjeto(p, produtos);
      if (filtroCategoria !== "all" && !cats.includes(filtroCategoria))
        return false;
      if (filtroTier !== "all" && cli?.tier !== filtroTier) return false;
      if (filtroSaude !== "all" && p.saude_atual !== filtroSaude) return false;
      if (q) {
        const haystack = [
          p.nome,
          p.codigo,
          cli?.nome_fantasia,
          cli?.razao_social,
          ...prods.map(({ produto }) => produto?.nome ?? ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [projetos, produtos, clientes, fases, filtroCategoria, filtroTier, filtroSaude, busca]);

  const filtroAtivo =
    filtroCategoria !== "all" ||
    filtroTier !== "all" ||
    filtroSaude !== "all" ||
    busca.trim() !== "";

  return (
    <div className="spacing-section">
      <PageHeader
        title="Projetos"
        description="Kanban da carteira. Arraste cards entre fases para atualizar o status."
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
              <button
                onClick={() => setView("gantt")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  view === "gantt" ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                <GanttChart className="h-3.5 w-3.5" />
                Gantt
              </button>
            </div>
            <Button variant="outline" onClick={() => setFasesDialogOpen(true)}>
              <Columns className="h-4 w-4" />
              Gerenciar fases
            </Button>
            <Button
              onClick={() => {
                setEditando(null);
                setClientePreSelect(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo projeto
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por projeto, cliente, código ou produto"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filtros:
            </div>

            <FilterChip
              label="Categoria"
              value={filtroCategoria}
              options={[
                { value: "all", label: "Todas" },
                ...CATEGORIAS.map((c) => ({ value: c.value, label: c.label })),
              ]}
              onChange={(v) => setFiltroCategoria(v as typeof filtroCategoria)}
            />
            <FilterChip
              label="Tier"
              value={filtroTier}
              options={[
                { value: "all", label: "Todos" },
                ...TIERS.map((t) => ({ value: t.value, label: t.label })),
              ]}
              onChange={(v) => setFiltroTier(v as typeof filtroTier)}
            />
            <FilterChip
              label="Saúde"
              value={filtroSaude}
              options={[
                { value: "all", label: "Todas" },
                { value: "saudavel", label: "Saudável" },
                { value: "alerta", label: "Em alerta" },
                { value: "cuidado", label: "Em cuidado" },
                { value: "critico", label: "Crítico" },
              ]}
              onChange={(v) => setFiltroSaude(v as typeof filtroSaude)}
            />

            {filtroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => {
                  setFiltroCategoria("all");
                  setFiltroTier("all");
                  setFiltroSaude("all");
                  setBusca("");
                }}
              >
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {view === "kanban" ? (
        <ProjetoKanban projetos={filtrados} />
      ) : view === "gantt" ? (
        <ProjetoGantt projetos={filtrados} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="table-header p-3 text-left">Código</th>
                  <th className="table-header p-3 text-left">Cliente</th>
                  <th className="table-header p-3 text-left">Produtos</th>
                  <th className="table-header p-3 text-left">Categorias</th>
                  <th className="table-header p-3 text-left">Tier</th>
                  <th className="table-header p-3 text-left">Fase</th>
                  <th className="table-header p-3 text-left">Saúde</th>
                  <th className="table-header p-3 text-right">Valor</th>
                  <th className="table-header p-3 text-left">Início</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const cliente = clientes.find((c) => c.id === p.cliente_id);
                  const prods = produtosDoProjeto(p, produtos);
                  const cats = categoriasDoProjeto(p, produtos);
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <Link
                          to={`/projetos/${p.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {p.codigo}
                        </Link>
                      </td>
                      <td className="p-3 font-medium">
                        {cliente?.nome_fantasia ?? "—"}
                      </td>
                      <td className="p-3 text-content">
                        {prods.length === 0 ? (
                          "—"
                        ) : (
                          <div className="space-y-0.5">
                            {prods.slice(0, 2).map(({ item, produto }) => (
                              <div key={item.id} className="text-xs">
                                {produto?.nome ?? "—"}
                              </div>
                            ))}
                            {prods.length > 2 && (
                              <div className="text-[10px] italic text-muted-foreground">
                                +{prods.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {cats.slice(0, 2).map((cat) => (
                            <Badge key={cat} variant={variantCategoria(cat)} className="text-[10px]">
                              {CATEGORIAS.find((c) => c.value === cat)?.label}
                            </Badge>
                          ))}
                          {cats.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{cats.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {cliente && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {cliente.tier}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-content">
                        {fases.find((f) => f.id === p.fase_atual)?.nome ?? "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant={saudeVariant[p.saude_atual]}>
                          {SAUDE_LABEL[p.saude_atual]}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatCurrency(p.valor_total)}
                      </td>
                      <td className="p-3 text-content">{formatDate(p.data_inicio)}</td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Nenhum projeto encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <ProjetoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projeto={editando}
        clientePreSelect={clientePreSelect}
      />

      <FasesManagerDialog
        open={fasesDialogOpen}
        onOpenChange={setFasesDialogOpen}
      />
    </div>
  );
}

function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
