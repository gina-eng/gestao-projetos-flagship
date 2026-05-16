import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Building2,
  Briefcase,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
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
  Cliente,
  FormaPagamento,
  FORMAS_PAGAMENTO,
  ItemNegociacao,
  MODELOS_VENDAS,
  ModeloVendas,
  Produto,
  Projeto,
  RegiaoAtuacao,
  REGIOES_ATUACAO,
  Segmento,
  SEGMENTOS,
  Tier,
  TIERS,
  TipoNegociacao,
} from "@/types";
import {
  categoriasDoTipo,
  formatCnpj,
  formatCurrency,
  formatMoedaBR,
  parseMoedaBR,
  suggestSigla,
  uid,
  variantCategoria,
  TIPO_NEGOCIACAO_LABEL,
  TIPO_NEGOCIACAO_LABEL_CURTO,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ContatoHandoff {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
}

function contatoVazio(): ContatoHandoff {
  return {
    id: uid("ct_"),
    nome: "",
    cargo: "",
    email: "",
    telefone: "",
  };
}

// Uma negociação agrupa N produtos (mesma categoria-grupo) sob 1 forma de
// pagamento e 1 tipo (one-time ou recorrente_executar). Cada negociação vira
// 1 projeto na operação. O Handoff pode conter várias negociações que serão
// agrupadas pelo `venda_id` (cards compartilham o sufixo `O{N}`).
interface ItemProduto {
  id: string;
  produto_id: string;
  variacao_id: string;
}

interface Negociacao {
  id: string;
  tipo: TipoNegociacao;
  itens: ItemProduto[];
  // Em one-time, é o valor cheio. Em recorrente_executar, é o TCV total
  // (o valor mensal sai de TCV ÷ LT).
  valor_total: number;
  lt_meses: number;                       // só importa em recorrente_executar (6 ou 12)
  forma_pagamento: FormaPagamento | "";
  num_parcelas: number;                   // one-time: 1-12; executar: igual a lt_meses
  data_inicio_pagamento: string;
}

interface FormState {
  // Cliente
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  segmento: Segmento | "";
  segmento_outro: string;
  nicho: string;
  regiao_atuacao: RegiaoAtuacao | "";
  modelo_vendas: ModeloVendas[];
  tier: Tier;
  endereco: string;
  cidade: string;
  estado: string;
  contatos: ContatoHandoff[];

  // Negociações da venda + datas comuns
  negociacoes: Negociacao[];
  data_assinatura: string;
  data_kickoff: string;

  // Documentos
  oportunidade_crm_url: string;
  whatsapp_grupo_url: string;
  contrato_url: string;
  transcricao_venda_url: string;
  transcricao_qualificacao_url: string;
  transcricao_plano_voo_url: string;

  observacoes: string;
}

function negociacaoVazia(tipo: TipoNegociacao = "one_time"): Negociacao {
  return {
    id: uid("neg_"),
    tipo,
    itens: [],
    valor_total: 0,
    lt_meses: tipo === "recorrente_executar" ? 12 : 1,
    forma_pagamento: "",
    num_parcelas: tipo === "recorrente_executar" ? 12 : 1,
    data_inicio_pagamento: "",
  };
}

function formInicial(): FormState {
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    segmento: "",
    segmento_outro: "",
    nicho: "",
    regiao_atuacao: "",
    modelo_vendas: [],
    tier: "small",
    endereco: "",
    cidade: "",
    estado: "",
    contatos: [contatoVazio()],
    negociacoes: [negociacaoVazia("one_time")],
    data_assinatura: hoje,
    data_kickoff: "",
    oportunidade_crm_url: "",
    whatsapp_grupo_url: "",
    contrato_url: "",
    transcricao_venda_url: "",
    transcricao_qualificacao_url: "",
    transcricao_plano_voo_url: "",
    observacoes: "",
  };
}

