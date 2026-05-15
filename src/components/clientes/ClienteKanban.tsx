import { DragEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useApp } from "@/store";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, labelSegmento } from "@/lib/utils";
import {
  type Cliente,
  type FaseCliente,
  FASES_CLIENTE,
  SEGMENTO_LABEL,
  STATUS_CLIENTE_LABEL,
  TIERS,
} from "@/types";

// Mapeia o status concreto do cliente para a fase visível no kanban.
// "churn" cai junto com "inativo" porque é um inativo com motivo explícito.
function faseDoCliente(c: Cliente): FaseCliente {
  if (c.status === "em_fechamento") return "em_fechamento";
  if (c.status === "ativo") return "ativo";
  return "inativo"; // inativo ou churn
}

export function ClienteKanban({ clientes }: { clientes: Cliente[] }) {
  const { projetos, moveClienteStatus } = useApp();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverFase, setHoverFase] = useState<FaseCliente | null>(null);

  function onDragStart(e: DragEvent, clienteId: string) {
    setDraggingId(clienteId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", clienteId);
  }

  function onDragEnd() {
    setDraggingId(null);
    setHoverFase(null);
  }

  function onDragOver(e: DragEvent, fase: FaseCliente) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoverFase !== fase) setHoverFase(fase);
  }

  function onDrop(e: DragEvent, fase: FaseCliente) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const cli = clientes.find((c) => c.id === id);
    if (!cli) return;

    const atual = faseDoCliente(cli);
    if (atual === fase) {
      setDraggingId(null);
      setHoverFase(null);
      return;
    }

    // Avisos de coerência (mas não bloqueiam o movimento).
    const projetosAtivos = projetos.filter(
      (p) => p.cliente_id === id && p.status === "ativo"
    ).length;

    if (fase === "ativo" && projetosAtivos === 0) {
      const ok = window.confirm(
        "Este cliente não tem projeto ativo vinculado. Marcar como Ativo mesmo assim?"
      );
      if (!ok) {
        setDraggingId(null);
        setHoverFase(null);
        return;
      }
    }
    if (fase === "inativo" && projetosAtivos > 0) {
      const ok = window.confirm(
        `Este cliente tem ${projetosAtivos} projeto(s) ativo(s). Mover para Inativo mesmo assim?`
      );
      if (!ok) {
        setDraggingId(null);
        setHoverFase(null);
        return;
      }
    }

    moveClienteStatus(id, fase);
    setDraggingId(null);
    setHoverFase(null);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="kanban-scroller h-[calc(100vh-280px)] min-h-[420px] overflow-x-auto overflow-y-hidden pb-3">
        <div className="flex h-full min-w-max gap-3 pr-1">
          {FASES_CLIENTE.map((fase) => {
          const cards = clientes.filter((c) => faseDoCliente(c) === fase.value);
          return (
            <div
              key={fase.value}
              onDragOver={(e) => onDragOver(e, fase.value)}
              onDrop={(e) => onDrop(e, fase.value)}
              className={cn(
                "flex h-full w-72 flex-shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
                hoverFase === fase.value && draggingId && "border-primary bg-primary/5"
              )}
            >
              <div className="shrink-0 border-b border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  {fase.label}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {cards.length}{" "}
                  {cards.length === 1 ? "cliente" : "clientes"} · {fase.descricao}
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      Solte um card aqui
                    </p>
                  </div>
                ) : (
                  cards.map((c) => {
                    const projetosAtivos = projetos.filter(
                      (p) => p.cliente_id === c.id && p.status === "ativo"
                    ).length;
                    const totalProjetos = projetos.filter(
                      (p) => p.cliente_id === c.id
                    ).length;

                    // Avisos de coerência exibidos no card.
                    let aviso: string | null = null;
                    if (fase.value === "ativo" && projetosAtivos === 0) {
                      aviso = "Sem projeto ativo vinculado.";
                    } else if (fase.value === "inativo" && projetosAtivos > 0) {
                      aviso = `${projetosAtivos} projeto(s) ainda ativos.`;
                    }

                    return (
                      <Link
                        key={c.id}
                        to={`/clientes/${c.id}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, c.id)}
                        onDragEnd={onDragEnd}
                        className={cn(
                          "block",
                          draggingId === c.id && "opacity-40"
                        )}
                      >
                        <Card className="card-hover cursor-grab border-border/70 p-3 active:cursor-grabbing">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {c.sigla}
                            </span>
                            {c.status === "churn" && (
                              <Badge variant="critico" className="text-[9px]">
                                Churn
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold leading-tight text-foreground">
                            {c.nome_fantasia}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.razao_social}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] capitalize">
                              {TIERS.find((t) => t.value === c.tier)?.label}
                            </Badge>
                            {c.segmento && (
                              <span className="text-[10px] text-muted-foreground">
                                {labelSegmento(c, SEGMENTO_LABEL)}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                            <span>
                              {totalProjetos === 0
                                ? "Sem projetos"
                                : `${projetosAtivos}/${totalProjetos} ativo${
                                    totalProjetos === 1 ? "" : "s"
                                  }`}
                            </span>
                            {fase.value !== "em_fechamento" && (
                              <span className="font-medium">
                                {STATUS_CLIENTE_LABEL[c.status]}
                              </span>
                            )}
                          </div>

                          {aviso && (
                            <div className="mt-2 flex items-start gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-800 ring-1 ring-amber-200">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{aviso}</span>
                            </div>
                          )}
                        </Card>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
