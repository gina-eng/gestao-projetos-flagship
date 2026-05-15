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
import { Investidor, FUNCOES_SQUAD, FuncaoSquad, StatusComum } from "@/types";
import { uid } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  investidor: Investidor | null;
}

const EMPTY: Investidor = {
  id: "",
  nome: "",
  email: "",
  telefone: "",
  funcao_principal: "analista",
  funcoes_secundarias: [],
  status: "ativo",
  data_entrada: new Date().toISOString().slice(0, 10),
};

export function InvestidorFormDialog({ open, onOpenChange, investidor }: Props) {
  const { saveInvestidor } = useApp();
  const [form, setForm] = useState<Investidor>(EMPTY);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(investidor ?? { ...EMPTY, id: uid("inv_") });
      setErros({});
    }
  }, [open, investidor]);

  function setField<K extends keyof Investidor>(key: K, value: Investidor[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleSecundaria(f: FuncaoSquad) {
    setForm((s) => {
      const has = s.funcoes_secundarias.includes(f);
      return {
        ...s,
        funcoes_secundarias: has
          ? s.funcoes_secundarias.filter((x) => x !== f)
          : [...s.funcoes_secundarias, f],
      };
    });
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Obrigatório";
    if (!form.email.trim()) e.email = "Obrigatório";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "E-mail inválido";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    saveInvestidor(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{investidor ? "Editar investidor" : "Novo investidor"}</DialogTitle>
          <DialogDescription>
            Membros da equipe disponíveis para alocação em projetos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={form.nome} onChange={(e) => setField("nome", e.target.value)} />
              {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
              {erros.email && <p className="text-xs text-destructive">{erros.email}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.telefone ?? ""}
                onChange={(e) => setField("telefone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de entrada</Label>
              <Input
                type="date"
                value={form.data_entrada}
                onChange={(e) => setField("data_entrada", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Função principal</Label>
              <Select
                value={form.funcao_principal}
                onValueChange={(v) => setField("funcao_principal", v as FuncaoSquad)}
              >
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
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setField("status", v as StatusComum)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Funções secundárias</Label>
            <div className="flex flex-wrap gap-2">
              {FUNCOES_SQUAD.filter((f) => f.value !== form.funcao_principal).map((f) => {
                const active = form.funcoes_secundarias.includes(f.value);
                return (
                  <button
                    type="button"
                    key={f.value}
                    onClick={() => toggleSecundaria(f.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

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
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
