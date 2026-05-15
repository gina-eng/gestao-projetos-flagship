import { useMemo, useState } from "react";
import { Plus, Search, UserPlus2, Mail, Phone, Edit } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/Layout";
import { InvestidorFormDialog } from "@/components/investidores/InvestidorFormDialog";
import { formatCurrency } from "@/lib/utils";
import { FUNCOES_SQUAD, Investidor } from "@/types";

export function InvestidoresPage() {
  const { investidores, projetos } = useApp();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Investidor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q
      ? investidores.filter(
          (i) =>
            i.nome.toLowerCase().includes(q) ||
            i.email.toLowerCase().includes(q)
        )
      : investidores;
    return [...lista].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [investidores, busca]);

  function metricasInvestidor(invId: string) {
    const projetosDele = projetos.filter(
      (p) => p.status === "ativo" && p.squad.some((s) => s.investidor_id === invId)
    );
    // TCV por projeto: prioriza valor_tcv; fallback recorrente = valor_total × lt_meses;
    // fallback one-time = valor_total.
    function tcvDoProjeto(p: typeof projetosDele[number]) {
      if (typeof p.valor_tcv === "number" && p.valor_tcv > 0) return p.valor_tcv;
      if (p.modelo_cobranca === "recorrente") {
        return p.valor_total * (p.lt_meses ?? 0);
      }
      return p.valor_total;
    }
    // Mensal por projeto:
    // - recorrente: valor_total (já é o mensal). Se vier 0, derivamos do TCV÷lt_meses.
    // - one-time / parcelado: TCV ÷ horizonte (num_parcelas, fallback em lt_meses).
    function mensalDoProjeto(p: typeof projetosDele[number]) {
      const tcvP = tcvDoProjeto(p);
      if (p.modelo_cobranca === "recorrente") {
        if (p.valor_total && p.valor_total > 0) return p.valor_total;
        if (p.lt_meses && p.lt_meses > 0) return tcvP / p.lt_meses;
        return 0;
      }
      const meses = p.num_parcelas && p.num_parcelas > 0
        ? p.num_parcelas
        : p.lt_meses && p.lt_meses > 0
          ? p.lt_meses
          : 1;
      return tcvP / meses;
    }
    // Atribuição proporcional: cada investidor recebe a fatia (mensal/TCV) ÷ pessoas no squad.
    const mensal = projetosDele.reduce((acc, p) => {
      const share = Math.max(1, p.squad.length || 1);
      return acc + mensalDoProjeto(p) / share;
    }, 0);
    const tcv = projetosDele.reduce((acc, p) => {
      const share = Math.max(1, p.squad.length || 1);
      return acc + tcvDoProjeto(p) / share;
    }, 0);
    return { projetos: projetosDele.length, mensal, tcv };
  }

  return (
    <div className="spacing-section">
      <PageHeader
        title="Investidores"
        description="Equipe da unidade. Cada investidor pode atuar em múltiplos projetos com funções distintas."
        actions={
          <Button
            onClick={() => {
              setEditando(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo investidor
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserPlus2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-title-card">Nenhum investidor cadastrado</p>
              <p className="text-body">Adicione o time da unidade para começar a alocar squads.</p>
            </div>
            <Button onClick={() => { setEditando(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              Novo investidor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((inv) => {
            const m = metricasInvestidor(inv.id);
            const funcaoLabel = FUNCOES_SQUAD.find((f) => f.value === inv.funcao_principal)?.label;
            return (
              <Card key={inv.id} className="card-hover">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {inv.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="text-title-card leading-tight">{inv.nome}</p>
                        <p className="text-body-small">{funcaoLabel}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditando(inv);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1 text-xs text-content">
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> {inv.email}
                    </p>
                    {inv.telefone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" /> {inv.telefone}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Projetos
                      </p>
                      <p className="text-base font-semibold tabular-nums text-foreground">
                        {m.projetos}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Mensal
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(m.mensal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        TCV
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(m.tcv)}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={inv.status === "ativo" ? "saudavel" : "secondary"}
                    className="w-fit"
                  >
                    {inv.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <InvestidorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        investidor={editando}
      />
    </div>
  );
}
