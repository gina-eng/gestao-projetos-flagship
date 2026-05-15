import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Handshake,
  Lock,
  MessageCircle,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Target,
  Trash2,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { HistoricoAuditoria } from "@/components/HistoricoAuditoria";
import { formatCurrency, formatDate, uid } from "@/lib/utils";
import {
  CATEGORIAS,
  type CategoriaV4,
  type Cliente,
  FORMAS_PAGAMENTO,
  type FormaPagamento,
  FUNCOES_SQUAD,
  type FuncaoSquad,
  type Investidor,
  MOTIVOS_CHURN,
  type MotivoChurn,
  ORIGENS,
  type OrigemProjeto,
  type Produto,
  type Projeto,
  type ReuniaoProjeto,
  SAUDE_LABEL,
  type SaudeProjeto,
  SENTIMENTOS_REUNIAO,
  type SentimentoReuniao,
  type SquadMembro,
  STATUS_PROJETO_LABEL,
  type StatusProjeto,
  TIERS,
  TIPOS_REUNIAO,
  TIPO_REUNIAO_LABEL,
  type TipoReuniao,
} from "@/types";

// --------------------- Constantes visuais ---------------------

const saudeVariant: Record<SaudeProjeto, "saudavel" | "alerta" | "cuidado" | "critico"> = {
  saudavel: "saudavel",
  alerta: "alerta",
  cuidado: "cuidado",
  critico: "critico",
};

const SENTIMENTO_STYLE: Record<
  SentimentoReuniao,
  { dot: string; chip: string; barra: string }
> = {
  muito_positivo: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    barra: "bg-emerald-500",
  },
  positivo: {
    dot: "bg-emerald-400",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    barra: "bg-emerald-400",
  },
  neutro: {
    dot: "bg-slate-400",
    chip: "bg-slate-50 text-slate-700 ring-slate-200",
    barra: "bg-slate-400",
  },
  atencao: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 ring-amber-200",
    barra: "bg-amber-500",
  },
  negativo: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    barra: "bg-rose-500",
  },
};

type SetField = <K extends keyof Projeto>(key: K, value: Projeto[K]) => void;

// TCV (Total Contract Value) é o valor primário do projeto.
// - Em recorrente: o operador informa o TCV total do contrato (ex.: 120k).
//   valor_total (mensal) deriva como TCV / LT.
// - Em one-time: TCV = valor_total (mesmo número).
// Para retrocompatibilidade, deriva TCV quando não está explícito.
function tcvDoProjeto(p: Projeto): number {
  if (typeof p.valor_tcv === "number" && p.valor_tcv > 0) return p.valor_tcv;
  if (p.modelo_cobranca === "recorrente") {
    return p.valor_total * (p.lt_meses ?? 0);
  }
  return p.valor_total;
}

// Valor de cada parcela considerado no financeiro.
function valorParcela(p: Projeto): number {
  const total = tcvDoProjeto(p);
  const n = p.num_parcelas && p.num_parcelas > 0 ? p.num_parcelas : 1;
  return total / n;
}

// Opções fixas de LT para projetos recorrentes (definição comercial).
const LT_OPCOES_RECORRENTE = [6, 12] as const;

// --------------------- Página principal ---------------------

