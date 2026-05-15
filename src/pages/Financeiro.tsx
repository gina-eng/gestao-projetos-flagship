import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRightSquare,
  RefreshCw,
} from "lucide-react";
import { useApp } from "@/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/Layout";
import { PagamentoFormDialog } from "@/components/financeiro/PagamentoFormDialog";
import { ParcelaActionDialog } from "@/components/financeiro/ParcelaActionDialog";
import { formatCurrency } from "@/lib/utils";
import { Cliente, Pagamento, Parcela, Projeto, type StatusParcela } from "@/types";
import { cn } from "@/lib/utils";

const PRIORIDADE_STATUS: Record<StatusParcela, number> = {
  atrasado: 0,
  previsto: 1,
  pago: 2,
  cancelado: 3,
};

const STATUS_CELL_CLASS: Record<StatusParcela, string> = {
  atrasado: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  previsto: "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200",
  pago: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
  cancelado: "bg-muted text-muted-foreground line-through hover:bg-muted/70 border-border",
};

const STATUS_DOT: Record<StatusParcela, string> = {
  pago: "bg-emerald-500",
  previsto: "bg-amber-500",
  atrasado: "bg-red-500",
  cancelado: "bg-muted-foreground",
};

interface CelulaParcela {
  parcela: Parcela;
  pagamento: Pagamento;
  statusEfetivo: StatusParcela;
}

interface LinhaProjeto {
  projeto: Projeto;
  porMes: Record<string, CelulaParcela[]>;
  totalRecebido: number;
  totalPrevisto: number;
}

interface LinhaCliente {
  cliente: Cliente;
  projetos: LinhaProjeto[];
  porMes: Record<string, { previsto: number; pago: number; atrasado: number }>;
  totalRecebido: number;
  totalPrevisto: number;
}

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function gerarMeses(inicio: Date, qtd: number) {
  const out: { key: string; label: string; ano: number; mes: number }[] = [];
  const base = new Date(inicio);
  base.setDate(1);
  for (let i = 0; i < qtd; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    out.push({
      key: mesKey(d),
      label: d
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", ""),
      ano: d.getFullYear(),
      mes: d.getMonth(),
    });
  }
  return out;
}

