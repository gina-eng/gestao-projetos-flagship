-- ============================================================================
-- Gestão de Projetos V4 — Schema Supabase
-- ============================================================================
-- Como rodar:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Cola TUDO desse arquivo
--   3. RUN
--
-- Idempotente: pode rodar várias vezes (usa "if not exists" / "or replace").
-- Workspace único: todos os usuários autenticados @v4company.com veem tudo.
-- ============================================================================

-- ─── EXTENSÕES ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto" with schema extensions;

-- ─── CONSTANTES DE ACESSO ─────────────────────────────────────────────────
-- Quem pode acessar:
--   1. gina@v4company.com (admin master, passe livre)
--   2. Qualquer e-mail que esteja cadastrado em `public.investidores` com
--      status = 'ativo'.
-- E-mails de outros domínios são sempre bloqueados.

-- Função pública (sem auth) que diz se um e-mail tem permissão.
-- Usada pelo frontend antes do signup/login pra mostrar mensagem amigável.
create or replace function public.is_authorized(email_check text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with norm as (select lower(coalesce(email_check, '')) as e)
  select coalesce(
    (select e from norm) = 'gina@v4company.com'
    or exists (
      select 1 from public.investidores i, norm
      where lower(i.email) = norm.e
        and i.status = 'ativo'
    ),
    false
  );
$$;

-- Permite que qualquer um (anon + authenticated) chame is_authorized.
grant execute on function public.is_authorized(text) to anon, authenticated;

-- ─── GUARD DE SIGNUP ──────────────────────────────────────────────────────
-- Bloqueia inserções em auth.users que não passem na is_authorized().
create or replace function public.enforce_investidor_ou_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
begin
  -- Domínio @v4company.com obrigatório (defesa adicional).
  if right(v_email, length('@v4company.com')) <> '@v4company.com' then
    raise exception 'Apenas e-mails @v4company.com podem se cadastrar.';
  end if;
  -- Admin master ou investidor ativo.
  if not public.is_authorized(v_email) then
    raise exception 'E-mail não autorizado. Solicite o cadastro como investidor ativo.';
  end if;
  return new;
end;
$$;

-- Remove trigger antigo (se existir) e cria o novo.
drop trigger if exists on_auth_user_created_check_domain on auth.users;
drop trigger if exists on_auth_user_created_check_access on auth.users;
create trigger on_auth_user_created_check_access
  before insert on auth.users
  for each row execute function public.enforce_investidor_ou_admin();

-- ─── HELPER: usuário autenticado tem permissão? ──────────────────────────
-- Usado nas policies de RLS. Lê o e-mail do JWT da requisição atual e
-- delega para is_authorized().
create or replace function public.is_v4company_user()
returns boolean
language sql
stable
as $$
  select public.is_authorized((auth.jwt() ->> 'email')::text);
$$;

-- ─── TABELAS ──────────────────────────────────────────────────────────────

-- Investidores (membros da unidade que entram em squads)
create table if not exists public.investidores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  funcao_principal text not null,
  funcoes_secundarias text[] not null default '{}',
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  data_entrada date not null,
  data_saida date,
  foto_url text,
  usuario_id uuid,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Fases do kanban de projetos (CRUD pelo operador)
create table if not exists public.fases (
  id text primary key,
  nome text not null,
  descricao text,
  ordem int not null,
  criado_em timestamptz not null default now()
);

-- Clientes
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text,
  segmento text,
  segmento_outro text,
  nicho text,
  regiao_atuacao text,
  modelo_vendas text[] not null default '{}',
  tier text not null default 'small',
  endereco text,
  cidade text,
  estado text,
  status text not null default 'em_fechamento'
    check (status in ('em_fechamento','ativo','inativo','churn','excluido')),
  data_cadastro date not null default current_date,
  data_churn date,
  motivo_churn text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Contatos / stakeholders do cliente
create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  cargo text,
  email text,
  telefone text,
  contexto text,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- Conexões externas do cliente (WhatsApp, CRM, etc.)
create table if not exists public.conexoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  sistema text not null,
  id_externo text,
  url text,
  observacao text,
  criado_em timestamptz not null default now()
);

