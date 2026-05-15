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
  CATEGORIAS,
  type CategoriaV4,
  type Oportunidade,
} from "@/types";
import { uid } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientePreSelect?: string;
}

function empty(): Oportunidade {
  return {
    id: uid("opo_"),
    cliente_id: "",
    produto_id: "",
    nome: "",
    valor_estimado: 0,
    modelo_cobranca: "recorrente",
    lt_meses: 12,
    etapa: "identificada",
  };
}

export function OportunidadeFormDialog({
  open,
  onOpenChange,
  clientePreSelect,
}: Props) {
  const { clientes, produtos, investidores, projetos, saveOportunidade } = useApp();
  const [form, setForm] = useState<Oportunidade>(empty());
  const [categoria, setCategoria] = useState<CategoriaV4 | "">("");
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const base = empty();
      if (clientePreSelect) base.cliente_id = clientePreSelect;
      setForm(base);
      setCategoria("");
      setErros({});
    }
  }, [open, clientePreSelect]);

  const clientesAtivos = useMemo(
    () =>
      clientes.filter(
        (c) => c.status !== "inativo" && c.status !== "churn"
      ),
    [clientes]
  );

  const produtosFiltrados = useMemo(
    () =>
      produtos.filter(
        (p) => p.ativo && (!categoria || p.categoria === categoria)
      ),
    [produtos, categoria]
  );

  // Projetos do cliente selecionado, para vincular como origem da oportunidade.
  const projetosDoCliente = useMemo(
    () =>
      projetos.filter(
        (p) => p.cliente_id === form.cliente_id && p.status !== "concluido"
      ),
    [projetos, form.cliente_id]
  );

  function setField<K extends keyof Oportunidade>(k: K, v: Oportunidade[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validar() {
    const e: Record<string, string> = {};
    if (!form.cliente_id) e.cliente_id = "Selecione um cliente";
    if (!form.produto_id) e.produto_id = "Selecione um produto";
    if (!form.nome.trim()) e.nome = "Obrigatório";
    if (form.valor_estimado <= 0) e.valor_estimado = "Valor maior que zero";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    await saveOportunidade(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova oportunidade</DialogTitle>
          <DialogDescription>
            Possibilidade de venda de produto para um cliente existente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select
                value={form.cliente_id || undefined}
                onValueChange={(v) => setField("cliente_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.sigla} · {c.nome_fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros.cliente_id && (
                <p className="text-xs text-destructive">{erros.cliente_id}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={form.responsavel_id || undefined}
                onValueChange={(v) => setField("responsavel_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
            </div>
          </div>

          {form.cliente_id && projetosDoCliente.length > 0 && (
            <div className="space-y-1.5">
              <Label>Projeto vinculado (opcional)</Label>
              <Select
                value={form.projeto_id || "__none__"}
                onValueChange={(v) =>
                  setField("projeto_id", v === "__none__" ? undefined : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem projeto vinculado</SelectItem>
                  {projetosDoCliente.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} · {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Indica qual projeto gerou a oportunidade (upsell/cross-sell).
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Categoria V4</Label>
              <Select
                value={categoria || undefined}
                onValueChange={(v) => {
                  setCategoria(v as CategoriaV4);
                  setField("produto_id", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Produto *</Label>
              <Select
                value={form.produto_id || undefined}
                onValueChange={(v) => {
                  const prod = produtos.find((p) => p.id === v);
                  setForm((f) => ({
                    ...f,
                    produto_id: v,
                    nome: f.nome || (prod ? prod.nome : f.nome),
                    valor_estimado:
                      f.valor_estimado || (prod?.valor_sugerido ?? 0),
                    modelo_cobranca: prod
                      ? prod.modelo_cobranca_padrao
                      : f.modelo_cobranca,
                  }));
                }}
                disabled={!categoria}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      categoria
                        ? "Selecione o produto"
                        : "Defina a categoria primeiro"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {produtosFiltrados.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros.produto_id && (
                <p className="text-xs text-destructive">{erros.produto_id}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome / título da oportunidade *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setField("nome", e.target.value)}
              placeholder="Ex.: Upsell — Tráfego Pago Dedicado"
            />
            {erros.nome && (
              <p className="text-xs text-destructive">{erros.nome}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Cobrança</Label>
              <Select
                value={form.modelo_cobranca}
                onValueChange={(v) =>
                  setField(
                    "modelo_cobranca",
                    v as Oportunidade["modelo_cobranca"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado (TCV) *</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.valor_estimado || ""}
                onChange={(e) =>
                  setField("valor_estimado", Number(e.target.value) || 0)
                }
                placeholder="0,00"
              />
              {erros.valor_estimado && (
                <p className="text-xs text-destructive">
                  {erros.valor_estimado}
                </p>
              )}
            </div>
            {form.modelo_cobranca === "recorrente" && (
              <div className="space-y-1.5">
                <Label>Prazo (meses)</Label>
                <Select
                  value={
                    form.lt_meses === 6 || form.lt_meses === 12
                      ? String(form.lt_meses)
                      : undefined
                  }
                  onValueChange={(v) => setField("lt_meses", parseInt(v, 10))}
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
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) =>
                setField("observacoes", e.target.value || undefined)
              }
              rows={2}
              placeholder="Contexto, gancho da conversa, próximos passos..."
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
            <Button type="submit">Criar oportunidade</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
