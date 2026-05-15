import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
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
  CategoriaV4,
  FaseProjeto,
  FORMAS_PAGAMENTO,
  FormaPagamento,
  FUNCOES_SQUAD,
  FuncaoSquad,
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
} from "@/types";
import { formatCurrency, uid, variantCategoria } from "@/lib/utils";

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
    nome: "",
    modelo_cobranca: "recorrente",
    valor_total: 0,
    fase_atual: "inicio",
    data_assinatura: hoje,
    data_inicio: hoje,
    data_kickoff: undefined,
    lt_meses: 6,
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

export function ProjetoFormDialog({
  open,
  onOpenChange,
  projeto,
  clientePreSelect,
}: Props) {
  const { clientes, investidores, produtos, fases, saveProjeto, gerarCodigoProjeto } = useApp();
  const fasesOrdenadas = [...fases].sort((a, b) => a.ordem - b.ordem);
  const [form, setForm] = useState<Projeto>(emptyProjeto());
  const [categoria, setCategoria] = useState<CategoriaV4 | "">("");
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (projeto) {
        setForm(projeto);
        // ao editar, deriva a categoria a partir do produto já vinculado
        const prod = produtos.find((p) => p.id === projeto.produto_id);
        setCategoria(prod?.categoria ?? "");
      } else {
        const base = emptyProjeto();
        base.id = uid("prj_");
        if (clientePreSelect) {
          base.cliente_id = clientePreSelect;
          base.codigo = gerarCodigoProjeto(clientePreSelect);
        }
        setForm(base);
        setCategoria("");
      }
      setErros({});
    }
  }, [open, projeto, clientePreSelect, gerarCodigoProjeto, produtos]);

  const clientesAtivos = useMemo(
    () => clientes.filter((c) => c.status !== "inativo"),
    [clientes]
  );

  const produtosAtivos = useMemo(() => produtos.filter((p) => p.ativo), [produtos]);

  const produtosDaCategoria = useMemo(() => {
    if (!categoria) return [];
    const alvo = categoria.toString().toUpperCase();
    return produtosAtivos.filter(
      (p) => (p.categoria ?? "").toString().toUpperCase() === alvo
    );
  }, [produtosAtivos, categoria]);

  // Contagem de produtos ativos por categoria — usada para mostrar "(N)" na lista
  const contagemPorCategoria = useMemo(() => {
    const out: Record<CategoriaV4, number> = {
      SABER: 0,
      TER: 0,
      EXECUTAR: 0,
      POTENCIALIZAR: 0,
      DESTRAVA_RECEITA: 0,
    };
    produtosAtivos.forEach((p) => {
      out[p.categoria] += 1;
    });
    return out;
  }, [produtosAtivos]);

  const produtoSelecionado = produtos.find((p) => p.id === form.produto_id);
  const clienteSelecionado = clientes.find((c) => c.id === form.cliente_id);

  function setField<K extends keyof Projeto>(key: K, value: Projeto[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClienteChange(clienteId: string) {
    setForm((f) => ({
      ...f,
      cliente_id: clienteId,
      codigo: projeto ? f.codigo : gerarCodigoProjeto(clienteId),
    }));
  }

  function handleCategoriaChange(novaCat: CategoriaV4) {
    setCategoria(novaCat);
    // Se o produto atual não pertence à nova categoria, limpa.
    if (form.produto_id) {
      const prodAtual = produtos.find((p) => p.id === form.produto_id);
      if (prodAtual && prodAtual.categoria !== novaCat) {
        setField("produto_id", "");
      }
    }
  }

  function handleProdutoChange(produtoId: string) {
    const prod = produtos.find((p) => p.id === produtoId);
    setForm((f) => ({
      ...f,
      produto_id: produtoId,
      // ao trocar de produto, limpa a variação (não faz sentido manter
      // uma variação de um produto diferente).
      variacao_id: undefined,
      // Pré-preenche apenas em criação ou quando ainda vazio
      modelo_cobranca:
        !projeto && prod ? prod.modelo_cobranca_padrao : f.modelo_cobranca,
      valor_total:
        !projeto && prod?.valor_sugerido ? prod.valor_sugerido : f.valor_total,
      nome: !projeto && !f.nome && prod ? prod.nome : f.nome,
    }));
  }

  function handleVariacaoChange(variacaoId: string) {
    const prod = produtos.find((p) => p.id === form.produto_id);
    const variacao = prod?.variacoes.find((v) => v.id === variacaoId);
    setForm((f) => ({
      ...f,
      variacao_id: variacaoId || undefined,
      // Se a variação tem valor sugerido próprio e o projeto ainda não foi
      // editado manualmente (ou estamos criando), atualiza o valor.
      valor_total:
        !projeto && variacao?.valor_sugerido
          ? variacao.valor_sugerido
          : f.valor_total,
    }));
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
    setField("squad", form.squad.filter((s) => s.id !== id));
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
    if (!form.produto_id) e.produto_id = "Selecione um produto";
    if (!form.nome.trim()) e.nome = "Obrigatório";
    // TCV é o valor base obrigatório. Para retrocompat, deriva quando ausente.
    const tcvEfetivo =
      form.valor_tcv && form.valor_tcv > 0
        ? form.valor_tcv
        : form.modelo_cobranca === "recorrente"
        ? form.valor_total * (form.lt_meses ?? 0)
        : form.valor_total;
    if (tcvEfetivo <= 0) e.valor_total = "Informe o TCV do projeto";
    if (form.modelo_cobranca === "recorrente") {
      if (!form.lt_meses || (form.lt_meses !== 6 && form.lt_meses !== 12)) {
        e.lt_meses = "Selecione 6 ou 12 meses";
      }
    }
    if (!form.data_assinatura) e.data_assinatura = "Obrigatório";
    if (!form.data_inicio) e.data_inicio = "Obrigatório";
    if (form.squad.length === 0) e.squad = "Adicione ao menos um investidor";
    if (form.status === "churn" && !form.motivo_churn)
      e.motivo_churn = "Selecione o motivo do churn";
    // Se o produto selecionado tem variações ativas, a variação é obrigatória.
    const prodSel = produtos.find((p) => p.id === form.produto_id);
    const variacoesAtivas = (prodSel?.variacoes ?? []).filter((v) => v.ativo);
    if (variacoesAtivas.length > 0 && !form.variacao_id) {
      e.variacao_id = "Selecione uma variação";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    saveProjeto(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{projeto ? "Editar projeto" : "Novo projeto"}</DialogTitle>
          <DialogDescription>
            Tier é definido no cliente. Categoria V4 vem do produto.
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
                  Tier do cliente: <span className="font-semibold uppercase">{clienteSelecionado.tier}</span>
                  {clienteSelecionado.nicho && ` · Nicho: ${clienteSelecionado.nicho}`}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={form.codigo} disabled placeholder="—" />
            </div>
          </div>

          <CategoriaProdutoSeletor
            categoria={categoria}
            onCategoriaChange={handleCategoriaChange}
            contagem={contagemPorCategoria}
            produtoId={form.produto_id}
            onProdutoChange={handleProdutoChange}
            produtos={produtosDaCategoria}
            erroProduto={erros.produto_id}
            produtoSelecionado={produtoSelecionado}
            variacaoId={form.variacao_id}
            onVariacaoChange={handleVariacaoChange}
            erroVariacao={erros.variacao_id}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome do projeto *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder={produtoSelecionado?.nome ?? "Ex: Mídia paga Q1, Consultoria CRM 2026"}
              />
              {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Cobrança</Label>
              <Select
                value={form.modelo_cobranca}
                onValueChange={(v) => {
                  const novo = v as Projeto["modelo_cobranca"];
                  setForm((f) => {
                    let valorTotal = f.valor_total;
                    if (novo === "recorrente" && f.valor_tcv && f.lt_meses) {
                      valorTotal = f.valor_tcv / f.lt_meses;
                    } else if (novo === "one_time") {
                      valorTotal = f.valor_tcv ?? f.valor_total;
                    }
                    return { ...f, modelo_cobranca: novo, valor_total: valorTotal };
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="one_time">Pontual (one-time)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {form.modelo_cobranca === "recorrente"
                  ? "TCV (total do contrato) *"
                  : "Valor total do projeto *"}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={(() => {
                  if (typeof form.valor_tcv === "number" && form.valor_tcv > 0) {
                    return form.valor_tcv;
                  }
                  const derivado =
                    form.modelo_cobranca === "recorrente"
                      ? form.valor_total * (form.lt_meses ?? 0)
                      : form.valor_total;
                  return derivado > 0 ? derivado : "";
                })()}
                onChange={(e) => {
                  const v = e.target.value;
                  const tcv = v === "" ? undefined : Number(e.target.value);
                  setForm((f) => {
                    let valorTotal = f.valor_total;
                    if (f.modelo_cobranca === "recorrente") {
                      if (tcv && f.lt_meses && f.lt_meses > 0) {
                        valorTotal = tcv / f.lt_meses;
                      }
                    } else {
                      valorTotal = tcv ?? 0;
                    }
                    return {
                      ...f,
                      valor_tcv: tcv && tcv > 0 ? tcv : undefined,
                      valor_total: valorTotal,
                    };
                  });
                }}
                placeholder="0,00"
              />
              {erros.valor_total && (
                <p className="text-xs text-destructive">{erros.valor_total}</p>
              )}
            </div>
            {form.modelo_cobranca === "recorrente" && (
              <div className="space-y-1.5">
                <Label>Prazo de vigência *</Label>
                <Select
                  value={
                    form.lt_meses === 6 || form.lt_meses === 12
                      ? String(form.lt_meses)
                      : undefined
                  }
                  onValueChange={(v) => {
                    const lt = parseInt(v, 10);
                    setForm((f) => {
                      const valorTotal =
                        f.valor_tcv && f.valor_tcv > 0 && lt > 0
                          ? f.valor_tcv / lt
                          : f.valor_total;
                      return { ...f, lt_meses: lt, valor_total: valorTotal };
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="6 ou 12" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.modelo_cobranca === "recorrente" && (
              <div className="space-y-1.5">
                <Label>Valor mensal (derivado)</Label>
                <div className="flex h-10 items-center rounded-md border border-dashed border-border/60 bg-muted/40 px-3 text-sm">
                  <span className="font-semibold tabular-nums text-foreground">
                    {form.valor_tcv && form.lt_meses
                      ? formatCurrency(form.valor_tcv / form.lt_meses)
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

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
              <Label>Nº de parcelas (até 12)</Label>
              <Select
                value={String(form.num_parcelas ?? 1)}
                onValueChange={(v) =>
                  setField("num_parcelas", parseInt(v, 10))
                }
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
                onValueChange={(v) => setField("fase_atual", v as FaseProjeto)}
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
                  {(["saudavel", "alerta", "cuidado", "critico"] as SaudeProjeto[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SAUDE_LABEL[s]}
                    </SelectItem>
                  ))}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar projeto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoriaProdutoSeletor({
  categoria,
  onCategoriaChange,
  contagem,
  produtoId,
  onProdutoChange,
  produtos,
  erroProduto,
  produtoSelecionado,
  variacaoId,
  onVariacaoChange,
  erroVariacao,
}: {
  categoria: CategoriaV4 | "";
  onCategoriaChange: (c: CategoriaV4) => void;
  contagem: Record<CategoriaV4, number>;
  produtoId: string;
  onProdutoChange: (id: string) => void;
  produtos: Produto[];
  erroProduto?: string;
  produtoSelecionado?: Produto;
  variacaoId?: string;
  onVariacaoChange: (id: string) => void;
  erroVariacao?: string;
}) {
  const categoriaLabel = CATEGORIAS.find(
    (c) => c.value === produtoSelecionado?.categoria
  )?.label;

  const variacoesAtivas = (produtoSelecionado?.variacoes ?? []).filter(
    (v) => v.ativo
  );
  const temVariacoes = variacoesAtivas.length > 0;
  const variacaoSelecionada = variacoesAtivas.find((v) => v.id === variacaoId);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Categoria V4 *</Label>
        <Select
          value={categoria}
          onValueChange={(v) => onCategoriaChange(v as CategoriaV4)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({contagem[c.value]} produto{contagem[c.value] === 1 ? "" : "s"})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Produto *</Label>
        <Select
          value={produtoId}
          onValueChange={onProdutoChange}
          disabled={!categoria}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                categoria ? "Selecione o produto" : "Escolha a categoria primeiro"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {produtos.length === 0 && categoria && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Nenhum produto ativo nesta categoria. Cadastre em "Produtos".
              </div>
            )}
            {produtos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
                {p.variacoes.filter((v) => v.ativo).length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({p.variacoes.filter((v) => v.ativo).length} variações)
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erroProduto && <p className="text-xs text-destructive">{erroProduto}</p>}
      </div>

      {temVariacoes && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Variação *</Label>
          <Select value={variacaoId ?? ""} onValueChange={onVariacaoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a variação" />
            </SelectTrigger>
            <SelectContent>
              {variacoesAtivas.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                  {v.valor_sugerido !== undefined && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      — {formatCurrency(v.valor_sugerido)}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {erroVariacao && <p className="text-xs text-destructive">{erroVariacao}</p>}
        </div>
      )}

      {produtoSelecionado && (
        <div className="sm:col-span-2 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Badge
            variant={variantCategoria(produtoSelecionado.categoria)}
            className="text-[10px] shrink-0"
          >
            {categoriaLabel}
          </Badge>
          <span>
            {produtoSelecionado.descricao ?? "Sem descrição."}
            {variacaoSelecionada?.valor_sugerido !== undefined
              ? ` · Variação sugerida: ${formatCurrency(variacaoSelecionada.valor_sugerido)}`
              : produtoSelecionado.valor_sugerido
              ? ` · Sugerido: ${formatCurrency(produtoSelecionado.valor_sugerido)}`
              : ""}
          </span>
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
                  <span className="font-medium text-foreground">{inv?.nome ?? "—"}</span>
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
        <Select value={novaFuncao} onValueChange={(v) => setNovaFuncao(v as FuncaoSquad)}>
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

// Bloco de links do handoff comercial. Cada linha = um ícone, um campo
// editável e (se preenchido) um botão "Abrir" que pula direto pra URL.
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
                    setField(c.key, (e.target.value || undefined) as Projeto[typeof c.key])
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
