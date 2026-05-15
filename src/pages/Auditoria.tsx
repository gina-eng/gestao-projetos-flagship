import { useMemo, useState } from "react";
import { Download, Lock, Search, User as UserIcon } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/Layout";
import { HistoricoAuditoria } from "@/components/HistoricoAuditoria";
import { AcaoAuditoria, EntidadeAuditavel } from "@/types";

const ENTIDADES: { value: EntidadeAuditavel | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "cliente", label: "Clientes" },
  { value: "projeto", label: "Projetos" },
  { value: "investidor", label: "Investidores" },
  { value: "produto", label: "Produtos" },
  { value: "pagamento", label: "Pagamentos" },
  { value: "parcela", label: "Parcelas" },
];

const ACOES: { value: AcaoAuditoria | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "criar", label: "Criação" },
  { value: "atualizar", label: "Atualização" },
  { value: "remover", label: "Remoção" },
  { value: "evento", label: "Evento" },
];

function iniciais(nome?: string | null) {
  if (!nome) return "?";
  return (
    nome
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditoriaPage() {
  const { auditoria, sessao } = useApp();
  const [busca, setBusca] = useState("");
  const [filtroEnt, setFiltroEnt] = useState<EntidadeAuditavel | "all">("all");
  const [filtroAcao, setFiltroAcao] = useState<AcaoAuditoria | "all">("all");
  const [apenasMinhas, setApenasMinhas] = useState(false);

  // Compara o usuário logado com o registro por usuario_id; fallback pra nome
  // (pra cobrir registros antigos onde usuario_id pode ser diferente).
  function ehDoUsuarioLogado(r: { usuario_id?: string; usuario_nome?: string }) {
    if (!sessao) return false;
    if (r.usuario_id && sessao.usuario_id) {
      return r.usuario_id === sessao.usuario_id;
    }
    return (
      !!r.usuario_nome &&
      r.usuario_nome.trim().toLowerCase() ===
        (sessao.nome ?? "").trim().toLowerCase()
    );
  }

  const minhasAcoes = useMemo(
    () => auditoria.filter(ehDoUsuarioLogado),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auditoria, sessao]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return auditoria.filter((r) => {
      if (apenasMinhas && !ehDoUsuarioLogado(r)) return false;
      if (filtroEnt !== "all" && r.entidade !== filtroEnt) return false;
      if (filtroAcao !== "all" && r.acao !== filtroAcao) return false;
      if (!q) return true;
      return (
        r.entidade_label.toLowerCase().includes(q) ||
        r.resumo.toLowerCase().includes(q) ||
        (r.usuario_nome ?? "").toLowerCase().includes(q) ||
        r.mudancas.some(
          (m) =>
            m.label.toLowerCase().includes(q) ||
            (m.de ?? "").toLowerCase().includes(q) ||
            (m.para ?? "").toLowerCase().includes(q)
        )
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditoria, busca, filtroEnt, filtroAcao, apenasMinhas, sessao]);

  // Métricas das ações do usuário logado
  const minhasMetricas = useMemo(() => {
    const total = minhasAcoes.length;
    const ultima = minhasAcoes[0]; // já vem ordenado desc no store
    const criou = minhasAcoes.filter((r) => r.acao === "criar").length;
    const editou = minhasAcoes.filter((r) => r.acao === "atualizar").length;
    const removeu = minhasAcoes.filter((r) => r.acao === "remover").length;
    return { total, ultima, criou, editou, removeu };
  }, [minhasAcoes]);

  function exportarCSV() {
    const header = [
      "timestamp",
      "usuario",
      "entidade",
      "entidade_id",
      "entidade_label",
      "acao",
      "campo",
      "de",
      "para",
    ];
    const linhas: string[][] = [header];
    filtrados.forEach((r) => {
      if (r.mudancas.length === 0) {
        linhas.push([
          r.timestamp,
          r.usuario_nome ?? "",
          r.entidade,
          r.entidade_id,
          r.entidade_label,
          r.acao,
          "",
          "",
          "",
        ]);
        return;
      }
      r.mudancas.forEach((m) => {
        linhas.push([
          r.timestamp,
          r.usuario_nome ?? "",
          r.entidade,
          r.entidade_id,
          r.entidade_label,
          r.acao,
          m.label,
          m.de ?? "",
          m.para ?? "",
        ]);
      });
    });
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="spacing-section">
      <PageHeader
        title="Auditoria"
        description="Log imutável de todas as alterações do sistema. Ordenado do mais recente para o mais antigo."
        actions={
          <Button
            variant="outline"
            onClick={exportarCSV}
            disabled={filtrados.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

      {/* Card "Suas ações" — destaca a participação do usuário logado */}
      {sessao && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {iniciais(sessao.nome)}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Suas ações
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {sessao.nome}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {sessao.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Stat label="Total" value={minhasMetricas.total} />
              <Stat label="Criou" value={minhasMetricas.criou} tone="emerald" />
              <Stat label="Editou" value={minhasMetricas.editou} tone="amber" />
              <Stat
                label="Removeu"
                value={minhasMetricas.removeu}
                tone="rose"
              />
              {minhasMetricas.ultima && (
                <div className="ml-1 rounded-md border border-border/60 bg-card px-3 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Última
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    {formatTs(minhasMetricas.ultima.timestamp)}
                  </p>
                </div>
              )}
              <Button
                size="sm"
                variant={apenasMinhas ? "default" : "outline"}
                onClick={() => setApenasMinhas((v) => !v)}
                className="ml-1"
              >
                <UserIcon className="h-3.5 w-3.5" />
                {apenasMinhas ? "Mostrando só as minhas" : "Apenas as minhas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por entidade, campo, usuário ou valor"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Entidade:</span>
            <select
              value={filtroEnt}
              onChange={(e) =>
                setFiltroEnt(e.target.value as EntidadeAuditavel | "all")
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ENTIDADES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Ação:</span>
            <select
              value={filtroAcao}
              onChange={(e) =>
                setFiltroAcao(e.target.value as AcaoAuditoria | "all")
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ACOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {apenasMinhas && (
            <Badge variant="default" className="text-[10px]">
              Filtrando só as suas
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="container-section flex items-start gap-2 text-xs">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Append-only:</strong> registros
          nunca são editados ou removidos. A linha do tempo abaixo é a fonte
          da verdade para auditoria.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <HistoricoAuditoria
            registros={filtrados}
            titulo=""
            vazio={
              auditoria.length === 0
                ? "Nenhuma alteração registrada ainda. Faça uma mudança em qualquer entidade."
                : apenasMinhas
                ? "Você ainda não realizou nenhuma ação que corresponda aos filtros."
                : "Nenhum registro corresponde aos filtros."
            }
            limiteInicial={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
      ? "text-amber-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-card px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-sm font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
