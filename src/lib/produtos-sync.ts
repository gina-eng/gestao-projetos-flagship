import { supabaseCatalog, supabaseCatalogConfigurado } from "./supabase";
import { CategoriaV4, Produto } from "@/types";

// Schema REAL da tabela `products` no Supabase (V4):
// - id           uuid
// - produto      text                   → nome do produto
// - categoria    categoria_produto      → enum lowercase (saber/ter/executar/potencializar/destrava_receita)
// - duracao      text                   → "Recorrente" ou número (dias/meses) ou null
// - dono         text                   → responsável (não usado aqui)
// - valor        text                   → preço numérico como string ("8070.95")
interface ProdutoRow {
  id: string;
  produto: string;
  categoria: string | null;
  duracao: string | null;
  dono: string | null;
  valor: string | null;
}

const CATEGORIAS_VALIDAS: CategoriaV4[] = [
  "SABER",
  "TER",
  "EXECUTAR",
  "POTENCIALIZAR",
  "DESTRAVA_RECEITA",
];

const TABELA = import.meta.env.VITE_SUPABASE_PRODUTOS_TABLE || "products";

function mapearProduto(row: ProdutoRow): Produto {
  // categoria vem em lowercase ("saber") ou com espaços ("destrava receita").
  // Normaliza espaços/hífens em underscore e upper-case antes de comparar.
  const catUpper = (row.categoria ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase() as CategoriaV4;
  const categoria = CATEGORIAS_VALIDAS.includes(catUpper)
    ? catUpper
    : "EXECUTAR";

  // duracao "Recorrente" (qualquer caixa) → recorrente; resto → one_time
  const ehRecorrente =
    (row.duracao ?? "").trim().toLowerCase() === "recorrente";
  const modelo: "recorrente" | "one_time" = ehRecorrente
    ? "recorrente"
    : "one_time";

  // valor é text no banco → converte para número
  const valorParsed = row.valor ? parseFloat(row.valor) : NaN;
  const valor_sugerido = Number.isFinite(valorParsed) ? valorParsed : undefined;

  // Se duração não for "Recorrente" e tiver algum valor, exibe como descrição
  // (preserva "21", "30 dias", etc. que aparecem em alguns produtos)
  const descricao =
    row.duracao && !ehRecorrente && row.duracao.trim() !== ""
      ? `Duração: ${row.duracao}`
      : undefined;

  return {
    id: row.id,
    nome: row.produto,
    categoria,
    descricao,
    modelo_cobranca_padrao: modelo,
    valor_sugerido,
    ativo: true,
    externo_id: row.id,
    variacoes: [], // tabela atual não tem variações separadas
  };
}

export interface ResultadoSincronizacao {
  ok: boolean;
  quantidade?: number;
  produtos?: Produto[];
  erro?: string;
}

export async function buscarProdutosSupabase(): Promise<ResultadoSincronizacao> {
  if (!supabaseCatalogConfigurado() || !supabaseCatalog) {
    return {
      ok: false,
      erro:
        "Catálogo Supabase não configurado. Defina VITE_SUPABASE_CATALOG_URL e VITE_SUPABASE_CATALOG_ANON_KEY no .env.local.",
    };
  }

  const { data, error } = await supabaseCatalog
    .from(TABELA)
    .select("id, produto, categoria, duracao, dono, valor")
    .order("produto", { ascending: true });

  if (error) {
    let dica = "";
    if (
      error.code === "PGRST301" ||
      error.message.toLowerCase().includes("permission") ||
      error.message.toLowerCase().includes("rls")
    ) {
      dica =
        " (RLS bloqueando: adicione uma policy de SELECT pública na tabela products)";
    } else if (
      error.code === "PGRST205" ||
      error.message.toLowerCase().includes("not find")
    ) {
      dica = ` (tabela "${TABELA}" não encontrada — verifique o nome)`;
    }
    return {
      ok: false,
      erro: `Erro do Supabase: ${error.message}${dica}`,
    };
  }

  const produtos = (data ?? []).map((row) =>
    mapearProduto(row as unknown as ProdutoRow)
  );

  return {
    ok: true,
    quantidade: produtos.length,
    produtos,
  };
}
