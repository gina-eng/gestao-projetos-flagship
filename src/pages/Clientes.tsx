import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, LayoutGrid, List as ListIcon, Plus, Search } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/Layout";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { ClienteKanban } from "@/components/clientes/ClienteKanban";
import {
  type Cliente,
  MODELOS_VENDAS,
  SEGMENTO_LABEL,
  STATUS_CLIENTE_LABEL,
  TIERS,
} from "@/types";
import { labelSegmento } from "@/lib/utils";

type ViewMode = "kanban" | "lista";

export function ClientesPage() {
  const { clientes, projetos } = useApp();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("kanban");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nome_fantasia.toLowerCase().includes(q) ||
        c.razao_social.toLowerCase().includes(q) ||
        c.sigla.toLowerCase().includes(q) ||
        (c.cnpj ?? "").includes(q)
    );
  }, [clientes, busca]);

  return (
    <div className="spacing-section">
      <PageHeader
        title="Clientes"
        description="Cadastro central. Arraste entre fases pra mover Em fechamento → Ativo → Inativo."
        actions={
          <>
            <div className="flex rounded-md border border-input bg-background p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  view === "kanban"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                onClick={() => setView("lista")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  view === "lista"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                Lista
              </button>
            </div>
            <Button
              onClick={() => {
                setEditando(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo cliente
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, sigla ou CNPJ"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {filtrados.length === 0 ? (
        <EmptyState
          onCreate={() => {
            setEditando(null);
            setDialogOpen(true);
          }}
        />
      ) : view === "kanban" ? (
        <ClienteKanban clientes={filtrados} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => {
            const projetosDoCliente = projetos.filter((p) => p.cliente_id === c.id);
            const ativos = projetosDoCliente.filter(
              (p) => p.status === "ativo"
            ).length;
            return (
              <Link key={c.id} to={`/clientes/${c.id}`} className="block">
                <Card className="card-hover h-full border-border/70">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                          {c.sigla}
                        </div>
                        <div>
                          <p className="text-title-card leading-tight">
                            {c.nome_fantasia}
                          </p>
                          <p className="text-body-small">{c.razao_social}</p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          c.status === "ativo"
                            ? "saudavel"
                            : c.status === "churn"
                            ? "critico"
                            : c.status === "em_fechamento"
                            ? "alerta"
                            : "secondary"
                        }
                      >
                        {STATUS_CLIENTE_LABEL[c.status]}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        Tier · {TIERS.find((t) => t.value === c.tier)?.label}
                      </Badge>
                      {c.modelo_vendas.map((m) => {
                        const label =
                          MODELOS_VENDAS.find((mv) => mv.value === m)?.label ?? m;
                        return (
                          <Badge key={m} variant="outline" className="text-[10px]">
                            {label}
                          </Badge>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                      {c.segmento && (
                        <p>
                          <span className="font-medium text-foreground">Segmento:</span>{" "}
                          {labelSegmento(c, SEGMENTO_LABEL)}
                        </p>
                      )}
                      {c.nicho && (
                        <p>
                          <span className="font-medium text-foreground">Nicho:</span>{" "}
                          {c.nicho}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end border-t border-border/60 pt-3 text-xs">
                      <span className="font-semibold tabular-nums text-foreground">
                        {ativos} {ativos === 1 ? "projeto ativo" : "projetos ativos"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={editando}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <p className="text-title-card">Nenhum cliente encontrado</p>
          <p className="text-body">Comece cadastrando o primeiro cliente da unidade.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </CardContent>
    </Card>
  );
}
