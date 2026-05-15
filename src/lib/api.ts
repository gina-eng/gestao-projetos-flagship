// ============================================================================
// API: wrappers de Supabase para todas as entidades do app.
// ============================================================================
// - Cada entidade tem mappers row↔interface e funções fetch/upsert/delete.
// - Tabelas com sub-coleções (clientes→contatos/conexoes, projetos→
//   squad/reunioes/links_rapidos) usam estratégia delete-all-then-insert no
//   upsert: simples, sem precisar diferenciar inserts/updates/removes.
// - Erros propagam como exceptions; chamadores tratam com try/catch.
// ============================================================================

import { supabase } from "./supabase";
import {
  Cliente,
  ConexaoCliente,
  ContatoCliente,
  Fase,
  Investidor,
  ItemNegociacao,
  LinkRapido,
  Oportunidade,
  Pagamento,
  Parcela,
  Projeto,
  RegistroAuditoria,
  ReuniaoProjeto,
  SquadMembro,
} from "@/types";

function db() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }
  return supabase;
}

function throwIfError(error: unknown): asserts error is null {
  if (error) {
    const e = error as { message?: string; details?: string };
    throw new Error(e.message ?? "Erro do Supabase");
  }
}

// ─── INVESTIDORES ────────────────────────────────────────────────────────

export async function fetchInvestidores(): Promise<Investidor[]> {
  const { data, error } = await db()
    .from("investidores")
    .select("*")
    .order("nome", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(rowToInvestidor);
}

function rowToInvestidor(r: Record<string, unknown>): Investidor {
  return {
    id: r.id as string,
    nome: r.nome as string,
    email: r.email as string,
    telefone: (r.telefone as string) ?? undefined,
    funcao_principal: r.funcao_principal as Investidor["funcao_principal"],
    funcoes_secundarias: (r.funcoes_secundarias as Investidor["funcoes_secundarias"]) ?? [],
    status: r.status as Investidor["status"],
    data_entrada: r.data_entrada as string,
    data_saida: (r.data_saida as string) ?? undefined,
    foto_url: (r.foto_url as string) ?? undefined,
    usuario_id: (r.usuario_id as string) ?? undefined,
    observacoes: (r.observacoes as string) ?? undefined,
  };
}

function investidorToRow(i: Investidor): Record<string, unknown> {
  return {
    id: i.id,
    nome: i.nome,
    email: i.email,
    telefone: i.telefone ?? null,
    funcao_principal: i.funcao_principal,
    funcoes_secundarias: i.funcoes_secundarias,
    status: i.status,
    data_entrada: i.data_entrada,
    data_saida: i.data_saida ?? null,
    foto_url: i.foto_url ?? null,
    usuario_id: i.usuario_id ?? null,
    observacoes: i.observacoes ?? null,
  };
}

export async function upsertInvestidor(i: Investidor): Promise<void> {
  const { error } = await db().from("investidores").upsert(investidorToRow(i));
  throwIfError(error);
}

export async function deleteInvestidor(id: string): Promise<void> {
  const { error } = await db()
    .from("investidores")
    .update({ status: "inativo", data_saida: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  throwIfError(error);
}

// ─── FASES ────────────────────────────────────────────────────────────────

export async function fetchFases(): Promise<Fase[]> {
  const { data, error } = await db()
    .from("fases")
    .select("*")
    .order("ordem", { ascending: true });
  throwIfError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    descricao: r.descricao ?? undefined,
    ordem: r.ordem,
  }));
}

export async function upsertFase(f: Fase): Promise<void> {
  const { error } = await db().from("fases").upsert({
    id: f.id,
    nome: f.nome,
    descricao: f.descricao ?? null,
    ordem: f.ordem,
  });
  throwIfError(error);
}

export async function deleteFase(id: string): Promise<void> {
  const { error } = await db().from("fases").delete().eq("id", id);
  throwIfError(error);
}

export async function reordenarFases(ids: string[]): Promise<void> {
  // Atualiza `ordem` de cada fase. Faz em paralelo.
  const ops = ids.map((id, idx) =>
    db().from("fases").update({ ordem: idx + 1 }).eq("id", id)
  );
  const results = await Promise.all(ops);
  for (const r of results) throwIfError(r.error);
}

// ─── CLIENTES (+ contatos, conexões) ─────────────────────────────────────

