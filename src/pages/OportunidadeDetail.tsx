import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ExternalLink,
  RotateCcw,
  Save,
  Trash2,
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
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CATEGORIAS,
  type CategoriaV4,
  type EtapaOportunidade,
  ETAPA_OPORTUNIDADE_LABEL,
  ETAPAS_OPORTUNIDADE,
  type MotivoPerda,
  MOTIVOS_PERDA,
  type Oportunidade,
} from "@/types";

type SetField = <K extends keyof Oportunidade>(
  key: K,
  value: Oportunidade[K]
) => void;

export function OportunidadeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    oportunidades,
    clientes,
    produtos,
    investidores,
    projetos,
    auditoria,
    saveOportunidade,
    deleteOportunidade,
  } = useApp();

  const saved = oportunidades.find((o) => o.id === id);
  const [draft, setDraft] = useState<Oportunidade | null>(saved ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    () => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft]
  );

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/oportunidades")}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center">
            <p>Oportunidade não encontrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function voltar() {
    if (
      isDirty &&
      !window.confirm("Há alterações não salvas. Deseja sair sem salvar?")
    )
      return;
    navigate("/oportunidades");
  }

  function validar(d: Oportunidade): Record<string, string> {
    const e: Record<string, string> = {};
    if (!d.cliente_id) e.cliente_id = "Selecione um cliente";
    if (!d.produto_id) e.produto_id = "Selecione um produto";
    if (!d.nome.trim()) e.nome = "Obrigatório";
    if (d.valor_estimado <= 0) e.valor_estimado = "Valor maior que zero";
    if (d.etapa === "perdida" && !d.motivo_perda)
      e.motivo_perda = "Selecione o motivo da perda";
    return e;
  }

  function salvar() {
    if (!draft) return;
    const errs = validar(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    saveOportunidade(draft);
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
      `Excluir a oportunidade "${saved.nome}"?\n\nA exclusão é PERMANENTE.`
    );
    if (!ok) return;
    await deleteOportunidade(saved.id);
    navigate("/oportunidades");
  }

  const cliente = clientes.find((c) => c.id === draft.cliente_id);
  const produto = produtos.find((p) => p.id === draft.produto_id);
  const responsavel = investidores.find((i) => i.id === draft.responsavel_id);
  const categoria = CATEGORIAS.find((c) => c.value === produto?.categoria);
  const projetoOrigem = projetos.find((p) => p.id === draft.origem_projeto_id);
  const produtoSelecionadoCat = produto?.categoria;
  const produtosFiltrados = produtos.filter(
    (p) =>
      p.ativo &&
      (!produtoSelecionadoCat || p.categoria === produtoSelecionadoCat)
  );

  const projetosDoCliente = projetos.filter(
    (p) => p.cliente_id === draft.cliente_id && p.status === "ativo"
  );

  const auditoriaOpo = auditoria.filter((a) => a.entidade_id === draft.id);

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
          <ArrowLeft className="h-4 w-4" /> Oportunidades
        </Button>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ETAPA_OPORTUNIDADE_LABEL[draft.etapa]}</Badge>
              {categoria && (
                <Badge
                  variant={
                    categoria.value === "SABER"
                      ? "saber"
                      : categoria.value === "TER"
                      ? "ter"
                      : categoria.value === "EXECUTAR"
                      ? "executar"
                      : "potencializar"
                  }
                >
                  {categoria.label}
                </Badge>
              )}
            </div>
            <Input
              value={draft.nome}
              onChange={(e) => setField("nome", e.target.value)}
              placeholder="Nome da oportunidade"
              className="h-auto border-0 bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight text-foreground shadow-none focus-visible:ring-0"
            />
            {errors.nome && (
              <p className="text-xs text-destructive">{errors.nome}</p>
            )}
            {cliente && (
              <Link
                to={`/clientes/${cliente.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <Building2 className="h-4 w-4" />
                {cliente.sigla} · {cliente.nome_fantasia}
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </header>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-title-card">Dados da oportunidade</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" error={errors.cliente_id}>
            <Select
              value={draft.cliente_id || undefined}
              onValueChange={(v) => setField("cliente_id", v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clientes
                  .filter((c) => c.status !== "churn")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.sigla} · {c.nome_fantasia}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Responsável">
            <Select
              value={draft.responsavel_id || undefined}
              onValueChange={(v) => setField("responsavel_id", v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {investidores
                  .filter((i) => i.status === "ativo")
                  .map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Categoria V4">
            <div className="flex h-9 items-center">
              <Badge variant="outline">{categoria?.label ?? "—"}</Badge>
              <span className="ml-2 text-[11px] text-muted-foreground">
                vem do produto
              </span>
            </div>
          </Field>

          <Field label="Produto" error={errors.produto_id}>
            <Select
              value={draft.produto_id || undefined}
              onValueChange={(v) => setField("produto_id", v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {produtosFiltrados.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
                {produtosFiltrados.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum produto disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Modelo de cobrança">
            <Select
              value={draft.modelo_cobranca}
              onValueChange={(v) =>
                setField("modelo_cobranca", v as Oportunidade["modelo_cobranca"])
              }
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

          <Field label="Valor estimado (TCV)" error={errors.valor_estimado}>
            <Input
              type="number"
              step={0.01}
              min={0}
              value={draft.valor_estimado || ""}
              onChange={(e) =>
                setField("valor_estimado", parseFloat(e.target.value) || 0)
              }
              className="h-9 text-sm"
            />
          </Field>

          {draft.modelo_cobranca === "recorrente" && (
            <Field label="Prazo (meses)">
              <Select
                value={
                  draft.lt_meses === 6 || draft.lt_meses === 12
                    ? String(draft.lt_meses)
                    : undefined
                }
                onValueChange={(v) => setField("lt_meses", parseInt(v, 10))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="6 ou 12" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {projetosDoCliente.length > 0 && (
            <Field label="Projeto que originou (cross-sell)">
              <Select
                value={draft.origem_projeto_id || undefined}
                onValueChange={(v) =>
                  setField("origem_projeto_id", v || undefined)
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {projetosDoCliente.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} · {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projetoOrigem && (
                <Link
                  to={`/projetos/${projetoOrigem.id}`}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir projeto
                </Link>
              )}
            </Field>
          )}

          <Field label="Etapa">
            <Select
              value={draft.etapa}
              onValueChange={(v) => setField("etapa", v as EtapaOportunidade)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS_OPORTUNIDADE.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {draft.etapa === "perdida" && (
            <Field
              label="Motivo da perda"
              error={errors.motivo_perda}
              className="sm:col-span-2"
            >
              <Select
                value={draft.motivo_perda || undefined}
                onValueChange={(v) => setField("motivo_perda", v as MotivoPerda)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_PERDA.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Próxima ação" className="sm:col-span-2">
            <Input
              value={draft.proxima_acao ?? ""}
              onChange={(e) =>
                setField("proxima_acao", e.target.value || undefined)
              }
              placeholder="Ex.: Enviar proposta até 15/03"
              className="h-9 text-sm"
            />
          </Field>

          <Field label="Data da próxima ação">
            <Input
              type="date"
              value={draft.data_proxima_acao ?? ""}
              onChange={(e) =>
                setField("data_proxima_acao", e.target.value || undefined)
              }
              className="h-9 text-sm"
            />
          </Field>

          <Field label="Fechamento previsto">
            <Input
              type="date"
              value={draft.data_fechamento_prevista ?? ""}
              onChange={(e) =>
                setField("data_fechamento_prevista", e.target.value || undefined)
              }
              className="h-9 text-sm"
            />
          </Field>

          {(draft.etapa === "ganha" || draft.etapa === "perdida") && (
            <Field label="Data de fechamento real">
              <Input
                type="date"
                value={draft.data_fechamento_real ?? ""}
                onChange={(e) =>
                  setField("data_fechamento_real", e.target.value || undefined)
                }
                className="h-9 text-sm"
              />
            </Field>
          )}

          <Field label="Observações" className="sm:col-span-2">
            <Textarea
              value={draft.observacoes ?? ""}
              onChange={(e) =>
                setField("observacoes", e.target.value || undefined)
              }
              rows={3}
              className="text-sm"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Resumo financeiro derivado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-card">Resumo financeiro</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              TCV estimado
            </p>
            <p className="text-base font-bold tabular-nums">
              {formatCurrency(draft.valor_estimado)}
            </p>
          </div>
          {draft.modelo_cobranca === "recorrente" && draft.lt_meses && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Mensal (derivado)
              </p>
              <p className="text-base font-bold tabular-nums">
                {formatCurrency(draft.valor_estimado / draft.lt_meses)}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Responsável
            </p>
            <p className="text-base font-semibold">
              {responsavel?.nome ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-card">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoricoAuditoria
            registros={auditoriaOpo}
            titulo=""
            vazio="Nenhuma alteração registrada ainda."
            limiteInicial={6}
          />
        </CardContent>
      </Card>

      {/* Zona perigosa */}
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
                Excluir esta oportunidade
              </p>
              <p className="text-xs text-muted-foreground">
                Remove permanentemente o registro. Para apenas marcar como
                perdida, mude a etapa acima.
              </p>
            </div>
            <Button variant="destructive" onClick={excluir} className="shrink-0">
              <Trash2 className="h-4 w-4" />
              Excluir oportunidade
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
