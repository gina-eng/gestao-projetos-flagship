import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  MailOpen,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Users,
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
import { formatCurrency, formatDate, nomeProduto, uid } from "@/lib/utils";
import {
  CATEGORIAS,
  type Cliente,
  type ContatoCliente,
  MODELOS_VENDAS,
  type ModeloVendas,
  MOTIVOS_CHURN,
  type MotivoChurn,
  type RegiaoAtuacao,
  REGIOES_ATUACAO,
  SAUDE_LABEL,
  type SaudeProjeto,
  type Segmento,
  SEGMENTOS,
  STATUS_CLIENTE_LABEL,
  type StatusCliente,
  type Tier,
  TIERS,
} from "@/types";

const saudeVariant: Record<SaudeProjeto, "saudavel" | "alerta" | "cuidado" | "critico"> = {
  saudavel: "saudavel",
  alerta: "alerta",
  cuidado: "cuidado",
  critico: "critico",
};

type SetField = <K extends keyof Cliente>(key: K, value: Cliente[K]) => void;

export function ClienteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clientes, projetos, produtos, fases, auditoria, saveCliente } = useApp();

  const saved = clientes.find((c) => c.id === id);
  const [draft, setDraft] = useState<Cliente | null>(saved ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sincroniza o rascunho com o store enquanto não há alterações pendentes.
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

  // Aviso nativo antes de fechar a aba com alterações pendentes.
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
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [key]: value };
      // Quando o status vira "churn", registra a data automaticamente.
      // Se sair de churn, limpa data_churn e motivo.
      if (key === "status") {
        if (value === "churn" && !next.data_churn) {
          next.data_churn = new Date().toISOString().slice(0, 10);
        } else if (value !== "churn") {
          next.data_churn = undefined;
          next.motivo_churn = undefined;
        }
      }
      return next;
    });
  }, []);

  const siglasOcupadas = useMemo(
    () =>
      new Set(
        clientes
          .filter((c) => c.id !== draft?.id)
          .map((c) => c.sigla.toUpperCase())
      ),
    [clientes, draft?.id]
  );

  if (!saved || !draft) {
    return (
      <div className="spacing-section">
        <Button variant="outline" size="sm" onClick={() => navigate("/clientes")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center">
            <p>Cliente não encontrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function voltar() {
    if (isDirty && !window.confirm("Há alterações não salvas. Deseja sair sem salvar?")) {
      return;
    }
    navigate("/clientes");
  }

  function validar(d: Cliente): Record<string, string> {
    const e: Record<string, string> = {};
    if (!d.nome_fantasia.trim()) e.nome_fantasia = "Obrigatório";
    if (!d.razao_social.trim()) e.razao_social = "Obrigatório";
    if (!d.sigla.trim()) e.sigla = "Obrigatório";
    if (d.sigla && (d.sigla.length < 3 || d.sigla.length > 6))
      e.sigla = "Entre 3 e 6 caracteres";
    if (d.sigla && !/^[A-Z0-9]+$/.test(d.sigla))
      e.sigla = "Apenas letras/números maiúsculos";
    if (d.sigla && siglasOcupadas.has(d.sigla.toUpperCase()))
      e.sigla = "Sigla já utilizada";
    if (d.modelo_vendas.length === 0) e.modelo_vendas = "Selecione ao menos um";
    if (!d.segmento) e.segmento = "Selecione um segmento";
    if (d.segmento === "outros" && !d.segmento_outro?.trim())
      e.segmento_outro = "Descreva o segmento";
    if (!d.regiao_atuacao) e.regiao_atuacao = "Selecione uma região";
    if (d.status === "churn" && !d.motivo_churn)
      e.motivo_churn = "Selecione o motivo do churn";
    return e;
  }

  function salvar() {
    if (!draft) return;
    const errs = validar(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    saveCliente({ ...draft, sigla: draft.sigla.toUpperCase() });
  }

  function descartar() {
    if (!saved) return;
    if (!window.confirm("Descartar todas as alterações?")) return;
    setDraft(saved);
    setErrors({});
  }

  const projetosCliente = projetos.filter((p) => p.cliente_id === draft.id);
  const auditoriaCliente = auditoria.filter(
    (a) => a.entidade === "cliente" && a.entidade_id === draft.id
  );

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
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Button>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono uppercase">
                {draft.sigla || "—"}
              </Badge>
              <Badge
                variant={
                  draft.status === "ativo"
                    ? "saudavel"
                    : draft.status === "churn"
                    ? "critico"
                    : draft.status === "em_fechamento"
                    ? "alerta"
                    : "secondary"
                }
              >
                {STATUS_CLIENTE_LABEL[draft.status]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {TIERS.find((t) => t.value === draft.tier)?.label}
              </Badge>
            </div>
            <div>
              <Input
                value={draft.nome_fantasia}
                onChange={(e) => setField("nome_fantasia", e.target.value)}
                placeholder="Nome fantasia"
                className="h-auto border-0 bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight text-foreground shadow-none focus-visible:ring-0"
              />
              {errors.nome_fantasia && (
                <p className="text-xs text-destructive">{errors.nome_fantasia}</p>
              )}
            </div>
            <Input
              value={draft.razao_social}
              onChange={(e) => setField("razao_social", e.target.value)}
              placeholder="Razão social"
              className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
            />
            {errors.razao_social && (
              <p className="text-xs text-destructive">{errors.razao_social}</p>
            )}
          </div>
          <Button asChild>
            <Link to={`/projetos?cliente=${draft.id}`}>
              <Plus className="h-4 w-4" />
              Novo projeto
            </Link>
          </Button>
        </header>
      </div>

      <DadosClienteCard
        draft={draft}
        setField={setField}
        errors={errors}
        siglasOcupadas={siglasOcupadas}
      />

      <StakeholdersCard
        contatos={draft.contatos}
        onChange={(novos) => setField("contatos", novos)}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-title-card">
            Projetos · {projetosCliente.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projetosCliente.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum projeto cadastrado para este cliente.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link to={`/projetos?cliente=${draft.id}`}>
                  <Plus className="h-4 w-4" />
                  Criar projeto
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {projetosCliente.map((p) => {
                const produto = produtos.find((pr) => pr.id === p.produto_id);
                return (
                  <Link
                    key={p.id}
                    to={`/projetos/${p.id}`}
                    className="flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {produto && (
                        <Badge
                          variant={
                            produto.categoria === "SABER"
                              ? "saber"
                              : produto.categoria === "TER"
                              ? "ter"
                              : produto.categoria === "EXECUTAR"
                              ? "executar"
                              : "potencializar"
                          }
                        >
                          {CATEGORIAS.find((c) => c.value === produto.categoria)?.label}
                        </Badge>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {p.codigo} · {p.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {nomeProduto({ produto, variacao_id: p.variacao_id })} ·{" "}
                          {fases.find((f) => f.id === p.fase_atual)?.nome ?? "—"} ·{" "}
                          {formatCurrency(p.valor_total)}
                          {p.modelo_cobranca === "recorrente" && "/mês"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={saudeVariant[p.saude_atual]}>
                        {SAUDE_LABEL[p.saude_atual]}
                      </Badge>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
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
            registros={auditoriaCliente}
            titulo=""
            vazio="Nenhuma alteração registrada ainda."
            limiteInicial={6}
          />
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

// --------------------- Dados do cliente (editável inline) ---------------------

function DadosClienteCard({
  draft,
  setField,
  errors,
  siglasOcupadas,
}: {
  draft: Cliente;
  setField: SetField;
  errors: Record<string, string>;
  siglasOcupadas: Set<string>;
}) {
  function toggleModeloVendas(m: ModeloVendas) {
    const has = draft.modelo_vendas.includes(m);
    setField(
      "modelo_vendas",
      has ? draft.modelo_vendas.filter((x) => x !== m) : [...draft.modelo_vendas, m]
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title-card">Dados do cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sigla (ticker)" error={errors.sigla}>
            <Input
              value={draft.sigla}
              maxLength={6}
              onChange={(e) =>
                setField("sigla", e.target.value.toUpperCase() as Cliente["sigla"])
              }
              placeholder="Ex: CRJM"
              className="h-9 text-sm"
            />
            {!errors.sigla && (
              <p className="text-[11px] text-muted-foreground">3 a 6 caracteres, A-Z/0-9.</p>
            )}
          </Field>
          <Field label="CNPJ">
            <Input
              value={draft.cnpj ?? ""}
              onChange={(e) => setField("cnpj", e.target.value || undefined)}
              placeholder="00.000.000/0000-00"
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onValueChange={(v) => setField("status", v as StatusCliente)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_fechamento">Em fechamento</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="churn">Churn</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Segmento" error={errors.segmento}>
            <Select
              value={draft.segmento ?? undefined}
              onValueChange={(v) => {
                setField("segmento", v as Segmento);
                if (v !== "outros") setField("segmento_outro", undefined);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
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
          </Field>
          <Field label="Nicho">
            <Input
              value={draft.nicho ?? ""}
              onChange={(e) => setField("nicho", e.target.value || undefined)}
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Região de atuação" error={errors.regiao_atuacao}>
            <Select
              value={draft.regiao_atuacao ?? undefined}
              onValueChange={(v) => setField("regiao_atuacao", v as RegiaoAtuacao)}
            >
              <SelectTrigger className="h-9 text-sm">
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
          </Field>
          <Field label="Tier">
            <Select
              value={draft.tier}
              onValueChange={(v) => setField("tier", v as Tier)}
            >
              <SelectTrigger className="h-9 text-sm">
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
          </Field>
        </div>

        {draft.segmento === "outros" && (
          <Field label="Descreva o segmento" error={errors.segmento_outro}>
            <Input
              value={draft.segmento_outro ?? ""}
              onChange={(e) =>
                setField("segmento_outro", e.target.value || undefined)
              }
              placeholder="Ex: Agronegócio, Energia, etc."
              className="h-9 text-sm"
            />
          </Field>
        )}

        {draft.status === "churn" && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <Field label="Motivo do churn" error={errors.motivo_churn}>
              <Select
                value={draft.motivo_churn ?? undefined}
                onValueChange={(v) => setField("motivo_churn", v as MotivoChurn)}
              >
                <SelectTrigger className="h-9 text-sm">
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
            </Field>
            {draft.data_churn && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Data do churn: {formatDate(draft.data_churn)}
              </p>
            )}
          </div>
        )}

        <Field label="Modelo de vendas" error={errors.modelo_vendas}>
          <div className="flex flex-wrap gap-2">
            {MODELOS_VENDAS.map((m) => {
              const active = draft.modelo_vendas.includes(m.value);
              return (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => toggleModeloVendas(m.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_180px_90px]">
          <Field label="Endereço">
            <Input
              value={draft.endereco ?? ""}
              onChange={(e) => setField("endereco", e.target.value || undefined)}
              placeholder="Rua, número, complemento"
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Cidade">
            <Input
              value={draft.cidade ?? ""}
              onChange={(e) => setField("cidade", e.target.value || undefined)}
              placeholder="Ex: São Paulo"
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Estado">
            <Input
              value={draft.estado ?? ""}
              onChange={(e) =>
                setField(
                  "estado",
                  e.target.value.toUpperCase().slice(0, 2) || undefined
                )
              }
              placeholder="UF"
              maxLength={2}
              className="h-9 text-sm"
            />
          </Field>
        </div>

        <Field label="Cadastrado em">
          <p className="text-sm text-foreground">{formatDate(draft.data_cadastro)}</p>
        </Field>

        <Field label="Observações">
          <Textarea
            value={draft.observacoes ?? ""}
            onChange={(e) => setField("observacoes", e.target.value || undefined)}
            rows={3}
            className="text-sm"
            placeholder="Notas internas, particularidades, contexto..."
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

// --------------------- Stakeholders (inline) ---------------------

function StakeholdersCard({
  contatos,
  onChange,
}: {
  contatos: ContatoCliente[];
  onChange: (novos: ContatoCliente[]) => void;
}) {
  function adicionar() {
    onChange([...contatos, { id: uid("ct_"), nome: "" }]);
  }

  function atualizar(id: string, patch: Partial<ContatoCliente>) {
    onChange(contatos.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remover(id: string) {
    if (!window.confirm("Remover esse contato?")) return;
    onChange(contatos.filter((c) => c.id !== id));
  }

  const comContexto = contatos.filter((c) => c.contexto && c.contexto.trim()).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-title-card">Stakeholders</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {contatos.length === 0
                ? "Cadastre as pessoas-chave do cliente e mapeie o perfil delas em texto."
                : `${contatos.length} pessoa(s) · ${comContexto} com contexto mapeado.`}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={adicionar}>
          <Plus className="h-3.5 w-3.5" />
          Novo stakeholder
        </Button>
      </CardHeader>
      <CardContent>
        {contatos.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Nenhum stakeholder cadastrado.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {contatos.map((c) => (
              <StakeholderItem
                key={c.id}
                contato={c}
                onPatch={(patch) => atualizar(c.id, patch)}
                onRemove={() => remover(c.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StakeholderItem({
  contato,
  onPatch,
  onRemove,
}: {
  contato: ContatoCliente;
  onPatch: (patch: Partial<ContatoCliente>) => void;
  onRemove: () => void;
}) {
  const iniciais =
    contato.nome
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {iniciais}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Input
              value={contato.nome}
              onChange={(e) => onPatch({ nome: e.target.value })}
              placeholder="Nome"
              className="h-8 text-sm"
            />
            <Input
              value={contato.cargo ?? ""}
              onChange={(e) =>
                onPatch({ cargo: e.target.value || undefined })
              }
              placeholder="Cargo"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="relative">
              <MailOpen className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={contato.email ?? ""}
                onChange={(e) =>
                  onPatch({ email: e.target.value || undefined })
                }
                placeholder="E-mail"
                className="h-8 pl-7 text-sm"
              />
            </div>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={contato.telefone ?? ""}
                onChange={(e) =>
                  onPatch({ telefone: e.target.value || undefined })
                }
                placeholder="Telefone"
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="self-start rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Remover stakeholder"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded-md border border-border/40 bg-muted/30 p-2">
        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Contexto
        </Label>
        <Textarea
          value={contato.contexto ?? ""}
          onChange={(e) =>
            onPatch({ contexto: e.target.value || undefined })
          }
          rows={3}
          placeholder="Mapeie o perfil da pessoa: papel na decisão, jeitão, dores, motivações, como abordar. Use insights das reuniões."
          className="mt-1 bg-background text-xs"
        />
      </div>
    </div>
  );
}
