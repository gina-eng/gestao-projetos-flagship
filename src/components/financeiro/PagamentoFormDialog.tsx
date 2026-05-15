import { FormEvent, useEffect, useState } from "react";
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
  METODOS_PAGAMENTO,
  MetodoPagamento,
  Pagamento,
  Parcela,
  Periodicidade,
  TipoPagamento,
} from "@/types";
import { formatCurrency, uid } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface FormState {
  projeto_id: string;
  tipo: TipoPagamento;
  metodo: MetodoPagamento;
  valor_total: number;
  num_parcelas: number;
  data_primeira_parcela: string;
  periodicidade: Periodicidade;
  observacoes: string;
}

function emptyForm(): FormState {
  return {
    projeto_id: "",
    tipo: "recorrente",
    metodo: "pix",
    valor_total: 0,
    num_parcelas: 12,
    data_primeira_parcela: new Date().toISOString().slice(0, 10),
    periodicidade: "mensal",
    observacoes: "",
  };
}

export function PagamentoFormDialog({ open, onOpenChange }: Props) {
  const { projetos, clientes, savePagamento } = useApp();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setErros({});
    }
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const valorParcela = form.num_parcelas > 0 ? form.valor_total / form.num_parcelas : 0;

  function gerarParcelas(pagamentoId: string): Parcela[] {
    const out: Parcela[] = [];
    const base = new Date(form.data_primeira_parcela);
    for (let i = 0; i < form.num_parcelas; i++) {
      const d = new Date(base);
      if (form.periodicidade === "mensal") d.setMonth(d.getMonth() + i);
      else if (form.periodicidade === "trimestral") d.setMonth(d.getMonth() + i * 3);
      // unica/personalizada → todas na primeira data ou ignora — ajustável depois
      out.push({
        id: uid("par_"),
        pagamento_id: pagamentoId,
        numero: i + 1,
        valor: valorParcela,
        data_vencimento: d.toISOString().slice(0, 10),
        status: "previsto",
      });
    }
    return out;
  }

  function validar() {
    const e: Record<string, string> = {};
    if (!form.projeto_id) e.projeto_id = "Selecione um projeto";
    if (form.valor_total <= 0) e.valor_total = "Valor maior que zero";
    if (form.num_parcelas <= 0) e.num_parcelas = "Mínimo 1";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    const id = uid("pag_");
    const pag: Pagamento = {
      id,
      projeto_id: form.projeto_id,
      tipo: form.tipo,
      metodo: form.metodo,
      valor_total: form.valor_total,
      num_parcelas: form.num_parcelas,
      data_primeira_parcela: form.data_primeira_parcela,
      periodicidade: form.periodicidade,
      status_geral: "ativo",
      observacoes: form.observacoes || undefined,
      parcelas: gerarParcelas(id),
    };
    savePagamento(pag);
    onOpenChange(false);
  }

  const projetosAtivos = projetos.filter((p) => p.status === "ativo" || p.status === "pausado");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo pagamento</DialogTitle>
          <DialogDescription>
            As parcelas serão geradas automaticamente conforme a periodicidade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Projeto *</Label>
            <Select
              value={form.projeto_id}
              onValueChange={(v) => {
                // Ao escolher o projeto, herda os dados de pagamento já
                // definidos no contrato: TCV (ou valor_total), número de
                // parcelas, forma de pagamento e início do pagamento.
                const proj = projetos.find((p) => p.id === v);
                if (!proj) {
                  setForm((f) => ({ ...f, projeto_id: v }));
                  return;
                }
                // Mapeia forma de pagamento do projeto → método da parcela.
                const metodoMap: Record<string, FormState["metodo"]> = {
                  pix: "pix",
                  boleto: "boleto",
                  cheque: "outro",
                  cartao: "cartao_credito",
                  cartao_recorrente: "cartao_credito",
                };
                const valorContrato =
                  proj.modelo_cobranca === "recorrente"
                    ? proj.valor_tcv && proj.valor_tcv > 0
                      ? proj.valor_tcv
                      : proj.valor_total * (proj.lt_meses ?? 0)
                    : proj.valor_tcv && proj.valor_tcv > 0
                    ? proj.valor_tcv
                    : proj.valor_total;
                setForm((f) => ({
                  ...f,
                  projeto_id: v,
                  tipo:
                    proj.modelo_cobranca === "recorrente"
                      ? "recorrente"
                      : (proj.num_parcelas ?? 1) > 1
                      ? "parcelado"
                      : f.tipo,
                  metodo: proj.forma_pagamento
                    ? metodoMap[proj.forma_pagamento] ?? f.metodo
                    : f.metodo,
                  valor_total: valorContrato > 0 ? valorContrato : f.valor_total,
                  num_parcelas: proj.num_parcelas ?? f.num_parcelas,
                  data_primeira_parcela:
                    proj.data_inicio_pagamento ?? f.data_primeira_parcela,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {projetosAtivos.map((p) => {
                  const cli = clientes.find((c) => c.id === p.cliente_id);
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} · {cli?.nome_fantasia} — {p.nome}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {erros.projeto_id && <p className="text-xs text-destructive">{erros.projeto_id}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setField("tipo", v as TipoPagamento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (à vista)</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select
                value={form.metodo}
                onValueChange={(v) => setField("metodo", v as MetodoPagamento)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGAMENTO.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Periodicidade</Label>
              <Select
                value={form.periodicidade}
                onValueChange={(v) => setField("periodicidade", v as Periodicidade)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="unica">Única</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Valor total *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_total || ""}
                onChange={(e) => setField("valor_total", Number(e.target.value))}
              />
              {erros.valor_total && (
                <p className="text-xs text-destructive">{erros.valor_total}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nº parcelas *</Label>
              <Input
                type="number"
                min={1}
                value={form.num_parcelas || ""}
                onChange={(e) => setField("num_parcelas", Number(e.target.value))}
              />
              {erros.num_parcelas && (
                <p className="text-xs text-destructive">{erros.num_parcelas}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>1ª parcela em</Label>
              <Input
                type="date"
                value={form.data_primeira_parcela}
                onChange={(e) => setField("data_primeira_parcela", e.target.value)}
              />
            </div>
          </div>

          <div className="container-section">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Resumo
              </span>
              <span className="text-sm font-semibold">
                {form.num_parcelas}× de {formatCurrency(valorParcela)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total: {formatCurrency(form.valor_total)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setField("observacoes", e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Criar pagamento</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
