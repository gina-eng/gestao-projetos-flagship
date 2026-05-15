import { FormEvent, useEffect, useMemo, useState } from "react";
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
import {
  Cliente,
  ContatoCliente,
  MODELOS_VENDAS,
  ModeloVendas,
  MOTIVOS_CHURN,
  MotivoChurn,
  RegiaoAtuacao,
  REGIOES_ATUACAO,
  Segmento,
  SEGMENTOS,
  StatusCliente,
  Tier,
  TIERS,
} from "@/types";
import { suggestSigla, uid } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: Cliente | null;
}

const EMPTY: Cliente = {
  id: "",
  sigla: "",
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  segmento: undefined,
  segmento_outro: "",
  nicho: "",
  regiao_atuacao: undefined,
  modelo_vendas: [],
  tier: "small",
  endereco: "",
  cidade: "",
  estado: "",
  contatos: [],
  conexoes: [],
  status: "em_fechamento",
  data_cadastro: new Date().toISOString().slice(0, 10),
  observacoes: "",
};

export function ClienteFormDialog({ open, onOpenChange, cliente }: Props) {
  const { clientes, saveCliente } = useApp();
  const [form, setForm] = useState<Cliente>(EMPTY);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(cliente ?? { ...EMPTY, id: uid("cli_") });
      setErros({});
    }
  }, [open, cliente]);

  const siglasOcupadas = useMemo(
    () => new Set(clientes.filter((c) => c.id !== form.id).map((c) => c.sigla.toUpperCase())),
    [clientes, form.id]
  );

  function setField<K extends keyof Cliente>(key: K, value: Cliente[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Ao mudar status para churn pela primeira vez, registra a data automaticamente.
      // Se voltar pra ativo, limpa a data e o motivo.
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
  }

  function toggleModeloVendas(m: ModeloVendas) {
    setForm((f) => {
      const has = f.modelo_vendas.includes(m);
      return {
        ...f,
        modelo_vendas: has ? f.modelo_vendas.filter((x) => x !== m) : [...f.modelo_vendas, m],
      };
    });
  }

  function aplicarSugestaoSigla() {
    if (form.sigla) return;
    const sug = suggestSigla(form.nome_fantasia || form.razao_social);
    if (!sug) return;
    let candidato = sug;
    let i = 2;
    while (siglasOcupadas.has(candidato)) {
      candidato = sug.slice(0, 3) + i;
      i++;
    }
    setField("sigla", candidato);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.nome_fantasia.trim()) e.nome_fantasia = "Obrigatório";
    if (!form.razao_social.trim()) e.razao_social = "Obrigatório";
    if (!form.sigla.trim()) e.sigla = "Obrigatório";
    if (form.sigla && (form.sigla.length < 3 || form.sigla.length > 6))
      e.sigla = "Entre 3 e 6 caracteres";
    if (form.sigla && !/^[A-Z0-9]+$/.test(form.sigla))
      e.sigla = "Apenas letras/números maiúsculos";
    if (form.sigla && siglasOcupadas.has(form.sigla.toUpperCase()))
      e.sigla = "Sigla já utilizada";
    if (form.modelo_vendas.length === 0) e.modelo_vendas = "Selecione ao menos um";
    if (!form.segmento) e.segmento = "Selecione um segmento";
    if (form.segmento === "outros" && !form.segmento_outro?.trim())
      e.segmento_outro = "Descreva o segmento";
    if (!form.regiao_atuacao) e.regiao_atuacao = "Selecione uma região";
    if (form.status === "churn" && !form.motivo_churn)
      e.motivo_churn = "Selecione o motivo do churn";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    saveCliente({ ...form, sigla: form.sigla.toUpperCase() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            A sigla é o ticker único usado para sincronizar com sistemas externos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome fantasia *</Label>
              <Input
                value={form.nome_fantasia}
                onChange={(e) => setField("nome_fantasia", e.target.value)}
                onBlur={aplicarSugestaoSigla}
              />
              {erros.nome_fantasia && (
                <p className="text-xs text-destructive">{erros.nome_fantasia}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Razão social *</Label>
              <Input
                value={form.razao_social}
                onChange={(e) => setField("razao_social", e.target.value)}
              />
              {erros.razao_social && (
                <p className="text-xs text-destructive">{erros.razao_social}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Sigla (ticker) *</Label>
              <Input
                value={form.sigla}
                maxLength={6}
                onChange={(e) => setField("sigla", e.target.value.toUpperCase())}
                placeholder="Ex: CRJM"
              />
              {erros.sigla && <p className="text-xs text-destructive">{erros.sigla}</p>}
              {!erros.sigla && (
                <p className="text-[11px] text-muted-foreground">3 a 6 caracteres, A-Z/0-9.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj ?? ""}
                onChange={(e) => setField("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setField("status", v as StatusCliente)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_fechamento">Em fechamento</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="churn">Churn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Segmento *</Label>
              <Select
                value={form.segmento ?? ""}
                onValueChange={(v) => {
                  setField("segmento", v as Segmento);
                  if (v !== "outros") setField("segmento_outro", "");
                }}
              >
                <SelectTrigger>
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
                <p className="text-xs text-destructive">{erros.segmento}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nicho</Label>
              <Input value={form.nicho ?? ""} onChange={(e) => setField("nicho", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Região de atuação *</Label>
              <Select
                value={form.regiao_atuacao ?? ""}
                onValueChange={(v) => setField("regiao_atuacao", v as RegiaoAtuacao)}
              >
                <SelectTrigger>
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
                <p className="text-xs text-destructive">{erros.regiao_atuacao}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tier *</Label>
              <Select value={form.tier} onValueChange={(v) => setField("tier", v as Tier)}>
                <SelectTrigger>
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

          {form.segmento === "outros" && (
            <div className="space-y-1.5">
              <Label>Descreva o segmento *</Label>
              <Input
                value={form.segmento_outro ?? ""}
                onChange={(e) => setField("segmento_outro", e.target.value)}
                placeholder="Ex: Agronegócio, Energia, etc."
              />
              {erros.segmento_outro && (
                <p className="text-xs text-destructive">{erros.segmento_outro}</p>
              )}
            </div>
          )}

          {form.status === "churn" && (
            <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-3">
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

          <div className="space-y-1.5">
            <Label>Modelo de vendas *</Label>
            <div className="flex flex-wrap gap-2">
              {MODELOS_VENDAS.map((m) => {
                const active = form.modelo_vendas.includes(m.value);
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
            {erros.modelo_vendas && (
              <p className="text-xs text-destructive">{erros.modelo_vendas}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_180px_90px]">
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input
                value={form.endereco ?? ""}
                onChange={(e) => setField("endereco", e.target.value)}
                placeholder="Rua, número, complemento"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input
                value={form.cidade ?? ""}
                onChange={(e) => setField("cidade", e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Input
                value={form.estado ?? ""}
                onChange={(e) =>
                  setField("estado", e.target.value.toUpperCase().slice(0, 2))
                }
                placeholder="UF"
                maxLength={2}
              />
            </div>
          </div>

          <ContatosEditor
            contatos={form.contatos}
            onChange={(contatos) => setField("contatos", contatos)}
          />

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) => setField("observacoes", e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar cliente</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContatosEditor({
  contatos,
  onChange,
}: {
  contatos: Cliente["contatos"];
  onChange: (c: Cliente["contatos"]) => void;
}) {
  function adicionar() {
    const novo: ContatoCliente = { id: uid("ct_"), nome: "" };
    onChange([...contatos, novo]);
  }

  function atualizar(id: string, patch: Partial<ContatoCliente>) {
    onChange(contatos.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remover(id: string) {
    onChange(contatos.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Stakeholders</Label>
          <p className="text-[11px] text-muted-foreground">
            Cadastre as pessoas-chave e use o campo de contexto para descrever
            o perfil de cada uma (jeitão, dores, como abordar).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {contatos.length}
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={adicionar}>
            <Plus className="h-3.5 w-3.5" />
            Novo
          </Button>
        </div>
      </div>

      {contatos.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          Nenhum stakeholder cadastrado. Clique em "Novo" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {contatos.map((c) => (
            <div
              key={c.id}
              className="space-y-2 rounded-md border border-border/60 bg-card p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={c.nome}
                  onChange={(e) => atualizar(c.id, { nome: e.target.value })}
                  placeholder="Nome"
                  className="h-8 text-sm"
                />
                <Input
                  value={c.cargo ?? ""}
                  onChange={(e) =>
                    atualizar(c.id, { cargo: e.target.value || undefined })
                  }
                  placeholder="Cargo"
                  className="h-8 text-sm"
                />
                <button
                  type="button"
                  onClick={() => remover(c.id)}
                  className="self-center rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="email"
                  value={c.email ?? ""}
                  onChange={(e) =>
                    atualizar(c.id, { email: e.target.value || undefined })
                  }
                  placeholder="E-mail"
                  className="h-8 text-sm"
                />
                <Input
                  value={c.telefone ?? ""}
                  onChange={(e) =>
                    atualizar(c.id, { telefone: e.target.value || undefined })
                  }
                  placeholder="Telefone"
                  className="h-8 text-sm"
                />
              </div>
              <Textarea
                value={c.contexto ?? ""}
                onChange={(e) =>
                  atualizar(c.id, { contexto: e.target.value || undefined })
                }
                rows={3}
                placeholder="Contexto sobre a pessoa: papel na decisão, jeitão, dores, motivações, como abordar. Use insights das reuniões de venda/qualificação/plano de vôo."
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
