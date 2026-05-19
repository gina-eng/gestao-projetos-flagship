import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useApp } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIAS,
  FaseProjeto,
  FORMAS_PAGAMENTO,
  FormaPagamento,
  FUNCOES_SQUAD,
  FuncaoSquad,
  ItemNegociacao,
  MOTIVOS_CHURN,
  MotivoChurn,
  ORIGENS,
  OrigemProjeto,
  Produto,
  Projeto,
  SAUDE_LABEL,
  SaudeProjeto,
  SquadMembro,
  StatusProjeto,
  TipoNegociacao,
} from "@/types";
import {
  categoriasDoTipo,
  formatCurrency,
  itensDoProjeto,
  statusDaFase,
  uid,
  variantCategoria,
  TIPO_NEGOCIACAO_LABEL,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projeto: Projeto | null;
  clientePreSelect?: string;
}

function emptyProjeto(): Projeto {
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    id: "",
    codigo: "",
    cliente_id: "",
    produto_id: "",
    itens: [],
    tipo_negociacao: "one_time",
    nome: "",
    modelo_cobranca: "one_time",
    valor_total: 0,
    fase_atual: "inicio",
    data_assinatura: hoje,
    data_inicio: hoje,
    data_kickoff: undefined,
    lt_meses: undefined,
    num_parcelas: 1,
    status: "ativo",
    saude_atual: "saudavel",
    links_rapidos: [],
    origem: "aquisicao",
    squad: [],
    oportunidade_crm_url: undefined,
    whatsapp_grupo_url: undefined,
    contrato_url: undefined,
    transcricao_venda_url: undefined,
    transcricao_qualificacao_url: undefined,
    transcricao_plano_voo_url: undefined,
  };
}

// Deduz o tipo da negociação a partir de um projeto existente. Usa o
// campo `tipo_negociacao` quando disponível; senão, deriva de `modelo_cobranca`.
function deduzirTipo(p: Projeto): TipoNegociacao {
  if (p.tipo_negociacao) return p.tipo_negociacao;
  return p.modelo_cobranca === "recorrente" ? "recorrente_executar" : "one_time";
}

