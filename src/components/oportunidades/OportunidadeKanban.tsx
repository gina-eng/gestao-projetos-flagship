import { DragEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, User as UserIcon } from "lucide-react";
import { useApp } from "@/store";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import {
  type EtapaOportunidade,
  ETAPAS_OPORTUNIDADE,
  type Oportunidade,
} from "@/types";

const ETAPA_TONE: Record<EtapaOportunidade, string> = {
  identificada: "bg-slate-100 text-slate-700",
  em_negociacao: "bg-amber-100 text-amber-800",
  proposta_enviada: "bg-blue-100 text-blue-800",
  ganha: "bg-emerald-100 text-emerald-800",
  perdida: "bg-rose-100 text-rose-800",
};

export function OportunidadeKanban({
  oportunidades,
}: {
  oportunidades: Oportunidade[];
}) {
  const { clientes, produtos, investidores, moveOportunidadeEtapa } = useApp();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverEtapa, setHoverEtapa] = useState<EtapaOportunidade | null>(null);

  function onDragStart(e: DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setHoverEtapa(null);
  }

  function onDragOver(e: DragEvent, etapa: EtapaOportunidade) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoverEtapa !== etapa) setHoverEtapa(etapa);
  }

  function onDrop(e: DragEvent, etapa: EtapaOportunidade) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveOportunidadeEtapa(id, etapa);
    setDraggingId(null);
    setHoverEtapa(null);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="kanban-scroller h-[calc(100vh-280px)] min-h-[420px] overflow-x-auto overflow-y-hidden pb-3">
        <div className="flex h-full min-w-max gap-3 pr-1">
          {ETAPAS_OPORTUNIDADE.map((etapa) => {
            const cards = oportunidades.filter((o) => o.etapa === etapa.value);
            const totalValor = cards.reduce(
              (acc, o) => acc + (o.valor_estimado ?? 0),
              0
            );
            return (
              <div
                key={etapa.value}
                onDragOver={(e) => onDragOver(e, etapa.value)}
                onDrop={(e) => onDrop(e, etapa.value)}
                className={cn(
                  "flex h-full w-72 flex-shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
                  hoverEtapa === etapa.value && draggingId && "border-primary bg-primary/5"
                )}
              >
                <div className="shrink-0 border-b border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        ETAPA_TONE[etapa.value]
                      )}
                    >
                      {etapa.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {cards.length}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {etapa.descricao}
                  </p>
                  {totalValor > 0 && (
                    <p className="mt-1 text-[11px] font-semibold tabular-nums text-foreground">
                      {formatCurrency(totalValor)}
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
                    cards.map((o) => {
                      const cli = clientes.find((c) => c.id === o.cliente_id);
                      const prod = produtos.find((p) => p.id === o.produto_id);
                      const resp = investidores.find(
                        (i) => i.id === o.responsavel_id
                      );
                      return (
                        <Link
                          key={o.id}
                          to={`/oportunidades/${o.id}`}
                          draggable
                          onDragStart={(e) => onDragStart(e, o.id)}
                          onDragEnd={onDragEnd}
                          className={cn(
                            "block",
                            draggingId === o.id && "opacity-40"
                          )}
                        >
                          <Card className="card-hover cursor-grab border-border/70 p-3 active:cursor-grabbing">
                            <p className="text-sm font-semibold leading-tight text-foreground">
                              {o.nome}
                            </p>
                            {cli && (
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Building2 className="h-3 w-3 shrink-0" />
                                {cli.nome_fantasia}
                              </p>
                            )}
                            {prod && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {prod.nome}
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
                              <span className="font-semibold tabular-nums text-foreground">
                                {formatCurrency(o.valor_estimado)}
                                {o.modelo_cobranca === "recorrente" && (
                                  <span className="font-normal text-muted-foreground">
                                    /mês
                                  </span>
                                )}
                              </span>
                              {resp && (
                                <Badge variant="outline" className="text-[9px]">
                                  <UserIcon className="mr-0.5 h-2.5 w-2.5" />
                                  {resp.nome.split(" ")[0]}
                                </Badge>
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
