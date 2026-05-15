import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  Users,
  Video,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/Layout";
import { cn, formatCurrency } from "@/lib/utils";
import {
  type Pagamento,
  type Parcela,
  type Projeto,
  type ReuniaoProjeto,
  TIPO_REUNIAO_LABEL,
} from "@/types";

// ─── Helpers de data ──────────────────────────────────────────────────────

function toYmd(d: Date): string {
  // ISO date local (não em UTC) — evita off-by-one em fusos negativos.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(date: Date): Date {
  // Segunda como início da semana (padrão BR).
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DIAS_SEMANA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ─── Tipos auxiliares pra render ─────────────────────────────────────────

interface ReuniaoComProjeto {
  reuniao: ReuniaoProjeto;
  projeto: Projeto;
}

interface ParcelaComContexto {
  parcela: Parcela;
  pagamento: Pagamento;
  projeto?: Projeto;
}

type View = "semana" | "mes";

// ─── Página ───────────────────────────────────────────────────────────────

export function CalendarioPage() {
  const { projetos, pagamentos, clientes } = useApp();
  const [view, setView] = useState<View>("semana");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Reuniões e parcelas indexadas por dia (yyyy-mm-dd) pra acesso O(1) no render.
  const reunioesPorDia = useMemo(() => {
    const map = new Map<string, ReuniaoComProjeto[]>();
    for (const projeto of projetos) {
      for (const reuniao of projeto.reunioes ?? []) {
        const k = reuniao.data;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push({ reuniao, projeto });
      }
    }
    return map;
  }, [projetos]);

  const parcelasPorDia = useMemo(() => {
    const map = new Map<string, ParcelaComContexto[]>();
    for (const pagamento of pagamentos) {
      const projeto = projetos.find((p) => p.id === pagamento.projeto_id);
      for (const parcela of pagamento.parcelas) {
        if (parcela.status === "cancelado") continue;
        const k = parcela.data_vencimento;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push({ parcela, pagamento, projeto });
      }
    }
    return map;
  }, [pagamentos, projetos]);

  // Lista de dias visíveis conforme a visão.
  const dias = useMemo(() => {
    if (view === "semana") {
      const inicio = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
    }
    // Mês: começa pela 1ª segunda da semana que contém o dia 1, vai por 6 semanas.
    const inicio = startOfWeek(startOfMonth(cursor));
    return Array.from({ length: 42 }, (_, i) => addDays(inicio, i));
  }, [cursor, view]);

  const intervaloLabel = useMemo(() => {
    if (view === "semana") {
      const ini = dias[0];
      const fim = dias[6];
      const mesmoMes =
        ini.getMonth() === fim.getMonth() &&
        ini.getFullYear() === fim.getFullYear();
      const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
      if (mesmoMes) {
        return `${ini.getDate()} – ${fim.getDate()} de ${new Intl.DateTimeFormat(
          "pt-BR",
          { month: "long", year: "numeric" }
        ).format(ini)}`;
      }
      return `${fmt.format(ini)} – ${fmt.format(fim)} de ${fim.getFullYear()}`;
    }
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(cursor);
  }, [dias, cursor, view]);

  function navegar(direcao: -1 | 1) {
    setCursor((c) => {
      const novo = new Date(c);
      if (view === "semana") {
        novo.setDate(c.getDate() + direcao * 7);
      } else {
        novo.setMonth(c.getMonth() + direcao);
      }
      return novo;
    });
  }

  function irHoje() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  }

  // Totais da janela visível (semana ou mês visível).
  const visibleStart = dias[0];
  const visibleEnd = dias[dias.length - 1];
  const reunioesNaJanela = useMemo(() => {
    let count = 0;
    reunioesPorDia.forEach((arr, k) => {
      const d = new Date(k + "T00:00:00");
      if (d >= visibleStart && d <= visibleEnd) count += arr.length;
    });
    return count;
  }, [reunioesPorDia, visibleStart, visibleEnd]);

  const valorParcelasNaJanela = useMemo(() => {
    let total = 0;
    parcelasPorDia.forEach((arr, k) => {
      const d = new Date(k + "T00:00:00");
      if (d >= visibleStart && d <= visibleEnd) {
        total += arr.reduce((acc, p) => acc + p.parcela.valor, 0);
      }
    });
    return total;
  }, [parcelasPorDia, visibleStart, visibleEnd]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="spacing-section">
      <PageHeader
        title="Calendário"
        description="Reuniões e vencimentos da carteira, organizados por data."
      />

      {/* Controles: navegação + visualização + métricas */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navegar(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={irHoje}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => navegar(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <p className="ml-2 text-sm font-semibold capitalize text-foreground">
              {intervaloLabel}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Video className="h-3 w-3 text-saber" />
                {reunioesNaJanela} reunião(ões)
              </span>
              <span className="inline-flex items-center gap-1">
                <CircleDollarSign className="h-3 w-3 text-executar" />
                {formatCurrency(valorParcelasNaJanela)}
              </span>
            </div>
            <div className="flex rounded-md border border-input bg-background p-0.5">
              <button
                onClick={() => setView("semana")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium",
                  view === "semana"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
              >
                Semana
              </button>
              <button
                onClick={() => setView("mes")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium",
                  view === "mes"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
              >
                Mês
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {view === "semana" ? (
        <SemanaView
          dias={dias}
          hoje={hoje}
          reunioesPorDia={reunioesPorDia}
          parcelasPorDia={parcelasPorDia}
          clientesById={Object.fromEntries(clientes.map((c) => [c.id, c]))}
        />
      ) : (
        <MesView
          dias={dias}
          cursor={cursor}
          hoje={hoje}
          reunioesPorDia={reunioesPorDia}
          parcelasPorDia={parcelasPorDia}
        />
      )}
    </div>
  );
}

// ─── Vista semana ─────────────────────────────────────────────────────────

function SemanaView({
  dias,
  hoje,
  reunioesPorDia,
  parcelasPorDia,
  clientesById,
}: {
  dias: Date[];
  hoje: Date;
  reunioesPorDia: Map<string, ReuniaoComProjeto[]>;
  parcelasPorDia: Map<string, ParcelaComContexto[]>;
  clientesById: Record<string, { sigla: string; nome_fantasia: string }>;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="kanban-scroller overflow-x-auto pb-3">
        <div className="grid min-w-[1000px] grid-cols-7 gap-2">
          {dias.map((dia) => {
            const k = toYmd(dia);
            const reunioes = reunioesPorDia.get(k) ?? [];
            const parcelas = parcelasPorDia.get(k) ?? [];
            const isHoje = isSameDay(dia, hoje);
            const isFimSemana = dia.getDay() === 0 || dia.getDay() === 6;

            return (
              <div
                key={k}
                className={cn(
                  "flex min-h-[480px] flex-col rounded-lg border bg-card",
                  isHoje && "border-primary/60 ring-1 ring-primary/30",
                  isFimSemana && !isHoje && "bg-muted/30"
                )}
              >
                <div
                  className={cn(
                    "border-b border-border/60 p-2.5 text-center",
                    isHoje && "bg-primary/5"
                  )}
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {DIAS_SEMANA_CURTO[(dia.getDay() + 6) % 7]}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      isHoje ? "text-primary" : "text-foreground"
                    )}
                  >
                    {dia.getDate()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
                      dia
                    )}
                  </p>
                </div>

                {/* Topo — reuniões */}
                <div className="flex-1 border-b border-border/60 p-2 space-y-1.5">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-saber">
                    <Video className="h-3 w-3" />
                    Reuniões
                  </p>
                  {reunioes.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/60">—</p>
                  ) : (
                    reunioes.map(({ reuniao, projeto }) => {
                      const cli = clientesById[projeto.cliente_id];
                      return (
                        <Link
                          key={reuniao.id}
                          to={`/projetos/${projeto.id}`}
                          className="block rounded-md border border-saber/30 bg-saber/5 p-1.5 hover:bg-saber/10"
                        >
                          <p className="line-clamp-2 text-[11px] font-semibold text-foreground">
                            {reuniao.titulo || TIPO_REUNIAO_LABEL[reuniao.tipo]}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                            <Users className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">
                              {cli?.sigla ?? "?"} · {projeto.codigo}
                            </span>
                          </p>
                          <Badge
                            variant="outline"
                            className="mt-1 text-[9px] py-0"
                          >
                            {TIPO_REUNIAO_LABEL[reuniao.tipo]}
                          </Badge>
                        </Link>
                      );
                    })
                  )}
                </div>

                {/* Base — pagamentos */}
                <div className="p-2 space-y-1.5">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-executar">
                    <CircleDollarSign className="h-3 w-3" />
                    Pagamentos
                  </p>
                  {parcelas.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/60">—</p>
                  ) : (
                    parcelas.map(({ parcela, pagamento, projeto }) => {
                      const cli = projeto
                        ? clientesById[projeto.cliente_id]
                        : undefined;
                      return (
                        <Link
                          key={parcela.id}
                          to={`/financeiro`}
                          className={cn(
                            "block rounded-md border p-1.5",
                            parcela.status === "pago"
                              ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                              : parcela.status === "atrasado"
                              ? "border-rose-200 bg-rose-50 hover:bg-rose-100"
                              : "border-executar/30 bg-executar/5 hover:bg-executar/10"
                          )}
                        >
                          <p className="text-[11px] font-semibold tabular-nums text-foreground">
                            {formatCurrency(parcela.valor)}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {cli?.sigla ?? "?"} ·{" "}
                            {parcela.numero}/{pagamento.num_parcelas}
                          </p>
                          <Badge
                            variant={
                              parcela.status === "pago"
                                ? "saudavel"
                                : parcela.status === "atrasado"
                                ? "critico"
                                : "outline"
                            }
                            className="mt-1 text-[9px] py-0 capitalize"
                          >
                            {parcela.status}
                          </Badge>
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

// ─── Vista mês ────────────────────────────────────────────────────────────

function MesView({
  dias,
  cursor,
  hoje,
  reunioesPorDia,
  parcelasPorDia,
}: {
  dias: Date[];
  cursor: Date;
  hoje: Date;
  reunioesPorDia: Map<string, ReuniaoComProjeto[]>;
  parcelasPorDia: Map<string, ParcelaComContexto[]>;
}) {
  const mesAtual = cursor.getMonth();
  // 6 linhas × 7 colunas
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="grid grid-cols-7 gap-1.5">
        {DIAS_SEMANA_CURTO.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {dias.map((dia) => {
          const k = toYmd(dia);
          const reunioes = reunioesPorDia.get(k) ?? [];
          const parcelas = parcelasPorDia.get(k) ?? [];
          const isHoje = isSameDay(dia, hoje);
          const noMes = dia.getMonth() === mesAtual;
          const totalParcelas = parcelas.reduce(
            (acc, p) => acc + p.parcela.valor,
            0
          );

          return (
            <div
              key={k}
              className={cn(
                "flex min-h-[110px] flex-col rounded-md border bg-card p-1.5",
                !noMes && "opacity-40",
                isHoje && "border-primary/60 ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    isHoje ? "text-primary" : "text-foreground"
                  )}
                >
                  {dia.getDate()}
                </span>
              </div>

              {reunioes.length > 0 && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-saber">
                  <Video className="h-2.5 w-2.5" />
                  <span className="font-semibold">{reunioes.length}</span>
                </div>
              )}
              {parcelas.length > 0 && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-executar">
                  <CircleDollarSign className="h-2.5 w-2.5" />
                  <span className="truncate font-semibold tabular-nums">
                    {formatCurrency(totalParcelas)}
                  </span>
                </div>
              )}

              {(reunioes.length > 0 || parcelas.length > 0) && (
                <Link
                  to="#"
                  onClick={(e) => {
                    // Vista mês é resumida; clicar abre detalhe na vista semana
                    // dessa semana. Por enquanto sem ação custom; deixa cosmético.
                    e.preventDefault();
                  }}
                  className="mt-auto flex items-center gap-0.5 self-end text-[9px] text-muted-foreground hover:text-primary"
                >
                  Ver
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
