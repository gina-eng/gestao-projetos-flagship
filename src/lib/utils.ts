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

export function uid(prefix = ""): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
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