export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await db()
    .from("clientes")
    .select("*, contatos(*), conexoes(*)")
    .order("nome_fantasia", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(rowToCliente);
}

function rowToCliente(r: Record<string, unknown>): Cliente {
  const contatosRows = (r.contatos as Record<string, unknown>[] | null) ?? [];
  const conexoesRows = (r.conexoes as Record<string, unknown>[] | null) ?? [];
  return {
    id: r.id as string,
    sigla: r.sigla as string,
    razao_social: r.razao_social as string,
    nome_fantasia: r.nome_fantasia as string,
    cnpj: (r.cnpj as string) ?? undefined,
    segmento: (r.segmento as Cliente["segmento"]) ?? undefined,
    segmento_outro: (r.segmento_outro as string) ?? undefined,
    nicho: (r.nicho as string) ?? undefined,
    regiao_atuacao: (r.regiao_atuacao as Cliente["regiao_atuacao"]) ?? undefined,
    modelo_vendas: (r.modelo_vendas as Cliente["modelo_vendas"]) ?? [],
    tier: r.tier as Cliente["tier"],
    endereco: (r.endereco as string) ?? undefined,
    cidade: (r.cidade as string) ?? undefined,
    estado: (r.estado as string) ?? undefined,
    contatos: contatosRows
      .sort((a, b) => ((a.ordem as number) ?? 0) - ((b.ordem as number) ?? 0))
      .map(
        (c): ContatoCliente => ({
          id: c.id as string,
          nome: c.nome as string,
          cargo: (c.cargo as string) ?? undefined,
          email: (c.email as string) ?? undefined,
          telefone: (c.telefone as string) ?? undefined,
          contexto: (c.contexto as string) ?? undefined,
        })
      ),
    conexoes: conexoesRows.map(
      (c): ConexaoCliente => ({
        id: c.id as string,
        cliente_id: c.cliente_id as string,
        sistema: c.sistema as ConexaoCliente["sistema"],
        id_externo: (c.id_externo as string) ?? undefined,
        url: (c.url as string) ?? undefined,
        observacao: (c.observacao as string) ?? undefined,
      })
    ),
    status: r.status as Cliente["status"],
    data_cadastro: r.data_cadastro as string,
    data_churn: (r.data_churn as string) ?? undefined,
    motivo_churn: (r.motivo_churn as Cliente["motivo_churn"]) ?? undefined,
    observacoes: (r.observacoes as string) ?? undefined,
  };
}

export async function upsertCliente(c: Cliente): Promise<void> {
  const supa = db();
  const { error: errCli } = await supa.from("clientes").upsert({
    id: c.id,
    sigla: c.sigla,
    razao_social: c.razao_social,
    nome_fantasia: c.nome_fantasia,
    cnpj: c.cnpj ?? null,
    segmento: c.segmento ?? null,
    segmento_outro: c.segmento_outro ?? null,
    nicho: c.nicho ?? null,
    regiao_atuacao: c.regiao_atuacao ?? null,
    modelo_vendas: c.modelo_vendas,
    tier: c.tier,
    endereco: c.endereco ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
    status: c.status,
    data_cadastro: c.data_cadastro,
    data_churn: c.data_churn ?? null,
    motivo_churn: c.motivo_churn ?? null,
    observacoes: c.observacoes ?? null,
  });
  throwIfError(errCli);

  // Estratégia delete-all-then-insert para sub-tabelas. Simples e correto.
  const { error: errDelCt } = await supa
    .from("contatos")
    .delete()
    .eq("cliente_id", c.id);
  throwIfError(errDelCt);
  if (c.contatos.length > 0) {
    const { error: errCt } = await supa.from("contatos").insert(
      c.contatos.map((ct, idx) => ({
        id: ct.id,
        cliente_id: c.id,
        nome: ct.nome,
        cargo: ct.cargo ?? null,
        email: ct.email ?? null,
        telefone: ct.telefone ?? null,
        contexto: ct.contexto ?? null,
        ordem: idx,
      }))
    );
    throwIfError(errCt);
  }

  const { error: errDelCx } = await supa
    .from("conexoes")
    .delete()
    .eq("cliente_id", c.id);
  throwIfError(errDelCx);
  if (c.conexoes.length > 0) {
    const { error: errCx } = await supa.from("conexoes").insert(
      c.conexoes.map((cx) => ({
        id: cx.id,
        cliente_id: c.id,
        sistema: cx.sistema,
        id_externo: cx.id_externo ?? null,
        url: cx.url ?? null,
        observacao: cx.observacao ?? null,
      }))
    );
    throwIfError(errCx);
  }
}

