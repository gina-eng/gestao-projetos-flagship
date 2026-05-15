import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  CategoriaV4,
  ItemNegociacao,
  Produto,
  Projeto,
  TipoNegociacao,
} from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mapeia a categoria V4 do produto para a variant visual usada em Badges
// e o tone dos StatBoxes. Centralizado aqui pra manter consistência.
export type CategoriaTone =
  | "saber"
  | "ter"
  | "executar"
  | "potencializar"
  | "destrava";

export function variantCategoria(c?: string | null): CategoriaTone | "outline" {
  switch (c) {
    case "SABER":
      return "saber";
    case "TER":
      return "ter";
    case "EXECUTAR":
      return "executar";
    case "POTENCIALIZAR":
      return "potencializar";
    case "DESTRAVA_RECEITA":
      return "destrava";
    default:
      return "outline";
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateInput(date: string | Date | undefined | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Gera um UUID v4 válido (compatível com Postgres `uuid` PK no Supabase).
// O parâmetro `_prefix` é mantido por compatibilidade com chamadas legadas,
// mas é ignorado — IDs precisam ser UUIDs puros para passar no schema.
export function uid(_prefix = ""): string {
  // Browser moderno: crypto.randomUUID() (Chrome 92+, FF 95+, Safari 15.4+).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (RFC 4122 v4) para ambientes sem crypto.randomUUID.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface NomeComposto {
  produto?: { nome: string; variacoes?: { id: string; nome: string }[] };
  variacao_id?: string;
}

export function nomeProduto(p: NomeComposto): string {
  if (!p.produto) return "—";
  const variacao = p.variacao_id
    ? p.produto.variacoes?.find((v) => v.id === p.variacao_id)
    : undefined;
  return variacao ? `${p.produto.nome} · ${variacao.nome}` : p.produto.nome;
}

interface ClienteSegmento {
  segmento?: string;
  segmento_outro?: string;
}

// Retorna o label legível do segmento. Se for "outros", usa o texto livre.
export function labelSegmento(
  cliente: ClienteSegmento | undefined,
  mapa: Record<string, string>
): string {
  if (!cliente?.segmento) return "—";
  if (cliente.segmento === "outros") {
    return cliente.segmento_outro?.trim() || "Outros";
  }
  return mapa[cliente.segmento] ?? cliente.segmento;
}

// ─── Helpers de negociação (múltiplos produtos por projeto) ───

// Retorna a lista efetiva de itens do projeto. Faz fallback para o `produto_id`
// legado quando `itens` está vazio (projetos criados antes da feature).
export function itensDoProjeto(projeto: Projeto): ItemNegociacao[] {
  if (projeto.itens && projeto.itens.length > 0) return projeto.itens;
  if (projeto.produto_id) {
    return [
      {
        id: `legacy_${projeto.id}`,
        produto_id: projeto.produto_id,
        variacao_id: projeto.variacao_id,
      },
    ];
  }
  return [];
}

// Resolve cada item para o produto correspondente no catálogo.
export function produtosDoProjeto(
  projeto: Projeto,
  produtos: Produto[]
): { item: ItemNegociacao; produto: Produto | undefined }[] {
  return itensDoProjeto(projeto).map((item) => ({
    item,
    produto: produtos.find((p) => p.id === item.produto_id),
  }));
}

// Set de categorias presentes no projeto (deriva dos produtos vinculados).
export function categoriasDoProjeto(
  projeto: Projeto,
  produtos: Produto[]
): CategoriaV4[] {
  const set = new Set<CategoriaV4>();
  for (const { produto } of produtosDoProjeto(projeto, produtos)) {
    if (produto) set.add(produto.categoria);
  }
  return Array.from(set);
}

// Conjunto de categorias compatíveis com cada tipo de negociação.
// EXECUTAR fica sozinho num bloco. Os demais (Saber/Ter/Destrava Receita/
// Potencializar) ficam juntos em bloco one-time.
export function categoriasDoTipo(tipo: TipoNegociacao): CategoriaV4[] {
  if (tipo === "recorrente_executar") return ["EXECUTAR"];
  return ["SABER", "TER", "DESTRAVA_RECEITA", "POTENCIALIZAR"];
}

// Tipo de negociação inferido a partir da categoria do produto.
export function tipoNegociacaoDaCategoria(
  cat: CategoriaV4 | undefined | null
): TipoNegociacao {
  return cat === "EXECUTAR" ? "recorrente_executar" : "one_time";
}

export const TIPO_NEGOCIACAO_LABEL: Record<TipoNegociacao, string> = {
  one_time: "One-time (Saber/Ter/Destrava Receita/Potencializar)",
  recorrente_executar: "Recorrente (Executar)",
};

export const TIPO_NEGOCIACAO_LABEL_CURTO: Record<TipoNegociacao, string> = {
  one_time: "One-time",
  recorrente_executar: "Executar",
};

export function suggestSigla(nomeFantasia: string): string {
  const clean = nomeFantasia
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, "");
  const palavras = clean.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "";
  if (palavras.length === 1) return palavras[0].slice(0, 4);
  const first = palavras[0].slice(0, 3);
  const second = palavras[1].slice(0, 1);
  return (first + second).slice(0, 5);
}
