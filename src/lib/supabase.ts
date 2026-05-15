import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Dois Supabase clients separados:
//
// 1. `supabase` (principal) — dados da aplicação + autenticação.
//    Hoje é onde vivem clientes, projetos, pagamentos, parcelas, investidores,
//    fases, reuniões, contatos e auditoria. Auth Supabase configurada nesse
//    projeto (restrita a e-mails @v4company.com via trigger no DB).
//    Envs: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
//
// 2. `supabaseCatalog` (secundário) — apenas leitura do catálogo de produtos
//    V4 (tabela `products`). Mantido em projeto separado por questão de
//    domínio (catálogo é fonte de verdade externa). Não requer auth.
//    Envs: VITE_SUPABASE_CATALOG_URL + VITE_SUPABASE_CATALOG_ANON_KEY
//
// Os dois clients podem coexistir sem conflito — são instâncias HTTP isoladas
// que apontam pra projetos Supabase diferentes.
// ============================================================================

const appUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const appKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const catalogUrl = import.meta.env.VITE_SUPABASE_CATALOG_URL as string | undefined;
const catalogKey = import.meta.env.VITE_SUPABASE_CATALOG_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  appUrl && appKey
    ? createClient(appUrl, appKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const supabaseCatalog: SupabaseClient | null =
  catalogUrl && catalogKey ? createClient(catalogUrl, catalogKey) : null;

export function supabaseConfigurado(): boolean {
  return supabase !== null;
}

export function supabaseCatalogConfigurado(): boolean {
  return supabaseCatalog !== null;
}