export async function softDeleteCliente(id: string): Promise<void> {
  const { error } = await db()
    .from("clientes")
    .update({ status: "inativo" })
    .eq("id", id);
  throwIfError(error);
}

// Exclusão FÍSICA do cliente. Como `projetos.cliente_id` tem
// ON DELETE RESTRICT, o Postgres bloqueia se houver projetos vinculados —
// mapeamos esse erro para uma mensagem amigável.
export async function hardDeleteCliente(id: string): Promise<void> {
  const supa = db();
  // Limpa filhos manuais (contatos/conexoes têm ON DELETE CASCADE; deixar
  // o cascade fazer o trabalho).
  const { error } = await supa.from("clientes").delete().eq("id", id);
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (
      msg.includes("foreign key") ||
      msg.includes("violates") ||
      msg.includes("restrict")
    ) {
      throw new Error(
        "Existem projetos vinculados a este cliente. Exclua ou mova os projetos antes."
      );
    }
    throw new Error(error.message || "Erro ao excluir cliente.");
  }
}

export async function moveClienteStatus(id: string, status: Cliente["status"]): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "churn") {
    patch.data_churn = new Date().toISOString().slice(0, 10);
  } else {
    patch.data_churn = null;
    patch.motivo_churn = null;
  }
  const { error } = await db().from("clientes").update(patch).eq("id", id);
  throwIfError(error);
}

// ─── PROJETOS (+ squad, reuniões, links rápidos) ──────────────────────────

export async function fetchProjetos(): Promise<Projeto[]> {
  const { data, error } = await db()
    .from("projetos")
    .select("*, squad_membros(*), reunioes(*), links_rapidos(*)")
    .order("criado_em", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(rowToProjeto);
}

// Lê o JSON `itens` da coluna `projetos.itens` (jsonb no Supabase).
// Retorna undefined quando ausente — a UI usa `produto_id` legado.
function parseItens(raw: unknown): ItemNegociacao[] | undefined {
  if (!raw) return undefined;
  const arr =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })()
      : raw;
  if (!Array.isArray(arr)) return undefined;
  return arr
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .map((it) => ({
      id: String(it.id ?? ""),
      produto_id: String(it.produto_id ?? ""),
      variacao_id: it.variacao_id ? String(it.variacao_id) : undefined,
    }))
    .filter((it) => it.produto_id);
}

