import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X, AlertTriangle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Fase } from "@/types";
import { uid } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// Estado local com lista editável das fases enquanto o dialog está aberto.
// Só persiste na store ao clicar em "Salvar alterações".
export function FasesManagerDialog({ open, onOpenChange }: Props) {
  const { fases, projetos, saveFase, deleteFase, reordenarFases } = useApp();
  const [lista, setLista] = useState<Fase[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Clona pra evitar mutação direta
      const ordenadas = [...fases].sort((a, b) => a.ordem - b.ordem);
      setLista(ordenadas);
      setNovoNome("");
      setNovaDescricao("");
      setErro(null);
    }
  }, [open, fases]);

  const contagemPorFase = useMemo(() => {
    const m: Record<string, number> = {};
    projetos.forEach((p) => {
      m[p.fase_atual] = (m[p.fase_atual] ?? 0) + 1;
    });
    return m;
  }, [projetos]);

  function moverParaCima(idx: number) {
    if (idx === 0) return;
    const nova = [...lista];
    [nova[idx - 1], nova[idx]] = [nova[idx], nova[idx - 1]];
    setLista(nova);
  }

  function moverParaBaixo(idx: number) {
    if (idx === lista.length - 1) return;
    const nova = [...lista];
    [nova[idx], nova[idx + 1]] = [nova[idx + 1], nova[idx]];
    setLista(nova);
  }

  function atualizarCampo(id: string, campo: "nome" | "descricao", valor: string) {
    setLista((l) => l.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  }

  function adicionarNova() {
    if (!novoNome.trim()) {
      setErro("O nome da nova fase é obrigatório.");
      return;
    }
    const nova: Fase = {
      id: uid("fase_"),
      nome: novoNome.trim(),
      descricao: novaDescricao.trim() || undefined,
      ordem: lista.length + 1,
    };
    setLista([...lista, nova]);
    setNovoNome("");
    setNovaDescricao("");
    setErro(null);
  }

  function removerLocal(id: string) {
    // Bloqueia visualmente se há projetos vinculados (extra-safety; a store
    // também bloqueia ao persistir).
    if ((contagemPorFase[id] ?? 0) > 0) {
      setErro(
        `Não é possível remover esta fase: ${contagemPorFase[id]} projeto(s) estão nela. Mova-os antes.`
      );
      return;
    }
    setLista((l) => l.filter((f) => f.id !== id));
    setErro(null);
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);

    // 1. Detecta fases que foram removidas (estão em `fases` mas não em `lista`).
    //    Tenta deletar via store; se algum bloquear, aborta com mensagem.
    const idsRestantes = new Set(lista.map((f) => f.id));
    const removidas = fases.filter((f) => !idsRestantes.has(f.id));
    for (const r of removidas) {
      const err = await deleteFase(r.id);
      if (err) {
        setErro(err);
        return;
      }
    }

    // 2. Salva criações e atualizações com nova ordem
    lista.forEach((f, idx) => {
      const original = fases.find((x) => x.id === f.id);
      const novoComOrdem = { ...f, ordem: idx + 1 };
      const mudou =
        !original ||
        original.nome !== f.nome ||
        original.descricao !== f.descricao ||
        original.ordem !== idx + 1;
      if (mudou) saveFase(novoComOrdem);
    });

    // 3. Garante consistência da ordem (caso só tenha havido reorder sem rename)
    reordenarFases(lista.map((f) => f.id));

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar fases do kanban</DialogTitle>
          <DialogDescription>
            Adicione, renomeie, reordene ou remova fases. Uma fase com projetos
            vinculados não pode ser removida — mova-os primeiro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Lista de fases atuais */}
          <div className="space-y-1.5">
            <Label>Fases existentes ({lista.length})</Label>
            {lista.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                Nenhuma fase. Adicione abaixo.
              </p>
            ) : (
              <div className="space-y-1.5">
                {lista.map((f, idx) => {
                  const usos = contagemPorFase[f.id] ?? 0;
                  return (
                    <div
                      key={f.id}
                      className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 rounded-md border border-border/60 bg-card p-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moverParaCima(idx)}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moverParaBaixo(idx)}
                          disabled={idx === lista.length - 1}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>

                      <Input
                        value={f.nome}
                        onChange={(e) =>
                          atualizarCampo(f.id, "nome", e.target.value)
                        }
                        placeholder="Nome da fase"
                        className="h-8 text-sm"
                      />

                      <Input
                        value={f.descricao ?? ""}
                        onChange={(e) =>
                          atualizarCampo(f.id, "descricao", e.target.value)
                        }
                        placeholder="Descrição (opcional)"
                        className="h-8 text-xs"
                      />

                      <Badge
                        variant={usos > 0 ? "secondary" : "outline"}
                        className="text-[10px]"
                        title={
                          usos > 0
                            ? `${usos} projeto(s) nesta fase`
                            : "Sem projetos"
                        }
                      >
                        {usos}
                      </Badge>

                      <button
                        type="button"
                        onClick={() => removerLocal(f.id)}
                        disabled={usos > 0}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        title={
                          usos > 0
                            ? "Remova os projetos desta fase antes de excluí-la"
                            : "Excluir fase"
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Adicionar nova */}
          <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
            <Label>Adicionar nova fase</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome da fase"
                className="h-9 text-sm"
              />
              <Input
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Descrição (opcional)"
                className="h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={adicionarNova}
                disabled={!novoNome.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button type="submit">Salvar alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
