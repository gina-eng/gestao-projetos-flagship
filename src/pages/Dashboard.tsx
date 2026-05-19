import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Users,
  KanbanSquare,
  Wallet,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Store,
  Layers,
  Sparkles,
  Link2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/Layout";
import {
  categoriasDoProjeto,
  formatCurrency,
  formatDate,
  produtosDoProjeto,
  variantCategoria,
} from "@/lib/utils";
import {
  CATEGORIAS,
  MODELOS_VENDAS,
  SAUDE_LABEL,
  TIERS,
  type SaudeProjeto,
} from "@/types";

const saudeVariant: Record<SaudeProjeto, "saudavel" | "alerta" | "cuidado" | "critico"> = {
  saudavel: "saudavel",
  alerta: "alerta",
  cuidado: "cuidado",
  critico: "critico",
};

export function DashboardPage() {
  const { clientes, projetos, pagamentos, produtos, fases, sessao } = useApp();

  const projetosAtivos = projetos.filter((p) => p.status === "ativo");
  // Categorias presentes em um projeto (set, pode ter mais de uma).
  const categoriasDe = (projetoId: string) => {
    const p = projetos.find((x) => x.id === projetoId);
    if (!p) return [] as string[];
    return categoriasDoProjeto(p, produtos);
  };

  // Receita do mês: soma das parcelas com vencimento no mês corrente,
  // somando o que já foi recebido + o que ainda está em aberto (previsto/atrasado).
  // Exclui canceladas. Cobre tanto recorrentes quanto one-time.
  // TCV: valor total do contrato ao longo do LT (recorrente × LT + one-time).
  const tcvDe = (p: typeof projetosAtivos[number]) =>
    p.modelo_cobranca === "recorrente" ? p.valor_total * (p.lt_meses ?? 12) : p.valor_total;

  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  const fimDoMes = new Date(inicioDoMes);
  fimDoMes.setMonth(fimDoMes.getMonth() + 1);

  const receitaMes = pagamentos
    .flatMap((p) => p.parcelas)
    .reduce(
      (acc, par) => {
        if (par.status === "cancelado") return acc;
        const venc = new Date(par.data_vencimento);
        if (venc < inicioDoMes || venc >= fimDoMes) return acc;
        acc.total += par.valor;
        if (par.status === "pago") acc.recebido += par.valor;
        else acc.aberto += par.valor;
        return acc;
      },
      { total: 0, recebido: 0, aberto: 0 }
    );

  const receitaTCV = projetosAtivos.reduce((acc, p) => acc + tcvDe(p), 0);

  // ─── Em tratativa: projetos cadastrados mas ainda não em operação ───
  // Identifica pela fase atual (nome contém "tratativa", case-insensitive).
  // Mesma regra usada no Gantt para destacar em vermelho.
  const fasesPreOperacao = new Set(
    fases.filter((f) => f.nome.toLowerCase().includes("tratativa")).map((f) => f.id)
  );
  const projetosEmTratativa = projetosAtivos.filter((p) =>
    fasesPreOperacao.has(p.fase_atual)
  );
  const tratativaResumo = {
    quantidade: projetosEmTratativa.length,
    tcv: projetosEmTratativa.reduce((acc, p) => acc + tcvDe(p), 0),
  };


  const hoje = new Date();
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() + 30);

  const parcelasProximas = pagamentos
    .flatMap((p) => p.parcelas)
    .filter((par) => {
      if (par.status !== "previsto") return false;
      const venc = new Date(par.data_vencimento);
      return venc >= hoje && venc <= dataLimite;
    })
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  const parcelasAtrasadas = pagamentos.flatMap((p) => p.parcelas).filter((par) => {
    if (par.status === "pago" || par.status === "cancelado") return false;
    return new Date(par.data_vencimento) < hoje;
  });

  const projetosPorSaude = {
    saudavel: projetosAtivos.filter((p) => p.saude_atual === "saudavel").length,
    alerta: projetosAtivos.filter((p) => p.saude_atual === "alerta").length,
    cuidado: projetosAtivos.filter((p) => p.saude_atual === "cuidado").length,
    critico: projetosAtivos.filter((p) => p.saude_atual === "critico").length,
  };

  const projetosPorFase = [...fases]
    .sort((a, b) => a.ordem - b.ordem)
    .map((fase) => ({
      ...fase,
      count: projetosAtivos.filter((p) => p.fase_atual === fase.id).length,
    }));

  // Quantos projetos ativos têm pelo menos 1 produto de cada categoria.
  // Não tentamos rateá-los por valor: como a negociação tem 1 valor único
  // para N produtos, atribuir TCV/receita por categoria seria arbitrário.
  const projetosPorCategoria = CATEGORIAS.map((cat) => ({
    ...cat,
    count: projetosAtivos.filter((p) =>
      categoriasDe(p.id).includes(cat.value)
    ).length,
  }));

  // Helper: pega o cliente do projeto
  function clienteDe(projetoId: string) {
    const p = projetosAtivos.find((x) => x.id === projetoId);
    return p ? clientes.find((c) => c.id === p.cliente_id) : undefined;
  }

  // Distribuição por modelo de vendas (do cliente vinculado).
  // Projetos cujo cliente atende a múltiplos modelos contam em cada um.
  const projetosPorModeloVendas = MODELOS_VENDAS.map((mv) => {
    const itens = projetosAtivos.filter((p) => {
      const cli = clienteDe(p.id);
      return cli?.modelo_vendas.includes(mv.value);
    });
    return {
      ...mv,
      count: itens.length,
      receita: itens
        .filter((p) => p.modelo_cobranca === "recorrente")
        .reduce((acc, p) => acc + p.valor_total, 0),
      tcv: itens.reduce((acc, p) => acc + tcvDe(p), 0),
    };
  });

  // Distribuição por tier (do cliente vinculado)
  const projetosPorTier = TIERS.map((t) => {
    const list = projetosAtivos.filter((p) => clienteDe(p.id)?.tier === t.value);
    return {
      ...t,
      count: list.length,
      receita: list
        .filter((p) => p.modelo_cobranca === "recorrente")
        .reduce((acc, p) => acc + p.valor_total, 0),
      tcv: list.reduce((acc, p) => acc + tcvDe(p), 0),
    };
  });

  // Distribuição por nicho (vem do cliente).
  const nichosMap = new Map<string, { count: number; receita: number; tcv: number }>();
  projetosAtivos.forEach((p) => {
    const cli = clienteDe(p.id);
    const nicho = (cli?.nicho || "Sem nicho").trim() || "Sem nicho";
    const acc = nichosMap.get(nicho) ?? { count: 0, receita: 0, tcv: 0 };
    acc.count += 1;
    if (p.modelo_cobranca === "recorrente") acc.receita += p.valor_total;
    acc.tcv += tcvDe(p);
    nichosMap.set(nicho, acc);
  });
  const projetosPorNicho = Array.from(nichosMap.entries())
    .map(([nicho, v]) => ({ nicho, ...v }))
    .sort((a, b) => b.tcv - a.tcv);

  const maxModelo = Math.max(1, ...projetosPorModeloVendas.map((m) => m.count));
  const maxTier = Math.max(1, ...projetosPorTier.map((m) => m.count));
  const maxNicho = Math.max(1, ...projetosPorNicho.map((m) => m.count));

  return (
    <div className="spacing-section">
      <PageHeader
        title={`Olá, ${sessao?.nome?.split(" ")[0] ?? "operador"}`}
        description="Visão geral da carteira da unidade."
        actions={
          <>
            <LinkHandoffButton />
            <Button asChild>
              <Link to="/projetos">
                <KanbanSquare className="h-4 w-4" />
                Ver Kanban
              </Link>
            </Button>
          </>
        }
      />

      <EvolucaoCarteira
        clientes={clientes}
        projetos={projetos}
        pagamentos={pagamentos}
        receitaMes={receitaMes}
        tcv={receitaTCV}
      />

      {tratativaResumo.quantidade > 0 && (
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <CardTitle className="text-title-card text-red-700">
                Em tratativa — fora de operação
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-red-700">
              <Link to="/projetos">Ver no Kanban</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-red-200 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">
                  Cards
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
                  {tratativaResumo.quantidade}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {tratativaResumo.quantidade === 1 ? "projeto" : "projetos"} aguardando início
                </p>
              </div>
              <div className="rounded-md border border-red-200 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">
                  TCV em tratativa
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(tratativaResumo.tcv)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Soma do valor de contrato
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-title-card">Saúde da carteira</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <HealthChip label="Saudáveis" count={projetosPorSaude.saudavel} variant="saudavel" />
              <HealthChip label="Em alerta" count={projetosPorSaude.alerta} variant="alerta" />
              <HealthChip label="Em cuidado" count={projetosPorSaude.cuidado} variant="cuidado" />
              <HealthChip label="Críticos" count={projetosPorSaude.critico} variant="critico" />
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Distribuição por fase
              </p>
              <div className="space-y-1.5">
                {projetosPorFase.filter((f) => f.count > 0).map((f) => (
                  <div key={f.id} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-content">{f.nome}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(f.count / projetosAtivos.length) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums">
                      {f.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title-card">Carteira por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projetosPorCategoria.map((cat) => (
              <div
                key={cat.value}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2"
              >
                <Badge variant={variantCategoria(cat.value)}>{cat.label}</Badge>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {cat.count}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {cat.count === 1 ? "projeto" : "projetos"}
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Mix da carteira: modelo de vendas · tier · nicho */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-title-card">Modelo de vendas</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-saber/10 text-saber">
              <Store className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {projetosPorModeloVendas.every((m) => m.count === 0) ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sem projetos para classificar.
              </p>
            ) : (
              projetosPorModeloVendas.map((m) => (
                <DistRow
                  key={m.value}
                  label={m.label}
                  count={m.count}
                  receita={m.receita}
                  tcv={m.tcv}
                  max={maxModelo}
                  total={projetosAtivos.length}
                  barClass="bg-saber"
                />
              ))
            )}
            <p className="pt-2 text-[11px] text-muted-foreground">
              Projetos cujo cliente atende a mais de um modelo aparecem em cada um.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-title-card">Tier do cliente</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ter/10 text-ter">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {projetosPorTier.every((t) => t.count === 0) ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sem projetos para classificar.
              </p>
            ) : (
              projetosPorTier.map((t) => (
                <DistRow
                  key={t.value}
                  label={t.label}
                  count={t.count}
                  receita={t.receita}
                  tcv={t.tcv}
                  max={maxTier}
                  total={projetosAtivos.length}
                  barClass="bg-ter"
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-title-card">Nichos atendidos</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-potencializar/10 text-potencializar">
              <Sparkles className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {projetosPorNicho.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sem nichos cadastrados.
              </p>
            ) : (
              <>
                {projetosPorNicho.slice(0, 6).map((n) => (
                  <DistRow
                    key={n.nicho}
                    label={n.nicho}
                    count={n.count}
                    receita={n.receita}
                    tcv={n.tcv}
                    max={maxNicho}
                    total={projetosAtivos.length}
                    barClass="bg-potencializar"
                  />
                ))}
                {projetosPorNicho.length > 6 && (
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    + {projetosPorNicho.length - 6} outros nichos
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-title-card">Próximos recebimentos (30 dias)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {parcelasProximas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma parcela prevista nos próximos 30 dias.
              </p>
            ) : (
              <div className="space-y-1.5">
                {parcelasProximas.slice(0, 6).map((par) => {
                  const pag = pagamentos.find((p) => p.id === par.pagamento_id);
                  const proj = projetos.find((p) => p.id === pag?.projeto_id);
                  return (
                    <div
                      key={par.id}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {proj?.codigo} · Parcela {par.numero}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vence em {formatDate(par.data_vencimento)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(par.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link to="/financeiro">
                Ver financeiro <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-title-card">Atenção imediata</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            {parcelasAtrasadas.length > 0 && (
              <div className="container-highlight">
                <p className="text-sm font-semibold text-foreground">
                  {parcelasAtrasadas.length} parcela(s) atrasada(s)
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Valor total: {formatCurrency(parcelasAtrasadas.reduce((a, p) => a + p.valor, 0))}
                </p>
              </div>
            )}

            {projetosAtivos
              .filter((p) => p.saude_atual === "critico" || p.saude_atual === "cuidado")
              .slice(0, 4)
              .map((p) => {
                const cliente = clientes.find((c) => c.id === p.cliente_id);
                const itens = produtosDoProjeto(p, produtos);
                const nomesProdutos = itens
                  .map(({ produto }) => produto?.nome ?? "—")
                  .join(" · ");
                return (
                  <Link
                    key={p.id}
                    to={`/projetos/${p.id}`}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {p.codigo} · {cliente?.nome_fantasia ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nomesProdutos || "—"}
                      </p>
                    </div>
                    <Badge variant={saudeVariant[p.saude_atual]}>
                      {SAUDE_LABEL[p.saude_atual]}
                    </Badge>
                  </Link>
                );
              })}

            {parcelasAtrasadas.length === 0 &&
              !projetosAtivos.some(
                (p) => p.saude_atual === "critico" || p.saude_atual === "cuidado"
              ) && (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm text-muted-foreground">
                    Nada urgente no momento.
                  </p>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface EvolucaoItem {
  key: string;
  label: string;
  ano: number;
  mes: number;
  // Carteira ao final do mês
  clientesAtivosFim: number;
  projetosAtivosFim: number;
  // Eventos do mês
  clientesNovos: number;
  projetosNovos: number;
  logoChurn: number;        // clientes que viraram churn no mês
  revenueChurn: number;     // receita recorrente perdida no mês (MRR dos projetos churn)
  receita: number;          // total das parcelas do mês (pagas + em aberto)
  receitaAdicionada: number; // soma do valor mensal de novos contratos recorrentes do mês
}

const PERIODOS = [
  { value: 3, label: "3m" },
  { value: 6, label: "6m" },
  { value: 12, label: "12m" },
  { value: 24, label: "24m" },
];

function EvolucaoCarteira({
  clientes,
  projetos,
  pagamentos,
  receitaMes,
  tcv,
}: {
  clientes: ReturnType<typeof useApp>["clientes"];
  projetos: ReturnType<typeof useApp>["projetos"];
  pagamentos: ReturnType<typeof useApp>["pagamentos"];
  receitaMes: { total: number; recebido: number; aberto: number };
  tcv: number;
}) {
  const [periodo, setPeriodo] = useState<number>(6);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // ----- Cálculo dos meses -----
  const evolucao: EvolucaoItem[] = (() => {
    const base = new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    const out: EvolucaoItem[] = [];
    for (let i = periodo - 1; i >= 0; i--) {
      const inicio = new Date(base);
      inicio.setMonth(inicio.getMonth() - i);
      const fim = new Date(inicio);
      fim.setMonth(fim.getMonth() + 1);

      const clientesNovos = clientes.filter((c) => {
        if (!c.data_cadastro) return false;
        const d = new Date(c.data_cadastro);
        return d >= inicio && d < fim;
      }).length;

      const projetosNovosLista = projetos.filter((p) => {
        const d = new Date(p.data_assinatura ?? p.data_inicio);
        return d >= inicio && d < fim;
      });
      const projetosNovos = projetosNovosLista.length;

      // Receita mensal adicionada: soma do valor_total dos NOVOS contratos
      // recorrentes assinados neste mês (incremento de MRR pela aquisição).
      const receitaAdicionada = projetosNovosLista
        .filter((p) => p.modelo_cobranca === "recorrente")
        .reduce((acc, p) => acc + p.valor_total, 0);

      // Clientes ATIVOS ao final do mês
      const clientesAtivosFim = clientes.filter((c) => {
        if (!c.data_cadastro) return false;
        const dCad = new Date(c.data_cadastro);
        if (dCad >= fim) return false;
        if (c.data_churn) {
          const dChurn = new Date(c.data_churn);
          if (dChurn < fim) return false;
        }
        return true;
      }).length;

      // Projetos ATIVOS ao final do mês: assinatura já aconteceu e ainda não
      // fizeram churn (sem data_churn do cliente até o fim do mês).
      const projetosAtivosFim = projetos.filter((p) => {
        const dAss = new Date(p.data_assinatura ?? p.data_inicio);
        if (dAss >= fim) return false;
        const cli = clientes.find((c) => c.id === p.cliente_id);
        if (cli?.data_churn) {
          const dChurn = new Date(cli.data_churn);
          if (dChurn < fim) return false;
        }
        return true;
      }).length;

      // Clientes que viraram churn neste mês
      const clientesChurnNoMes = clientes.filter((c) => {
        if (!c.data_churn) return false;
        const d = new Date(c.data_churn);
        return d >= inicio && d < fim;
      });
      const logoChurn = clientesChurnNoMes.length;
      const revenueChurn = clientesChurnNoMes.reduce((acc, cli) => {
        const mrrCliente = projetos
          .filter(
            (p) => p.cliente_id === cli.id && p.modelo_cobranca === "recorrente"
          )
          .reduce((s, p) => s + p.valor_total, 0);
        return acc + mrrCliente;
      }, 0);

      const receita = pagamentos
        .flatMap((p) => p.parcelas)
        .filter((par) => {
          if (par.status === "cancelado") return false;
          const venc = new Date(par.data_vencimento);
          return venc >= inicio && venc < fim;
        })
        .reduce((acc, par) => acc + par.valor, 0);

      out.push({
        key: `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}`,
        label: inicio
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        ano: inicio.getFullYear(),
        mes: inicio.getMonth(),
        clientesAtivosFim,
        projetosAtivosFim,
        clientesNovos,
        projetosNovos,
        logoChurn,
        revenueChurn,
        receita,
        receitaAdicionada,
      });
    }
    return out;
  })();

  const maxReceita = Math.max(1, ...evolucao.map((e) => e.receita));
  const maxAtivos = Math.max(1, ...evolucao.map((e) => e.projetosAtivosFim));

  const totais = evolucao.reduce(
    (acc, e) => ({
      clientes: acc.clientes + e.clientesNovos,
      projetos: acc.projetos + e.projetosNovos,
      receita: acc.receita + e.receita,
      logoChurn: acc.logoChurn + e.logoChurn,
      revenueChurn: acc.revenueChurn + e.revenueChurn,
    }),
    { clientes: 0, projetos: 0, receita: 0, logoChurn: 0, revenueChurn: 0 }
  );

  const mesAtualIdx = evolucao.length - 1;
  const atual = evolucao[mesAtualIdx];
  const anterior = mesAtualIdx > 0 ? evolucao[mesAtualIdx - 1] : null;

  function delta(a: number, b: number) {
    if (!anterior || b === 0) return null;
    return ((a - b) / b) * 100;
  }

  // Coordenadas da linha em viewBox 0-100.
  // Padding generoso pra linha (e os bullets HTML por cima) ficarem sempre
  // dentro da área das barras, mesmo quando o valor é zero.
  const yPadTopo = 10;
  const yPadBase = 12;
  const yEscala = 100 - yPadTopo - yPadBase;
  const pontoX = (i: number) =>
    evolucao.length === 1 ? 50 : ((i + 0.5) / evolucao.length) * 100;
  const pontoY = (v: number) => yPadTopo + (1 - v / maxAtivos) * yEscala;

  const linePoints = evolucao
    .map((e, i) => `${pontoX(i)},${pontoY(e.projetosAtivosFim)}`)
    .join(" ");

  // Altura fixa pra área de barras (a parte do label fica abaixo, fora dela)
  const chartHeight = 240;
  const labelHeight = 32;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-title-card">Evolução da carteira</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Barras = receita do mês. Linha = projetos ativos acumulados. Passe o
            mouse em um mês para ver novos, churn e receita perdida.
          </p>
        </div>

        <div className="flex rounded-md border border-input bg-background p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                periodo === p.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Sumário compacto — 5 cards (Receita do mês com split + TCV +
            Projetos ativos + Aquisição + Churn) */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ReceitaMesCard receitaMes={receitaMes} />
          <TcvCard tcv={tcv} />
          <MetricSummary
            icon={KanbanSquare}
            label="Projetos ativos"
            colorClass="bg-foreground"
            accentClass="bg-muted text-foreground"
            total={atual.projetosAtivosFim}
            atual={atual.projetosAtivosFim}
            delta={delta(
              atual.projetosAtivosFim,
              anterior?.projetosAtivosFim ?? 0
            )}
            format={(v) => String(v)}
            sufixo="no fim do mês"
          />
          <MetricSummary
            icon={Users}
            label="Aquisição"
            colorClass="bg-ter"
            accentClass="bg-ter/10 text-ter"
            total={totais.clientes}
            atual={atual.clientesNovos}
            delta={delta(atual.clientesNovos, anterior?.clientesNovos ?? 0)}
            format={(v) => String(v)}
            subtitulo={`${totais.projetos} projeto(s) no período`}
          />
          <MetricSummary
            icon={AlertTriangle}
            label="Churn"
            colorClass="bg-red-500"
            accentClass="bg-red-100 text-red-700"
            total={totais.logoChurn}
            atual={atual.logoChurn}
            delta={null}
            format={(v) => String(v)}
            subtitulo={`${formatCurrency(totais.revenueChurn)} de receita perdida`}
          />
        </div>

        {/* Combo chart */}
        <div className="relative" style={{ height: chartHeight }}>
          {/* Container interno comum (acima dos labels) — TODAS as camadas
              do gráfico ficam aqui dentro com `absolute inset-0` para
              garantir que tenham EXATAMENTE as mesmas dimensões. Sem isto,
              SVG e bullets HTML acabam em coordenadas diferentes.
              Importante: NÃO usar overflow-hidden aqui — a tooltip do hover
              precisa renderizar acima do gráfico. */}
          <div
            className="absolute left-0 right-0 top-0"
            style={{ bottom: labelHeight }}
          >
            {/* Camada 1: barras (sem gap horizontal — cada coluna ocupa
                100/n% exato, com padding interno para parecer espaçada) */}
            <div className="flex h-full items-end">
              {evolucao.map((e, idx) => {
                const altura = (e.receita / maxReceita) * 100;
                const isAtual = idx === mesAtualIdx;
                const isHover = hoverIdx === idx;
                return (
                  <div
                    key={e.key}
                    className="relative flex h-full flex-1 flex-col justify-end px-1"
                  >
                    <div
                      className={cn(
                        "w-full rounded-t transition-all",
                        "bg-primary/65",
                        isHover ? "opacity-100" : isAtual ? "opacity-90" : "opacity-80"
                      )}
                      style={{
                        height:
                          e.receita === 0 ? "2px" : `${Math.max(altura, 3)}%`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Camada 2: SVG só com a linha. `h-full w-full` força o SVG a
                preencher exatamente o container interno; o viewBox 0-100
                mapeia para a mesma área que os bullets HTML usam. */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <polyline
                points={linePoints}
                fill="none"
                stroke="hsl(var(--foreground))"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>

            {/* Camada 3: bullets HTML — alinhados ao MESMO espaço do SVG */}
            <div className="pointer-events-none absolute inset-0">
              {evolucao.map((e, i) => {
                const isAtual = i === mesAtualIdx;
                const isHover = hoverIdx === i;
                const tamanho = isHover || isAtual ? 8 : 7;
                return (
                  <div
                    key={e.key}
                    className="absolute rounded-full"
                    style={{
                      left: `${pontoX(i)}%`,
                      top: `${pontoY(e.projetosAtivosFim)}%`,
                      width: tamanho,
                      height: tamanho,
                      transform: "translate(-50%, -50%)",
                      background: "hsl(var(--foreground))",
                    }}
                  />
                );
              })}
            </div>

            {/* Camada 4: zonas de hover transparentes */}
            <div className="absolute inset-0 flex">
            {evolucao.map((e, idx) => {
              const isHover = hoverIdx === idx;
              return (
                <div
                  key={e.key}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className="relative flex-1 cursor-pointer"
                >
                  {isHover && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 w-56 -translate-x-1/2 rounded-md border border-border bg-card p-3 text-xs shadow-lg">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {e.label}/{String(e.ano).slice(-2)}
                      </p>
                      <div className="space-y-1">
                        <TooltipRow
                          dotClass="bg-primary/70"
                          label="Receita do mês"
                          value={formatCurrency(e.receita)}
                        />
                        <TooltipRow
                          dotClass="bg-emerald-500"
                          label="Clientes ativos"
                          value={String(e.clientesAtivosFim)}
                        />
                        <TooltipRow
                          dotClass="bg-foreground"
                          label="Projetos ativos"
                          value={String(e.projetosAtivosFim)}
                        />
                        <div className="my-1.5 border-t border-border/60" />
                        <TooltipRow
                          dotClass="bg-ter"
                          label="Clientes novos"
                          value={String(e.clientesNovos)}
                        />
                        <TooltipRow
                          dotClass="bg-ter/60"
                          label="Projetos novos"
                          value={String(e.projetosNovos)}
                        />
                        <TooltipRow
                          dotClass="bg-primary/40"
                          label="Receita mês adicionada"
                          value={formatCurrency(e.receitaAdicionada)}
                        />
                      </div>
                      <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-border bg-card" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Fim do container interno do gráfico */}
          </div>

          {/* Rótulos dos meses (fora do container interno, alinhados às colunas) */}
          <div
            className="absolute inset-x-0 bottom-0 flex items-start pt-2"
            style={{ height: labelHeight }}
          >
            {evolucao.map((e, idx) => {
              const isAtual = idx === mesAtualIdx;
              return (
                <div key={e.key} className="flex-1 text-center">
                  <p
                    className={cn(
                      "text-[10px] font-semibold capitalize",
                      isAtual ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {e.label}
                  </p>
                  <p className="text-[9px] tabular-nums text-muted-foreground">
                    /{String(e.ano).slice(-2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-primary/65" />
            Receita do mês
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="8" viewBox="0 0 22 8">
              <line
                x1="0"
                y1="4"
                x2="22"
                y2="4"
                stroke="hsl(var(--foreground))"
                strokeWidth="2"
              />
              <circle cx="11" cy="4" r="2.5" fill="hsl(var(--foreground))" />
            </svg>
            Projetos ativos (acumulado)
          </span>
          <span className="text-muted-foreground/80">
            Hover para clientes novos, projetos novos, logo churn e revenue
            churn.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TooltipRow({
  dotClass,
  label,
  value,
  sub,
}: {
  dotClass: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", dotClass)} />
        <span className="text-content">{label}</span>
      </span>
      <span className="text-right">
        <span className="font-semibold tabular-nums text-foreground">
          {value}
        </span>
        {sub && (
          <span className="ml-1 text-[9px] text-muted-foreground">{sub}</span>
        )}
      </span>
    </div>
  );
}

function ReceitaMesCard({
  receitaMes,
}: {
  receitaMes: { total: number; recebido: number; aberto: number };
}) {
  const pctRecebido =
    receitaMes.total > 0 ? (receitaMes.recebido / receitaMes.total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary/70" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Receita do mês
            </p>
          </div>
          <div className="mt-1">
            <span className="text-base font-bold tabular-nums text-foreground">
              {formatCurrency(receitaMes.total)}
            </span>
          </div>
          {receitaMes.total > 0 && (
            <>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pctRecebido}%` }}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] tabular-nums">
                <span className="text-emerald-700">
                  Rec. {formatCurrency(receitaMes.recebido)}
                </span>
                <span className="text-amber-800">
                  Ab. {formatCurrency(receitaMes.aberto)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TcvCard({ tcv }: { tcv: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-potencializar/10 text-potencializar">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-potencializar" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Receita TCV
            </p>
          </div>
          <div className="mt-1">
            <span className="text-base font-bold tabular-nums text-foreground">
              {formatCurrency(tcv)}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            Total Contract Value (recorrente × LT + one-time)
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricSummary({
  icon: Icon,
  label,
  colorClass,
  accentClass,
  total,
  atual,
  delta,
  format,
  sufixo = "no mês",
  subtitulo,
}: {
  icon: typeof Users;
  label: string;
  colorClass: string;
  accentClass: string;
  total: number;
  atual: number;
  delta: number | null;
  format: (v: number) => string;
  sufixo?: string;
  subtitulo?: string;
}) {
  const positivo = delta !== null && delta >= 0;
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            accentClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", colorClass)} />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <div>
              <span className="text-base font-bold tabular-nums text-foreground">
                {format(atual)}
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground">
                {sufixo}
              </span>
            </div>
            {delta !== null && (
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  positivo ? "text-emerald-700" : "text-red-700"
                )}
              >
                {positivo ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {subtitulo ?? (
              <>
                {format(total)} <span className="text-[9px]">no período</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function HealthChip({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "saudavel" | "alerta" | "cuidado" | "critico";
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <Badge variant={variant} className="text-[10px]">
        {label}
      </Badge>
      <p className="mt-2 text-2xl font-bold tabular-nums">{count}</p>
    </div>
  );
}

function DistRow({
  label,
  count,
  receita,
  tcv,
  max,
  total,
  barClass,
}: {
  label: string;
  count: number;
  receita: number;
  tcv?: number;
  max: number;
  total: number;
  barClass: string;
}) {
  const pctBar = max > 0 ? (count / max) * 100 : 0;
  const pctTotal = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{count}</span>
          {count > 0 && (
            <>
              {" · "}
              {pctTotal}%
            </>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pctBar}%` }} />
      </div>
      {(receita > 0 || (tcv && tcv > 0)) && (
        <div className="flex items-baseline justify-between gap-2 pt-0.5 text-[11px] tabular-nums">
          <span className="text-content">
            Mês{" "}
            <span className="font-semibold text-foreground">{formatCurrency(receita)}</span>
          </span>
          {tcv !== undefined && tcv > 0 && (
            <span className="text-muted-foreground">
              TCV <span className="font-semibold text-foreground">{formatCurrency(tcv)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Botão que copia o link público de /handoff para o clipboard. Útil pra
// compartilhar com o time comercial sem ter que digitar a URL.
function LinkHandoffButton() {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    const url = `${window.location.origin}/handoff`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }
  return (
    <Button variant="outline" onClick={copiar} title="Copia /handoff pro clipboard">
      {copiado ? (
        <>
          <Check className="h-4 w-4 text-emerald-600" />
          Link copiado!
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" />
          Link de handoff
        </>
      )}
    </Button>
  );
}