function rowToProjeto(r: Record<string, unknown>): Projeto {
  const squadRows = (r.squad_membros as Record<string, unknown>[] | null) ?? [];
  const reunioesRows = (r.reunioes as Record<string, unknown>[] | null) ?? [];
  const linksRows = (r.links_rapidos as Record<string, unknown>[] | null) ?? [];
  return {
    id: r.id as string,
    codigo: r.codigo as string,
    cliente_id: r.cliente_id as string,
    produto_id: r.produto_id as string,
    variacao_id: (r.variacao_id as string) ?? undefined,
    itens: parseItens(r.itens),
    tipo_negociacao:
      (r.tipo_negociacao as Projeto["tipo_negociacao"]) ?? undefined,
    venda_id: (r.venda_id as string) ?? undefined,
    venda_seq:
      r.venda_seq === null || r.venda_seq === undefined
        ? undefined
        : Number(r.venda_seq),
    venda_letra: (r.venda_letra as string) ?? undefined,
    nome: r.nome as string,
    modelo_cobranca: r.modelo_cobranca as Projeto["modelo_cobranca"],
    valor_total: Number(r.valor_total),
    valor_tcv:
      r.valor_tcv === null || r.valor_tcv === undefined
        ? undefined
        : Number(r.valor_tcv),
    forma_pagamento: (r.forma_pagamento as Projeto["forma_pagamento"]) ?? undefined,
    num_parcelas: (r.num_parcelas as number) ?? undefined,
    fase_atual: r.fase_atual as string,
    data_assinatura: r.data_assinatura as string,
    data_inicio: r.data_inicio as string,
    data_kickoff: (r.data_kickoff as string) ?? undefined,
    data_inicio_pagamento: (r.data_inicio_pagamento as string) ?? undefined,
    lt_meses: (r.lt_meses as number) ?? undefined,
    oportunidade_crm_url: (r.oportunidade_crm_url as string) ?? undefined,
    whatsapp_grupo_url: (r.whatsapp_grupo_url as string) ?? undefined,
    contrato_url: (r.contrato_url as string) ?? undefined,
    transcricao_venda_url: (r.transcricao_venda_url as string) ?? undefined,
    transcricao_qualificacao_url: (r.transcricao_qualificacao_url as string) ?? undefined,
    transcricao_plano_voo_url: (r.transcricao_plano_voo_url as string) ?? undefined,
    contexto_inicial: (r.contexto_inicial as string) ?? undefined,
    reunioes: reunioesRows
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .map(
        (m): ReuniaoProjeto => ({
          id: m.id as string,
          data: m.data as string,
          titulo: (m.titulo as string) ?? "",
          tipo: m.tipo as ReuniaoProjeto["tipo"],
          participantes: (m.participantes as string) ?? undefined,
          transcricao_url: (m.transcricao_url as string) ?? undefined,
          gravacao_url: (m.gravacao_url as string) ?? undefined,
          sentimento: (m.sentimento as ReuniaoProjeto["sentimento"]) ?? "neutro",
          resumo: (m.resumo as string) ?? undefined,
          proximos_passos: (m.proximos_passos as string) ?? undefined,
        })
      ),
    data_conclusao_prevista: (r.data_conclusao_prevista as string) ?? undefined,
    data_conclusao_real: (r.data_conclusao_real as string) ?? undefined,
    status: r.status as Projeto["status"],
    motivo_churn: (r.motivo_churn as Projeto["motivo_churn"]) ?? undefined,
    plano_roi: (r.plano_roi as string) ?? undefined,
    saude_atual: r.saude_atual as Projeto["saude_atual"],
    links_rapidos: linksRows
      .sort((a, b) => ((a.ordem as number) ?? 0) - ((b.ordem as number) ?? 0))
      .map(
        (l): LinkRapido => ({
          id: l.id as string,
          label: l.label as string,
          url: l.url as string,
        })
      ),
    origem: r.origem as Projeto["origem"],
    observacoes: (r.observacoes as string) ?? undefined,
    squad: squadRows.map(
      (s): SquadMembro => ({
        id: s.id as string,
        investidor_id: s.investidor_id as string,
        funcao: s.funcao as SquadMembro["funcao"],
        data_entrada: s.data_entrada as string,
        data_saida: (s.data_saida as string) ?? undefined,
        principal: !!s.principal,
      })
    ),
  };
}