export function ProjetoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    projetos,
    clientes,
    investidores,
    produtos,
    pagamentos,
    fases,
    auditoria,
    saveProjeto,
    deleteProjeto,
  } = useApp();

  const saved = projetos.find((p) => p.id === id);

  // Rascunho: estado de edição inline. Toda mudança no formulário fica aqui
  // até o operador clicar em "Salvar alteração".
  const [draft, setDraft] = useState<Projeto | null>(saved ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mantém o rascunho em sincronia com o store. Se o operador acabou de
  // salvar (ou se outra aba alterou os dados), o draft é atualizado — mas só
  // quando não há diff pendente (para não sobrescrever digitação).
  useEffect(() => {
    if (!saved) {
      setDraft(null);
      return;
    }
    setDraft((current) => {
      if (!current || current.id !== saved.id) return saved;
      if (JSON.stringify(current) === JSON.stringify(saved)) return saved;
      return current;
    });
  }, [saved]);

  const isDirty = useMemo(
    () =>
      !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft]
  );

  // Aviso nativo do navegador antes de fechar a aba com alterações pendentes.
  useEffect(() => {
    if (!isDirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const setField: SetField = useCallback((key, value) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }, []);

  if (!saved || !draft) {
    return (
      <div className="spacing-section">
        <Button variant="outline" size="sm" onClick={() => navigate("/projetos")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center">
            <p>Projeto não encontrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function voltar() {
    if (isDirty && !window.confirm("Há alterações não salvas. Deseja sair sem salvar?")) {
      return;
    }
    navigate("/projetos");
  }

  function validar(d: Projeto): Record<string, string> {
    const e: Record<string, string> = {};
    if (!d.cliente_id) e.cliente_id = "Selecione um cliente";
    if (!d.produto_id) e.produto_id = "Selecione um produto";
    if (!d.nome.trim()) e.nome = "Obrigatório";
    // TCV é o valor base obrigatório. valor_total deriva dele.
    const tcvEfetivo = tcvDoProjeto(d);
    if (tcvEfetivo <= 0) e.valor_tcv = "Informe o TCV do projeto";
    if (d.modelo_cobranca === "recorrente") {
      if (!d.lt_meses || (d.lt_meses !== 6 && d.lt_meses !== 12)) {
        e.lt_meses = "Selecione 6 ou 12 meses";
      }
    }
    if (!d.data_assinatura) e.data_assinatura = "Obrigatório";
    if (!d.data_inicio) e.data_inicio = "Obrigatório";
    if (d.squad.length === 0) e.squad = "Adicione ao menos um investidor";
    if (d.status === "churn" && !d.motivo_churn) {
      e.motivo_churn = "Selecione o motivo do churn";
    }
    const prodSel = produtos.find((p) => p.id === d.produto_id);
    const variacoesAtivas = (prodSel?.variacoes ?? []).filter((v) => v.ativo);
    if (variacoesAtivas.length > 0 && !d.variacao_id) {
      e.variacao_id = "Selecione uma variação";
    }
    return e;
  }

  function salvar() {
    if (!draft) return;
    const errs = validar(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    saveProjeto(draft);
  }

  function descartar() {
    if (!saved) return;
    if (!window.confirm("Descartar todas as alterações?")) return;
    setDraft(saved);
    setErrors({});
  }

  async function excluir() {
    if (!saved) return;
    const ok = window.confirm(
      `Excluir o projeto "${saved.codigo} · ${saved.nome}"?\n\n` +
        "Isso remove o projeto, pagamentos, parcelas, reuniões e squad " +
        "vinculados. A operação é PERMANENTE e não pode ser desfeita.\n\n" +
        "Para apenas encerrar o projeto sem perder histórico, mude o " +
        "Status para 'Concluído' no card de Dados."
    );
    if (!ok) return;
    await deleteProjeto(saved.id);
    navigate("/projetos");
  }

  const cliente = clientes.find((c) => c.id === draft.cliente_id);
  const produto = produtos.find((p) => p.id === draft.produto_id);
  const categoria = CATEGORIAS.find((c) => c.value === produto?.categoria);
  const tier = TIERS.find((t) => t.value === cliente?.tier);
  const fase = fases.find((f) => f.id === draft.fase_atual);
  const pagamentosProjeto = pagamentos.filter((p) => p.projeto_id === draft.id);
  const parcelas = pagamentosProjeto.flatMap((p) => p.parcelas);
  const totalRecebido = parcelas
    .filter((p) => p.status === "pago")
    .reduce((a, p) => a + p.valor, 0);
  const totalPrevisto = parcelas
    .filter((p) => p.status === "previsto")
    .reduce((a, p) => a + p.valor, 0);
  const auditoriaProjeto = auditoria.filter(
    (a) =>
      (a.entidade === "projeto" && a.entidade_id === draft.id) ||
      a.pai_id === draft.id
  );
  const fasesOrdenadas = [...fases].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="spacing-section">
      <SaveBar
        isDirty={isDirty}
        onSave={salvar}
        onDescartar={descartar}
        errors={errors}
      />

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={voltar}
          className="mb-3 -ml-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Projetos
        </Button>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {draft.codigo}
              </span>
              <Badge
                variant={
                  categoria?.value === "SABER"
                    ? "saber"
                    : categoria?.value === "TER"
                    ? "ter"
                    : categoria?.value === "EXECUTAR"
                    ? "executar"
                    : "potencializar"
                }
              >
                {categoria?.label ?? "—"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {tier?.label ?? "—"}
              </Badge>
              <Badge variant={saudeVariant[draft.saude_atual]}>
                {SAUDE_LABEL[draft.saude_atual]}
              </Badge>
            </div>
            <div>
              <Input
                value={draft.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Nome do projeto"
                className="h-auto border-0 bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight text-foreground shadow-none focus-visible:ring-0"
              />
              {errors.nome && (
                <p className="text-xs text-destructive">{errors.nome}</p>
              )}
            </div>
            {cliente && (
              <Link
                to={`/clientes/${cliente.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <Building2 className="h-4 w-4" />
                {cliente.nome_fantasia}
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </header>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox
          icon={Activity}
          label="Fase atual"
          value={fase?.nome ?? "—"}
          tone="primary"
        />
        <StatBox
          icon={CalendarDays}
          label="Assinatura"
          value={formatDate(draft.data_assinatura)}
          tone="ter"
        />
        <StatBox
          icon={Wallet}
          label={draft.modelo_cobranca === "recorrente" ? "Valor mensal" : "Valor total"}
          value={formatCurrency(draft.valor_total)}
          tone="executar"
        />
        <StatBox
          icon={Briefcase}
          label="Squad"
          value={`${draft.squad.length} pessoa(s)`}
          tone="potencializar"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DadosProjetoCard
          draft={draft}
          setField={setField}
          setDraft={setDraft}
          clientes={clientes}
          produtos={produtos}
          fasesOrdenadas={fasesOrdenadas}
          tier={tier}
          errors={errors}
        />
        <SquadCard
          draft={draft}
          setField={setField}
          investidores={investidores}
          erro={errors.squad}
        />
      </div>

      <DocumentosCard draft={draft} setField={setField} />

      <ContextoInicialCard draft={draft} setField={setField} />

      <ReunioesCard draft={draft} setField={setField} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-title-card">Financeiro</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/financeiro">Detalhar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700">
                  Recebido
                </p>
                <p className="text-base font-bold tabular-nums text-emerald-700">
                  {formatCurrency(totalRecebido)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-amber-700">
                  Previsto
                </p>
                <p className="text-base font-bold tabular-nums text-amber-700">
                  {formatCurrency(totalPrevisto)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
                <p className="text-base font-bold tabular-nums">
                  {formatCurrency(totalRecebido + totalPrevisto)}
                </p>
              </div>
            </div>
            {pagamentosProjeto.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento cadastrado para este projeto.
              </p>
            ) : (
              <div className="space-y-1.5">
                {pagamentosProjeto.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {p.tipo} · {p.metodo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.num_parcelas}× · 1ª em{" "}
                        {formatDate(p.data_primeira_parcela)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(p.valor_total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title-card">Histórico de alterações</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoricoAuditoria
              registros={auditoriaProjeto}
              titulo=""
              vazio="Nenhuma alteração registrada ainda. Toda mudança no projeto, pagamentos e parcelas é gravada aqui."
              limiteInicial={6}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-title-card text-destructive">
            Zona perigosa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                Excluir este projeto
              </p>
              <p className="text-xs text-muted-foreground">
                Remove permanentemente o projeto, pagamentos, parcelas,
                reuniões e squad vinculados. Para apenas encerrar sem perder
                histórico, mude o Status para "Concluído" no card de Dados.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={excluir}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              Excluir projeto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------- Barra Salvar/Descartar ---------------------

function SaveBar({
  isDirty,
  onSave,
  onDescartar,
  errors,
}: {
  isDirty: boolean;
  onSave: () => void;
  onDescartar: () => void;
  errors: Record<string, string>;
}) {
  if (!isDirty) return null;
  const temErros = Object.keys(errors).length > 0;
  return (
    <div className="sticky top-[60px] z-40 -mx-4 border-y border-amber-200 bg-amber-50/95 px-4 py-2.5 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <p className="text-sm font-medium text-amber-900">
            {temErros
              ? "Não foi possível salvar — verifique os campos destacados."
              : "Você tem alterações não salvas."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDescartar}>
            <RotateCcw className="h-3.5 w-3.5" />
            Descartar
          </Button>
          <Button size="sm" onClick={onSave}>
            <Save className="h-3.5 w-3.5" />
            Salvar alteração
          </Button>
        </div>
      </div>
    </div>
  );
}

// --------------------- Stat Box ---------------------

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  tone: "primary" | "ter" | "executar" | "potencializar";
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    ter: "bg-ter/10 text-ter",
    executar: "bg-executar/10 text-executar",
    potencializar: "bg-potencializar/10 text-potencializar",
  };
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------- Dados do Projeto (editável inline) ---------------------

function DadosProjetoCard({
  draft,
  setField,
  setDraft,
  clientes,
  produtos,
  fasesOrdenadas,
  tier,
  errors,
}: {
  draft: Projeto;
  setField: SetField;
  setDraft: React.Dispatch<React.SetStateAction<Projeto | null>>;
  clientes: Cliente[];
  produtos: Produto[];
  fasesOrdenadas: { id: string; nome: string }[];
  tier: { value: string; label: string } | undefined;
  errors: Record<string, string>;
}) {
  const clientesAtivos = clientes.filter((c) => c.status !== "inativo");

  // Categoria selecionada — state local independente do produto. Inicializa
  // a partir do produto vinculado, mas persiste sozinha quando o produto é
  // limpo (para que o filtro de produtos continue funcionando).
  const produtoSelecionado = produtos.find((p) => p.id === draft.produto_id);
  const [categoriaSel, setCategoriaSel] = useState<CategoriaV4 | "">(
    produtoSelecionado?.categoria ?? ""
  );
  // Quando o projeto muda (ID diferente), ressincroniza.
  useEffect(() => {
    setCategoriaSel(produtoSelecionado?.categoria ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id]);

  // Cliente é protegido — trocar exige confirmação explícita.
  const [editandoCliente, setEditandoCliente] = useState(false);
  const clienteVinculado = clientes.find((c) => c.id === draft.cliente_id);

  const produtosFiltrados = produtos.filter(
    (p) => p.ativo && (!categoriaSel || p.categoria === categoriaSel)
  );
  const variacoesAtivas = (produtoSelecionado?.variacoes ?? []).filter(
    (v) => v.ativo
  );

  function handleCategoriaChange(novaCat: CategoriaV4) {
    setCategoriaSel(novaCat);
    // Se o produto atual não pertence à nova categoria, limpa produto/variação.
    if (draft.produto_id) {
      const prodAtual = produtos.find((p) => p.id === draft.produto_id);
      if (prodAtual && prodAtual.categoria !== novaCat) {
        setDraft((d) =>
          d ? { ...d, produto_id: "", variacao_id: undefined } : d
        );
      }
    }
  }

  function handleProdutoChange(produtoId: string) {
    setDraft((d) =>
      d ? { ...d, produto_id: produtoId, variacao_id: undefined } : d
    );
  }

  function pedirTrocaCliente() {
    const ok = window.confirm(
      "Trocar o cliente vinculado é uma operação séria — afeta histórico, " +
        "auditoria e códigos de projeto. Tem certeza que deseja prosseguir?"
    );
    if (ok) setEditandoCliente(true);
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-title-card">Dados do projeto</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {/* Cliente (protegido) */}
        <Field label="Cliente" error={errors.cliente_id}>
          {editandoCliente ? (
            <div className="flex items-center gap-2">
              <Select
                value={draft.cliente_id || undefined}
                onValueChange={(v) => {
                  setField("cliente_id", v);
                  setEditandoCliente(false);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditandoCliente(false)}
                title="Cancelar troca"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex h-9 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm">
              <span className="flex items-center gap-2 truncate text-foreground">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                {clienteVinculado ? (
                  <Link
                    to={`/clientes/${clienteVinculado.id}`}
                    className="truncate font-medium hover:text-primary"
                  >
                    {clienteVinculado.nome_fantasia}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Sem cliente</span>
                )}
              </span>
              <button
                type="button"
                onClick={pedirTrocaCliente}
                className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-primary"
              >
                Trocar…
              </button>
            </div>
          )}
        </Field>

        {/* Categoria */}
        <Field label="Categoria V4">
          <Select
            value={categoriaSel || undefined}
            onValueChange={(v) => handleCategoriaChange(v as CategoriaV4)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Produto */}
        <Field label="Produto" error={errors.produto_id}>
          <Select
            value={draft.produto_id || undefined}
            onValueChange={handleProdutoChange}
            disabled={!categoriaSel}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue
                placeholder={
                  categoriaSel
                    ? produtosFiltrados.length === 0
                      ? "Nenhum produto nesta categoria"
                      : "Selecione"
                    : "Defina a categoria primeiro"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {produtosFiltrados.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum produto ativo nesta categoria.
                </div>
              ) : (
                produtosFiltrados.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>

        {/* Variação */}
        {variacoesAtivas.length > 0 && (
          <Field label="Variação" error={errors.variacao_id}>
            <Select
              value={draft.variacao_id || undefined}
              onValueChange={(v) => setField("variacao_id", v || undefined)}
            >
              <SelectTrigger className="h-9 text-sm">
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
          </Field>
        )}

        {/* Modelo de cobrança — ao trocar, recompoe valor_total */}
        <Field label="Modelo de cobrança">
          <Select
            value={draft.modelo_cobranca}
            onValueChange={(v) => {
              const novo = v as Projeto["modelo_cobranca"];
              setDraft((d) => {
                if (!d) return d;
                let valorTotal = d.valor_total;
                if (novo === "recorrente" && d.valor_tcv && d.lt_meses) {
                  valorTotal = d.valor_tcv / d.lt_meses;
                } else if (novo === "one_time") {
                  valorTotal = d.valor_tcv ?? d.valor_total;
                }
                return { ...d, modelo_cobranca: novo, valor_total: valorTotal };
              });
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recorrente">Recorrente</SelectItem>
              <SelectItem value="one_time">One-time</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {/* TCV — campo PRIMÁRIO do valor. valor_total deriva dele. */}
        <Field
          label={
            draft.modelo_cobranca === "recorrente"
              ? "TCV (valor total do contrato)"
              : "Valor total do projeto"
          }
          error={errors.valor_tcv}
        >
          <Input
            type="number"
            min={0}
            step={0.01}
            value={(() => {
              if (typeof draft.valor_tcv === "number" && draft.valor_tcv > 0) {
                return draft.valor_tcv;
              }
              // Compat: mostra TCV derivado de dados antigos.
              const derivado =
                draft.modelo_cobranca === "recorrente"
                  ? draft.valor_total * (draft.lt_meses ?? 0)
                  : draft.valor_total;
              return derivado > 0 ? derivado : "";
            })()}
            onChange={(e) => {
              const v = e.target.value;
              const tcv = v === "" ? undefined : parseFloat(v) || 0;
              setDraft((d) => {
                if (!d) return d;
                let valorTotal = d.valor_total;
                if (d.modelo_cobranca === "recorrente") {
                  if (tcv && d.lt_meses && d.lt_meses > 0) {
                    valorTotal = tcv / d.lt_meses;
                  }
                } else {
                  valorTotal = tcv ?? 0;
                }
                return {
                  ...d,
                  valor_tcv: tcv && tcv > 0 ? tcv : undefined,
                  valor_total: valorTotal,
                };
              });
            }}
            placeholder="0,00"
            className="h-9 text-sm"
          />
        </Field>

        {/* LT — Select 6/12 para recorrente, escondido para one-time */}
        {draft.modelo_cobranca === "recorrente" && (
          <Field label="Prazo de vigência" error={errors.lt_meses}>
            <Select
              value={
                draft.lt_meses === 6 || draft.lt_meses === 12
                  ? String(draft.lt_meses)
                  : undefined
              }
              onValueChange={(v) => {
                const lt = parseInt(v, 10);
                setDraft((d) => {
                  if (!d) return d;
                  const valorTotal =
                    d.valor_tcv && d.valor_tcv > 0 && lt > 0
                      ? d.valor_tcv / lt
                      : d.valor_total;
                  return { ...d, lt_meses: lt, valor_total: valorTotal };
                });
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {LT_OPCOES_RECORRENTE.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Valor mensal (derivado) — só recorrente */}
        {draft.modelo_cobranca === "recorrente" && (
          <Field label="Valor mensal (derivado)">
            <div className="flex h-9 items-center justify-between rounded-md border border-dashed border-border/60 bg-muted/40 px-3 text-sm">
              <span className="font-semibold tabular-nums text-foreground">
                {tcvDoProjeto(draft) > 0 && draft.lt_meses
                  ? formatCurrency(tcvDoProjeto(draft) / draft.lt_meses)
                  : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                TCV ÷ {draft.lt_meses ?? "?"} meses
              </span>
            </div>
          </Field>
        )}

        {/* Forma de pagamento */}
        <Field label="Forma de pagamento">
          <Select
            value={draft.forma_pagamento ?? undefined}
            onValueChange={(v) =>
              setField("forma_pagamento", v as FormaPagamento)
            }
          >
            <SelectTrigger className="h-9 text-sm">
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
        </Field>

        {/* Nº de parcelas (1 a 12) */}
        <Field label="Nº de parcelas (até 12)">
          <Select
            value={String(draft.num_parcelas ?? 1)}
            onValueChange={(v) => setField("num_parcelas", parseInt(v, 10))}
          >
            <SelectTrigger className="h-9 text-sm">
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
        </Field>

        {/* Valor da parcela (derivado) — só aparece com TCV preenchido */}
        {tcvDoProjeto(draft) > 0 && (
          <Field label="Valor da parcela" className="sm:col-span-2">
            <div className="flex h-9 items-center justify-between rounded-md border border-dashed border-border/60 bg-muted/40 px-3 text-sm">
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(valorParcela(draft))}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {draft.num_parcelas ?? 1}× de{" "}
                {formatCurrency(tcvDoProjeto(draft))}
                {" — "}usado no financeiro
              </span>
            </div>
          </Field>
        )}

        {/* Tier (derivado) */}
        <Field label="Tier">
          <div className="flex h-9 items-center">
            <Badge variant="outline">{tier?.label ?? "—"}</Badge>
            <span className="ml-2 text-[11px] text-muted-foreground">
              vem do cliente
            </span>
          </div>
        </Field>

        {/* Fase atual */}
        <Field label="Fase atual">
          <Select
            value={draft.fase_atual}
            onValueChange={(v) => setField("fase_atual", v)}
          >
            <SelectTrigger className="h-9 text-sm">
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
        </Field>

        {/* Status */}
        <Field label="Status">
          <Select
            value={draft.status}
            onValueChange={(v) => setField("status", v as StatusProjeto)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_PROJETO_LABEL) as StatusProjeto[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_PROJETO_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Saúde */}
        <Field label="Saúde atual">
          <Select
            value={draft.saude_atual}
            onValueChange={(v) => setField("saude_atual", v as SaudeProjeto)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SAUDE_LABEL) as SaudeProjeto[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SAUDE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Origem */}
        <Field label="Origem">
          <Select
            value={draft.origem}
            onValueChange={(v) => setField("origem", v as OrigemProjeto)}
          >
            <SelectTrigger className="h-9 text-sm">
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
        </Field>

        {/* Conclusão prevista */}
        <Field label="Conclusão prevista">
          <Input
            type="date"
            value={draft.data_conclusao_prevista ?? ""}
            onChange={(e) =>
              setField("data_conclusao_prevista", e.target.value || undefined)
            }
            className="h-9 text-sm"
          />
        </Field>

        {/* Data de assinatura */}
        <Field label="Data de assinatura" error={errors.data_assinatura}>
          <Input
            type="date"
            value={draft.data_assinatura}
            onChange={(e) => setField("data_assinatura", e.target.value)}
            className="h-9 text-sm"
          />
        </Field>

        {/* Início da operação */}
        <Field label="Início da operação" error={errors.data_inicio}>
          <Input
            type="date"
            value={draft.data_inicio}
            onChange={(e) => setField("data_inicio", e.target.value)}
            className="h-9 text-sm"
          />
        </Field>

        {/* Data de kickoff */}
        <Field label="Data de kickoff">
          <Input
            type="date"
            value={draft.data_kickoff ?? ""}
            onChange={(e) =>
              setField("data_kickoff", e.target.value || undefined)
            }
            className="h-9 text-sm"
          />
        </Field>

        {/* Início do pagamento */}
        <Field label="Início do pagamento">
          <Input
            type="date"
            value={draft.data_inicio_pagamento ?? ""}
            onChange={(e) =>
              setField("data_inicio_pagamento", e.target.value || undefined)
            }
            className="h-9 text-sm"
          />
        </Field>

        {/* Motivo do churn */}
        {draft.status === "churn" && (
          <Field
            label="Motivo do churn"
            error={errors.motivo_churn}
            className="sm:col-span-2"
          >
            <Select
              value={draft.motivo_churn ?? undefined}
              onValueChange={(v) => setField("motivo_churn", v as MotivoChurn)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_CHURN.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Observações */}
        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            value={draft.observacoes ?? ""}
            onChange={(e) =>
              setField("observacoes", e.target.value || undefined)
            }
            rows={2}
            className="text-sm"
            placeholder="Notas internas, contexto, próximos passos..."
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// --------------------- Squad (inline) ---------------------

function SquadCard({
  draft,
  setField,
  investidores,
  erro,
}: {
  draft: Projeto;
  setField: SetField;
  investidores: Investidor[];
  erro?: string;
}) {
  const [novoInv, setNovoInv] = useState("");
  const [novaFuncao, setNovaFuncao] = useState<FuncaoSquad>("analista");

  const disponiveis = investidores.filter(
    (i) =>
      i.status === "ativo" &&
      !draft.squad.find((s) => s.investidor_id === i.id)
  );

  function adicionar() {
    if (!novoInv) return;
    const novo: SquadMembro = {
      id: uid("sqm_"),
      investidor_id: novoInv,
      funcao: novaFuncao,
      data_entrada: new Date().toISOString().slice(0, 10),
      principal: draft.squad.length === 0,
    };
    setField("squad", [...draft.squad, novo]);
    setNovoInv("");
  }

  function remover(id: string) {
    const nova = draft.squad.filter((s) => s.id !== id);
    // Se o principal foi removido, promove o primeiro restante.
    if (nova.length > 0 && !nova.find((s) => s.principal)) {
      nova[0] = { ...nova[0], principal: true };
    }
    setField("squad", nova);
  }

  function tornarPrincipal(id: string) {
    setField(
      "squad",
      draft.squad.map((s) => ({ ...s, principal: s.id === id }))
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-title-card">Squad</CardTitle>
        <Badge variant="outline" className="text-[10px]">
          {draft.squad.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.squad.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
            Sem squad alocado.
          </p>
        ) : (
          <div className="space-y-2">
            {draft.squad.map((s) => {
              const inv = investidores.find((i) => i.id === s.investidor_id);
              if (!inv) return null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-card p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {inv.nome
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {inv.nome}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {FUNCOES_SQUAD.find((f) => f.value === s.funcao)?.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.principal ? (
                      <Badge variant="default" className="text-[10px]">
                        <Star className="mr-1 h-3 w-3" />
                        Principal
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => tornarPrincipal(s.id)}
                        className="rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                        title="Tornar principal"
                      >
                        Tornar principal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remover(s.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remover do squad"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-2 rounded-md border border-border/60 bg-muted/30 p-2.5 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={novoInv || undefined} onValueChange={setNovoInv}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Investidor" />
            </SelectTrigger>
            <SelectContent>
              {disponiveis.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum disponível
                </div>
              ) : (
                disponiveis.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select
            value={novaFuncao}
            onValueChange={(v) => setNovaFuncao(v as FuncaoSquad)}
          >
            <SelectTrigger className="h-8 text-sm">
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
            onClick={adicionar}
            disabled={!novoInv}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  );
}

// --------------------- Documentos (links editáveis inline) ---------------------

function DocumentosCard({
  draft,
  setField,
}: {
  draft: Projeto;
  setField: SetField;
}) {
  const links: {
    key: keyof Projeto;
    label: string;
    placeholder: string;
    icon: typeof FileText;
    color: string;
  }[] = [
    {
      key: "oportunidade_crm_url",
      label: "Oportunidade no CRM",
      placeholder: "https://crm.exemplo.com/oportunidades/123",
      icon: Target,
      color: "bg-ter/10 text-ter",
    },
    {
      key: "whatsapp_grupo_url",
      label: "Grupo do WhatsApp",
      placeholder: "https://chat.whatsapp.com/...",
      icon: MessageCircle,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "contrato_url",
      label: "Contrato",
      placeholder: "Link do drive ou plataforma de assinatura",
      icon: FileText,
      color: "bg-primary/10 text-primary",
    },
    {
      key: "transcricao_venda_url",
      label: "Reunião de Vendas",
      placeholder: "Link da gravação ou transcrição",
      icon: Video,
      color: "bg-saber/10 text-saber",
    },
    {
      key: "transcricao_qualificacao_url",
      label: "Reunião de Qualificação",
      placeholder: "Link da gravação ou transcrição",
      icon: Video,
      color: "bg-executar/10 text-executar",
    },
    {
      key: "transcricao_plano_voo_url",
      label: "Reunião de Plano de Vôo",
      placeholder: "Link da gravação ou transcrição",
      icon: Video,
      color: "bg-potencializar/10 text-potencializar",
    },
  ];

  const preenchidos = links.filter((l) => {
    const v = (draft[l.key] as string | undefined) ?? "";
    return v.trim().length > 0;
  }).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-title-card">Documentos do projeto</CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {preenchidos} de {links.length} preenchidos
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => {
            const valor = (draft[l.key] as string | undefined) ?? "";
            return (
              <div
                key={l.key}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-card p-2.5"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${l.color}`}
                >
                  <l.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {l.label}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="url"
                      value={valor}
                      onChange={(e) =>
                        setField(
                          l.key,
                          (e.target.value || undefined) as Projeto[typeof l.key]
                        )
                      }
                      placeholder={l.placeholder}
                      className="h-8 text-xs"
                    />
                    {valor && (
                      <a
                        href={valor}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                      >
                        Abrir
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------- Contexto inicial (sempre editável) ---------------------

function ContextoInicialCard({
  draft,
  setField,
}: {
  draft: Projeto;
  setField: SetField;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ter/10 text-ter">
          <Handshake className="h-4 w-4" />
        </div>
        <div>
          <CardTitle className="text-title-card">
            Contexto inicial · Passagem de bastão
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Briefing do comercial para a operação começar com contexto.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={draft.contexto_inicial ?? ""}
          onChange={(e) =>
            setField("contexto_inicial", e.target.value || undefined)
          }
          rows={6}
          className="resize-y bg-background"
          placeholder="Cole aqui o briefing do handoff comercial gerado pela IA: dores do cliente, promessas feitas, decisores, expectativas e restrições."
        />
      </CardContent>
    </Card>
  );
}

// --------------------- Reuniões ---------------------

function ReunioesCard({
  draft,
  setField,
}: {
  draft: Projeto;
  setField: SetField;
}) {
  const reunioes = draft.reunioes ?? [];
  const ordenadas = [...reunioes].sort((a, b) =>
    a.data < b.data ? 1 : a.data > b.data ? -1 : 0
  );
  const tendencia = ordenadas.slice(0, 3);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function persistir(nova: ReuniaoProjeto[]) {
    setField("reunioes", nova);
  }

  function atualizar(id: string, patch: Partial<ReuniaoProjeto>) {
    persistir(reunioes.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function adicionar() {
    const nova: ReuniaoProjeto = {
      id: uid("reu_"),
      data: new Date().toISOString().slice(0, 10),
      titulo: "",
      tipo: "alinhamento",
      sentimento: "neutro",
    };
    persistir([nova, ...reunioes]);
    setEditingId(nova.id);
  }

  function remover(id: string) {
    if (!window.confirm("Remover essa reunião?")) return;
    persistir(reunioes.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
    if (expandedId === id) setExpandedId(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-saber/10 text-saber">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-title-card">
              Reuniões e sentimento do cliente
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {reunioes.length === 0
                ? "Selecione o tipo, cole o link da transcrição e o resumo da IA."
                : `${reunioes.length} reunião(ões) registrada(s).`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tendencia.length > 0 && <TendenciaSentimento reunioes={tendencia} />}
          <Button size="sm" onClick={adicionar}>
            <Plus className="h-3.5 w-3.5" />
            Nova reunião
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {ordenadas.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma reunião registrada ainda.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Clique em "Nova reunião" para adicionar a primeira.
            </p>
          </div>
        ) : (
          <ol className="relative space-y-3 border-l border-border/70 pl-5">
            {ordenadas.map((r) =>
              editingId === r.id ? (
                <ReuniaoInlineEditor
                  key={r.id}
                  reuniao={r}
                  onPatch={(patch) => atualizar(r.id, patch)}
                  onClose={() => setEditingId(null)}
                  onRemove={() => remover(r.id)}
                />
              ) : (
                <ReuniaoItemView
                  key={r.id}
                  reuniao={r}
                  expanded={expandedId === r.id}
                  onToggleExpand={() =>
                    setExpandedId((cur) => (cur === r.id ? null : r.id))
                  }
                  onEdit={() => setEditingId(r.id)}
                  onRemove={() => remover(r.id)}
                  onPatch={(patch) => atualizar(r.id, patch)}
                />
              )
            )}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function TendenciaSentimento({ reunioes }: { reunioes: ReuniaoProjeto[] }) {
  const ordem = [...reunioes].reverse();
  return (
    <div
      className="flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1"
      title="Tendência das últimas reuniões"
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Tendência
      </span>
      <div className="flex items-center gap-0.5">
        {ordem.map((r) => (
          <span
            key={r.id}
            className={`h-3 w-1.5 rounded-sm ${SENTIMENTO_STYLE[r.sentimento].barra}`}
          />
        ))}
      </div>
    </div>
  );
}

function ReuniaoItemView({
  reuniao,
  expanded,
  onToggleExpand,
  onEdit,
  onRemove,
  onPatch,
}: {
  reuniao: ReuniaoProjeto;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<ReuniaoProjeto>) => void;
}) {
  const style = SENTIMENTO_STYLE[reuniao.sentimento];
  const sentimentoCfg = SENTIMENTOS_REUNIAO.find(
    (s) => s.value === reuniao.sentimento
  );

  return (
    <li className="relative">
      <span
        className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${style.dot}`}
      />
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {formatDate(reuniao.data)}
            </p>
            <Badge variant="outline" className="text-[10px]">
              {TIPO_REUNIAO_LABEL[reuniao.tipo]}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {reuniao.transcricao_url && (
              <a
                href={reuniao.transcricao_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                <FileText className="h-3 w-3" />
                Transcrição
              </a>
            )}
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              <Sparkles className="h-3 w-3" />
              {expanded ? "Ocultar resumo" : "Ver resumo da Reunião"}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              title="Editar reunião"
            >
              <FileText className="h-3 w-3" />
              Editar
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Remover reunião"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Resumo da Reunião
              </Label>
              <Textarea
                value={reuniao.resumo ?? ""}
                onChange={(e) =>
                  onPatch({ resumo: e.target.value || undefined })
                }
                rows={4}
                className="bg-background text-sm"
                placeholder="Cole aqui o resumo gerado pela IA a partir da transcrição."
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Próximos Passos
              </Label>
              <Textarea
                value={reuniao.proximos_passos ?? ""}
                onChange={(e) =>
                  onPatch({ proximos_passos: e.target.value || undefined })
                }
                rows={2}
                className="bg-background text-sm"
                placeholder="Combinados, responsáveis, prazos..."
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Sentimento
              </Label>
              <Select
                value={reuniao.sentimento}
                onValueChange={(v) =>
                  onPatch({ sentimento: v as SentimentoReuniao })
                }
              >
                <SelectTrigger className="h-8 bg-background text-sm">
                  <SelectValue>
                    {sentimentoCfg && (
                      <span className="inline-flex items-center gap-1">
                        <span>{sentimentoCfg.emoji}</span>
                        <span>{sentimentoCfg.label}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SENTIMENTOS_REUNIAO.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="inline-flex items-center gap-2">
                        <span>{s.emoji}</span>
                        <span>{s.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={onToggleExpand}>
                <X className="h-3.5 w-3.5" />
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function ReuniaoInlineEditor({
  reuniao,
  onPatch,
  onClose,
  onRemove,
}: {
  reuniao: ReuniaoProjeto;
  onPatch: (patch: Partial<ReuniaoProjeto>) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
      <div className="space-y-3 rounded-lg border border-primary/40 bg-card p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[auto_minmax(140px,180px)_1fr]">
          <div className="space-y-0.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Data
            </Label>
            <Input
              type="date"
              value={reuniao.data}
              onChange={(e) => onPatch({ data: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Tipo
            </Label>
            <Select
              value={reuniao.tipo}
              onValueChange={(v) => onPatch({ tipo: v as TipoReuniao })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_REUNIAO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Link da transcrição
            </Label>
            <Input
              type="url"
              value={reuniao.transcricao_url ?? ""}
              onChange={(e) =>
                onPatch({ transcricao_url: e.target.value || undefined })
              }
              placeholder="https://..."
              className="h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Fechar
          </Button>
        </div>
      </div>
    </li>
  );
}