-- Projetos
create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  produto_id text not null,                -- referencia products.id (catálogo externo V4)
  variacao_id text,
  nome text not null,
  modelo_cobranca text not null check (modelo_cobranca in ('one_time','recorrente')),
  valor_total numeric(14,2) not null default 0,
  valor_tcv numeric(14,2),
  forma_pagamento text check (forma_pagamento in ('pix','boleto','cheque','cartao_recorrente','cartao')),
  num_parcelas int check (num_parcelas between 1 and 12),
  fase_atual text not null references public.fases(id),
  data_assinatura date not null,
  data_inicio date not null,
  data_kickoff date,
  data_inicio_pagamento date,
  lt_meses int,
  oportunidade_crm_url text,
  whatsapp_grupo_url text,
  contrato_url text,
  transcricao_venda_url text,
  transcricao_qualificacao_url text,
  transcricao_plano_voo_url text,
  contexto_inicial text,
  data_conclusao_prevista date,
  data_conclusao_real date,
  status text not null default 'ativo' check (status in ('ativo','pausado','concluido','churn')),
  motivo_churn text,
  plano_roi text,
  saude_atual text not null default 'saudavel'
    check (saude_atual in ('saudavel','alerta','cuidado','critico')),
  origem text not null check (origem in ('aquisicao','upsell','indicacao','renovacao')),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_projetos_cliente_id on public.projetos(cliente_id);
create index if not exists idx_projetos_fase on public.projetos(fase_atual);
create index if not exists idx_projetos_status on public.projetos(status);

-- Squad alocado num projeto
create table if not exists public.squad_membros (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  investidor_id uuid not null references public.investidores(id) on delete restrict,
  funcao text not null,
  data_entrada date not null default current_date,
  data_saida date,
  principal boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (projeto_id, investidor_id)
);

-- Reuniões do projeto
create table if not exists public.reunioes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  data date not null,
  titulo text,
  tipo text not null,
  participantes text,
  transcricao_url text,
  gravacao_url text,
  sentimento text not null default 'neutro',
  resumo text,
  proximos_passos text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Links rápidos do projeto
create table if not exists public.links_rapidos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  label text not null,
  url text not null,
  ordem int not null default 0
);

-- Pagamentos do projeto
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','recorrente','parcelado')),
  metodo text not null,
  valor_total numeric(14,2) not null,
  num_parcelas int not null,
  data_primeira_parcela date not null,
  periodicidade text not null check (periodicidade in ('mensal','trimestral','unica','personalizada')),
  status_geral text not null default 'ativo' check (status_geral in ('ativo','concluido','cancelado')),
  observacoes text,
  -- Pagamento "espelho" do projeto: sincronizado automaticamente a partir
  -- dos campos valor_tcv + num_parcelas + forma_pagamento + data_inicio_pagamento.
  -- Quando true, é gerenciado pelo sistema e regenerado a cada save do projeto
  -- (preservando parcelas pagas).
  auto_gerado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pagamentos_projeto on public.pagamentos(projeto_id);

-- Migração idempotente: garante a coluna em bancos pré-existentes.
alter table public.pagamentos
  add column if not exists auto_gerado boolean not null default false;

-- Parcelas dos pagamentos
create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  numero int not null,
  valor numeric(14,2) not null,
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'previsto' check (status in ('previsto','pago','atrasado','cancelado')),
  comprovante_url text,
  observacao text,
  unique (pagamento_id, numero)
);

create index if not exists idx_parcelas_pagamento on public.parcelas(pagamento_id);
create index if not exists idx_parcelas_status on public.parcelas(status);

-- Oportunidades de vendas (cross-sell/upsell a partir de clientes ativos).
-- Vinculada APENAS ao cliente, não a projeto.
-- 4 etapas: identificada → avancando → fechado_ganho / fechado_perdido
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  projeto_id uuid references public.projetos(id) on delete set null,
  produto_id text not null,                -- referencia products.id (catálogo V4)
  variacao_id text,
  nome text not null,
  valor_estimado numeric(14,2) not null default 0,
  modelo_cobranca text not null default 'recorrente'
    check (modelo_cobranca in ('one_time','recorrente')),
  lt_meses int,
  responsavel_id uuid references public.investidores(id) on delete set null,
  etapa text not null default 'identificada'
    check (etapa in ('identificada','avancando','fechado_ganho','fechado_perdido')),
  motivo_perda text,
  proxima_acao text,
  data_proxima_acao date,
  data_fechamento_prevista date,
  data_fechamento_real date,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_oportunidades_cliente on public.oportunidades(cliente_id);
create index if not exists idx_oportunidades_etapa on public.oportunidades(etapa);
create index if not exists idx_oportunidades_responsavel on public.oportunidades(responsavel_id);

-- ─── Migração 2026-05: 5 etapas → 4 etapas + remove origem_projeto_id ────
-- Idempotente: detecta dados antigos e migra. Sem efeito se já está OK.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'oportunidades'
      and column_name = 'origem_projeto_id'
  ) then
    alter table public.oportunidades drop column origem_projeto_id;
  end if;
end$$;

