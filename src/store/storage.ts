// Camada de persistência. Hoje: localStorage. Amanhã: troca por API HTTP
// sem alterar o restante do código.

const PREFIX = "v4gp:";

export function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeKey<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export const STORAGE_KEYS = {
  clientes: "clientes",
  investidores: "investidores",
  produtos: "produtos",
  projetos: "projetos",
  pagamentos: "pagamentos",
  fases: "fases",
  auditoria: "auditoria",
  usuarios: "usuarios",
  sessao: "sessao",
  // bump quando o schema do seed muda — força re-seed limpo
  seedDone: "seed_done_v10",
} as const;
