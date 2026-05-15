import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Building2,
  Briefcase,
  Link2,
  Loader2,
  Plus,
  Trash2,
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
  CategoriaV4,
  Cliente,
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
} from "@/types";
import { formatCurrency, suggestSigla, uid } from "@/lib/utils";
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

interface ItemVendido {
  id: string;
  categoria: CategoriaV4 | "";
  produto_id: string;
  variacao_id: string;
  projeto_nome: string;
  modelo_cobranca: "recorrente" | "one_time";
  valor_total: number;
  lt_meses: number;
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

  // Itens vendidos + datas comuns
  itens: ItemVendido[];
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

function itemVazio(): ItemVendido {
  return {
    id: uid("item_"),
    categoria: "",
    produto_id: "",
    variacao_id: "",
    projeto_nome: "",
    modelo_cobranca: "recorrente",
    valor_total: 0,
    lt_meses: 12,
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
    itens: [itemVazio()],
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
    if (!form.regiao_atuacao) e.regiao_atuacao = "Selecione";
    if (form.modelo_vendas.length === 0)
      e.modelo_vendas = "Selecione ao menos um";
    if (!siglaAuto) e.nome_fantasia = "Não conseguimos gerar sigla — verifique o nome";

    // Itens
    if (form.itens.length === 0) e.itens = "Adicione ao menos um item";
    form.itens.forEach((item, idx) => {
      if (!item.categoria) e[`item_${idx}_categoria`] = "Selecione";
      if (!item.produto_id) e[`item_${idx}_produto`] = "Selecione";
      const prod = produtos.find((p) => p.id === item.produto_id);
      const variacoes = (prod?.variacoes ?? []).filter((v) => v.ativo);
      if (variacoes.length > 0 && !item.variacao_id)
        e[`item_${idx}_variacao`] = "Selecione";
      if (item.valor_total <= 0) e[`item_${idx}_valor`] = "> 0";
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

  // ---------- Itens ----------
  function adicionarItem() {
    setField("itens", [...form.itens, itemVazio()]);
  }

  function removerItem(id: string) {
    if (form.itens.length === 1) return; // não deixa zerar
    setField("itens", form.itens.filter((i) => i.id !== id));
  }

  function atualizarItem(id: string, patch: Partial<ItemVendido>) {
    setField(
      "itens",
      form.itens.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
  }

  function escolherProdutoItem(itemId: string, produtoId: string) {
    const prod = produtos.find((p) => p.id === produtoId);
    atualizarItem(itemId, {
      produto_id: produtoId,
      variacao_id: "",
      modelo_cobranca: prod?.modelo_cobranca_padrao ?? "recorrente",
      valor_total: prod?.valor_sugerido ?? 0,
      projeto_nome: prod?.nome ?? "",
    });
  }

  function escolherVariacaoItem(itemId: string, variacaoId: string) {
    const item = form.itens.find((i) => i.id === itemId);
    const prod = produtos.find((p) => p.id === item?.produto_id);
    const variacao = prod?.variacoes.find((v) => v.id === variacaoId);
    atualizarItem(itemId, {
      variacao_id: variacaoId,
      valor_total: variacao?.valor_sugerido ?? item?.valor_total ?? 0,
    });
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
        regiao_atuacao: form.regiao_atuacao as RegiaoAtuacao,
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

      // Cria N projetos (um por item vendido). gerarCodigoProjeto incrementa
      // automaticamente baseado em quantos já existem para esse cliente.
      const codigos: string[] = [];
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

      for (let idx = 0; idx < form.itens.length; idx++) {
        const item = form.itens[idx];
        // codigo: como gerarCodigoProjeto lê do estado atual e ainda não
        // refletiu os criados nessa rodada, construímos manualmente.
        const seq = String(idx + 1).padStart(2, "0");
        const codigo = `${siglaAuto}-${seq}`;
        codigos.push(codigo);

        const projeto: Projeto = {
          id: uid("prj_"),
          codigo,
          cliente_id: clienteId,
          produto_id: item.produto_id,
          variacao_id: item.variacao_id || undefined,
          nome: item.projeto_nome.trim() || codigo,
          modelo_cobranca: item.modelo_cobranca,
          valor_total: item.valor_total,
          fase_atual: "inicio",
          data_assinatura: form.data_assinatura,
          data_inicio: form.data_assinatura,
          data_kickoff: form.data_kickoff || undefined,
          lt_meses: item.lt_meses || undefined,
          status: "ativo",
          saude_atual: "saudavel",
          links_rapidos: [],
          origem: "aquisicao",
          squad: [],
          ...linksDocs,
        };
        saveProjeto(projeto);
      }

      // Silencia gerarCodigoProjeto (não precisamos do retorno; usamos manual)
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

  const totalContrato = form.itens.reduce(
    (acc, i) => acc + (Number.isFinite(i.valor_total) ? i.valor_total : 0),
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

            {/* Coluna direita: itens vendidos + documentos */}
            <div className="space-y-4">
              <StepItens
                form={form}
                erros={erros}
                setField={setField}
                produtos={produtos}
                onUpdate={atualizarItem}
                onAdd={adicionarItem}
                onRemove={removerItem}
                onChangeProduto={escolherProdutoItem}
                onChangeVariacao={escolherVariacaoItem}
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
                onChange={(e) => setField("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
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
              <Label className="text-xs">Região *</Label>
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
              {erros.regiao_atuacao && (
                <p className="text-[11px] text-destructive">{erros.regiao_atuacao}</p>
              )}
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
// Step 2: Itens vendidos (N produtos)
// ─────────────────────────────────────────────────────────────────────
function StepItens({
  form,
  erros,
  setField,
  produtos,
  onUpdate,
  onAdd,
  onRemove,
  onChangeProduto,
  onChangeVariacao,
  totalContrato,
}: {
  form: FormState;
  erros: Record<string, string>;
  setField: <K extends keyof FormState>(key: K, valor: FormState[K]) => void;
  produtos: Produto[];
  onUpdate: (id: string, patch: Partial<ItemVendido>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChangeProduto: (itemId: string, produtoId: string) => void;
  onChangeVariacao: (itemId: string, variacaoId: string) => void;
  totalContrato: number;
}) {
  const produtosAtivos = produtos.filter((p) => p.ativo);
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-ter" />
          <h2 className="text-lg font-bold text-foreground">Itens vendidos</h2>
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
            Total: {formatCurrency(totalContrato)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada item vira um projeto na operação. Adicione quantos produtos
          fizerem parte do contrato.
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

      {/* Lista de itens */}
      <div className="space-y-2">
        {form.itens.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            idx={idx}
            produtos={produtosAtivos}
            erros={erros}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onChangeProduto={onChangeProduto}
            onChangeVariacao={onChangeVariacao}
            podeRemover={form.itens.length > 1}
          />
        ))}
      </div>

      <Button type="button" variant="outline" onClick={onAdd} className="w-full">
        <Plus className="h-4 w-4" />
        Adicionar outro produto / projeto
      </Button>

      {erros.itens && (
        <p className="text-xs text-destructive">{erros.itens}</p>
      )}
    </div>
  );
}

function ItemRow({
  item,
  idx,
  produtos,
  erros,
  onUpdate,
  onRemove,
  onChangeProduto,
  onChangeVariacao,
  podeRemover,
}: {
  item: ItemVendido;
  idx: number;
  produtos: Produto[];
  erros: Record<string, string>;
  onUpdate: (id: string, patch: Partial<ItemVendido>) => void;
  onRemove: (id: string) => void;
  onChangeProduto: (itemId: string, produtoId: string) => void;
  onChangeVariacao: (itemId: string, variacaoId: string) => void;
  podeRemover: boolean;
}) {
  // Filtro tolerante a desalinhamento de case entre o dado armazenado e
  // o valor do dropdown (defensivo, caso a sincronização antiga tenha
  // salvo categoria em lowercase).
  const produtosDaCategoria = produtos.filter(
    (p) =>
      item.categoria &&
      (p.categoria ?? "").toString().toUpperCase() ===
        item.categoria.toString().toUpperCase()
  );
  const produtoSelecionado = produtos.find((p) => p.id === item.produto_id);
  const variacoesAtivas = (produtoSelecionado?.variacoes ?? []).filter(
    (v) => v.ativo
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-[10px]">
            Item {idx + 1}
          </Badge>
          {podeRemover && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Remover item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Categoria *
            </Label>
            <Select
              value={item.categoria}
              onValueChange={(v) =>
                onUpdate(item.id, {
                  categoria: v as CategoriaV4,
                  produto_id: "",
                  variacao_id: "",
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SABER">Saber</SelectItem>
                <SelectItem value="TER">Ter</SelectItem>
                <SelectItem value="EXECUTAR">Executar</SelectItem>
                <SelectItem value="POTENCIALIZAR">Potencializar</SelectItem>
              </SelectContent>
            </Select>
            {erros[`item_${idx}_categoria`] && (
              <p className="text-[10px] text-destructive">
                {erros[`item_${idx}_categoria`]}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Produto *
            </Label>
            <Select
              value={item.produto_id}
              onValueChange={(v) => onChangeProduto(item.id, v)}
              disabled={!item.categoria}
            >
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={item.categoria ? "Selecione" : "Categoria primeiro"}
                />
              </SelectTrigger>
              <SelectContent>
                {produtosDaCategoria.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros[`item_${idx}_produto`] && (
              <p className="text-[10px] text-destructive">
                {erros[`item_${idx}_produto`]}
              </p>
            )}
          </div>
          {variacoesAtivas.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Variação *
              </Label>
              <Select
                value={item.variacao_id}
                onValueChange={(v) => onChangeVariacao(item.id, v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {variacoesAtivas.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros[`item_${idx}_variacao`] && (
                <p className="text-[10px] text-destructive">
                  {erros[`item_${idx}_variacao`]}
                </p>
              )}
            </div>
          ) : (
            <div />
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Nome do projeto (opcional)
            </Label>
            <Input
              value={item.projeto_nome}
              onChange={(e) => onUpdate(item.id, { projeto_nome: e.target.value })}
              placeholder={produtoSelecionado?.nome ?? "Ex: Mídia Q1 2026"}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Cobrança
            </Label>
            <Select
              value={item.modelo_cobranca}
              onValueChange={(v) =>
                onUpdate(item.id, {
                  modelo_cobranca: v as "recorrente" | "one_time",
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recorrente">Recorrente</SelectItem>
                <SelectItem value="one_time">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Valor {item.modelo_cobranca === "recorrente" ? "mês" : "total"} *
            </Label>
            <Input
              type="number"
              step="0.01"
              value={item.valor_total || ""}
              onChange={(e) =>
                onUpdate(item.id, { valor_total: Number(e.target.value) })
              }
              className="h-9"
            />
            {erros[`item_${idx}_valor`] && (
              <p className="text-[10px] text-destructive">
                {erros[`item_${idx}_valor`]}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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