-- Drop check antigo (5 etapas) se ainda existir, migra dados, recria check.
alter table public.oportunidades drop constraint if exists oportunidades_etapa_check;

update public.oportunidades set etapa = 'avancando'
  where etapa in ('em_negociacao', 'proposta_enviada');
update public.oportunidades set etapa = 'fechado_ganho'
  where etapa = 'ganha';
update public.oportunidades set etapa = 'fechado_perdido'
  where etapa = 'perdida';

alter table public.oportunidades add constraint oportunidades_etapa_check
  check (etapa in ('identificada','avancando','fechado_ganho','fechado_perdido'));

-- ─── Migração 2026-05-15: re-introduz projeto_id (opcional) ─────────────
-- Permite vincular uma oportunidade a um projeto específico do cliente.
-- Útil para mapear "qual projeto gera mais oportunidades de upsell".
alter table public.oportunidades
  add column if not exists projeto_id uuid
  references public.projetos(id) on delete set null;
create index if not exists idx_oportunidades_projeto
  on public.oportunidades(projeto_id);

-- ─── Migração 2026-05-15: adicionar 'excluido' ao StatusCliente ─────────
-- Permite distinguir cliente removido manualmente pelo operador (excluido)
-- de cliente sem projeto ativo no momento (inativo). Idempotente.
alter table public.clientes drop constraint if exists clientes_status_check;
alter table public.clientes add constraint clientes_status_check
  check (status in ('em_fechamento','ativo','inativo','churn','excluido'));

-- Auditoria (append-only)
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  usuario_id uuid,
  usuario_email text,
  usuario_nome text,
  entidade text not null,
  entidade_id text not null,
  entidade_label text not null,
  pai_entidade text,
  pai_id text,
  acao text not null check (acao in ('criar','atualizar','remover','evento')),
  resumo text not null,
  mudancas jsonb not null default '[]'::jsonb
);

create index if not exists idx_auditoria_entidade on public.auditoria(entidade, entidade_id);
create index if not exists idx_auditoria_pai on public.auditoria(pai_id);
create index if not exists idx_auditoria_ts on public.auditoria(ts desc);

-- ─── TRIGGER: atualizar `atualizado_em` automaticamente ────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select unnest(array['clientes','projetos','reunioes','investidores','oportunidades'])
  loop
    execute format(
      'drop trigger if exists trg_touch_%I on public.%I;
       create trigger trg_touch_%I before update on public.%I
         for each row execute function public.touch_updated_at();',
      t, t, t, t
    );
  end loop;
end$$;

-- ─── RLS (workspace único, qualquer @v4company.com vê tudo) ───────────────
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'investidores','fases','clientes','contatos','conexoes',
      'projetos','squad_membros','reunioes','links_rapidos',
      'pagamentos','parcelas','auditoria','oportunidades'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "v4 select" on public.%I;', t);
    execute format(
      'create policy "v4 select" on public.%I for select to authenticated
         using (public.is_v4company_user());', t
    );

    execute format('drop policy if exists "v4 insert" on public.%I;', t);
    execute format(
      'create policy "v4 insert" on public.%I for insert to authenticated
         with check (public.is_v4company_user());', t
    );

    execute format('drop policy if exists "v4 update" on public.%I;', t);
    execute format(
      'create policy "v4 update" on public.%I for update to authenticated
         using (public.is_v4company_user())
         with check (public.is_v4company_user());', t
    );

    execute format('drop policy if exists "v4 delete" on public.%I;', t);
    execute format(
      'create policy "v4 delete" on public.%I for delete to authenticated
         using (public.is_v4company_user());', t
    );
  end loop;
end$$;

-- A tabela `products` (catálogo V4) tem RLS própria; mantém leitura pública
-- conforme SUPABASE_SETUP.sql na raiz do projeto.

-- ─── SEED DE FASES PADRÃO ─────────────────────────────────────────────────
-- Insere as fases default só se a tabela estiver vazia.
insert into public.fases (id, nome, descricao, ordem)
select * from (values
  ('inicio',      'Início',                'Cliente recém-fechado.',     1),
  ('kickoff',     'Kickoff',               'Reunião de início realizada.',2),
  ('diagnostico', 'Diagnóstico / Setup',   'Levantamento e estrutura.',  3),
  ('execucao',    'Execução',              'Operação rodando.',          4),
  ('entrega',     'Entrega / Proposta',    'Entrega de marcos.',         5),
  ('followup',    'Follow-up',             'Acompanhamento próximo.',    6),
  ('concluido',   'Concluído',             'Projeto encerrado.',         7)
) as f(id, nome, descricao, ordem)
where not exists (select 1 from public.fases);

-- ============================================================================
-- Fim do schema.
-- ============================================================================