export function FinanceiroPage() {
  const { pagamentos, projetos, clientes, sincronizarTodosPagamentos } = useApp();
  const [novoOpen, setNovoOpen] = useState(false);
  const [parcelaSel, setParcelaSel] = useState<{ pagamentoId: string; parcela: Parcela } | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  async function handleSync() {
    setSincronizando(true);
    const res = await sincronizarTodosPagamentos();
    setSincronizando(false);
    window.alert(
      `Sincronização concluída.\n\n${res.sincronizados} projeto(s) sincronizado(s).\n${res.pulados} pulado(s) (faltam TCV / nº parcelas / data início pagamento).`
    );
  }

  // Janela inicial: 1 mês antes do atual + 11 meses pra frente (12 meses)
  const [inicioJanela, setInicioJanela] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d;
  });
  const [qtdMeses, setQtdMeses] = useState(12);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const meses = useMemo(() => gerarMeses(inicioJanela, qtdMeses), [inicioJanela, qtdMeses]);

  function statusEfetivo(p: Parcela): StatusParcela {
    if (p.status === "previsto" && new Date(p.data_vencimento) < hoje) return "atrasado";
    return p.status;
  }

  function toggleCliente(id: string) {
    setExpandidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Montagem das linhas (cliente → projetos → células por mês)
  const linhas: LinhaCliente[] = useMemo(() => {
    const porCliente = new Map<string, LinhaCliente>();

    pagamentos.forEach((pag) => {
      const projeto = projetos.find((p) => p.id === pag.projeto_id);
      if (!projeto) return;
      const cliente = clientes.find((c) => c.id === projeto.cliente_id);
      if (!cliente) return;

      let linha = porCliente.get(cliente.id);
      if (!linha) {
        linha = {
          cliente,
          projetos: [],
          porMes: {},
          totalRecebido: 0,
          totalPrevisto: 0,
        };
        porCliente.set(cliente.id, linha);
      }

      let linhaProj = linha.projetos.find((p) => p.projeto.id === projeto.id);
      if (!linhaProj) {
        linhaProj = { projeto, porMes: {}, totalRecebido: 0, totalPrevisto: 0 };
        linha.projetos.push(linhaProj);
      }

      pag.parcelas.forEach((par) => {
        const venc = new Date(par.data_vencimento);
        const key = mesKey(venc);
        const status = statusEfetivo(par);

        if (!linhaProj!.porMes[key]) linhaProj!.porMes[key] = [];
        linhaProj!.porMes[key].push({ parcela: par, pagamento: pag, statusEfetivo: status });

        if (!linha!.porMes[key]) linha!.porMes[key] = { previsto: 0, pago: 0, atrasado: 0 };

        if (status === "pago") {
          linha!.porMes[key].pago += par.valor;
          linhaProj!.totalRecebido += par.valor;
          linha!.totalRecebido += par.valor;
        } else if (status === "atrasado") {
          linha!.porMes[key].atrasado += par.valor;
          linhaProj!.totalPrevisto += par.valor;
          linha!.totalPrevisto += par.valor;
        } else if (status === "previsto") {
          linha!.porMes[key].previsto += par.valor;
          linhaProj!.totalPrevisto += par.valor;
          linha!.totalPrevisto += par.valor;
        }
      });
    });

    return Array.from(porCliente.values()).sort((a, b) =>
      a.cliente.nome_fantasia.localeCompare(b.cliente.nome_fantasia)
    );
  }, [pagamentos, projetos, clientes, hoje]);

  // Totais por mês (linha rodapé)
  const totaisPorMes = useMemo(() => {
    const out: Record<string, { previsto: number; pago: number; atrasado: number }> = {};
    meses.forEach((m) => (out[m.key] = { previsto: 0, pago: 0, atrasado: 0 }));
    linhas.forEach((l) => {
      Object.entries(l.porMes).forEach(([key, v]) => {
        if (!out[key]) out[key] = { previsto: 0, pago: 0, atrasado: 0 };
        out[key].previsto += v.previsto;
        out[key].pago += v.pago;
        out[key].atrasado += v.atrasado;
      });
    });
    return out;
  }, [linhas, meses]);

  const totaisGerais = useMemo(() => {
    return Object.values(totaisPorMes).reduce(
      (acc, m) => {
        acc.previsto += m.previsto;
        acc.pago += m.pago;
        acc.atrasado += m.atrasado;
        return acc;
      },
      { previsto: 0, pago: 0, atrasado: 0 }
    );
  }, [totaisPorMes]);

  function navegarMeses(delta: number) {
    setInicioJanela((d) => {
      const n = new Date(d);
      n.setMonth(n.getMonth() + delta);
      return n;
    });
  }

  function irHoje() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    setInicioJanela(d);
  }

  return (
    <div className="spacing-section">
      <PageHeader
        title="Financeiro"
        description="Tabela de parcelas: cada linha é um cliente, cada coluna um mês. Clique em uma célula para atualizar o status."
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={sincronizando}
              title="Recria os pagamentos espelho a partir dos campos de pagamento de cada projeto (TCV + parcelas + data início). Preserva parcelas pagas."
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  sincronizando && "animate-spin"
                )}
              />
              {sincronizando ? "Sincronizando…" : "Sincronizar do projeto"}
            </Button>
            <Button onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo pagamento
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiFin
          icon={CheckCircle2}
          tone="emerald"
          label="Total recebido (janela)"
          value={formatCurrency(totaisGerais.pago)}
        />
        <KpiFin
          icon={Clock}
          tone="amber"
          label="A receber (janela)"
          value={formatCurrency(totaisGerais.previsto)}
        />
        <KpiFin
          icon={AlertTriangle}
          tone="red"
          label="Atrasado (janela)"
          value={formatCurrency(totaisGerais.atrasado)}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-title-card">
            Tabela de parcelas · {meses[0]?.label}/{String(meses[0]?.ano).slice(-2)}
            {" → "}
            {meses[meses.length - 1]?.label}/{String(meses[meses.length - 1]?.ano).slice(-2)}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navegarMeses(-3)}>
              <ChevronLeft className="h-4 w-4" /> 3m
            </Button>
            <Button variant="outline" size="sm" onClick={irHoje}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => navegarMeses(3)}>
              3m <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-2 flex rounded-md border border-input bg-background p-0.5">
              {[6, 12, 18].map((q) => (
                <button
                  key={q}
                  onClick={() => setQtdMeses(q)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium",
                    qtdMeses === q ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  {q}m
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {linhas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento cadastrado. Crie um pagamento para popular a tabela.
              </p>
              <Button onClick={() => setNovoOpen(true)}>
                <Plus className="h-4 w-4" /> Novo pagamento
              </Button>
            </div>
          ) : (
            <div className="relative overflow-auto" style={{ maxHeight: "70vh" }}>
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-20 bg-card">
                  <tr>
                    <th
                      className="table-header sticky left-0 z-30 min-w-[220px] border-b border-r bg-card p-3 text-left"
                      style={{ minWidth: 220 }}
                    >
                      Cliente / Projeto
                    </th>
                    {meses.map((m) => {
                      const mesAtual = m.ano === hoje.getFullYear() && m.mes === hoje.getMonth();
                      return (
                        <th
                          key={m.key}
                          className={cn(
                            "table-header border-b p-2 text-center font-semibold whitespace-nowrap",
                            mesAtual && "bg-primary/5 text-primary"
                          )}
                          style={{ minWidth: 90 }}
                        >
                          <div className="capitalize">{m.label}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">
                            /{String(m.ano).slice(-2)}
                          </div>
                        </th>
                      );
                    })}
                    <th
                      className="table-header sticky right-0 z-30 border-b border-l bg-card p-3 text-right"
                      style={{ minWidth: 120 }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {linhas.map((linha) => {
                    const expandido = expandidos.has(linha.cliente.id);
                    const multipleProjetos = linha.projetos.length > 1;
                    return (
                      <Fragment key={linha.cliente.id}>
                        {/* Linha agregada do cliente */}
                        <tr className="group bg-card hover:bg-muted/40">
                          <td
                            className="sticky left-0 z-10 border-b border-r bg-inherit p-2"
                            style={{ minWidth: 220 }}
                          >
                            <button
                              type="button"
                              onClick={() => multipleProjetos && toggleCliente(linha.cliente.id)}
                              className={cn(
                                "flex w-full items-center gap-2 text-left",
                                multipleProjetos && "cursor-pointer"
                              )}
                            >
                              {multipleProjetos ? (
                                expandido ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRightSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                )
                              ) : (
                                <span className="w-3.5" />
                              )}
                              <span className="flex h-7 w-9 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                                {linha.cliente.sigla}
                              </span>
                              <Link
                                to={`/clientes/${linha.cliente.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="truncate text-sm font-semibold text-foreground hover:text-primary"
                              >
                                {linha.cliente.nome_fantasia}
                              </Link>
                              {multipleProjetos && (
                                <span className="ml-auto text-[10px] text-muted-foreground">
                                  {linha.projetos.length} proj.
                                </span>
                              )}
                            </button>
                          </td>

                          {meses.map((m) => {
                            const v = linha.porMes[m.key];
                            if (!v || (v.previsto === 0 && v.pago === 0 && v.atrasado === 0)) {
                              return (
                                <td
                                  key={m.key}
                                  className="border-b border-r/0 p-1 text-center"
                                />
                              );
                            }
                            const total = v.previsto + v.pago + v.atrasado;
                            const statusDominante: StatusParcela =
                              v.atrasado > 0 ? "atrasado" : v.pago > 0 && v.previsto === 0 ? "pago" : "previsto";
                            return (
                              <td key={m.key} className="border-b p-1 text-center">
                                <div
                                  className={cn(
                                    "mx-auto inline-flex flex-col items-center rounded-md border px-2 py-1",
                                    STATUS_CELL_CLASS[statusDominante]
                                  )}
                                >
                                  <span className="text-xs font-semibold tabular-nums leading-tight">
                                    {formatCurrency(total)}
                                  </span>
                                  {(v.pago > 0 && v.previsto + v.atrasado > 0) && (
                                    <span className="text-[9px] leading-tight opacity-75">
                                      pago {formatCurrency(v.pago)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          <td
                            className="sticky right-0 z-10 border-b border-l bg-inherit p-3 text-right"
                            style={{ minWidth: 120 }}
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold tabular-nums text-foreground">
                                {formatCurrency(linha.totalRecebido + linha.totalPrevisto)}
                              </p>
                              <div className="flex justify-end gap-2 text-[10px] tabular-nums">
                                <span className="text-emerald-700">
                                  {formatCurrency(linha.totalRecebido)}
                                </span>
                                <span className="text-amber-700">
                                  {formatCurrency(linha.totalPrevisto)}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Sub-linhas: projetos (quando expandido OU quando há apenas 1 projeto) */}
                        {(expandido || !multipleProjetos) &&
                          linha.projetos.map((lp) => (
                            <tr
                              key={lp.projeto.id}
                              className={cn(
                                "bg-muted/30 hover:bg-muted/50",
                                !multipleProjetos && "hidden" // single proj → não duplica, info já está na linha cliente
                              )}
                            >
                              <td
                                className="sticky left-0 z-10 border-b border-r bg-muted/30 p-2 pl-9"
                                style={{ minWidth: 220 }}
                              >
                                <Link
                                  to={`/projetos/${lp.projeto.id}`}
                                  className="flex items-center gap-2 text-left"
                                >
                                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                                    {lp.projeto.codigo}
                                  </span>
                                  <span className="truncate text-xs text-content">
                                    {lp.projeto.nome}
                                  </span>
                                </Link>
                              </td>

                              {meses.map((m) => {
                                const celulas = lp.porMes[m.key] ?? [];
                                if (celulas.length === 0) {
                                  return (
                                    <td
                                      key={m.key}
                                      className="border-b p-1 text-center"
                                    />
                                  );
                                }
                                const total = celulas.reduce((a, c) => a + c.parcela.valor, 0);
                                const statusDominante = celulas
                                  .map((c) => c.statusEfetivo)
                                  .sort(
                                    (a, b) => PRIORIDADE_STATUS[a] - PRIORIDADE_STATUS[b]
                                  )[0];
                                const primeira = celulas[0];
                                return (
                                  <td key={m.key} className="border-b p-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setParcelaSel({
                                          pagamentoId: primeira.pagamento.id,
                                          parcela: {
                                            ...primeira.parcela,
                                            status: primeira.statusEfetivo,
                                          },
                                        })
                                      }
                                      className={cn(
                                        "group/cell relative flex w-full flex-col items-center gap-0.5 rounded-md border px-2 py-1 transition-colors",
                                        STATUS_CELL_CLASS[statusDominante]
                                      )}
                                      title={`${celulas.length}× parcela(s) · ${primeira.statusEfetivo}`}
                                    >
                                      <span
                                        className={cn(
                                          "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                                          STATUS_DOT[statusDominante]
                                        )}
                                      />
                                      <span className="text-xs font-semibold tabular-nums leading-tight">
                                        {formatCurrency(total)}
                                      </span>
                                      {celulas.length > 1 && (
                                        <span className="text-[9px] leading-tight opacity-75">
                                          {celulas.length}×
                                        </span>
                                      )}
                                    </button>
                                  </td>
                                );
                              })}

                              <td
                                className="sticky right-0 z-10 border-b border-l bg-muted/30 p-3 text-right"
                                style={{ minWidth: 120 }}
                              >
                                <p className="text-xs font-semibold tabular-nums text-foreground">
                                  {formatCurrency(lp.totalRecebido + lp.totalPrevisto)}
                                </p>
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>

                <tfoot className="sticky bottom-0 z-20 bg-card">
                  <tr>
                    <td
                      className="sticky left-0 z-30 border-t-2 border-r bg-card p-3 text-xs font-bold uppercase tracking-wide text-foreground"
                      style={{ minWidth: 220 }}
                    >
                      Total mensal
                    </td>
                    {meses.map((m) => {
                      const t = totaisPorMes[m.key];
                      const total = (t?.previsto ?? 0) + (t?.pago ?? 0) + (t?.atrasado ?? 0);
                      if (total === 0) {
                        return (
                          <td
                            key={m.key}
                            className="border-t-2 p-2 text-center text-[10px] text-muted-foreground"
                          >
                            —
                          </td>
                        );
                      }
                      return (
                        <td
                          key={m.key}
                          className="border-t-2 p-2 text-center"
                        >
                          <div className="text-xs font-bold tabular-nums">
                            {formatCurrency(total)}
                          </div>
                          {t.pago > 0 && (
                            <div className="text-[9px] tabular-nums text-emerald-700">
                              {Math.round((t.pago / total) * 100)}% pago
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className="sticky right-0 z-30 border-t-2 border-l bg-card p-3 text-right"
                      style={{ minWidth: 120 }}
                    >
                      <p className="text-sm font-bold tabular-nums">
                        {formatCurrency(
                          totaisGerais.pago + totaisGerais.previsto + totaisGerais.atrasado
                        )}
                      </p>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <LegendaItem className="bg-emerald-50 border-emerald-200 text-emerald-700" label="Pago" />
        <LegendaItem className="bg-amber-50 border-amber-200 text-amber-800" label="Previsto" />
        <LegendaItem className="bg-red-50 border-red-200 text-red-700" label="Atrasado" />
        <LegendaItem className="bg-muted border-border text-muted-foreground" label="Cancelado" />
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Clique em uma célula para atualizar o status.
        </span>
      </div>

      <PagamentoFormDialog open={novoOpen} onOpenChange={setNovoOpen} />

      {parcelaSel && (
        <ParcelaActionDialog
          open={!!parcelaSel}
          onOpenChange={(v) => !v && setParcelaSel(null)}
          pagamentoId={parcelaSel.pagamentoId}
          parcela={parcelaSel.parcela}
        />
      )}
    </div>
  );
}

function KpiFin({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "red";
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendaItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-5 rounded-sm border", className)} />
      {label}
    </span>
  );
}