export function ProjetoFormDialog({
  open,
  onOpenChange,
  projeto,
  clientePreSelect,
}: Props) {
  const {
    clientes,
    produtos,
    fases,
    saveProjeto,
    proximaVendaSeq,
    proximaLetraDaVenda,
  } = useApp();
  const fasesOrdenadas = [...fases].sort((a, b) => a.ordem - b.ordem);
  const [form, setForm] = useState<Projeto>(emptyProjeto());
  const [tipo, setTipo] = useState<TipoNegociacao>("one_time");
  const [itensForm, setItensForm] = useState<ItemNegociacao[]>([]);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (projeto) {
      setForm(projeto);
      setTipo(deduzirTipo(projeto));
      setItensForm(itensDoProjeto(projeto).map((it) => ({ ...it })));
    } else {
      const base = emptyProjeto();
      base.id = uid("prj_");
      if (clientePreSelect) {
        base.cliente_id = clientePreSelect;
        const seq = proximaVendaSeq(clientePreSelect);
        const letra = proximaLetraDaVenda(clientePreSelect, seq);
        const cli = clientes.find((c) => c.id === clientePreSelect);
        base.codigo = cli ? `${cli.sigla}-O${seq}-${letra}` : "";
        base.venda_seq = seq;
        base.venda_letra = letra;
        base.venda_id = uid("vnd_");
      }
      base.nome = base.codigo;
      setForm(base);
      setTipo("one_time");
      setItensForm([]);
    }
    setErros({});
  }, [
    open,
    projeto,
    clientePreSelect,
    proximaVendaSeq,
    proximaLetraDaVenda,
    clientes,
  ]);

  const clientesAtivos = useMemo(
    () => clientes.filter((c) => c.status !== "inativo"),
    [clientes]
  );

  const produtosAtivos = useMemo(
    () => produtos.filter((p) => p.ativo),
    [produtos]
  );

  const categoriasGrupo = useMemo(() => categoriasDoTipo(tipo), [tipo]);

  const produtosDisponiveis = useMemo(
    () => produtosAtivos.filter((p) => categoriasGrupo.includes(p.categoria)),
    [produtosAtivos, categoriasGrupo]
  );

  const clienteSelecionado = clientes.find((c) => c.id === form.cliente_id);
  const valorMensalDerivado =
    tipo === "recorrente_executar" && form.lt_meses && form.lt_meses > 0
      ? (form.valor_tcv ?? 0) / form.lt_meses
      : 0;

  function setField<K extends keyof Projeto>(key: K, value: Projeto[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClienteChange(clienteId: string) {
    setForm((f) => {
      if (projeto) {
        // Edição: não altera o código existente
        return { ...f, cliente_id: clienteId };
      }
      const seq = proximaVendaSeq(clienteId);
      const letra = proximaLetraDaVenda(clienteId, seq);
      const cli = clientes.find((c) => c.id === clienteId);
      const codigo = cli ? `${cli.sigla}-O${seq}-${letra}` : "";
      return {
        ...f,
        cliente_id: clienteId,
        codigo,
        venda_id: f.venda_id ?? uid("vnd_"),
        venda_seq: seq,
        venda_letra: letra,
        nome: codigo,
      };
    });
  }

  function handleTipoChange(novoTipo: TipoNegociacao) {
    setTipo(novoTipo);
    // Limpa itens incompatíveis ao trocar o tipo (produtos do grupo errado)
    const novosGrupo = categoriasDoTipo(novoTipo);
    setItensForm((itens) =>
      itens.filter((it) => {
        const prod = produtos.find((p) => p.id === it.produto_id);
        return prod && novosGrupo.includes(prod.categoria);
      })
    );
    setForm((f) => ({
      ...f,
      tipo_negociacao: novoTipo,
      modelo_cobranca: novoTipo === "recorrente_executar" ? "recorrente" : "one_time",
      lt_meses: novoTipo === "recorrente_executar" ? f.lt_meses ?? 12 : undefined,
      num_parcelas:
        novoTipo === "recorrente_executar" ? f.lt_meses ?? 12 : f.num_parcelas ?? 1,
    }));
  }

  function handleTcvChange(valor: number) {
    setForm((f) => {
      if (tipo === "recorrente_executar") {
        const lt = f.lt_meses && f.lt_meses > 0 ? f.lt_meses : 12;
        return {
          ...f,
          valor_tcv: valor > 0 ? valor : undefined,
          valor_total: lt > 0 ? valor / lt : valor,
          num_parcelas: lt,
        };
      }
      return {
        ...f,
        valor_tcv: valor > 0 ? valor : undefined,
        valor_total: valor,
      };
    });
  }

  function handleLtChange(lt: number) {
    setForm((f) => ({
      ...f,
      lt_meses: lt,
      num_parcelas: lt,
      valor_total: f.valor_tcv && lt > 0 ? f.valor_tcv / lt : f.valor_total,
    }));
  }

  function adicionarProduto(produtoId: string) {
    if (itensForm.some((it) => it.produto_id === produtoId)) return;
    setItensForm((itens) => [
      ...itens,
      { id: uid("itp_"), produto_id: produtoId, variacao_id: undefined },
    ]);
  }

  function removerProduto(itemId: string) {
    setItensForm((itens) => itens.filter((it) => it.id !== itemId));
  }

  function atualizarVariacao(itemId: string, variacaoId: string) {
    setItensForm((itens) =>
      itens.map((it) =>
        it.id === itemId ? { ...it, variacao_id: variacaoId } : it
      )
    );
  }

  function addSquadMembro(invId: string, funcao: FuncaoSquad) {
    if (!invId) return;
    const exists = form.squad.find((s) => s.investidor_id === invId);
    if (exists) return;
    const novo: SquadMembro = {
      id: uid("sqm_"),
      investidor_id: invId,
      funcao,
      data_entrada: new Date().toISOString().slice(0, 10),
      principal: form.squad.length === 0,
    };
    setField("squad", [...form.squad, novo]);
  }

  function removeSquadMembro(id: string) {
    setField(
      "squad",
      form.squad.filter((s) => s.id !== id)
    );
  }

  function tornarPrincipal(id: string) {
    setField(
      "squad",
      form.squad.map((s) => ({ ...s, principal: s.id === id }))
    );
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.cliente_id) e.cliente_id = "Selecione um cliente";
    if (itensForm.length === 0) e.itens = "Adicione ao menos 1 produto";
    // Variação obrigatória quando produto tem variações ativas
    itensForm.forEach((it) => {
      const prod = produtos.find((p) => p.id === it.produto_id);
      const ativas = (prod?.variacoes ?? []).filter((v) => v.ativo);
      if (ativas.length > 0 && !it.variacao_id) {
        e[`item_${it.id}_variacao`] = "Selecione variação";
      }
    });
    const tcv = form.valor_tcv ?? 0;
    if (tcv <= 0) e.valor_total = "Informe o valor";
    if (tipo === "recorrente_executar") {
      if (!form.lt_meses || (form.lt_meses !== 6 && form.lt_meses !== 12)) {
        e.lt_meses = "Selecione 6 ou 12 meses";
      }
    }
    if (!form.data_assinatura) e.data_assinatura = "Obrigatório";
    if (!form.data_inicio) e.data_inicio = "Obrigatório";
    if (form.squad.length === 0) e.squad = "Adicione ao menos um investidor";
    if (form.status === "churn" && !form.motivo_churn)
      e.motivo_churn = "Selecione o motivo do churn";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    // Compõe os itens finais e populariza os campos legados (produto_id /
    // variacao_id) com o primeiro item, mantendo retrocompatibilidade.
    const itens = itensForm.map((it) => ({
      id: it.id,
      produto_id: it.produto_id,
      variacao_id: it.variacao_id || undefined,
    }));
    const principal = itens[0];
    const projetoFinal: Projeto = {
      ...form,
      itens,
      tipo_negociacao: tipo,
      modelo_cobranca: tipo === "recorrente_executar" ? "recorrente" : "one_time",
      produto_id: principal?.produto_id ?? "",
      variacao_id: principal?.variacao_id,
      nome: form.nome.trim() || form.codigo,
    };
    saveProjeto(projetoFinal);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{projeto ? "Editar projeto" : "Novo projeto"}</DialogTitle>
          <DialogDescription>
            Uma negociação tem 1 forma de pagamento e N produtos. Produtos de
            Executar ficam em negociação separada dos demais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cliente *</Label>
              <Select value={form.cliente_id} onValueChange={handleClienteChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.sigla} · {c.nome_fantasia} ({c.tier})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros.cliente_id && (
                <p className="text-xs text-destructive">{erros.cliente_id}</p>
              )}
              {clienteSelecionado && (
                <p className="text-[11px] text-muted-foreground">
                  Tier do cliente:{" "}
                  <span className="font-semibold uppercase">
                    {clienteSelecionado.tier}
                  </span>
                  {clienteSelecionado.nicho && ` · Nicho: ${clienteSelecionado.nicho}`}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={form.codigo} disabled placeholder="—" />
            </div>
          </div>

          {/* Tipo de negociação */}
          <div className="space-y-1.5">
            <Label>Tipo de negociação *</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["one_time", "recorrente_executar"] as TipoNegociacao[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTipoChange(t)}
                    className={cn(
                      "rounded-md border-2 p-3 text-left transition",
                      tipo === t
                        ? t === "recorrente_executar"
                          ? "border-executar bg-executar/5"
                          : "border-ter bg-ter/5"
                        : "border-border/60 hover:bg-muted/40"
                    )}
                  >
                    <p className="text-xs font-semibold text-foreground">
                      {TIPO_NEGOCIACAO_LABEL[t]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t === "recorrente_executar"
                        ? "TCV ÷ tempo (6 ou 12 meses) = valor mensal."
                        : "Valor cheio em até 12× parcelas."}
                    </p>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Lista de produtos */}
          <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <Label>Produtos da negociação *</Label>
              <Badge variant="outline" className="text-[10px]">
                {itensForm.length}
              </Badge>
            </div>
            <SeletorProdutosBusca
              produtos={produtosDisponiveis}
              jaSelecionados={itensForm.map((it) => it.produto_id)}
              onSelecionar={adicionarProduto}
              placeholder={
                tipo === "recorrente_executar"
                  ? "Buscar produto Executar..."
                  : "Buscar produto Saber/Ter/Destrava/Potencializar..."
              }
            />
            {itensForm.length === 0 && (
              <p className="text-[11px] italic text-muted-foreground">
                Nenhum produto adicionado.
              </p>
            )}
            <ul className="space-y-1.5">
              {itensForm.map((it) => {
                const prod = produtos.find((p) => p.id === it.produto_id);
                const variacoesAtivas = (prod?.variacoes ?? []).filter(
                  (v) => v.ativo
                );
                return (
                  <li
                    key={it.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5 text-xs"
                  >
                    {prod && (
                      <Badge
                        variant={variantCategoria(prod.categoria)}
                        className="shrink-0 text-[9px]"
                      >
                        {CATEGORIAS.find((c) => c.value === prod.categoria)?.label}
                      </Badge>
                    )}
                    <span className="font-medium text-foreground">
                      {prod?.nome ?? "—"}
                    </span>
                    {variacoesAtivas.length > 0 && (
                      <Select
                        value={it.variacao_id || undefined}
                        onValueChange={(v) => atualizarVariacao(it.id, v)}
                      >
                        <SelectTrigger className="h-7 w-auto min-w-[140px] text-[11px]">
                          <SelectValue placeholder="Variação" />
                        </SelectTrigger>
                        <SelectContent>
                          {variacoesAtivas.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {erros[`item_${it.id}_variacao`] && (
                      <span className="text-[10px] text-destructive">
                        {erros[`item_${it.id}_variacao`]}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removerProduto(it.id)}
                      className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remover produto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {erros.itens && (
              <p className="text-xs text-destructive">{erros.itens}</p>
            )}
          </div>

          {/* Valor + LT */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={cn(
                "space-y-1.5",
                tipo === "one_time" ? "lg:col-span-2" : "lg:col-span-2"
              )}
            >
              <Label>
                {tipo === "recorrente_executar"
                  ? "TCV (valor total do contrato) *"
                  : "Valor total da negociação *"}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_tcv ?? ""}
                onChange={(e) => handleTcvChange(Number(e.target.value))}
                placeholder="0,00"
              />
              {erros.valor_total && (
                <p className="text-xs text-destructive">{erros.valor_total}</p>
              )}
            </div>

            {tipo === "recorrente_executar" && (
              <>
                <div className="space-y-1.5">
                  <Label>Tempo (meses) *</Label>
                  <div className="flex h-10 gap-1 rounded-md border border-input bg-background p-0.5">
                    {[6, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleLtChange(m)}
                        className={cn(
                          "flex-1 rounded text-xs font-medium transition",
                          form.lt_meses === m
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {m} meses
                      </button>
                    ))}
                  </div>
                  {erros.lt_meses && (
                    <p className="text-xs text-destructive">{erros.lt_meses}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Valor mensal (derivado)</Label>
                  <div className="flex h-10 items-center rounded-md border border-dashed border-border/60 bg-muted/40 px-3 text-sm">
                    <span className="font-semibold tabular-nums text-foreground">
                      {valorMensalDerivado > 0
                        ? formatCurrency(valorMensalDerivado)
                        : "—"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pagamento */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select
                value={form.forma_pagamento ?? undefined}
                onValueChange={(v) =>
                  setField("forma_pagamento", v as FormaPagamento)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nº de parcelas</Label>
              {tipo === "recorrente_executar" ? (
                <div className="flex h-10 items-center rounded-md border border-dashed border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground">
                  {form.lt_meses ?? "—"}× (mensal)
                </div>
              ) : (
                <Select
                  value={String(form.num_parcelas ?? 1)}
                  onValueChange={(v) => setField("num_parcelas", parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}× {n === 1 ? "(à vista)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {form.valor_tcv && form.valor_tcv > 0 && (
              <div className="space-y-1.5">
                <Label>Valor da parcela</Label>
                <div className="flex h-10 items-center justify-between rounded-md border border-dashed border-border/60 bg-muted/40 px-3 text-sm">
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(
                      form.valor_tcv /
                        (form.num_parcelas && form.num_parcelas > 0
                          ? form.num_parcelas
                          : 1)
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Usado no financeiro
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Data de assinatura *</Label>
              <Input
                type="date"
                value={form.data_assinatura}
                onChange={(e) => setField("data_assinatura", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Contrato fechado (evento de aquisição).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Data de kickoff</Label>
              <Input
                type="date"
                value={form.data_kickoff ?? ""}
                onChange={(e) =>
                  setField("data_kickoff", e.target.value || undefined)
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Reunião de kickoff agendada.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Início da operação *</Label>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) => setField("data_inicio", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Quando a equipe começou.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Início do pagamento</Label>
              <Input
                type="date"
                value={form.data_inicio_pagamento ?? ""}
                onChange={(e) =>
                  setField("data_inicio_pagamento", e.target.value || undefined)
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Referência para o financeiro.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Fase atual</Label>
              <Select
                value={form.fase_atual}
                onValueChange={(v) => {
                  const faseObj = fasesOrdenadas.find((f) => f.id === v);
                  setForm((f) => ({
                    ...f,
                    fase_atual: v as FaseProjeto,
                    status: statusDaFase(faseObj?.nome, f.status),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fasesOrdenadas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Saúde</Label>
              <Select
                value={form.saude_atual}
                onValueChange={(v) => setField("saude_atual", v as SaudeProjeto)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["saudavel", "alerta", "cuidado", "critico"] as SaudeProjeto[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {SAUDE_LABEL[s]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setField("status", v as StatusProjeto)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="churn">Churn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select
                value={form.origem}
                onValueChange={(v) => setField("origem", v as OrigemProjeto)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.status === "churn" && (
            <div className="container-highlight space-y-1.5">
              <Label>Motivo do churn *</Label>
              <Select
                value={form.motivo_churn ?? ""}
                onValueChange={(v) => setField("motivo_churn", v as MotivoChurn)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_CHURN.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros.motivo_churn && (
                <p className="text-xs text-destructive">{erros.motivo_churn}</p>
              )}
            </div>
          )}

          <SquadEditor
            squad={form.squad}
            onAdd={addSquadMembro}
            onRemove={removeSquadMembro}
            onPrincipal={tornarPrincipal}
            erro={erros.squad}
          />

          <DocumentosEditor form={form} setField={setField} />

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) => setField("observacoes", e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Salvar projeto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Combobox simples: busca + dropdown filtrado. Adiciona à seleção ao clicar.
function SeletorProdutosBusca({
  produtos,
  jaSelecionados,
  onSelecionar,
  placeholder,
}: {
  produtos: Produto[];
  jaSelecionados: string[];
  onSelecionar: (produtoId: string) => void;
  placeholder: string;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(ev.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const disponiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos
      .filter((p) => !jaSelecionados.includes(p.id))
      .filter(
        (p) =>
          !q ||
          p.nome.toLowerCase().includes(q) ||
          (p.descricao ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .slice(0, 30);
  }, [produtos, jaSelecionados, busca]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder={placeholder}
          className="h-9 pl-8 text-sm"
        />
      </div>
      {aberto && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {disponiveis.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum produto disponível.
            </p>
          ) : (
            <ul className="py-1">
              {disponiveis.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelecionar(p.id);
                      setBusca("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <Badge
                      variant={variantCategoria(p.categoria)}
                      className="shrink-0 text-[9px]"
                    >
                      {CATEGORIAS.find((c) => c.value === p.categoria)?.label}
                    </Badge>
                    <span className="font-medium text-foreground">{p.nome}</span>
                    {p.descricao && (
                      <span className="truncate text-muted-foreground">
                        · {p.descricao}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SquadEditor({
  squad,
  onAdd,
  onRemove,
  onPrincipal,
  erro,
}: {
  squad: SquadMembro[];
  onAdd: (invId: string, funcao: FuncaoSquad) => void;
  onRemove: (id: string) => void;
  onPrincipal: (id: string) => void;
  erro?: string;
}) {
  const { investidores } = useApp();
  const [novoInv, setNovoInv] = useState("");
  const [novaFuncao, setNovaFuncao] = useState<FuncaoSquad>("analista");

  const disponiveis = investidores.filter(
    (i) => i.status === "ativo" && !squad.find((s) => s.investidor_id === i.id)
  );

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label>Squad alocado *</Label>
        <Badge variant="outline" className="text-[10px]">
          {squad.length}
        </Badge>
      </div>

      {squad.length > 0 && (
        <div className="space-y-1.5">
          {squad.map((s) => {
            const inv = investidores.find((i) => i.id === s.investidor_id);
            const funcaoLabel = FUNCOES_SQUAD.find((f) => f.value === s.funcao)?.label;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {inv?.nome ?? "—"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {funcaoLabel}
                  </Badge>
                  {s.principal && (
                    <Badge variant="default" className="text-[10px]">
                      Principal
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!s.principal && (
                    <button
                      type="button"
                      onClick={() => onPrincipal(s.id)}
                      className="rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                    >
                      tornar principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(s.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Select value={novoInv} onValueChange={setNovoInv}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um investidor" />
          </SelectTrigger>
          <SelectContent>
            {disponiveis.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.nome}
              </SelectItem>
            ))}
            {disponiveis.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Nenhum disponível
              </div>
            )}
          </SelectContent>
        </Select>
        <Select
          value={novaFuncao}
          onValueChange={(v) => setNovaFuncao(v as FuncaoSquad)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FUNCOES_SQUAD.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onAdd(novoInv, novaFuncao);
            setNovoInv("");
          }}
          disabled={!novoInv}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

function DocumentosEditor({
  form,
  setField,
}: {
  form: Projeto;
  setField: <K extends keyof Projeto>(key: K, value: Projeto[K]) => void;
}) {
  const campos: {
    key: keyof Projeto;
    label: string;
    placeholder: string;
  }[] = [
    {
      key: "oportunidade_crm_url",
      label: "Oportunidade no CRM",
      placeholder: "https://crm.exemplo.com/oportunidades/123",
    },
    {
      key: "whatsapp_grupo_url",
      label: "Grupo do WhatsApp",
      placeholder: "https://chat.whatsapp.com/...",
    },
    {
      key: "contrato_url",
      label: "Contrato",
      placeholder: "Link do drive ou plataforma de assinatura",
    },
    {
      key: "transcricao_venda_url",
      label: "Transcrição — Reunião de Vendas",
      placeholder: "Link da gravação ou transcrição",
    },
    {
      key: "transcricao_qualificacao_url",
      label: "Transcrição — Reunião de Qualificação",
      placeholder: "Link da gravação ou transcrição",
    },
    {
      key: "transcricao_plano_voo_url",
      label: "Transcrição — Reunião de Plano de Vôo",
      placeholder: "Link da gravação ou transcrição",
    },
  ];

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
      <div>
        <Label>Documentos e links do projeto</Label>
        <p className="text-[11px] text-muted-foreground">
          Centralize aqui as URLs do handoff comercial. Todos os campos são
          opcionais — preencha o que tiver disponível.
        </p>
      </div>
      <div className="grid gap-2">
        {campos.map((c) => {
          const valor = (form[c.key] as string | undefined) ?? "";
          return (
            <div key={c.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  {c.label}
                </Label>
                <Input
                  type="url"
                  value={valor}
                  onChange={(e) =>
                    setField(
                      c.key,
                      (e.target.value || undefined) as Projeto[typeof c.key]
                    )
                  }
                  placeholder={c.placeholder}
                  className="h-8 text-sm"
                />
              </div>
              {valor && (
                <a
                  href={valor}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-end rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
                >
                  Abrir
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
