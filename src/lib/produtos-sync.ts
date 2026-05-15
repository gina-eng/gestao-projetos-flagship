import { supabase, supabaseConfigurado } from "./supabase";
import { CategoriaV4, Produto } from "@/types";

// Schema REAL da tabela `products` no Supabase (V4):
// - id           uuid
// - produto      text                   → nome do produto
// - categoria    categoria_produto      → enum lowercase (saber/ter/executar/potencializar)
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
];

const TABELA = import.meta.env.VITE_SUPABASE_PRODUTOS_TABLE || "products";

function mapearProduto(row: ProdutoRow): Produto {
  // categoria vem em lowercase ("saber"), normaliza pro nosso enum
  const catUpper = (row.categoria ?? "").toUpperCase() as CategoriaV4;
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
  if (!supabaseConfigurado() || !supabase) {
    return {
      ok: false,
      erro:
        "Conexão com Supabase não configurada. Crie o arquivo .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    };
  }

  const { data, error } = await supabase
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
