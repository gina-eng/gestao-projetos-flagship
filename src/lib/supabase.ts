import { createClient, SupabaseClient } from "@supabase/supabase-js";

// As credenciais do Supabase vivem em variáveis de ambiente (arquivo .env.local).
// Veja .env.local.example para um modelo. Se o arquivo não existir, o cliente
// fica `null` e a sincronização exibe um erro amigável em vez de quebrar.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export function supabaseConfigurado(): boolean {
  return supabase !== null;
}
