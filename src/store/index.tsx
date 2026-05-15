import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AcaoAuditoria,
  CampoMudanca,
  Cliente,
  EntidadeAuditavel,
  Fase,
  FASES_DEFAULT,
  Investidor,
  Pagamento,
  Parcela,
  type Perfil,
  Produto,
  Projeto,
  RegistroAuditoria,
  Sessao,
  Usuario,
} from "@/types";
import { readKey, STORAGE_KEYS, writeKey } from "./storage";
import * as api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/utils";
import {
  diffCliente,
  diffInvestidor,
  diffPagamento,
  diffParcela,
  diffProduto,
  diffProjeto,
  resumoMudancas,
} from "@/lib/audit";

interface AppState {
  clientes: Cliente[];
  investidores: Investidor[];
  produtos: Produto[];
  projetos: Projeto[];
  pagamentos: Pagamento[];
  fases: Fase[];
  auditoria: RegistroAuditoria[];
  usuarios: Usuario[];          // mantido só por retrocompat; Auth via Supabase
  sessao: Sessao | null;
  // True enquanto o estado inicial está sendo carregado do Supabase.
  isLoading: boolean;
  // Erro do último fetch global (null se OK).
  loadError: string | null;
}

export interface AuthResult {
  ok: boolean;
  erro?: string;
}

