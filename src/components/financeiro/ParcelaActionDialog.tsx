import { FormEvent, useState } from "react";
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
import { Parcela, StatusParcela } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pagamentoId: string;
  parcela: Parcela;
}

export function ParcelaActionDialog({ open, onOpenChange, pagamentoId, parcela }: Props) {
  const { atualizarParcela } = useApp();
  const [status, setStatus] = useState<StatusParcela>(
    parcela.status === "atrasado" ? "previsto" : parcela.status
  );
  const [dataPag, setDataPag] = useState(
    parcela.data_pagamento ?? new Date().toISOString().slice(0, 10)
  );
  const [obs, setObs] = useState(parcela.observacao ?? "");

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const atualizada: Parcela = {
      ...parcela,
      status,
      data_pagamento: status === "pago" ? dataPag : undefined,
      observacao: obs || undefined,
    };
    atualizarParcela(pagamentoId, atualizada);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar parcela</DialogTitle>
          <DialogDescription>
            Parcela {parcela.numero} — {formatCurrency(parcela.valor)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusParcela)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="previsto">Previsto</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "pago" && (
            <div className="space-y-1.5">
              <Label>Data de pagamento</Label>
              <Input
                type="date"
                value={dataPag}
                onChange={(e) => setDataPag(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