export async function upsertProjeto(p: Projeto): Promise<void> {
  const supa = db();
  const { error: errPrj } = await supa.from("projetos").upsert({
    id: p.id,
    codigo: p.codigo,
    cliente_id: p.cliente_id,
    produto_id: p.produto_id,
    variacao_id: p.variacao_id ?? null,
    itens: p.itens && p.itens.length > 0 ? p.itens : null,
    tipo_negociacao: p.tipo_negociacao ?? null,
    venda_id: p.venda_id ?? null,
    venda_seq: p.venda_seq ?? null,
    venda_letra: p.venda_letra ?? null,
    nome: p.nome,
    modelo_cobranca: p.modelo_cobranca,
    valor_total: p.valor_total,
    valor_tcv: p.valor_tcv ?? null,
    forma_pagamento: p.forma_pagamento ?? null,
    num_parcelas: p.num_parcelas ?? null,
    fase_atual: p.fase_atual,
    data_assinatura: p.data_assinatura,
    data_inicio: p.data_inicio,
    data_kickoff: p.data_kickoff ?? null,
    data_inicio_pagamento: p.data_inicio_pagamento ?? null,
    lt_meses: p.lt_meses ?? null,
    oportunidade_crm_url: p.oportunidade_crm_url ?? null,
    whatsapp_grupo_url: p.whatsapp_grupo_url ?? null,
    contrato_url: p.contrato_url ?? null,
    transcricao_venda_url: p.transcricao_venda_url ?? null,
    transcricao_qualificacao_url: p.transcricao_qualificacao_url ?? null,
    transcricao_plano_voo_url: p.transcricao_plano_voo_url ?? null,
    contexto_inicial: p.contexto_inicial ?? null,
    data_conclusao_prevista: p.data_conclusao_prevista ?? null,
    data_conclusao_real: p.data_conclusao_real ?? null,
    status: p.status,
    motivo_churn: p.motivo_churn ?? null,
    plano_roi: p.plano_roi ?? null,
    saude_atual: p.saude_atual,
    origem: p.origem,
    observacoes: p.observacoes ?? null,
  });
  throwIfError(errPrj);

  // Squad: delete-all-then-insert
  const { error: errDelSq } = await supa
    .from("squad_membros")
    .delete()
    .eq("projeto_id", p.id);
  throwIfError(errDelSq);
  if (p.squad.length > 0) {
    const { error: errSq } = await supa.from("squad_membros").insert(
      p.squad.map((s) => ({
        id: s.id,
        projeto_id: p.id,
        investidor_id: s.investidor_id,
        funcao: s.funcao,
        data_entrada: s.data_entrada,
        data_saida: s.data_saida ?? null,
        principal: s.principal,
      }))
    );
    throwIfError(errSq);
  }

  // Reuniões: upsert por id (preserva auditoria por reunião)
  const reunioes = p.reunioes ?? [];
  const { error: errDelReu } = await supa
    .from("reunioes")
    .delete()
    .eq("projeto_id", p.id);
  throwIfError(errDelReu);
  if (reunioes.length > 0) {
    const { error: errReu } = await supa.from("reunioes").insert(
      reunioes.map((m) => ({
        id: m.id,
        projeto_id: p.id,
        data: m.data,
        titulo: m.titulo || null,
        tipo: m.tipo,
        participantes: m.participantes ?? null,
        transcricao_url: m.transcricao_url ?? null,
        gravacao_url: m.gravacao_url ?? null,
        sentimento: m.sentimento,
        resumo: m.resumo ?? null,
        proximos_passos: m.proximos_passos ?? null,
      }))
    );
    throwIfError(errReu);
  }

  // Links rápidos
  const { error: errDelLk } = await supa
    .from("links_rapidos")
    .delete()
    .eq("projeto_id", p.id);
  throwIfError(errDelLk);
  if (p.links_rapidos.length > 0) {
    const { error: errLk } = await supa.from("links_rapidos").insert(
      p.links_rapidos.map((l, idx) => ({
        id: l.id,
        projeto_id: p.id,
        label: l.label,
        url: l.url,
        ordem: idx,
      }))
    );
    throwIfError(errLk);
  }
}

export async function softDeleteProjeto(id: string): Promise<void> {
  const { error } = await db()
    .from("projetos")
    .update({ status: "concluido" })
    .eq("id", id);
  throwIfError(error);
}

// Exclusão FÍSICA do projeto. Cascades cuidam de squad_membros, reuniões,
// links_rapidos, pagamentos e parcelas.
export async function hardDeleteProjeto(id: string): Promise<void> {
  const { error } = await db().from("projetos").delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "Erro ao excluir projeto.");
  }
}

export async function moveProjetoFase(id: string, fase: string): Promise<void> {
  const { error } = await db()
    .from("projetos")
    .update({ fase_atual: fase })
    .eq("id", id);
  throwIfError(error);
}

// ─── PAGAMENTOS (+ parcelas) ─────────────────────────────────────────────

