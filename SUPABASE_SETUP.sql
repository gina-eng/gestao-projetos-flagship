-- ────────────────────────────────────────────────────────────────────────
-- (Opcional) Permitir leitura pública da tabela `products` via anon key.
-- ────────────────────────────────────────────────────────────────────────
-- Você só precisa rodar isto SE o app der erro de permissão (PGRST301 ou
-- "permission denied") ao clicar em "Sincronizar".
--
-- Como rodar: Supabase → SQL Editor → New query → cola tudo → RUN.
-- ────────────────────────────────────────────────────────────────────────

alter table public.products enable row level security;

drop policy if exists "leitura publica products" on public.products;
create policy "leitura publica products"
  on public.products for select
  using (true);
