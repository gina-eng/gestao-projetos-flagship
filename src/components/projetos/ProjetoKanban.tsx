import { DragEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/store";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CATEGORIAS,
  Projeto,
  SAUDE_LABEL,
  type FaseProjeto,
  type SaudeProjeto,
} from "@/types";
import {
  categoriasDoProjeto,
  cn,
  formatCurrency,
  formatDate,
  produtosDoProjeto,
  variantCategoria,
} from "@/lib/utils";

const saudeVariant: Record<SaudeProjeto, "saudavel" | "alerta" | "cuidado" | "critico"> = {
  saudavel: "saudavel",
  alerta: "alerta",
  cuidado: "cuidado",
  critico: "critico",
};

const saudeDot: Record<SaudeProjeto, string> = {
  saudavel: "bg-emerald-500",
  alerta: "bg-amber-500",
  cuidado: "bg-orange-500",
  critico: "bg-red-500",
};

export function ProjetoKanban({ projetos }: { projetos: Projeto[] }) {
  const { clientes, investidores, produtos, fases, moveProjetoFase } = useApp();
  const fasesOrdenadas = [...fases].sort((a, b) => a.ordem - b.ordem);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverFase, setHoverFase] = useState<FaseProjeto | null>(null);

  function onDragStart(e: DragEvent, projetoId: string) {
    setDraggingId(projetoId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projetoId);
  }

  function onDragEnd() {
    setDraggingId(null);
    setHoverFase(null);
  }

  function onDragOver(e: DragEvent, fase: FaseProjeto) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoverFase !== fase) setHoverFase(fase);
  }

  function onDrop(e: DragEvent, fase: FaseProjeto) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveProjetoFase(id, fase);
    setDraggingId(null);
    setHoverFase(null);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="kanban-scroller h-[calc(100vh-280px)] min-h-[420px] overflow-x-auto overflow-y-hidden pb-3">
        <div className="flex h-full min-w-max gap-3 pr-1">
          {fasesOrdenadas.map((fase) => {
          const cards = projetos.filter((p) => p.fase_atual === fase.id);
          const total = cards.reduce(
            (acc, p) => acc + (p.modelo_cobranca === "recorrente" ? p.valor_total : 0),
            0
          );
          return (
            <div
              key={fase.id}
              onDragOver={(e) => onDragOver(e, fase.id)}
              onDrop={(e) => onDrop(e, fase.id)}
              className={cn(
                "flex h-full w-72 flex-shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
                hoverFase === fase.id && draggingId && "border-primary bg-primary/5"
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border/60 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {fase.nome}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{cards.length} {cards.length === 1 ? "projeto" : "projetos"}</p>
                </div>
                {total > 0 && (
                  <p className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {formatCurrency(total)}/mês
                  </p>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      Solte um card aqui
                    </p>
                  </div>
                ) : (
                  cards.map((p) => {
                    const cliente = clientes.find((c) => c.id === p.cliente_id);
                    const itensResolvidos = produtosDoProjeto(p, produtos);
                    const categorias = categoriasDoProjeto(p, produtos);
                    const principal = p.squad.find((s) => s.principal);
                    const invPrincipal = investidores.find(
                      (i) => i.id === principal?.investidor_id
                    );
                    const itensVisiveis = itensResolvidos.slice(0, 3);
                    const restantes = itensResolvidos.length - itensVisiveis.length;
                    return (
                      <Link
                        key={p.id}
                        to={`/projetos/${p.id}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, p.id)}
                        onDragEnd={onDragEnd}
                        className={cn(
                          "block",
                          draggingId === p.id && "opacity-40"
                        )}
                      >
                        <Card className="card-hover cursor-grab border-border/70 p-3 active:cursor-grabbing">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {p.codigo}
                            </span>
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                saudeDot[p.saude_atual]
                              )}
                              title={SAUDE_LABEL[p.saude_atual]}
                            />
                          </div>
                          {/* Título grande: cliente. Subtítulo fino: produtos. */}
                          <p className="text-sm font-semibold leading-tight text-foreground">
                            {cliente?.nome_fantasia ?? "—"}
                          </p>
                          {itensVisiveis.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                              {itensVisiveis.map(({ item, produto }) => (
                                <li key={item.id} className="truncate">
                                  • {produto?.nome ?? "—"}
                                </li>
                              ))}
                              {restantes > 0 && (
                                <li className="text-[10px] italic">
                                  +{restantes} produto{restantes === 1 ? "" : "s"}
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="mt-0.5 text-xs text-muted-foreground">—</p>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                              {categorias.length === 0 ? (
                                <span className="text-[9px] text-muted-foreground">—</span>
                              ) : (
                                categorias.slice(0, 2).map((cat) => (
                                  <Badge
                                    key={cat}
                                    variant={variantCategoria(cat)}
                                    className="text-[9px]"
                                  >
                                    {CATEGORIAS.find((c) => c.value === cat)?.label}
                                  </Badge>
                                ))
                              )}
                              {categorias.length > 2 && (
                                <span className="text-[9px] text-muted-foreground">
                                  +{categorias.length - 2}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-foreground">
                              {formatCurrency(p.valor_total)}
                              {p.modelo_cobranca === "recorrente" && (
                                <span className="font-normal text-muted-foreground">
                                  /mês
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                            <span>{formatDate(p.data_inicio)}</span>
                            {invPrincipal && (
                              <span className="flex items-center gap-1">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                                  {invPrincipal.nome
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")}
                                </span>
                              </span>
                            )}
                          </div>
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