export function HandoffPage() {
  const { clientes, produtos, saveCliente, saveProjeto, gerarCodigoProjeto } =
    useApp();
  const [form, setForm] = useState<FormState>(formInicial());
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [codigosCriados, setCodigosCriados] = useState<string[]>([]);
  const [sucesso, setSucesso] = useState(false);

  // Sigla auto-gerada a partir do nome fantasia, garantindo unicidade.
  const siglaAuto = useMemo(() => {
    const base = suggestSigla(form.nome_fantasia || form.razao_social);
    if (!base) return "";
    const ocupadas = new Set(clientes.map((c) => c.sigla.toUpperCase()));
    if (!ocupadas.has(base)) return base;
    // Disambigua: SIG2, SIG3, ...
    let i = 2;
    while (true) {
      const candidato = base.slice(0, Math.max(2, base.length - 1)) + i;
      if (!ocupadas.has(candidato)) return candidato;
      i++;
      if (i > 99) return base + "X"; // failsafe
    }
  }, [form.nome_fantasia, form.razao_social, clientes]);

  function setField<K extends keyof FormState>(key: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [key]: valor }));
  }

  function toggleModelo(m: ModeloVendas) {
    setForm((f) => {
      const has = f.modelo_vendas.includes(m);
      return {
        ...f,
        modelo_vendas: has
          ? f.modelo_vendas.filter((x) => x !== m)
          : [...f.modelo_vendas, m],
      };
    });
  }

  // ---------- Validação ----------
  function validar(): Record<string, string> {
    const e: Record<string, string> = {};
    // Cliente
    if (!form.nome_fantasia.trim()) e.nome_fantasia = "Obrigatório";
    if (!form.razao_social.trim()) e.razao_social = "Obrigatório";
    if (!form.segmento) e.segmento = "Selecione";
    if (form.segmento === "outros" && !form.segmento_outro.trim())
      e.segmento_outro = "Descreva";
    if (form.modelo_vendas.length === 0)
      e.modelo_vendas = "Selecione ao menos um";
    if (!siglaAuto) e.nome_fantasia = "Não conseguimos gerar sigla — verifique o nome";

    // Negociações
    if (form.negociacoes.length === 0)
      e.negociacoes = "Adicione ao menos uma negociação";
    form.negociacoes.forEach((neg, idx) => {
      if (neg.itens.length === 0)
        e[`neg_${idx}_itens`] = "Adicione ao menos 1 produto";
      // Garante que todos os produtos pertencem ao grupo correto
      const grupo = categoriasDoTipo(neg.tipo);
      const invalidos = neg.itens.filter((it) => {
        const prod = produtos.find((p) => p.id === it.produto_id);
        return !prod || !grupo.includes(prod.categoria);
      });
      if (invalidos.length > 0)
        e[`neg_${idx}_itens`] = "Produto incompatível com o tipo da negociação";
      // Variações obrigatórias quando o produto tem variação ativa
      neg.itens.forEach((it) => {
        const prod = produtos.find((p) => p.id === it.produto_id);
        const ativas = (prod?.variacoes ?? []).filter((v) => v.ativo);
        if (ativas.length > 0 && !it.variacao_id)
          e[`neg_${idx}_item_${it.id}_variacao`] = "Selecione variação";
      });
      if (neg.valor_total <= 0) e[`neg_${idx}_valor`] = "> 0";
      if (!neg.forma_pagamento) e[`neg_${idx}_forma`] = "Selecione";
      if (neg.tipo === "recorrente_executar" && ![6, 12].includes(neg.lt_meses))
        e[`neg_${idx}_lt`] = "Escolha 6 ou 12 meses";
      if (neg.tipo === "one_time" && (neg.num_parcelas < 1 || neg.num_parcelas > 12))
        e[`neg_${idx}_parcelas`] = "1 a 12";
    });
    return e;
  }

  // ---------- Contatos ----------
  function adicionarContato() {
    setField("contatos", [...form.contatos, contatoVazio()]);
  }

  function removerContato(id: string) {
    if (form.contatos.length === 1) {
      // Sempre mantém pelo menos uma linha vazia
      setField("contatos", [contatoVazio()]);
      return;
    }
    setField(
      "contatos",
      form.contatos.filter((c) => c.id !== id)
    );
  }

  function atualizarContato(id: string, patch: Partial<ContatoHandoff>) {
    setField(
      "contatos",
      form.contatos.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  // ---------- Negociações ----------
  function adicionarNegociacao(tipo: TipoNegociacao) {
    setField("negociacoes", [...form.negociacoes, negociacaoVazia(tipo)]);
  }

  function removerNegociacao(id: string) {
    if (form.negociacoes.length === 1) return; // não deixa zerar
    setField(
      "negociacoes",
      form.negociacoes.filter((n) => n.id !== id)
    );
  }

  function atualizarNegociacao(id: string, patch: Partial<Negociacao>) {
    setField(
      "negociacoes",
      form.negociacoes.map((n) => {
        if (n.id !== id) return n;
        const atualizada = { ...n, ...patch };
        // Em "executar", num_parcelas espelha lt_meses automaticamente.
        if (atualizada.tipo === "recorrente_executar") {
          atualizada.num_parcelas = atualizada.lt_meses;
        }
        return atualizada;
      })
    );
  }

  function adicionarProdutoNegociacao(negId: string, produtoId: string) {
    setField(
      "negociacoes",
      form.negociacoes.map((n) => {
        if (n.id !== negId) return n;
        if (n.itens.some((it) => it.produto_id === produtoId)) return n;
        return {
          ...n,
          itens: [
            ...n.itens,
            { id: uid("itp_"), produto_id: produtoId, variacao_id: "" },
          ],
        };
      })
    );
  }

  function atualizarVariacaoItem(
    negId: string,
    itemId: string,
    variacaoId: string
  ) {
    setField(
      "negociacoes",
      form.negociacoes.map((n) => {
        if (n.id !== negId) return n;
        return {
          ...n,
          itens: n.itens.map((it) =>
            it.id === itemId ? { ...it, variacao_id: variacaoId } : it
          ),
        };
      })
    );
  }

  function removerProdutoNegociacao(negId: string, itemId: string) {
    setField(
      "negociacoes",
      form.negociacoes.map((n) =>
        n.id === negId
          ? { ...n, itens: n.itens.filter((it) => it.id !== itemId) }
          : n
      )
    );
  }

  // ---------- Submit ----------
  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const ee = validar();
    setErros(ee);
    if (Object.keys(ee).length > 0) {
      // Rola até o primeiro erro
      requestAnimationFrame(() => {
        const primeiro = document.querySelector("[data-erro='true']");
        primeiro?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setEnviando(true);
    try {
      const clienteId = uid("cli_");
      const cliente: Cliente = {
        id: clienteId,
        sigla: siglaAuto,
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia.trim(),
        cnpj: form.cnpj.trim() || undefined,
        segmento: form.segmento as Segmento,
        segmento_outro: form.segmento_outro.trim() || undefined,
        nicho: form.nicho.trim() || undefined,
        regiao_atuacao: form.regiao_atuacao
          ? (form.regiao_atuacao as RegiaoAtuacao)
          : undefined,
        modelo_vendas: form.modelo_vendas,
        tier: form.tier,
        endereco: form.endereco.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        estado: form.estado.trim().toUpperCase() || undefined,
        contatos: form.contatos
          .filter((c) => c.nome.trim().length > 0)
          .map((c) => ({
            id: c.id || uid("ct_"),
            nome: c.nome.trim(),
            cargo: c.cargo.trim() || undefined,
            email: c.email.trim() || undefined,
            telefone: c.telefone.trim() || undefined,
          })),
        conexoes: [],
        status: "ativo",
        data_cadastro: new Date().toISOString().slice(0, 10),
        observacoes: form.observacoes.trim()
          ? `[Handoff comercial] ${form.observacoes.trim()}`
          : "Handoff comercial via formulário público.",
      };
      saveCliente(cliente);

      // Cria N projetos (um por negociação). Como o cliente é novo, a venda
      // é a primeira (`venda_seq = 1`). As negociações compartilham o mesmo
      // `venda_id` e recebem letras sequenciais A, B, C...
      const codigos: string[] = [];
      const vendaId = uid("vnd_");
      const vendaSeq = 1;
      const linksDocs = {
        oportunidade_crm_url: form.oportunidade_crm_url.trim() || undefined,
        whatsapp_grupo_url: form.whatsapp_grupo_url.trim() || undefined,
        contrato_url: form.contrato_url.trim() || undefined,
        transcricao_venda_url: form.transcricao_venda_url.trim() || undefined,
        transcricao_qualificacao_url:
          form.transcricao_qualificacao_url.trim() || undefined,
        transcricao_plano_voo_url:
          form.transcricao_plano_voo_url.trim() || undefined,
      };

      for (let idx = 0; idx < form.negociacoes.length; idx++) {
        const neg = form.negociacoes[idx];
        const letra = String.fromCharCode(65 + idx); // A, B, C...
        const codigo = `${siglaAuto}-O${vendaSeq}-${letra}`;
        codigos.push(codigo);

        // Cálculo dos valores:
        // - One-time: valor_total = valor cheio digitado (TCV = mesmo valor).
        // - Recorrente_executar: TCV digitado ÷ LT vira o valor mensal.
        const tcv = neg.valor_total;
        const modeloCobranca =
          neg.tipo === "recorrente_executar" ? "recorrente" : "one_time";
        const valorBase =
          neg.tipo === "recorrente_executar" && neg.lt_meses > 0
            ? tcv / neg.lt_meses
            : tcv;

        // Primeiro item populariza os campos legados (produto_id/variacao_id)
        // para retrocompatibilidade com queries antigas.
        const principal = neg.itens[0];
        const projetoItens: ItemNegociacao[] = neg.itens.map((it) => ({
          id: it.id,
          produto_id: it.produto_id,
          variacao_id: it.variacao_id || undefined,
        }));

        const projeto: Projeto = {
          id: uid("prj_"),
          codigo,
          cliente_id: clienteId,
          produto_id: principal?.produto_id ?? "",
          variacao_id: principal?.variacao_id || undefined,
          itens: projetoItens,
          tipo_negociacao: neg.tipo,
          venda_id: vendaId,
          venda_seq: vendaSeq,
          venda_letra: letra,
          nome: codigo,
          modelo_cobranca: modeloCobranca,
          valor_total: valorBase,
          valor_tcv: tcv > 0 ? tcv : undefined,
          forma_pagamento: neg.forma_pagamento || undefined,
          num_parcelas: neg.num_parcelas || undefined,
          data_inicio_pagamento: neg.data_inicio_pagamento || undefined,
          fase_atual: "inicio",
          data_assinatura: form.data_assinatura,
          data_inicio: form.data_assinatura,
          data_kickoff: form.data_kickoff || undefined,
          lt_meses:
            neg.tipo === "recorrente_executar" ? neg.lt_meses : undefined,
          status: "ativo",
          saude_atual: "saudavel",
          links_rapidos: [],
          origem: "aquisicao",
          squad: [],
          ...linksDocs,
        };
        saveProjeto(projeto);
      }

      // Silencia gerarCodigoProjeto (não usamos aqui — geramos manualmente).
      void gerarCodigoProjeto;

      setCodigosCriados(codigos);
      setSucesso(true);
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <Sucesso
        codigos={codigosCriados}
        onNovo={() => {
          setForm(formInicial());
          setCodigosCriados([]);
          setSucesso(false);
        }}
      />
    );
  }

  // Soma do TCV de todas as negociações (one-time = valor cheio, executar = TCV).
  const totalContrato = form.negociacoes.reduce(
    (acc, n) => acc + (Number.isFinite(n.valor_total) ? n.valor_total : 0),
    0
  );

  const totalErros = Object.keys(erros).length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-extrabold">
              V4
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                Handoff Comercial → Operações
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Cliente + projetos numa só submissão
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {siglaAuto && (
              <Badge variant="outline" className="font-mono text-[10px]">
                Sigla: {siglaAuto}
              </Badge>
            )}
            <Button type="submit" form="handoff-form" disabled={enviando} size="default">
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              {enviando ? "Enviando..." : "Enviar handoff"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <form
          id="handoff-form"
          onSubmit={handleSubmit}
          className="mx-auto max-w-7xl space-y-4 px-6 py-4"
        >
          {/* Layout em 2 colunas: cliente à esquerda, itens + docs à direita.
              No mobile colapsa em uma coluna só. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Coluna esquerda: tudo do cliente */}
            <div className="space-y-4">
              <StepCliente
                form={form}
                erros={erros}
                setField={setField}
                toggleModelo={toggleModelo}
                siglaAuto={siglaAuto}
                onAdicionarContato={adicionarContato}
                onRemoverContato={removerContato}
                onAtualizarContato={atualizarContato}
              />
            </div>

            {/* Coluna direita: negociações + documentos */}
            <div className="space-y-4">
              <StepNegociacoes
                form={form}
                erros={erros}
                setField={setField}
                produtos={produtos}
                onUpdateNegociacao={atualizarNegociacao}
                onAddNegociacao={adicionarNegociacao}
                onRemoveNegociacao={removerNegociacao}
                onAddProduto={adicionarProdutoNegociacao}
                onRemoveProduto={removerProdutoNegociacao}
                onUpdateVariacao={atualizarVariacaoItem}
                totalContrato={totalContrato}
              />

              <StepDocumentos form={form} setField={setField} />
            </div>
          </div>

          {/* CTA final */}
          <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {totalErros > 0 ? (
                <span className="text-destructive">
                  {totalErros} campo(s) com erro — verifique acima.
                </span>
              ) : (
                <>Tudo certo? Ao enviar, criamos o cliente e os projetos na operação.</>
              )}
            </div>
            <Button type="submit" disabled={enviando} size="lg">
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              {enviando ? "Enviando..." : "Enviar handoff"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────
// Step 1: Cliente
// ─────────────────────────────────────────────────────────────────────
function StepCliente({
  form,
  erros,
  setField,
  toggleModelo,
  siglaAuto,
  onAdicionarContato,
  onRemoverContato,
  onAtualizarContato,
}: {
  form: FormState;
  erros: Record<string, string>;
  setField: <K extends keyof FormState>(key: K, valor: FormState[K]) => void;
  toggleModelo: (m: ModeloVendas) => void;
  siglaAuto: string;
  onAdicionarContato: () => void;
  onRemoverContato: (id: string) => void;
  onAtualizarContato: (id: string, patch: Partial<ContatoHandoff>) => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-saber" />
          <h2 className="text-lg font-bold text-foreground">Dados do cliente</h2>
          {siglaAuto && (
            <Badge variant="outline" className="ml-auto font-mono text-[10px]">
              Sigla: {siglaAuto}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Empresa que comprou. Sigla é gerada automaticamente — você só preenche
          os dados.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome fantasia *</Label>
              <Input
                value={form.nome_fantasia}
                onChange={(e) => setField("nome_fantasia", e.target.value)}
                placeholder="Como o cliente é conhecido"
                className="h-9"
              />
              {erros.nome_fantasia && (
                <p className="text-[11px] text-destructive">{erros.nome_fantasia}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Razão social *</Label>
              <Input
                value={form.razao_social}
                onChange={(e) => setField("razao_social", e.target.value)}
                placeholder="Nome completo da empresa"
                className="h-9"
              />
              {erros.razao_social && (
                <p className="text-[11px] text-destructive">{erros.razao_social}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setField("cnpj", formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Segmento *</Label>
              <Select
                value={form.segmento}
                onValueChange={(v) => {
                  setField("segmento", v as Segmento);
                  if (v !== "outros") setField("segmento_outro", "");
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros.segmento && (
                <p className="text-[11px] text-destructive">{erros.segmento}</p>
              )}
            </div>
            {form.segmento === "outros" ? (
              <div className="space-y-1">
                <Label className="text-xs">Descreva o segmento *</Label>
                <Input
                  value={form.segmento_outro}
                  onChange={(e) => setField("segmento_outro", e.target.value)}
                  className="h-9"
                />
                {erros.segmento_outro && (
                  <p className="text-[11px] text-destructive">{erros.segmento_outro}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Nicho</Label>
                <Input
                  value={form.nicho}
                  onChange={(e) => setField("nicho", e.target.value)}
                  placeholder="Ex: Moda íntima"
                  className="h-9"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Região</Label>
              <Select
                value={form.regiao_atuacao}
                onValueChange={(v) => setField("regiao_atuacao", v as RegiaoAtuacao)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {REGIOES_ATUACAO.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tier</Label>
              <Select value={form.tier} onValueChange={(v) => setField("tier", v as Tier)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Modelo de vendas *</Label>
            <div className="flex flex-wrap gap-1.5">
              {MODELOS_VENDAS.map((m) => {
                const active = form.modelo_vendas.includes(m.value);
                return (
                  <button
                    type="button"
                    key={m.value}
                    onClick={() => toggleModelo(m.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            {erros.modelo_vendas && (
              <p className="text-[11px] text-destructive">{erros.modelo_vendas}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Endereço + Contatos — empilhados (porque o card pai já é uma das
          duas colunas da página, não cabem lado a lado aqui). */}
      <div className="grid gap-4">
        {/* Endereço */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Endereço do cliente
            </Label>
            <div className="space-y-1">
              <Label className="text-[10px]">Endereço</Label>
              <Input
                placeholder="Rua, número, complemento"
                value={form.endereco}
                onChange={(e) => setField("endereco", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
              <div className="space-y-1">
                <Label className="text-[10px]">Cidade</Label>
                <Input
                  placeholder="Ex: São Paulo"
                  value={form.cidade}
                  onChange={(e) => setField("cidade", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Estado (UF)</Label>
                <Input
                  placeholder="SP"
                  value={form.estado}
                  onChange={(e) =>
                    setField("estado", e.target.value.toUpperCase().slice(0, 2))
                  }
                  maxLength={2}
                  className="h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contatos do cliente — N pessoas */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Contatos do cliente (opcional)
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Adicione todas as pessoas relevantes do lado do cliente.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {form.contatos.filter((c) => c.nome.trim()).length} preenchido(s)
              </Badge>
            </div>

            <div className="space-y-2">
              {form.contatos.map((c, idx) => (
                <div
                  key={c.id}
                  className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Contato {idx + 1}
                    </span>
                    {(form.contatos.length > 1 || c.nome.trim()) && (
                      <button
                        type="button"
                        onClick={() => onRemoverContato(c.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remover contato"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Nome"
                      value={c.nome}
                      onChange={(e) =>
                        onAtualizarContato(c.id, { nome: e.target.value })
                      }
                      className="h-9"
                    />
                    <Input
                      placeholder="Cargo"
                      value={c.cargo}
                      onChange={(e) =>
                        onAtualizarContato(c.id, { cargo: e.target.value })
                      }
                      className="h-9"
                    />
                    <Input
                      placeholder="E-mail"
                      value={c.email}
                      onChange={(e) =>
                        onAtualizarContato(c.id, { email: e.target.value })
                      }
                      className="h-9"
                    />
                    <Input
                      placeholder="Telefone"
                      value={c.telefone}
                      onChange={(e) =>
                        onAtualizarContato(c.id, { telefone: e.target.value })
                      }
                      className="h-9"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAdicionarContato}
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar mais um contato
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2: Negociações (1 venda → N negociações → N projetos)
// ─────────────────────────────────────────────────────────────────────
function StepNegociacoes({
  form,
  erros,
  setField,
  produtos,
  onUpdateNegociacao,
  onAddNegociacao,
  onRemoveNegociacao,
  onAddProduto,
  onRemoveProduto,
  onUpdateVariacao,
  totalContrato,
}: {
  form: FormState;
  erros: Record<string, string>;
  setField: <K extends keyof FormState>(key: K, valor: FormState[K]) => void;
  produtos: Produto[];
  onUpdateNegociacao: (id: string, patch: Partial<Negociacao>) => void;
  onAddNegociacao: (tipo: TipoNegociacao) => void;
  onRemoveNegociacao: (id: string) => void;
  onAddProduto: (negId: string, produtoId: string) => void;
  onRemoveProduto: (negId: string, itemId: string) => void;
  onUpdateVariacao: (negId: string, itemId: string, variacaoId: string) => void;
  totalContrato: number;
}) {
  const produtosAtivos = produtos.filter((p) => p.ativo);
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-ter" />
          <h2 className="text-lg font-bold text-foreground">Negociações</h2>
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
            Total: {formatCurrency(totalContrato)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada negociação tem 1 forma de pagamento e vira 1 card na operação.
          Produtos de Executar ficam em negociação separada dos demais.
        </p>
      </div>

      {/* Datas comuns */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Data de assinatura</Label>
            <Input
              type="date"
              value={form.data_assinatura}
              onChange={(e) => setField("data_assinatura", e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data de kickoff agendado</Label>
            <Input
              type="date"
              value={form.data_kickoff}
              onChange={(e) => setField("data_kickoff", e.target.value)}
              className="h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de negociações */}
      <div className="space-y-3">
        {form.negociacoes.map((neg, idx) => (
          <NegociacaoCard
            key={neg.id}
            negociacao={neg}
            idx={idx}
            produtos={produtosAtivos}
            erros={erros}
            podeRemover={form.negociacoes.length > 1}
            onUpdate={onUpdateNegociacao}
            onRemove={onRemoveNegociacao}
            onAddProduto={onAddProduto}
            onRemoveProduto={onRemoveProduto}
            onUpdateVariacao={onUpdateVariacao}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={() => onAddNegociacao("one_time")}
          className="flex-1"
        >
          <Plus className="h-4 w-4" />
          Negociação one-time (Saber/Ter/Destrava/Potencializar)
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onAddNegociacao("recorrente_executar")}
          className="flex-1"
        >
          <Plus className="h-4 w-4" />
          Negociação recorrente (Executar)
        </Button>
      </div>

      {erros.negociacoes && (
        <p className="text-xs text-destructive">{erros.negociacoes}</p>
      )}
    </div>
  );
}

function NegociacaoCard({
  negociacao,
  idx,
  produtos,
  erros,
  podeRemover,
  onUpdate,
  onRemove,
  onAddProduto,
  onRemoveProduto,
  onUpdateVariacao,
}: {
  negociacao: Negociacao;
  idx: number;
  produtos: Produto[];
  erros: Record<string, string>;
  podeRemover: boolean;
  onUpdate: (id: string, patch: Partial<Negociacao>) => void;
  onRemove: (id: string) => void;
  onAddProduto: (negId: string, produtoId: string) => void;
  onRemoveProduto: (negId: string, itemId: string) => void;
  onUpdateVariacao: (negId: string, itemId: string, variacaoId: string) => void;
}) {
  const isExecutar = negociacao.tipo === "recorrente_executar";
  const categoriasGrupo = categoriasDoTipo(negociacao.tipo);
  const produtosDisponiveis = produtos.filter((p) =>
    categoriasGrupo.includes(p.categoria)
  );
  const valorParcela =
    (negociacao.num_parcelas || 1) > 0
      ? negociacao.valor_total / (negociacao.num_parcelas || 1)
      : 0;
  const valorMensal =
    isExecutar && negociacao.lt_meses > 0
      ? negociacao.valor_total / negociacao.lt_meses
      : 0;

  return (
    <Card
      className={cn(
        "border-2",
        isExecutar ? "border-executar/30" : "border-ter/30"
      )}
    >
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={isExecutar ? "executar" : "ter"}
              className="font-mono text-[10px]"
            >
              Negociação {String.fromCharCode(65 + idx)}
            </Badge>
            <span className="text-xs font-semibold text-foreground">
              {TIPO_NEGOCIACAO_LABEL[negociacao.tipo]}
            </span>
          </div>
          {podeRemover && (
            <button
              type="button"
              onClick={() => onRemove(negociacao.id)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Remover negociação"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Produtos da negociação */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Produtos *
          </Label>
          <SeletorProdutos
            produtos={produtosDisponiveis}
            jaSelecionados={negociacao.itens.map((it) => it.produto_id)}
            onSelecionar={(prodId) => onAddProduto(negociacao.id, prodId)}
            placeholder={
              isExecutar
                ? "Buscar produto Executar..."
                : "Buscar produto Saber/Ter/Destrava/Potencializar..."
            }
          />
          {negociacao.itens.length === 0 && (
            <p className="text-[11px] italic text-muted-foreground">
              Nenhum produto adicionado.
            </p>
          )}
          <ul className="space-y-1.5">
            {negociacao.itens.map((it) => {
              const prod = produtos.find((p) => p.id === it.produto_id);
              const variacoesAtivas = (prod?.variacoes ?? []).filter(
                (v) => v.ativo
              );
              return (
                <li
                  key={it.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs"
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
                      onValueChange={(v) =>
                        onUpdateVariacao(negociacao.id, it.id, v)
                      }
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
                  {erros[`neg_${idx}_item_${it.id}_variacao`] && (
                    <span className="text-[10px] text-destructive">
                      {erros[`neg_${idx}_item_${it.id}_variacao`]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveProduto(negociacao.id, it.id)}
                    className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remover produto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
          {erros[`neg_${idx}_itens`] && (
            <p className="text-[10px] text-destructive">
              {erros[`neg_${idx}_itens`]}
            </p>
          )}
        </div>

        {/* Valor + LT */}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {isExecutar
                ? "TCV (valor total do contrato) *"
                : "Valor total da negociação *"}
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                type="text"
                inputMode="decimal"
                value={formatMoedaBR(negociacao.valor_total)}
                onChange={(e) => {
                  const n = parseMoedaBR(e.target.value);
                  onUpdate(negociacao.id, {
                    valor_total: Number.isFinite(n) ? n : 0,
                  });
                }}
                className="h-9 pl-9 text-right tabular-nums"
                placeholder={isExecutar ? "60.000,00" : "0,00"}
              />
            </div>
            {erros[`neg_${idx}_valor`] && (
              <p className="text-[10px] text-destructive">
                {erros[`neg_${idx}_valor`]}
              </p>
            )}
          </div>
          {isExecutar && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tempo (meses) *
              </Label>
              <div className="flex h-9 gap-1 rounded-md border border-input bg-background p-0.5">
                {[6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onUpdate(negociacao.id, { lt_meses: m })}
                    className={cn(
                      "flex-1 rounded text-xs font-medium transition",
                      negociacao.lt_meses === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
              {erros[`neg_${idx}_lt`] && (
                <p className="text-[10px] text-destructive">
                  {erros[`neg_${idx}_lt`]}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Valor mensal calculado (só executar) */}
        {isExecutar && (
          <div className="rounded-md border border-dashed border-executar/50 bg-executar/5 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Valor mensal: </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(valorMensal)}
            </span>
            <span className="ml-2 text-muted-foreground">
              ({formatCurrency(negociacao.valor_total)} ÷ {negociacao.lt_meses})
            </span>
          </div>
        )}

        {/* Plano de pagamento */}
        <div className="rounded-md border border-border/60 bg-muted/30 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Plano de pagamento
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Início do pagamento
              </Label>
              <Input
                type="date"
                value={negociacao.data_inicio_pagamento || ""}
                onChange={(e) =>
                  onUpdate(negociacao.id, {
                    data_inicio_pagamento: e.target.value,
                  })
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Forma de pagamento *
              </Label>
              <Select
                value={negociacao.forma_pagamento || undefined}
                onValueChange={(v) =>
                  onUpdate(negociacao.id, {
                    forma_pagamento: v as FormaPagamento,
                  })
                }
              >
                <SelectTrigger className="h-9">
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
              {erros[`neg_${idx}_forma`] && (
                <p className="text-[10px] text-destructive">
                  {erros[`neg_${idx}_forma`]}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Nº de parcelas
              </Label>
              {isExecutar ? (
                <div className="flex h-9 items-center rounded-md border border-dashed border-border/60 bg-background px-3 text-xs text-muted-foreground">
                  {negociacao.lt_meses}× (mensal)
                </div>
              ) : (
                <Select
                  value={String(negociacao.num_parcelas || 1)}
                  onValueChange={(v) =>
                    onUpdate(negociacao.id, { num_parcelas: parseInt(v, 10) })
                  }
                >
                  <SelectTrigger className="h-9">
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
              {erros[`neg_${idx}_parcelas`] && (
                <p className="text-[10px] text-destructive">
                  {erros[`neg_${idx}_parcelas`]}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Valor da parcela
              </Label>
              <div className="flex h-9 items-center rounded-md border border-dashed border-border/60 bg-background px-3 text-xs">
                <span className="font-semibold tabular-nums">
                  {formatCurrency(isExecutar ? valorMensal : valorParcela)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Combobox simples: input de busca + dropdown filtrado. Ao escolher,
// chama onSelecionar. Esconde itens já selecionados.
function SeletorProdutos({
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
                      {TIPO_NEGOCIACAO_LABEL_CURTO[
                        p.categoria === "EXECUTAR"
                          ? "recorrente_executar"
                          : "one_time"
                      ]}
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

// ─────────────────────────────────────────────────────────────────────
// Step 3: Documentos
// ─────────────────────────────────────────────────────────────────────
function StepDocumentos({
  form,
  setField,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, valor: FormState[K]) => void;
}) {
  const links: { key: keyof FormState; label: string; placeholder: string }[] = [
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
      placeholder: "Link do drive ou assinatura",
    },
    {
      key: "transcricao_venda_url",
      label: "Transcrição — Reunião de Vendas",
      placeholder: "Link da gravação",
    },
    {
      key: "transcricao_qualificacao_url",
      label: "Transcrição — Reunião de Qualificação",
      placeholder: "Link da gravação",
    },
    {
      key: "transcricao_plano_voo_url",
      label: "Transcrição — Reunião de Plano de Vôo",
      placeholder: "Link da gravação",
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-potencializar" />
          <h2 className="text-lg font-bold text-foreground">Documentos e contexto</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Tudo opcional. Quanto mais preencher, mais rápido a operação começa.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
          {links.map((l) => (
            <div key={l.key} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {l.label}
              </Label>
              <Input
                type="url"
                value={(form[l.key] as string) ?? ""}
                onChange={(e) => setField(l.key, e.target.value as FormState[typeof l.key])}
                placeholder={l.placeholder}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 p-4">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Observações para a operação
          </Label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => setField("observacoes", e.target.value)}
            rows={4}
            placeholder="Contexto importante, expectativas do cliente, riscos identificados, etc."
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tela de sucesso
// ─────────────────────────────────────────────────────────────────────
function Sucesso({ codigos, onNovo }: { codigos: string[]; onNovo: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Handoff enviado!
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cliente cadastrado e {codigos.length} projeto(s) criado(s).
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {codigos.map((c) => (
              <Badge key={c} variant="outline" className="font-mono text-sm">
                {c}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            A operação vai assumir daqui e entrar em contato com você se precisar
            de algo.
          </p>
          <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={onNovo}>
              Enviar outro handoff
            </Button>
            <Button asChild>
              <Link to="/">Acessar sistema</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Suprime warning de unused
void useEffect;