export async function fetchPagamentos(): Promise<Pagamento[]> {
  const { data, error } = await db()
    .from("pagamentos")
    .select("*, parcelas(*)")
    .order("criado_em", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(rowToPagamento);
}

function rowToPagamento(r: Record<string, unknown>): Pagamento {
  const parcelasRows = (r.parcelas as Record<string, unknown>[] | null) ?? [];
  return {
    id: r.id as string,
    projeto_id: r.projeto_id as string,
    tipo: r.tipo as Pagamento["tipo"],
    metodo: r.metodo as Pagamento["metodo"],
    valor_total: Number(r.valor_total),
    num_parcelas: r.num_parcelas as number,
    data_primeira_parcela: r.data_primeira_parcela as string,
    periodicidade: r.periodicidade as Pagamento["periodicidade"],
    status_geral: r.status_geral as Pagamento["status_geral"],
    observacoes: (r.observacoes as string) ?? undefined,
    auto_gerado: Boolean(r.auto_gerado),
    parcelas: parcelasRows
      .sort((a, b) => ((a.numero as number) ?? 0) - ((b.numero as number) ?? 0))
      .map(
        (p): Parcela => ({
          id: p.id as string,
          pagamento_id: p.pagamento_id as string,
          numero: p.numero as number,
          valor: Number(p.valor),
          data_vencimento: p.data_vencimento as string,
          data_pagamento: (p.data_pagamento as string) ?? undefined,
          status: p.status as Parcela["status"],
          comprovante_url: (p.comprovante_url as string) ?? undefined,
          observacao: (p.observacao as string) ?? undefined,
        })
      ),
  };
}

export async function upsertPagamento(p: Pagamento): Promise<void> {
  const supa = db();
  const { error: errPag } = await supa.from("pagamentos").upsert({
    id: p.id,
    projeto_id: p.projeto_id,
    tipo: p.tipo,
    metodo: p.metodo,
    valor_total: p.valor_total,
    num_parcelas: p.num_parcelas,
    data_primeira_parcela: p.data_primeira_parcela,
    periodicidade: p.periodicidade,
    status_geral: p.status_geral,
    observacoes: p.observacoes ?? null,
    auto_gerado: p.auto_gerado ?? false,
  });
  throwIfError(errPag);

  // Parcelas — delete-all-then-insert
  const { error: errDel } = await supa
    .from("parcelas")
    .delete()
    .eq("pagamento_id", p.id);
  throwIfError(errDel);
  if (p.parcelas.length > 0) {
    const { error: errIns } = await supa.from("parcelas").insert(
      p.parcelas.map((pa) => ({
        id: pa.id,
        pagamento_id: p.id,
        numero: pa.numero,
        valor: pa.valor,
        data_vencimento: pa.data_vencimento,
        data_pagamento: pa.data_pagamento ?? null,
        status: pa.status,
        comprovante_url: pa.comprovante_url ?? null,
        observacao: pa.observacao ?? null,
      }))
    );
    throwIfError(errIns);
  }
}

export async function softDeletePagamento(id: string): Promise<void> {
  const { error } = await db()
    .from("pagamentos")
    .update({ status_geral: "cancelado" })
    .eq("id", id);
  throwIfError(error);
}

export async function upsertParcela(p: Parcela): Promise<void> {
  const { error } = await db()
    .from("parcelas")
    .update({
      valor: p.valor,
      data_vencimento: p.data_vencimento,
      data_pagamento: p.data_pagamento ?? null,
      status: p.status,
      comprovante_url: p.comprovante_url ?? null,
      observacao: p.observacao ?? null,
    })
    .eq("id", p.id);
  throwIfError(error);
}

// ─── OPORTUNIDADES ────────────────────────────────────────────────────────

export async function fetchOportunidades(): Promise<Oportunidade[]> {
  const { data, error } = await db()
    .from("oportunidades")
    .select("*")
    .order("criado_em", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(rowToOportunidade);
}

function rowToOportunidade(r: Record<string, unknown>): Oportunidade {
  return {
    id: r.id as string,
    cliente_id: r.cliente_id as string,
    projeto_id: (r.projeto_id as string) ?? undefined,
    produto_id: r.produto_id as string,
    variacao_id: (r.variacao_id as string) ?? undefined,
    nome: r.nome as string,
    valor_estimado: Number(r.valor_estimado),
    modelo_cobranca: r.modelo_cobranca as Oportunidade["modelo_cobranca"],
    lt_meses: (r.lt_meses as number) ?? undefined,
    responsavel_id: (r.responsavel_id as string) ?? undefined,
    etapa: r.etapa as Oportunidade["etapa"],
    motivo_perda: (r.motivo_perda as Oportunidade["motivo_perda"]) ?? undefined,
    proxima_acao: (r.proxima_acao as string) ?? undefined,
    data_proxima_acao: (r.data_proxima_acao as string) ?? undefined,
    data_fechamento_prevista: (r.data_fechamento_prevista as string) ?? undefined,
    data_fechamento_real: (r.data_fechamento_real as string) ?? undefined,
    observacoes: (r.observacoes as string) ?? undefined,
  };
}

export async function upsertOportunidade(o: Oportunidade): Promise<void> {
  const { error } = await db().from("oportunidades").upsert({
    id: o.id,
    cliente_id: o.cliente_id,
    projeto_id: o.projeto_id ?? null,
    produto_id: o.produto_id,
    variacao_id: o.variacao_id ?? null,
    nome: o.nome,
    valor_estimado: o.valor_estimado,
    modelo_cobranca: o.modelo_cobranca,
    lt_meses: o.lt_meses ?? null,
    responsavel_id: o.responsavel_id ?? null,
    etapa: o.etapa,
    motivo_perda: o.motivo_perda ?? null,
    proxima_acao: o.proxima_acao ?? null,
    data_proxima_acao: o.data_proxima_acao ?? null,
    data_fechamento_prevista: o.data_fechamento_prevista ?? null,
    data_fechamento_real: o.data_fechamento_real ?? null,
    observacoes: o.observacoes ?? null,
  });
  throwIfError(error);
}

export async function moveOportunidadeEtapa(
  id: string,
  etapa: Oportunidade["etapa"]
): Promise<void> {
  const patch: Record<string, unknown> = { etapa };
  if (etapa === "fechado_ganho" || etapa === "fechado_perdido") {
    patch.data_fechamento_real = new Date().toISOString().slice(0, 10);
  } else {
    patch.data_fechamento_real = null;
    patch.motivo_perda = null;
  }
  const { error } = await db().from("oportunidades").update(patch).eq("id", id);
  throwIfError(error);
}

export async function hardDeleteOportunidade(id: string): Promise<void> {
  const { error } = await db().from("oportunidades").delete().eq("id", id);
  throwIfError(error);
}

// ─── AUDITORIA ────────────────────────────────────────────────────────────

export async function fetchAuditoria(limit = 500): Promise<RegistroAuditoria[]> {
  const { data, error } = await db()
    .from("auditoria")
    .select("*")
    .order("ts", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return (data ?? []).map(rowToAuditoria);
}

function rowToAuditoria(r: Record<string, unknown>): RegistroAuditoria {
  return {
    id: r.id as string,
    timestamp: r.ts as string,
    usuario_id: (r.usuario_id as string) ?? undefined,
    usuario_nome: (r.usuario_nome as string) ?? undefined,
    entidade: r.entidade as RegistroAuditoria["entidade"],
    entidade_id: r.entidade_id as string,
    entidade_label: r.entidade_label as string,
    pai_entidade: (r.pai_entidade as RegistroAuditoria["pai_entidade"]) ?? undefined,
    pai_id: (r.pai_id as string) ?? undefined,
    acao: r.acao as RegistroAuditoria["acao"],
    resumo: r.resumo as string,
    mudancas: (r.mudancas as RegistroAuditoria["mudancas"]) ?? [],
  };
}

export async function insertAuditoria(r: RegistroAuditoria, usuarioEmail?: string): Promise<void> {
  const { error } = await db().from("auditoria").insert({
    id: r.id,
    ts: r.timestamp,
    usuario_id: r.usuario_id ?? null,
    usuario_email: usuarioEmail ?? null,
    usuario_nome: r.usuario_nome ?? null,
    entidade: r.entidade,
    entidade_id: r.entidade_id,
    entidade_label: r.entidade_label,
    pai_entidade: r.pai_entidade ?? null,
    pai_id: r.pai_id ?? null,
    acao: r.acao,
    resumo: r.resumo,
    mudancas: r.mudancas,
  });
  throwIfError(error);
}

// ─── FETCH ALL (carregamento inicial após login) ─────────────────────────

export interface DadosCarregados {
  clientes: Cliente[];
  investidores: Investidor[];
  fases: Fase[];
  projetos: Projeto[];
  pagamentos: Pagamento[];
  auditoria: RegistroAuditoria[];
  oportunidades: Oportunidade[];
}

export async function fetchTudo(): Promise<DadosCarregados> {
  const [clientes, investidores, fases, projetos, pagamentos, auditoria, oportunidades] =
    await Promise.all([
      fetchClientes(),
      fetchInvestidores(),
      fetchFases(),
      fetchProjetos(),
      fetchPagamentos(),
      fetchAuditoria(),
      fetchOportunidades(),
    ]);
  return { clientes, investidores, fases, projetos, pagamentos, auditoria, oportunidades };
}
