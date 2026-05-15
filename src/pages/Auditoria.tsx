import { useMemo, useState } from "react";
import { Search, Lock, Download } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
];

export function AuditoriaPage() {
  const { auditoria } = useApp();
  const [busca, setBusca] = useState("");
  const [filtroEnt, setFiltroEnt] = useState<EntidadeAuditavel | "all">("all");
  const [filtroAcao, setFiltroAcao] = useState<AcaoAuditoria | "all">("all");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return auditoria.filter((r) => {
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
  }, [auditoria, busca, filtroEnt, filtroAcao]);

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
      .map((l) =>
        l
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      )
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
          <Button variant="outline" onClick={exportarCSV} disabled={filtrados.length === 0}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

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
              onChange={(e) => setFiltroEnt(e.target.value as EntidadeAuditavel | "all")}
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
              onChange={(e) => setFiltroAcao(e.target.value as AcaoAuditoria | "all")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ACOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="container-section flex items-start gap-2 text-xs">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Append-only:</strong> registros nunca são
          editados ou removidos. A linha do tempo abaixo é a fonte da verdade para
          auditoria.
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
                : "Nenhum registro corresponde aos filtros."
            }
            limiteInicial={20}
          />
        </CardContent>
      </Card>
    </div>
  );
}
