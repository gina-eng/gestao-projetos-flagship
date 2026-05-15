import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
