import { useMemo, useState } from "react";
import {
  Search,
  Package,
  Database,
  Lock,
  RefreshCw,
  Link2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/Layout";
import { formatCurrency, variantCategoria } from "@/lib/utils";
import { CATEGORIAS, CategoriaV4 } from "@/types";
import { supabaseConfigurado } from "@/lib/supabase";
import { buscarProdutosSupabase } from "@/lib/produtos-sync";

type StatusSync =
  | { tipo: "idle" }
  | { tipo: "carregando" }
  | { tipo: "ok"; quantidade: number; horario: string }
  | { tipo: "erro"; mensagem: string };

export function ProdutosPage() {
  const { produtos, projetos, sincronizarProdutos } = useApp();
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState<CategoriaV4 | "all">("all");
  const [status, setStatus] = useState<StatusSync>({ tipo: "idle" });
  const conectado = supabaseConfigurado();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos
      .filter((p) => {
        if (!p.ativo) return false;
        if (filtroCat !== "all" && p.categoria !== filtroCat) return false;
        if (!q) return true;
        return (
          p.nome.toLowerCase().includes(q) ||
          (p.descricao ?? "").toLowerCase().includes(q) ||
          p.variacoes.some((v) => v.nome.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [produtos, busca, filtroCat]);

  function contagemUso(produtoId: string) {
    return projetos.filter(
      (p) => p.produto_id === produtoId && p.status === "ativo"
    ).length;
  }

  async function handleSincronizar() {
    setStatus({ tipo: "carregando" });
    const resultado = await buscarProdutosSupabase();
    if (resultado.ok && resultado.produtos) {
      sincronizarProdutos(resultado.produtos);
      setStatus({
        tipo: "ok",
        quantidade: resultado.quantidade ?? 0,
        horario: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    } else {
      setStatus({ tipo: "erro", mensagem: resultado.erro ?? "Falha desconhecida." });
    }
  }

  return (
    <div className="spacing-section">
      <PageHeader
        title="Catálogo de Produtos"
        description="Fonte externa (banco V4). Aqui você só visualiza — vínculos acontecem dentro do projeto."
        actions={
          <Button
            variant={conectado ? "default" : "outline"}
            onClick={handleSincronizar}
            disabled={!conectado || status.tipo === "carregando"}
            title={
              !conectado
                ? "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local"
                : "Buscar catálogo no Supabase"
            }
          >
            <RefreshCw
              className={`h-4 w-4 ${status.tipo === "carregando" ? "animate-spin" : ""}`}
            />
            {status.tipo === "carregando" ? "Sincronizando..." : "Sincronizar"}
          </Button>
        }
      />

      {/* Status da conexão com a fonte externa */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                conectado
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Database className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Fonte: banco de produtos V4 (Supabase)
                <Badge
                  variant="outline"
                  className={`ml-2 text-[10px] ${
                    conectado
                      ? "border-emerald-300 text-emerald-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {conectado ? "Conectado" : "Não configurado"}
                </Badge>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {conectado ? (
                  status.tipo === "ok" ? (
                    <>
                      Última sincronização às <strong>{status.horario}</strong> ·{" "}
                      {status.quantidade} produto(s) carregado(s).
                    </>
                  ) : status.tipo === "erro" ? (
                    <span className="text-destructive">
                      Erro: {status.mensagem}
                    </span>
                  ) : (
                    'Clique em "Sincronizar" para puxar o catálogo do Supabase.'
                  )
                ) : (
                  <>
                    Crie o arquivo <code className="rounded bg-muted px-1">.env.local</code>{" "}
                    com <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> e{" "}
                    <code className="rounded bg-muted px-1">VITE_SUPABASE_ANON_KEY</code>{" "}
                    e reinicie o servidor.
                  </>
                )}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="self-start text-[10px]">
            <Lock className="mr-1 h-3 w-3" />
            Read-only
          </Badge>
        </CardContent>
      </Card>

      {status.tipo === "ok" && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Catálogo sincronizado com sucesso. {status.quantidade} produto(s)
            ativo(s) no banco V4.
          </span>
        </div>
      )}
      {status.tipo === "erro" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{status.mensagem}</span>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto, descrição ou variação"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Categoria:</span>
            <select
              value={filtroCat}
              onChange={(e) => setFiltroCat(e.target.value as CategoriaV4 | "all")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-title-card">Nenhum produto disponível</p>
            <p className="text-body">
              Verifique a conexão com o banco V4 ou ajuste os filtros.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtrados.map((p) => {
            const usos = contagemUso(p.id);
            const variacoesAtivas = p.variacoes.filter((v) => v.ativo);
            return (
              <Card key={p.id} className="h-full">
                <CardContent className="space-y-3 p-5">
                  <div>
                    <Badge variant={variantCategoria(p.categoria)}>
                      {CATEGORIAS.find((c) => c.value === p.categoria)?.label}
                    </Badge>
                    <p className="mt-2 text-title-card leading-tight">{p.nome}</p>
                    {p.descricao && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.descricao}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-y border-border/60 py-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Modelo</p>
                      <p className="text-sm font-semibold text-foreground">
                        {p.modelo_cobranca_padrao === "recorrente"
                          ? "Recorrente"
                          : "One-time"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sugerido</p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {p.valor_sugerido ? formatCurrency(p.valor_sugerido) : "—"}
                      </p>
                    </div>
                  </div>

                  {variacoesAtivas.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Variações ({variacoesAtivas.length})
                      </p>
                      <ul className="space-y-1">
                        {variacoesAtivas.map((v) => (
                          <li
                            key={v.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs"
                          >
                            <span className="flex items-center gap-1.5 text-foreground">
                              <span className="font-medium">{v.nome}</span>
                              {v.percentual !== undefined && (
                                <Badge variant="outline" className="text-[9px]">
                                  {v.percentual}%
                                </Badge>
                              )}
                            </span>
                            {v.valor_sugerido !== undefined && (
                              <span className="tabular-nums text-muted-foreground">
                                {formatCurrency(v.valor_sugerido)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link2 className="h-3 w-3" />
                    <span>
                      {usos === 0 ? (
                        "Nenhum projeto ativo usando"
                      ) : (
                        <>
                          <span className="font-semibold text-foreground tabular-nums">
                            {usos}
                          </span>{" "}
                          {usos === 1 ? "projeto ativo" : "projetos ativos"} vinculado
                          {usos === 1 ? "" : "s"}
                        </>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
