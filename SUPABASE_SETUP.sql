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

-- ────────────────────────────────────────────────────────────────────────
-- Negociações: múltiplos produtos por projeto + agrupamento por venda.
-- ────────────────────────────────────────────────────────────────────────
-- Rode este bloco para habilitar a estrutura nova de Handoff/Projetos onde
-- 1 venda pode gerar até 2 cards (One-time vs Executar) compartilhando o
-- mesmo `venda_id` e cada um listando N produtos.
-- ────────────────────────────────────────────────────────────────────────

alter table public.projetos
  add column if not exists itens jsonb,
  add column if not exists tipo_negociacao text,
  add column if not exists venda_id text,
  add column if not exists venda_seq integer,
  add column if not exists venda_letra text;