interface AppActions {
  login: (email: string, senha: string) => Promise<AuthResult>;
  signUp: (email: string, senha: string, nome: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  logout: () => Promise<void>;

  saveCliente: (cliente: Cliente) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  moveClienteStatus: (clienteId: string, novoStatus: Cliente["status"]) => Promise<void>;

  saveInvestidor: (inv: Investidor) => Promise<void>;
  deleteInvestidor: (id: string) => Promise<void>;

  // Catálogo de produtos: read-only no front. A função abaixo é o ponto de
  // entrada para sincronizar com o banco externo (V4). Hoje recebe o payload
  // já pronto; amanhã será chamada pelo job/integração.
  sincronizarProdutos: (produtos: Produto[]) => void;

  saveProjeto: (projeto: Projeto) => Promise<void>;
  deleteProjeto: (id: string) => Promise<void>;
  moveProjetoFase: (projetoId: string, novaFase: Projeto["fase_atual"]) => Promise<void>;

  savePagamento: (pag: Pagamento) => Promise<void>;
  deletePagamento: (id: string) => Promise<void>;
  atualizarParcela: (pagamentoId: string, parcela: Parcela) => Promise<void>;

  // Fases do kanban (CRUD + reordenar). deleteFase devolve mensagem de erro
  // quando há projetos vinculados; null = ok.
  saveFase: (fase: Fase) => Promise<void>;
  deleteFase: (id: string) => Promise<string | null>;
  reordenarFases: (idsEmOrdem: string[]) => Promise<void>;

  // Importa dados que estão no localStorage para o Supabase (one-shot).
  importarLocalStorage: () => Promise<{
    ok: boolean;
    detalhes: Record<string, number>;
    erro?: string;
  }>;
}

type AppContextValue = AppState & AppActions & { gerarCodigoProjeto: (clienteId: string) => string };

const AppCtx = createContext<AppContextValue | null>(null);

function hashSenha(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return "h_" + Math.abs(h).toString(36);
}

interface NovoRegistroAudit {
  entidade: EntidadeAuditavel;
  entidade_id: string;
  entidade_label: string;
  pai_entidade?: EntidadeAuditavel;
  pai_id?: string;
  acao: AcaoAuditoria;
  resumo: string;
  mudancas: CampoMudanca[];
}

function fazerRegistro(
  base: NovoRegistroAudit,
  sessao: Sessao | null
): RegistroAuditoria {
  return {
    id: uid("aud_"),
    timestamp: new Date().toISOString(),
    usuario_id: sessao?.usuario_id,
    usuario_nome: sessao?.nome,
    ...base,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Estado inicial vazio. Os dados vêm do Supabase após o login.
  // `produtos` continua persistido em localStorage porque é cache do
  // catálogo externo (V4), sincronizado sob demanda.
  const [state, setState] = useState<AppState>(() => {
    const produtosBrutos = readKey<Produto[]>(STORAGE_KEYS.produtos, []);
    const produtosNormalizados = produtosBrutos.map((p) => {
      const catNorm = (p.categoria ?? "").toString().toUpperCase();
      const catValida = (
        ["SABER", "TER", "EXECUTAR", "POTENCIALIZAR"] as const
      ).includes(catNorm as never)
        ? (catNorm as Produto["categoria"])
        : "EXECUTAR";
      return catNorm === p.categoria ? p : { ...p, categoria: catValida };
    });

    return {
      clientes: [],
      investidores: [],
      produtos: produtosNormalizados,
      projetos: [],
      pagamentos: [],
      fases: FASES_DEFAULT,
      auditoria: [],
      usuarios: [],
      sessao: null,
      isLoading: false,
      loadError: null,
    };
  });

  // Produtos continua em localStorage (cache do catálogo V4).
  useEffect(() => writeKey(STORAGE_KEYS.produtos, state.produtos), [state.produtos]);

  // ─── Auth via Supabase ────────────────────────────────────────────────
  // A sessão vem do Supabase Auth. Mantemos a interface Sessao da app pra
  // não quebrar consumidores existentes (Layout, RequireAuth, auditoria).
  function mapSupabaseSession(s: Session | null): Sessao | null {
    if (!s?.user?.email) return null;
    const meta = (s.user.user_metadata ?? {}) as { nome?: string; perfil?: Perfil };
    return {
      usuario_id: s.user.id,
      email: s.user.email,
      nome: meta.nome ?? s.user.email,
      perfil: (meta.perfil as Perfil) ?? "executor",
      expira_em: new Date((s.expires_at ?? 0) * 1000).toISOString(),
    };
  }

  // Sincroniza state.sessao com Supabase Auth (sessão atual + mudanças).
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setState((s) => ({ ...s, sessao: mapSupabaseSession(data.session) }));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, sessao: mapSupabaseSession(session) }));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ─── Carrega tudo do Supabase quando há sessão autenticada ───────────
  // Dispara fetchTudo() ao logar e limpa o state ao deslogar. Mantém
  // produtos (catálogo, vem por sync separado) intactos.
  const usuarioId = state.sessao?.usuario_id;
  useEffect(() => {
    let cancelled = false;
    if (!supabase || !usuarioId) {
      // Sem sessão: limpa estado da app.
      setState((s) => ({
        ...s,
        clientes: [],
        investidores: [],
        fases: FASES_DEFAULT,
        projetos: [],
        pagamentos: [],
        auditoria: [],
        isLoading: false,
        loadError: null,
      }));
      return;
    }
    setState((s) => ({ ...s, isLoading: true, loadError: null }));
    api
      .fetchTudo()
      .then((dados) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          clientes: dados.clientes,
          investidores: dados.investidores,
          fases: dados.fases.length > 0 ? dados.fases : FASES_DEFAULT,
          projetos: dados.projetos,
          pagamentos: dados.pagamentos,
          auditoria: dados.auditoria,
          isLoading: false,
          loadError: null,
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Erro ao carregar dados.";
        console.error("[store] fetchTudo falhou:", err);
        setState((s) => ({ ...s, isLoading: false, loadError: msg }));
      });
    return () => {
      cancelled = true;
    };
  }, [usuarioId]);

  const login = useCallback(
    async (email: string, senha: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, erro: "Supabase não configurado." };
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        // Mapeia mensagens comuns pra português.
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid login credentials")) {
          return { ok: false, erro: "E-mail ou senha incorretos." };
        }
        if (msg.includes("email not confirmed")) {
          return {
            ok: false,
            erro: "Confirme seu e-mail antes de entrar. Confira sua caixa de entrada.",
          };
        }
        return { ok: false, erro: error.message };
      }
      return { ok: true };
    },
    []
  );

  const signUp = useCallback(
    async (email: string, senha: string, nome: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, erro: "Supabase não configurado." };
      }
      const emailNorm = email.trim().toLowerCase();
      if (!emailNorm.endsWith("@v4company.com")) {
        return {
          ok: false,
          erro: "Acesso restrito a e-mails @v4company.com.",
        };
      }
      const { error } = await supabase.auth.signUp({
        email: emailNorm,
        password: senha,
        options: {
          data: { nome: nome.trim(), perfil: "executor" as Perfil },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          return { ok: false, erro: "Esse e-mail já está cadastrado." };
        }
        if (msg.includes("v4company")) {
          return {
            ok: false,
            erro: "Apenas e-mails @v4company.com podem se cadastrar.",
          };
        }
        return { ok: false, erro: error.message };
      }
      return { ok: true };
    },
    []
  );

  const resetPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, erro: "Supabase não configurado." };
      }
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/login` }
      );
      if (error) return { ok: false, erro: error.message };
      return { ok: true };
    },
    []
  );

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setState((s) => ({ ...s, sessao: null }));
  }, []);

  // ─── Helper para persistir auditoria (best-effort) ───────────────────
  // Falha silenciosa: log no console mas não interrompe o fluxo. Auditoria
  // é importante, mas não bloqueia operações de negócio.
  const persistirAudit = useCallback(
    async (registro: RegistroAuditoria, email?: string) => {
      try {
        await api.insertAuditoria(registro, email);
      } catch (err) {
        console.error("[audit] falha ao persistir:", err);
      }
    },
    []
  );

  // ----- CLIENTE -----
  const saveCliente = useCallback(
    async (cliente: Cliente) => {
      const existing = state.clientes.find((c) => c.id === cliente.id);
      const mudancas = diffCliente(existing, cliente);
      try {
        await api.upsertCliente(cliente);
      } catch (err) {
        console.error("[saveCliente] falha:", err);
        return;
      }
      setState((s) => ({
        ...s,
        clientes: existing
          ? s.clientes.map((c) => (c.id === cliente.id ? cliente : c))
          : [...s.clientes, cliente],
      }));
      if (existing && mudancas.length === 0) return;
      const registro = fazerRegistro(
        {
          entidade: "cliente",
          entidade_id: cliente.id,
          entidade_label: `${cliente.sigla} · ${cliente.nome_fantasia}`,
          acao: existing ? "atualizar" : "criar",
          resumo: existing ? resumoMudancas(mudancas) : "Cliente criado",
          mudancas,
        },
        state.sessao
      );
      setState((s) => ({ ...s, auditoria: [registro, ...s.auditoria] }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.clientes, state.sessao, persistirAudit]
  );

  const deleteCliente = useCallback(
    async (id: string) => {
      const cli = state.clientes.find((c) => c.id === id);
      if (!cli) return;
      try {
        await api.softDeleteCliente(id);
      } catch (err) {
        console.error("[deleteCliente] falha:", err);
        return;
      }
      const novo: Cliente = { ...cli, status: "inativo" };
      const registro = fazerRegistro(
        {
          entidade: "cliente",
          entidade_id: id,
          entidade_label: `${cli.sigla} · ${cli.nome_fantasia}`,
          acao: "remover",
          resumo: "Cliente marcado como inativo",
          mudancas: diffCliente(cli, novo),
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        clientes: s.clientes.map((c) => (c.id === id ? novo : c)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.clientes, state.sessao, persistirAudit]
  );

  const moveClienteStatus = useCallback(
    async (clienteId: string, novoStatus: Cliente["status"]) => {
      const cli = state.clientes.find((c) => c.id === clienteId);
      if (!cli || cli.status === novoStatus) return;
      const novo: Cliente = { ...cli, status: novoStatus };
      if (novoStatus === "churn" && !novo.data_churn) {
        novo.data_churn = new Date().toISOString().slice(0, 10);
      } else if (novoStatus !== "churn") {
        novo.data_churn = undefined;
        novo.motivo_churn = undefined;
      }
      try {
        await api.moveClienteStatus(clienteId, novoStatus);
      } catch (err) {
        console.error("[moveClienteStatus] falha:", err);
        return;
      }
      const registro = fazerRegistro(
        {
          entidade: "cliente",
          entidade_id: clienteId,
          entidade_label: `${cli.sigla} · ${cli.nome_fantasia}`,
          acao: "atualizar",
          resumo: "Movido entre fases no kanban",
          mudancas: diffCliente(cli, novo),
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        clientes: s.clientes.map((c) => (c.id === clienteId ? novo : c)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.clientes, state.sessao, persistirAudit]
  );

  // ----- INVESTIDOR -----
  const saveInvestidor = useCallback(
    async (inv: Investidor) => {
      const existing = state.investidores.find((i) => i.id === inv.id);
      const mudancas = diffInvestidor(existing, inv);
      try {
        await api.upsertInvestidor(inv);
      } catch (err) {
        console.error("[saveInvestidor] falha:", err);
        return;
      }
      setState((s) => ({
        ...s,
        investidores: existing
          ? s.investidores.map((i) => (i.id === inv.id ? inv : i))
          : [...s.investidores, inv],
      }));
      if (existing && mudancas.length === 0) return;
      const registro = fazerRegistro(
        {
          entidade: "investidor",
          entidade_id: inv.id,
          entidade_label: inv.nome,
          acao: existing ? "atualizar" : "criar",
          resumo: existing ? resumoMudancas(mudancas) : "Investidor criado",
          mudancas,
        },
        state.sessao
      );
      setState((s) => ({ ...s, auditoria: [registro, ...s.auditoria] }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.investidores, state.sessao, persistirAudit]
  );

  const deleteInvestidor = useCallback(
    async (id: string) => {
      const inv = state.investidores.find((i) => i.id === id);
      if (!inv) return;
      try {
        await api.deleteInvestidor(id);
      } catch (err) {
        console.error("[deleteInvestidor] falha:", err);
        return;
      }
      const novo: Investidor = { ...inv, status: "inativo" };
      const registro = fazerRegistro(
        {
          entidade: "investidor",
          entidade_id: id,
          entidade_label: inv.nome,
          acao: "remover",
          resumo: "Investidor marcado como inativo",
          mudancas: diffInvestidor(inv, novo),
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        investidores: s.investidores.map((i) => (i.id === id ? novo : i)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.investidores, state.sessao, persistirAudit]
  );

  // ----- PRODUTO (read-only via sync com banco externo) -----
  // Recebe o snapshot completo do catálogo externo e:
  // 1. Adiciona produtos novos
  // 2. Atualiza produtos existentes (com diff registrado em auditoria)
  // 3. Marca como inativo os que sumiram do banco externo
  const sincronizarProdutos = useCallback((externos: Produto[]) => {
    setState((s) => {
      const novosRegistros: typeof s.auditoria = [];
      const idsExternos = new Set(externos.map((p) => p.id));
      const mapaAtual = new Map(s.produtos.map((p) => [p.id, p]));

      const atualizados = externos.map((ext) => {
        const atual = mapaAtual.get(ext.id);
        const mudancas = diffProduto(atual, ext);
        if (!atual || mudancas.length > 0) {
          novosRegistros.push(
            fazerRegistro(
              {
                entidade: "produto",
                entidade_id: ext.id,
                entidade_label: ext.nome,
                acao: atual ? "atualizar" : "criar",
                resumo: atual
                  ? `Sincronização: ${resumoMudancas(mudancas)}`
                  : "Produto importado do banco V4",
                mudancas,
              },
              s.sessao
            )
          );
        }
        return ext;
      });

      // Produtos que estavam aqui mas sumiram do banco externo viram inativos
      // (preserva referências históricas em projetos antigos).
      const desativados = s.produtos
        .filter((p) => !idsExternos.has(p.id) && p.ativo)
        .map((p) => {
          const novo = { ...p, ativo: false };
          novosRegistros.push(
            fazerRegistro(
              {
                entidade: "produto",
                entidade_id: p.id,
                entidade_label: p.nome,
                acao: "remover",
                resumo: "Produto desativado (não está mais no banco V4)",
                mudancas: diffProduto(p, novo),
              },
              s.sessao
            )
          );
          return novo;
        });

      const desativadosIds = new Set(desativados.map((d) => d.id));
      const intactos = s.produtos.filter(
        (p) => !idsExternos.has(p.id) && !desativadosIds.has(p.id)
      );

      return {
        ...s,
        produtos: [...atualizados, ...desativados, ...intactos],
        auditoria: [...novosRegistros, ...s.auditoria],
      };
    });
  }, []);

  // ----- PROJETO -----
  const saveProjeto = useCallback(
    async (projeto: Projeto) => {
      const existing = state.projetos.find((p) => p.id === projeto.id);
      const mudancas = diffProjeto(existing, projeto, state.fases);
      try {
        await api.upsertProjeto(projeto);
      } catch (err) {
        console.error("[saveProjeto] falha:", err);
        return;
      }
      setState((s) => ({
        ...s,
        projetos: existing
          ? s.projetos.map((p) => (p.id === projeto.id ? projeto : p))
          : [...s.projetos, projeto],
      }));
      if (existing && mudancas.length === 0) return;
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: projeto.id,
          entidade_label: `${projeto.codigo} · ${projeto.nome}`,
          acao: existing ? "atualizar" : "criar",
          resumo: existing ? resumoMudancas(mudancas) : "Projeto criado",
          mudancas,
        },
        state.sessao
      );
      setState((s) => ({ ...s, auditoria: [registro, ...s.auditoria] }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.projetos, state.fases, state.sessao, persistirAudit]
  );

  const deleteProjeto = useCallback(
    async (id: string) => {
      const prj = state.projetos.find((p) => p.id === id);
      if (!prj) return;
      try {
        await api.softDeleteProjeto(id);
      } catch (err) {
        console.error("[deleteProjeto] falha:", err);
        return;
      }
      const novo: Projeto = { ...prj, status: "concluido" };
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: id,
          entidade_label: `${prj.codigo} · ${prj.nome}`,
          acao: "remover",
          resumo: "Projeto encerrado",
          mudancas: diffProjeto(prj, novo, state.fases),
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        projetos: s.projetos.map((p) => (p.id === id ? novo : p)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.projetos, state.fases, state.sessao, persistirAudit]
  );

  const moveProjetoFase = useCallback(
    async (projetoId: string, novaFase: Projeto["fase_atual"]) => {
      const proj = state.projetos.find((p) => p.id === projetoId);
      if (!proj || proj.fase_atual === novaFase) return;
      const novo: Projeto = { ...proj, fase_atual: novaFase };
      try {
        await api.moveProjetoFase(projetoId, novaFase);
      } catch (err) {
        console.error("[moveProjetoFase] falha:", err);
        return;
      }
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: projetoId,
          entidade_label: `${proj.codigo} · ${proj.nome}`,
          acao: "atualizar",
          resumo: "Movido entre fases no kanban",
          mudancas: diffProjeto(proj, novo, state.fases),
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        projetos: s.projetos.map((p) => (p.id === projetoId ? novo : p)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.projetos, state.fases, state.sessao, persistirAudit]
  );

  // ----- PAGAMENTO -----
  const savePagamento = useCallback(
    async (pag: Pagamento) => {
      const existing = state.pagamentos.find((p) => p.id === pag.id);
      const mudancas = diffPagamento(existing, pag);
      try {
        await api.upsertPagamento(pag);
      } catch (err) {
        console.error("[savePagamento] falha:", err);
        return;
      }
      setState((s) => ({
        ...s,
        pagamentos: existing
          ? s.pagamentos.map((p) => (p.id === pag.id ? pag : p))
          : [...s.pagamentos, pag],
      }));
      if (existing && mudancas.length === 0) return;
      const proj = state.projetos.find((p) => p.id === pag.projeto_id);
      const registro = fazerRegistro(
        {
          entidade: "pagamento",
          entidade_id: pag.id,
          entidade_label: proj
            ? `${proj.codigo} · ${pag.tipo} ${pag.num_parcelas}×`
            : `Pagamento ${pag.tipo}`,
          pai_entidade: "projeto",
          pai_id: pag.projeto_id,
          acao: existing ? "atualizar" : "criar",
          resumo: existing
            ? resumoMudancas(mudancas)
            : `Pagamento criado · ${pag.num_parcelas} parcelas`,
          mudancas,
        },
        state.sessao
      );
      setState((s) => ({ ...s, auditoria: [registro, ...s.auditoria] }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.pagamentos, state.projetos, state.sessao, persistirAudit]
  );

  const deletePagamento = useCallback(
    async (id: string) => {
      const pag = state.pagamentos.find((p) => p.id === id);
      if (!pag) return;
      try {
        await api.softDeletePagamento(id);
      } catch (err) {
        console.error("[deletePagamento] falha:", err);
        return;
      }
      const novo: Pagamento = { ...pag, status_geral: "cancelado" };
      const proj = state.projetos.find((p) => p.id === pag.projeto_id);
      const registro = fazerRegistro(
        {
          entidade: "pagamento",
          entidade_id: id,
          entidade_label: proj ? `${proj.codigo} · pagamento` : "Pagamento",
          pai_entidade: "projeto",
          pai_id: pag.projeto_id,
          acao: "remover",
          resumo: "Pagamento cancelado",
          mudancas: diffPagamento(pag, novo),
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        pagamentos: s.pagamentos.map((p) => (p.id === id ? novo : p)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.pagamentos, state.projetos, state.sessao, persistirAudit]
  );

  const atualizarParcela = useCallback(
    async (pagamentoId: string, parcela: Parcela) => {
      const pag = state.pagamentos.find((p) => p.id === pagamentoId);
      if (!pag) return;
      const anterior = pag.parcelas.find((p) => p.id === parcela.id);
      const mudancas = diffParcela(anterior, parcela);
      try {
        await api.upsertParcela(parcela);
      } catch (err) {
        console.error("[atualizarParcela] falha:", err);
        return;
      }
      const novoPag = {
        ...pag,
        parcelas: pag.parcelas.map((par) =>
          par.id === parcela.id ? parcela : par
        ),
      };
      setState((s) => ({
        ...s,
        pagamentos: s.pagamentos.map((p) => (p.id === pagamentoId ? novoPag : p)),
      }));
      if (mudancas.length === 0) return;
      const proj = state.projetos.find((p) => p.id === pag.projeto_id);
      const registro = fazerRegistro(
        {
          entidade: "parcela",
          entidade_id: parcela.id,
          entidade_label: proj
            ? `${proj.codigo} · parcela ${parcela.numero}/${pag.num_parcelas}`
            : `Parcela ${parcela.numero}`,
          pai_entidade: "projeto",
          pai_id: pag.projeto_id,
          acao: "atualizar",
          resumo:
            parcela.status === "pago"
              ? `Parcela ${parcela.numero} paga`
              : resumoMudancas(mudancas),
          mudancas,
        },
        state.sessao
      );
      setState((s) => ({ ...s, auditoria: [registro, ...s.auditoria] }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.pagamentos, state.projetos, state.sessao, persistirAudit]
  );

  // ----- FASES (kanban) -----
  const saveFase = useCallback(
    async (fase: Fase) => {
      const existing = state.fases.find((f) => f.id === fase.id);
      try {
        await api.upsertFase(fase);
      } catch (err) {
        console.error("[saveFase] falha:", err);
        return;
      }
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: fase.id,
          entidade_label: `Fase: ${fase.nome}`,
          acao: existing ? "atualizar" : "criar",
          resumo: existing
            ? `Fase "${existing.nome}" alterada`
            : `Fase "${fase.nome}" criada`,
          mudancas: existing
            ? [
                ...(existing.nome !== fase.nome
                  ? [{ campo: "nome", label: "Nome", de: existing.nome, para: fase.nome }]
                  : []),
                ...(existing.descricao !== fase.descricao
                  ? [
                      {
                        campo: "descricao",
                        label: "Descrição",
                        de: existing.descricao ?? "—",
                        para: fase.descricao ?? "—",
                      },
                    ]
                  : []),
                ...(existing.ordem !== fase.ordem
                  ? [
                      {
                        campo: "ordem",
                        label: "Ordem",
                        de: String(existing.ordem),
                        para: String(fase.ordem),
                      },
                    ]
                  : []),
              ]
            : [],
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        fases: existing
          ? s.fases.map((f) => (f.id === fase.id ? fase : f))
          : [...s.fases, fase],
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.fases, state.sessao, persistirAudit]
  );

  const deleteFase = useCallback(
    async (id: string): Promise<string | null> => {
      const fase = state.fases.find((f) => f.id === id);
      if (!fase) return "Fase não encontrada.";
      const projetosNaFase = state.projetos.filter(
        (p) => p.fase_atual === id
      ).length;
      if (projetosNaFase > 0) {
        return `Não é possível excluir: ${projetosNaFase} projeto(s) estão nesta fase. Mova-os primeiro.`;
      }
      try {
        await api.deleteFase(id);
      } catch (err) {
        console.error("[deleteFase] falha:", err);
        return "Falha ao excluir no servidor.";
      }
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: id,
          entidade_label: `Fase: ${fase.nome}`,
          acao: "remover",
          resumo: `Fase "${fase.nome}" excluída`,
          mudancas: [],
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        fases: s.fases.filter((f) => f.id !== id),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
      return null;
    },
    [state.fases, state.projetos, state.sessao, persistirAudit]
  );

  const reordenarFases = useCallback(
    async (idsEmOrdem: string[]) => {
      try {
        await api.reordenarFases(idsEmOrdem);
      } catch (err) {
        console.error("[reordenarFases] falha:", err);
        return;
      }
      const novas = state.fases
        .map((f) => {
          const novaOrdem = idsEmOrdem.indexOf(f.id);
          return novaOrdem >= 0 ? { ...f, ordem: novaOrdem + 1 } : f;
        })
        .sort((a, b) => a.ordem - b.ordem);
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: "fases-reorder",
          entidade_label: "Fases do kanban",
          acao: "atualizar",
          resumo: "Ordem das fases atualizada",
          mudancas: [
            {
              campo: "ordem",
              label: "Nova ordem",
              de: state.fases.map((f) => f.nome).join(" → "),
              para: novas.map((f) => f.nome).join(" → "),
            },
          ],
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        fases: novas,
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.fases, state.sessao, persistirAudit]
  );

  const gerarCodigoProjeto = useCallback(
    (clienteId: string): string => {
      const cli = state.clientes.find((c) => c.id === clienteId);
      if (!cli) return "PROJ-00";
      const existentes = state.projetos.filter((p) => p.cliente_id === clienteId).length;
      const seq = String(existentes + 1).padStart(2, "0");
      return `${cli.sigla}-${seq}`;
    },
    [state.clientes, state.projetos]
  );

  // ─── Importador one-shot do localStorage para o Supabase ─────────────
  // Lê dados antigos persistidos em localStorage (clientes/projetos/etc.)
  // e faz upsert em massa no Supabase. Útil em primeiro acesso pós-Auth
  // pra trazer dados criados antes da migração.
  const importarLocalStorage = useCallback(async () => {
    const detalhes: Record<string, number> = {
      investidores: 0,
      fases: 0,
      clientes: 0,
      projetos: 0,
      pagamentos: 0,
    };
    try {
      const lsClientes = readKey<Cliente[]>(STORAGE_KEYS.clientes, []);
      const lsInvestidores = readKey<Investidor[]>(STORAGE_KEYS.investidores, []);
      const lsFases = readKey<Fase[]>(STORAGE_KEYS.fases, []);
      const lsProjetos = readKey<Projeto[]>(STORAGE_KEYS.projetos, []);
      const lsPagamentos = readKey<Pagamento[]>(STORAGE_KEYS.pagamentos, []);

      // Ordem importa por FKs:
      // 1. investidores (ref por projetos.squad)
      for (const i of lsInvestidores) {
        await api.upsertInvestidor(i);
        detalhes.investidores++;
      }
      // 2. fases (ref por projetos.fase_atual)
      for (const f of lsFases) {
        await api.upsertFase(f);
        detalhes.fases++;
      }
      // 3. clientes (ref por projetos.cliente_id)
      for (const c of lsClientes) {
        await api.upsertCliente(c);
        detalhes.clientes++;
      }
      // 4. projetos (depende de clientes/fases/investidores)
      for (const p of lsProjetos) {
        await api.upsertProjeto(p);
        detalhes.projetos++;
      }
      // 5. pagamentos (depende de projetos)
      for (const pg of lsPagamentos) {
        await api.upsertPagamento(pg);
        detalhes.pagamentos++;
      }

      // Após importar, refaz fetch para sincronizar state com Supabase.
      const dados = await api.fetchTudo();
      setState((s) => ({
        ...s,
        clientes: dados.clientes,
        investidores: dados.investidores,
        fases: dados.fases.length > 0 ? dados.fases : FASES_DEFAULT,
        projetos: dados.projetos,
        pagamentos: dados.pagamentos,
        auditoria: dados.auditoria,
      }));

      return { ok: true, detalhes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao importar.";
      console.error("[importarLocalStorage] falha:", err);
      return { ok: false, detalhes, erro: msg };
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      login,
      signUp,
      resetPassword,
      logout,
      saveCliente,
      deleteCliente,
      moveClienteStatus,
      saveInvestidor,
      deleteInvestidor,
      sincronizarProdutos,
      saveProjeto,
      deleteProjeto,
      moveProjetoFase,
      savePagamento,
      deletePagamento,
      atualizarParcela,
      saveFase,
      deleteFase,
      reordenarFases,
      gerarCodigoProjeto,
      importarLocalStorage,
    }),
    [
      state,
      login,
      signUp,
      resetPassword,
      logout,
      saveCliente,
      deleteCliente,
      moveClienteStatus,
      saveInvestidor,
      deleteInvestidor,
      sincronizarProdutos,
      saveProjeto,
      deleteProjeto,
      moveProjetoFase,
      savePagamento,
      deletePagamento,
      atualizarParcela,
      saveFase,
      deleteFase,
      reordenarFases,
      gerarCodigoProjeto,
      importarLocalStorage,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp deve ser usado dentro de <AppProvider>");
  return ctx;
}

export { hashSenha };
