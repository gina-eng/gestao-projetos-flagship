import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIAS,
  Projeto,
  SAUDE_LABEL,
  type SaudeProjeto,
} from "@/types";
import {
  categoriasDoProjeto,
  cn,
  formatDate,
  produtosDoProjeto,
  variantCategoria,
} from "@/lib/utils";

// Cor da barra do gantt por saúde do projeto (alinhado com os badges).
const saudeBarra: Record<SaudeProjeto, string> = {
  saudavel: "bg-emerald-500",
  alerta: "bg-amber-500",
  cuidado: "bg-orange-500",
  critico: "bg-red-500",
};

// Volta o sábado/domingo pra segunda mais próxima — a grade semanal usa
// segunda como início de semana. Mutaria a referência, então sempre clonamos.
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay(); // 0 = domingo, 1 = segunda...
  const offset = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + offset);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function fmtSemana(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function fmtMes(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  }).format(d);
}

interface LinhaGantt {
  projeto: Projeto;
  inicio: Date;
  fim: Date;
}

export function ProjetoGantt({ projetos }: { projetos: Projeto[] }) {
  const { clientes, produtos } = useApp();

  const linhas = useMemo<LinhaGantt[]>(() => {
    return projetos
      .filter((p) => p.data_inicio && p.data_conclusao_prevista)
      .map((p) => ({
        projeto: p,
        inicio: new Date(p.data_inicio),
        fim: new Date(p.data_conclusao_prevista!),
      }))
      .filter((l) => !isNaN(l.inicio.getTime()) && !isNaN(l.fim.getTime()))
      .map((l) =>
        l.fim < l.inicio ? { ...l, fim: addDays(l.inicio, 7) } : l
      )
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  }, [projetos]);

  const semFim = useMemo(
    () => projetos.filter((p) => !p.data_conclusao_prevista).length,
    [projetos]
  );

  // Janela do gantt: 1 semana de folga antes do mais antigo e depois do mais
  // recente, ancoradas em segundas-feiras.
  const { semanas, inicioJanela, hojePx, larguraSemana } = useMemo(() => {
    if (linhas.length === 0) {
      return {
        semanas: [] as Date[],
        inicioJanela: new Date(),
        hojePx: 0,
        larguraSemana: 80,
      };
    }
    const minInicio = linhas.reduce(
      (acc, l) => (l.inicio < acc ? l.inicio : acc),
      linhas[0].inicio
    );
    const maxFim = linhas.reduce(
      (acc, l) => (l.fim > acc ? l.fim : acc),
      linhas[0].fim
    );
    const start = addDays(startOfWeek(minInicio), -7);
    const end = addDays(startOfWeek(maxFim), 14);
    const semanas: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 7)) {
      semanas.push(d);
    }
    const larguraSemana = 80; // px por semana
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojePx =
      hoje >= start
        ? (diffDays(start, hoje) / 7) * larguraSemana
        : -1;
    return { semanas, inicioJanela: start, hojePx, larguraSemana };
  }, [linhas]);

  // Cabeçalhos de mês (agrupa as semanas que caem no mesmo mês/ano).
  const cabecalhosMes = useMemo(() => {
    const grupos: { label: string; colSpan: number }[] = [];
    semanas.forEach((s) => {
      const label = fmtMes(s);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.label === label) {
        ultimo.colSpan += 1;
      } else {
        grupos.push({ label, colSpan: 1 });
      }
    });
    return grupos;
  }, [semanas]);

  if (linhas.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">
            Nenhum projeto com timeline definida.
          </p>
          <p className="text-xs text-muted-foreground">
            O gráfico aparece quando o projeto tem <strong>data de início</strong>{" "}
            e <strong>conclusão prevista</strong> preenchidas.
          </p>
          {semFim > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {semFim} projeto{semFim === 1 ? "" : "s"} sem conclusão prevista
              ficaram fora.
            </p>
          )}
        </div>
      </Card>
    );
  }

  const larguraTimeline = semanas.length * larguraSemana;
  const LARGURA_LABEL = 280;

  return (
    <Card className="overflow-hidden">
      {semFim > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          <strong>{semFim}</strong> projeto{semFim === 1 ? "" : "s"} sem
          conclusão prevista — preencha o campo no detalhe para aparecer aqui.
        </div>
      )}
      <div className="overflow-x-auto">
        <div
          style={{ minWidth: LARGURA_LABEL + larguraTimeline }}
          className="relative"
        >
          {/* Cabeçalho: meses agrupados + semanas */}
          <div className="sticky top-0 z-20 border-b border-border bg-card">
            {/* Linha 1: meses */}
            <div className="flex">
              <div
                className="shrink-0 border-r border-border bg-muted/40"
                style={{ width: LARGURA_LABEL }}
              />
              <div className="flex">
                {cabecalhosMes.map((g, i) => (
                  <div
                    key={i}
                    style={{ width: g.colSpan * larguraSemana }}
                    className="border-r border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {g.label}
                  </div>
                ))}
              </div>
            </div>
            {/* Linha 2: semanas */}
            <div className="flex border-t border-border/60">
              <div
                className="flex shrink-0 items-center border-r border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: LARGURA_LABEL }}
              >
                Projeto
              </div>
              <div className="flex">
                {semanas.map((s, i) => (
                  <div
                    key={i}
                    style={{ width: larguraSemana }}
                    className="border-r border-border/60 py-1.5 text-center text-[10px] tabular-nums text-muted-foreground"
                  >
                    {fmtSemana(s)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Linhas de projeto */}
          <div className="relative">
            {linhas.map((linha) => {
              const { projeto, inicio, fim } = linha;
              const cliente = clientes.find((c) => c.id === projeto.cliente_id);
              const prods = produtosDoProjeto(projeto, produtos);
              const cats = categoriasDoProjeto(projeto, produtos);
              const offsetDias = diffDays(inicioJanela, inicio);
              const duracaoDias = Math.max(diffDays(inicio, fim), 1);
              const left = (offsetDias / 7) * larguraSemana;
              const width = (duracaoDias / 7) * larguraSemana;
              return (
                <div
                  key={projeto.id}
                  className="flex h-12 border-b border-border/60 hover:bg-muted/30"
                >
                  <div
                    className="flex shrink-0 items-center gap-2 border-r border-border bg-card px-3"
                    style={{ width: LARGURA_LABEL }}
                  >
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                      {projeto.codigo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {cliente?.nome_fantasia ?? "—"}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {prods.map(({ produto }) => produto?.nome ?? "—").join(" · ") ||
                          "—"}
                      </p>
                    </div>
                  </div>
                  <div
                    className="relative shrink-0"
                    style={{ width: larguraTimeline }}
                  >
                    {/* Grid vertical */}
                    <div className="absolute inset-0 flex">
                      {semanas.map((_, i) => (
                        <div
                          key={i}
                          style={{ width: larguraSemana }}
                          className="border-r border-border/30"
                        />
                      ))}
                    </div>
                    {/* Barra */}
                    <Link
                      to={`/projetos/${projeto.id}`}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition hover:brightness-110",
                        saudeBarra[projeto.saude_atual]
                      )}
                      style={{ left, width: Math.max(width, 24) }}
                      title={`${projeto.codigo} · ${cliente?.nome_fantasia ?? "—"} · ${formatDate(inicio.toISOString())} → ${formatDate(fim.toISOString())} · ${SAUDE_LABEL[projeto.saude_atual]}`}
                    >
                      {cats.slice(0, 1).map((cat) => (
                        <Badge
                          key={cat}
                          variant={variantCategoria(cat)}
                          className="shrink-0 border-0 bg-white/20 px-1 py-0 text-[9px] text-white"
                        >
                          {CATEGORIAS.find((c) => c.value === cat)?.label}
                        </Badge>
                      ))}
                      <span className="truncate">
                        {formatDate(inicio.toISOString())} →{" "}
                        {formatDate(fim.toISOString())}
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}
            {/* Linha vertical do "hoje" */}
            {hojePx >= 0 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary/80"
                style={{ left: LARGURA_LABEL + hojePx }}
              >
                <span className="absolute -top-1 left-1 rounded bg-primary px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Hoje
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
