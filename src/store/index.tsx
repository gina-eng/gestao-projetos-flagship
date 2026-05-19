import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AcaoAuditoria,
  CampoMudanca,
  Cliente,
  EntidadeAuditavel,
  ETAPA_OPORTUNIDADE_LABEL,
  Fase,
  FASES_DEFAULT,
  Investidor,
  Oportunidade,
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
import { ehFaseEncerramento, uid } from "@/lib/utils";
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
  oportunidades: Oportunidade[];
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

  saveOportunidade: (o: Oportunidade) => Promise<void>;
  deleteOportunidade: (id: string) => Promise<void>;
  moveOportunidadeEtapa: (id: string, etapa: Oportunidade["etapa"]) => Promise<void>;

  // Roda a sincronização de pagamento auto-gerado em todos os projetos
  // que têm os dados completos (TCV + parcelas + data início pagamento).
  sincronizarTodosPagamentos: () => Promise<{ sincronizados: number; pulados: number }>;

  // Recupera uma entidade a partir de um registro de auditoria de remoção
  // (volta status pra 'ativo'). Retorna mensagem de erro em string ou null
  // se OK.
  recuperarRegistro: (registroId: string) => Promise<string | null>;
}

type AppContextValue = AppState &
  AppActions & {
    // Gera um código completo "fresh" para uma nova venda do cliente.
    // Retorna `{ codigo, vendaSeq, vendaLetra }` para que o caller possa
    // popular também os campos `venda_seq`/`venda_letra` do Projeto.
    gerarCodigoProjeto: (clienteId: string) => string;
    proximaVendaSeq: (clienteId: string) => number;
    proximaLetraDaVenda: (clienteId: string, vendaSeq: number) => string;
  };

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

// Chaves de localStorage obsoletas (dados do app pré-Supabase).
// São limpas one-shot na primeira execução da versão Supabase.
const CHAVES_OBSOLETAS = [
  STORAGE_KEYS.clientes,
  STORAGE_KEYS.investidores,
  STORAGE_KEYS.projetos,
  STORAGE_KEYS.pagamentos,
  STORAGE_KEYS.fases,
  STORAGE_KEYS.auditoria,
  STORAGE_KEYS.usuarios,
  STORAGE_KEYS.sessao,
  STORAGE_KEYS.seedDone,
];
const LIMPEZA_FLAG = "v4gp:cleanup_v2_done";

function limpezaUnica() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(LIMPEZA_FLAG) === "1") return;
  for (const k of CHAVES_OBSOLETAS) {
    window.localStorage.removeItem("v4gp:" + k);
  }
  window.localStorage.setItem(LIMPEZA_FLAG, "1");
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Estado inicial vazio. Os dados vêm do Supabase após o login.
  // `produtos` continua persistido em localStorage porque é cache do
  // catálogo externo (V4), sincronizado sob demanda.
  const [state, setState] = useState<AppState>(() => {
    // Limpa sobras de versões anteriores (clientes/projetos/etc em LS).
    limpezaUnica();
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
      oportunidades: [],
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
        oportunidades: [],
        auditoria: [],
        isLoading: false,
        loadError: null,
      }));
      return;
    }
    setState((s) => ({ ...s, isLoading: true, loadError: null }));
    api
      .fetchTudo()
      .then(async (dados) => {
        if (cancelled) return;
        // Reconcilia status dos clientes com a realidade dos projetos antes
        // de renderizar (corrige inconsistências de versões anteriores).
        const ajustes: { id: string; novo: Cliente["status"] }[] = [];
        for (const cli of dados.clientes) {
          if (cli.status === "churn" || cli.status === "excluido") continue;
          const temAtivo = dados.projetos.some(
            (p) => p.cliente_id === cli.id && p.status === "ativo"
          );
          let novo: Cliente["status"];
          if (temAtivo) {
            novo = "ativo";
          } else if (cli.status === "em_fechamento") {
            continue; // preserva em_fechamento sem projetos
          } else {
            novo = "inativo";
          }
          if (cli.status !== novo) ajustes.push({ id: cli.id, novo });
        }
        // Aplica em paralelo no banco; ignora falhas individuais.
        await Promise.allSettled(
          ajustes.map((a) => api.moveClienteStatus(a.id, a.novo))
        );
        // Espelha no state.
        const clientesAjustados = dados.clientes.map((c) => {
          const ajuste = ajustes.find((a) => a.id === c.id);
          return ajuste ? { ...c, status: ajuste.novo } : c;
        });
        setState((s) => ({
          ...s,
          clientes: clientesAjustados,
          investidores: dados.investidores,
          fases: dados.fases.length > 0 ? dados.fases : FASES_DEFAULT,
          projetos: dados.projetos,
          pagamentos: dados.pagamentos,
          oportunidades: dados.oportunidades,
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

  // Verifica se um e-mail tem permissão de acesso (gina@v4company.com ou
  // investidor ativo cadastrado). Chama a RPC pública `is_authorized`.
  async function checarAutorizacao(email: string): Promise<boolean> {
    if (!supabase) return false;
    const emailNorm = email.trim().toLowerCase();
    if (emailNorm === "gina@v4company.com") return true; // fallback caso RPC falhe
    const { data, error } = await supabase.rpc("is_authorized", {
      email_check: emailNorm,
    });
    if (error) {
      console.error("[is_authorized] RPC falhou:", error);
      return false;
    }
    return Boolean(data);
  }

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
      // Pós-login: garante que o usuário ainda tem autorização. Se foi
      // removido da lista de investidores, encerra a sessão.
      const autorizado = await checarAutorizacao(email);
      if (!autorizado) {
        await supabase.auth.signOut();
        return {
          ok: false,
          erro:
            "Sua conta não está mais autorizada. Solicite o cadastro como investidor ativo.",
        };
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
      // Pre-check: só deixa criar conta quem é admin ou investidor ativo.
      const autorizado = await checarAutorizacao(emailNorm);
      if (!autorizado) {
        return {
          ok: false,
          erro:
            "E-mail não autorizado. Solicite o cadastro como investidor ativo antes de criar a conta.",
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
        if (msg.includes("v4company") || msg.includes("autorizado") || msg.includes("investidor")) {
          return {
            ok: false,
            erro:
              "E-mail não autorizado. Solicite o cadastro como investidor ativo.",
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

  // ─── Helper: notificar erro de operação ───────────────────────────────
  // Mostra alert simples + console.error. Substituível depois por toast.
  function notificarErro(operacao: string, err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${operacao}] falha:`, err);
    if (typeof window !== "undefined") {
      window.alert(`Erro ao ${operacao}: ${msg}`);
    }
  }

  // ─── Sincroniza Pagamento "espelho" a partir do projeto ───────────────
  // Quando o projeto tem TCV + num_parcelas + data_inicio_pagamento +
  // forma_pagamento configurados, gera/atualiza um Pagamento auto-gerado
  // com a régua de parcelas derivada. Preserva parcelas já pagas pra não
  // perder histórico financeiro.
  const syncPagamentoAutoDoProjeto = useCallback(
    async (projeto: Projeto) => {
      const tem =
        !!projeto.valor_tcv &&
        projeto.valor_tcv > 0 &&
        !!projeto.num_parcelas &&
        projeto.num_parcelas > 0 &&
        !!projeto.data_inicio_pagamento;

      // Procura o pagamento auto-gerado já existente desse projeto.
      const existente = state.pagamentos.find(
        (pg) => pg.projeto_id === projeto.id && pg.auto_gerado
      );

      // Sem dados completos → não cria; se já existe, mantém como está
      // (pode ter parcelas pagas que valem rastrear).
      if (!tem) return;

      // Mapeia forma de pagamento (acordo) → método (registro do pagamento).
      const metodoMap: Record<string, Pagamento["metodo"]> = {
        pix: "pix",
        boleto: "boleto",
        cheque: "outro",
        cartao: "cartao_credito",
        cartao_recorrente: "cartao_credito",
      };
      const metodo: Pagamento["metodo"] = projeto.forma_pagamento
        ? metodoMap[projeto.forma_pagamento] ?? "outro"
        : "outro";

      const valorParcela = projeto.valor_tcv! / projeto.num_parcelas!;
      const baseData = new Date(projeto.data_inicio_pagamento! + "T00:00:00");

      // Reaproveita parcelas pagas (mesmo número) pra preservar comprovantes.
      const pagasExistentes = (existente?.parcelas ?? []).filter(
        (par) => par.status === "pago"
      );
      const pagasPorNumero = new Map(pagasExistentes.map((p) => [p.numero, p]));

      const novasParcelas: Parcela[] = Array.from(
        { length: projeto.num_parcelas! },
        (_, i) => {
          const numero = i + 1;
          const reuso = pagasPorNumero.get(numero);
          if (reuso) return reuso; // preserva pago
          const d = new Date(baseData);
          d.setMonth(d.getMonth() + i);
          return {
            id: uid("par_"),
            pagamento_id: existente?.id ?? "tmp",
            numero,
            valor: valorParcela,
            data_vencimento: d.toISOString().slice(0, 10),
            status: "previsto" as const,
          };
        }
      );

      const tipo: Pagamento["tipo"] =
        projeto.modelo_cobranca === "recorrente"
          ? "recorrente"
          : projeto.num_parcelas! > 1
          ? "parcelado"
          : "entrada";

      const pagId = existente?.id ?? uid("pag_");
      // Sincroniza pagamento_id em todas as parcelas.
      const parcelasFinais = novasParcelas.map((p) => ({
        ...p,
        pagamento_id: pagId,
      }));

      const novoPag: Pagamento = {
        id: pagId,
        projeto_id: projeto.id,
        tipo,
        metodo,
        valor_total: projeto.valor_tcv!,
        num_parcelas: projeto.num_parcelas!,
        data_primeira_parcela: projeto.data_inicio_pagamento!,
        periodicidade: "mensal",
        status_geral: "ativo",
        observacoes: "[Auto] Sincronizado com o projeto",
        auto_gerado: true,
        parcelas: parcelasFinais,
      };

      try {
        await api.upsertPagamento(novoPag);
        console.log("[sync] pagamento espelho atualizado:", {
          projeto: projeto.codigo,
          valor_tcv: projeto.valor_tcv,
          num_parcelas: projeto.num_parcelas,
          data_inicio: projeto.data_inicio_pagamento,
          parcelas: parcelasFinais.length,
        });
      } catch (err) {
        // Erro mais visível — geralmente coluna 'auto_gerado' ausente no
        // banco ou problema de RLS.
        notificarErro("sincronizar financeiro do projeto", err);
        return;
      }
      setState((s) => ({
        ...s,
        pagamentos: existente
          ? s.pagamentos.map((pg) => (pg.id === pagId ? novoPag : pg))
          : [novoPag, ...s.pagamentos],
      }));
    },
    [state.pagamentos]
  );

  // Sincroniza TODOS os projetos com dados de pagamento contra o banco.
  // Útil pra projetos antigos criados antes da feature de auto-sincronização.
  const sincronizarTodosPagamentos = useCallback(async () => {
    let sincronizados = 0;
    let pulados = 0;
    for (const proj of state.projetos) {
      const tem =
        !!proj.valor_tcv &&
        proj.valor_tcv > 0 &&
        !!proj.num_parcelas &&
        proj.num_parcelas > 0 &&
        !!proj.data_inicio_pagamento;
      if (!tem) {
        pulados++;
        continue;
      }
      await syncPagamentoAutoDoProjeto(proj);
      sincronizados++;
    }
    return { sincronizados, pulados };
  }, [state.projetos, syncPagamentoAutoDoProjeto]);

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

  // ─── Auto-status do cliente baseado em projetos ativos ────────────────
  // Regra:
  //   - Cliente com 1+ projeto ativo: vai pra "ativo" (de qualquer estado
  //     exceto "churn").
  //   - Cliente "ativo" SEM projeto ativo: vai pra "inativo".
  //   - Cliente "em_fechamento" SEM projeto: mantém em_fechamento (estado
  //     inicial, ainda em negociação — preserva escolha manual).
  //   - Cliente "inativo" continua inativo enquanto não tiver projeto.
  //   - "churn" nunca muda automaticamente (estado terminal manual).
  // Recebe as listas correntes pra evitar stale closure depois de mutar.
  const reavaliarStatusCliente = useCallback(
    async (
      clienteId: string,
      projetosCorrentes: Projeto[],
      clientesCorrentes: Cliente[]
    ) => {
      const cli = clientesCorrentes.find((c) => c.id === clienteId);
      if (!cli) return;
      // churn e excluido são estados terminais manuais — não toca.
      if (cli.status === "churn" || cli.status === "excluido") return;
      const temAtivo = projetosCorrentes.some(
        (p) => p.cliente_id === clienteId && p.status === "ativo"
      );
      let novoStatus: Cliente["status"];
      if (temAtivo) {
        novoStatus = "ativo";
      } else {
        // Sem projeto ativo. Se está em em_fechamento (sem nada), preserva.
        // Se está ativo (perdeu o projeto), vira inativo.
        if (cli.status === "em_fechamento") return;
        novoStatus = "inativo";
      }
      if (cli.status === novoStatus) return;
      try {
        await api.moveClienteStatus(clienteId, novoStatus);
      } catch (err) {
        console.error("[reavaliarStatusCliente] falha:", err);
        return;
      }
      const novoCli: Cliente = { ...cli, status: novoStatus };
      const registro = fazerRegistro(
        {
          entidade: "cliente",
          entidade_id: clienteId,
          entidade_label: `${cli.sigla} · ${cli.nome_fantasia}`,
          acao: "evento",
          resumo:
            novoStatus === "inativo"
              ? "Cliente marcado como inativo (sem projetos ativos)"
              : "Cliente marcado como ativo (projeto ativo detectado)",
          mudancas: [
            { campo: "status", label: "Status", de: cli.status, para: novoStatus },
          ],
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        clientes: s.clientes.map((c) => (c.id === clienteId ? novoCli : c)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.sessao, persistirAudit]
  );

  // ----- CLIENTE -----
  const saveCliente = useCallback(
    async (cliente: Cliente) => {
      const existing = state.clientes.find((c) => c.id === cliente.id);
      const mudancas = diffCliente(existing, cliente);
      try {
        await api.upsertCliente(cliente);
      } catch (err) {
        notificarErro("salvar cliente", err);
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

  // Soft delete: marca como "excluido" (estado distinto de "inativo").
  // Cliente some das listagens mas continua no banco — permite recuperar
  // pelo histórico de auditoria.
  const deleteCliente = useCallback(
    async (id: string) => {
      const cli = state.clientes.find((c) => c.id === id);
      if (!cli) return;
      const statusAnterior = cli.status;
      try {
        await api.moveClienteStatus(id, "excluido");
      } catch (err) {
        notificarErro("excluir cliente", err);
        return;
      }
      const novo: Cliente = { ...cli, status: "excluido" };
      const registro = fazerRegistro(
        {
          entidade: "cliente",
          entidade_id: id,
          entidade_label: `${cli.sigla} · ${cli.nome_fantasia}`,
          acao: "remover",
          resumo: "Cliente excluído",
          mudancas: [
            { campo: "status", label: "Status", de: statusAnterior, para: "excluido" },
          ],
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
        notificarErro("mover cliente", err);
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
        notificarErro("salvar investidor", err);
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
        notificarErro("remover investidor", err);
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
        notificarErro("salvar projeto", err);
        return;
      }
      const projetosAtualizados = existing
        ? state.projetos.map((p) => (p.id === projeto.id ? projeto : p))
        : [...state.projetos, projeto];
      setState((s) => ({ ...s, projetos: projetosAtualizados }));
      if (existing && mudancas.length === 0) {
        // Mesmo sem diff, re-avalia: status pode ter mudado em outro lugar.
        await reavaliarStatusCliente(projeto.cliente_id, projetosAtualizados, state.clientes);
        return;
      }
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
      // Re-avalia o cliente atual; se mudou de cliente, re-avalia o antigo
      // também para deixar o anterior consistente.
      await reavaliarStatusCliente(projeto.cliente_id, projetosAtualizados, state.clientes);
      if (existing && existing.cliente_id !== projeto.cliente_id) {
        await reavaliarStatusCliente(existing.cliente_id, projetosAtualizados, state.clientes);
      }
      // Sincroniza o pagamento espelho do projeto (cria/atualiza régua de
      // parcelas conforme TCV + parcelas + data_inicio_pagamento).
      await syncPagamentoAutoDoProjeto(projeto);
    },
    [
      state.projetos,
      state.fases,
      state.sessao,
      state.clientes,
      persistirAudit,
      reavaliarStatusCliente,
      syncPagamentoAutoDoProjeto,
    ]
  );

  // Soft delete: marca como concluído (preserva projeto + pagamentos +
  // squad + reuniões para permitir "Recuperar" depois via auditoria).
  const deleteProjeto = useCallback(
    async (id: string) => {
      const prj = state.projetos.find((p) => p.id === id);
      if (!prj) return;
      const statusAnterior = prj.status;
      try {
        await api.softDeleteProjeto(id);
      } catch (err) {
        notificarErro("excluir projeto", err);
        return;
      }
      const novo: Projeto = { ...prj, status: "concluido" };
      const projetosAtualizados = state.projetos.map((p) =>
        p.id === id ? novo : p
      );
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: id,
          entidade_label: `${prj.codigo} · ${prj.nome}`,
          acao: "remover",
          resumo: "Projeto encerrado",
          mudancas: [
            { campo: "status", label: "Status", de: statusAnterior, para: "concluido" },
          ],
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        projetos: projetosAtualizados,
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
      // Re-avalia status do cliente vinculado.
      await reavaliarStatusCliente(prj.cliente_id, projetosAtualizados, state.clientes);
    },
    [state.projetos, state.sessao, state.clientes, persistirAudit, reavaliarStatusCliente]
  );

  const moveProjetoFase = useCallback(
    async (projetoId: string, novaFase: Projeto["fase_atual"]) => {
      const proj = state.projetos.find((p) => p.id === projetoId);
      if (!proj || proj.fase_atual === novaFase) return;
      // Ao entrar numa fase de encerramento (Concluído / Concluído Churn) e
      // ainda não houver `data_conclusao_real`, registra a data de hoje.
      // Isso permite atribuir corretamente o churn/conclusão ao mês no
      // relatório de evolução da carteira.
      const novaFaseObj = state.fases.find((f) => f.id === novaFase);
      const entrouEmEncerramento =
        ehFaseEncerramento(novaFaseObj?.nome) && !proj.data_conclusao_real;
      const dataConclusaoReal = entrouEmEncerramento
        ? new Date().toISOString().slice(0, 10)
        : proj.data_conclusao_real;
      const novo: Projeto = {
        ...proj,
        fase_atual: novaFase,
        data_conclusao_real: dataConclusaoReal,
      };
      try {
        // Persiste a mudança completa (fase + data_conclusao_real) quando a
        // data foi atualizada; senão usa o atalho mais leve de moveFase.
        if (entrouEmEncerramento) {
          await api.upsertProjeto(novo);
        } else {
          await api.moveProjetoFase(projetoId, novaFase);
        }
      } catch (err) {
        notificarErro("mover projeto", err);
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
        notificarErro("salvar pagamento", err);
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
        notificarErro("remover pagamento", err);
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
        notificarErro("atualizar parcela", err);
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
        notificarErro("salvar fase", err);
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
        notificarErro("remover fase", err);
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
        notificarErro("reordenar fases", err);
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

  // Próximo sequencial de venda dentro do cliente. Olha o maior `venda_seq`
  // já usado em projetos do mesmo cliente e retorna +1. Para clientes sem
  // venda registrada ainda, retorna 1. Projetos legados (sem `venda_seq`)
  // são ignorados na contagem — o sufixo `O{N}` é exclusivo do novo formato.
  const proximaVendaSeq = useCallback(
    (clienteId: string): number => {
      const seqs = state.projetos
        .filter((p) => p.cliente_id === clienteId && typeof p.venda_seq === "number")
        .map((p) => p.venda_seq as number);
      if (seqs.length === 0) return 1;
      return Math.max(...seqs) + 1;
    },
    [state.projetos]
  );

  // Próxima letra disponível dentro de uma venda específica. Considera
  // letras já usadas (case-insensitive) e retorna a próxima A→Z.
  const proximaLetraDaVenda = useCallback(
    (clienteId: string, vendaSeq: number): string => {
      const usadas = new Set(
        state.projetos
          .filter(
            (p) =>
              p.cliente_id === clienteId &&
              p.venda_seq === vendaSeq &&
              typeof p.venda_letra === "string"
          )
          .map((p) => (p.venda_letra as string).toUpperCase())
      );
      for (let code = 65; code <= 90; code++) {
        const letra = String.fromCharCode(code);
        if (!usadas.has(letra)) return letra;
      }
      return "Z"; // fallback se ultrapassar 26 negociações na mesma venda
    },
    [state.projetos]
  );

  const gerarCodigoProjeto = useCallback(
    (clienteId: string): string => {
      const cli = state.clientes.find((c) => c.id === clienteId);
      if (!cli) return "PROJ-O1-A";
      const seq = proximaVendaSeq(clienteId);
      return `${cli.sigla}-O${seq}-A`;
    },
    [state.clientes, proximaVendaSeq]
  );

  // ----- OPORTUNIDADE -----
  const saveOportunidade = useCallback(
    async (o: Oportunidade) => {
      const existing = state.oportunidades.find((x) => x.id === o.id);
      try {
        await api.upsertOportunidade(o);
      } catch (err) {
        notificarErro("salvar oportunidade", err);
        return;
      }
      setState((s) => ({
        ...s,
        oportunidades: existing
          ? s.oportunidades.map((x) => (x.id === o.id ? o : x))
          : [o, ...s.oportunidades],
      }));
      const cli = state.clientes.find((c) => c.id === o.cliente_id);
      const registro = fazerRegistro(
        {
          entidade: "projeto", // reaproveita a entidade no audit (não temos "oportunidade" no enum)
          entidade_id: o.id,
          entidade_label: `Oportunidade · ${cli?.sigla ?? "?"} · ${o.nome}`,
          acao: existing ? "atualizar" : "criar",
          resumo: existing
            ? "Oportunidade atualizada"
            : `Oportunidade criada · etapa ${ETAPA_OPORTUNIDADE_LABEL[o.etapa]}`,
          mudancas: [],
        },
        state.sessao
      );
      setState((s) => ({ ...s, auditoria: [registro, ...s.auditoria] }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.oportunidades, state.clientes, state.sessao, persistirAudit]
  );

  const deleteOportunidade = useCallback(
    async (id: string) => {
      const o = state.oportunidades.find((x) => x.id === id);
      if (!o) return;
      try {
        await api.hardDeleteOportunidade(id);
      } catch (err) {
        notificarErro("excluir oportunidade", err);
        return;
      }
      const cli = state.clientes.find((c) => c.id === o.cliente_id);
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: id,
          entidade_label: `Oportunidade · ${cli?.sigla ?? "?"} · ${o.nome}`,
          acao: "remover",
          resumo: "Oportunidade excluída",
          mudancas: [],
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        oportunidades: s.oportunidades.filter((x) => x.id !== id),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.oportunidades, state.clientes, state.sessao, persistirAudit]
  );

  const moveOportunidadeEtapa = useCallback(
    async (id: string, novaEtapa: Oportunidade["etapa"]) => {
      const o = state.oportunidades.find((x) => x.id === id);
      if (!o || o.etapa === novaEtapa) return;
      try {
        await api.moveOportunidadeEtapa(id, novaEtapa);
      } catch (err) {
        notificarErro("mover oportunidade", err);
        return;
      }
      const novo: Oportunidade = {
        ...o,
        etapa: novaEtapa,
        data_fechamento_real:
          novaEtapa === "fechado_ganho" || novaEtapa === "fechado_perdido"
            ? new Date().toISOString().slice(0, 10)
            : undefined,
        // Limpa motivo de perda se sair de "fechado_perdido"
        motivo_perda: novaEtapa === "fechado_perdido" ? o.motivo_perda : undefined,
      };
      const cli = state.clientes.find((c) => c.id === o.cliente_id);
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: id,
          entidade_label: `Oportunidade · ${cli?.sigla ?? "?"} · ${o.nome}`,
          acao: "atualizar",
          resumo: `Movida para "${ETAPA_OPORTUNIDADE_LABEL[novaEtapa]}"`,
          mudancas: [
            {
              campo: "etapa",
              label: "Etapa",
              de: ETAPA_OPORTUNIDADE_LABEL[o.etapa],
              para: ETAPA_OPORTUNIDADE_LABEL[novaEtapa],
            },
          ],
        },
        state.sessao
      );
      setState((s) => ({
        ...s,
        oportunidades: s.oportunidades.map((x) => (x.id === id ? novo : x)),
        auditoria: [registro, ...s.auditoria],
      }));
      persistirAudit(registro, state.sessao?.email);
    },
    [state.oportunidades, state.clientes, state.sessao, persistirAudit]
  );

  // ─── Recuperação a partir de um registro de auditoria ────────────────
  // Hoje suporta apenas `acao === 'remover'`. Reverte o status pra ativo
  // (cliente: 'ativo'; projeto: 'ativo'; investidor: 'ativo').
  const recuperarRegistro = useCallback(
    async (registroId: string): Promise<string | null> => {
      const reg = state.auditoria.find((a) => a.id === registroId);
      if (!reg) return "Registro de auditoria não encontrado.";
      if (reg.acao !== "remover") {
        return "Só é possível recuperar registros de remoção.";
      }
      try {
        if (reg.entidade === "cliente") {
          const cli = state.clientes.find((c) => c.id === reg.entidade_id);
          if (!cli) return "Cliente não está mais no banco — recuperação indisponível.";
          await api.moveClienteStatus(cli.id, "ativo");
          const novo: Cliente = { ...cli, status: "ativo" };
          const registroNovo = fazerRegistro(
            {
              entidade: "cliente",
              entidade_id: cli.id,
              entidade_label: `${cli.sigla} · ${cli.nome_fantasia}`,
              acao: "evento",
              resumo: "Cliente recuperado (status → ativo)",
              mudancas: [
                {
                  campo: "status",
                  label: "Status",
                  de: cli.status,
                  para: "ativo",
                },
              ],
            },
            state.sessao
          );
          setState((s) => ({
            ...s,
            clientes: s.clientes.map((c) => (c.id === cli.id ? novo : c)),
            auditoria: [registroNovo, ...s.auditoria],
          }));
          persistirAudit(registroNovo, state.sessao?.email);
          return null;
        }
        if (reg.entidade === "projeto") {
          const prj = state.projetos.find((p) => p.id === reg.entidade_id);
          if (!prj) return "Projeto não está mais no banco — recuperação indisponível.";
          const novo: Projeto = { ...prj, status: "ativo" };
          await api.upsertProjeto(novo);
          const projetosAtualizados = state.projetos.map((p) =>
            p.id === prj.id ? novo : p
          );
          const registroNovo = fazerRegistro(
            {
              entidade: "projeto",
              entidade_id: prj.id,
              entidade_label: `${prj.codigo} · ${prj.nome}`,
              acao: "evento",
              resumo: "Projeto recuperado (status → ativo)",
              mudancas: [
                {
                  campo: "status",
                  label: "Status",
                  de: prj.status,
                  para: "ativo",
                },
              ],
            },
            state.sessao
          );
          setState((s) => ({
            ...s,
            projetos: projetosAtualizados,
            auditoria: [registroNovo, ...s.auditoria],
          }));
          persistirAudit(registroNovo, state.sessao?.email);
          // Recuperar projeto pode reativar cliente que estava inativo.
          await reavaliarStatusCliente(prj.cliente_id, projetosAtualizados, state.clientes);
          return null;
        }
        if (reg.entidade === "investidor") {
          const inv = state.investidores.find((i) => i.id === reg.entidade_id);
          if (!inv) return "Investidor não está mais no banco — recuperação indisponível.";
          const novo: Investidor = { ...inv, status: "ativo", data_saida: undefined };
          await api.upsertInvestidor(novo);
          const registroNovo = fazerRegistro(
            {
              entidade: "investidor",
              entidade_id: inv.id,
              entidade_label: inv.nome,
              acao: "evento",
              resumo: "Investidor recuperado (status → ativo)",
              mudancas: [
                { campo: "status", label: "Status", de: inv.status, para: "ativo" },
              ],
            },
            state.sessao
          );
          setState((s) => ({
            ...s,
            investidores: s.investidores.map((i) => (i.id === inv.id ? novo : i)),
            auditoria: [registroNovo, ...s.auditoria],
          }));
          persistirAudit(registroNovo, state.sessao?.email);
          return null;
        }
        return `Recuperação não suportada para entidade "${reg.entidade}".`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha ao recuperar.";
        return msg;
      }
    },
    [
      state.auditoria,
      state.clientes,
      state.projetos,
      state.investidores,
      state.sessao,
      persistirAudit,
      reavaliarStatusCliente,
    ]
  );


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
      saveOportunidade,
      deleteOportunidade,
      moveOportunidadeEtapa,
      sincronizarTodosPagamentos,
      gerarCodigoProjeto,
      proximaVendaSeq,
      proximaLetraDaVenda,
      recuperarRegistro,
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
      saveOportunidade,
      deleteOportunidade,
      moveOportunidadeEtapa,
      sincronizarTodosPagamentos,
      gerarCodigoProjeto,
      proximaVendaSeq,
      proximaLetraDaVenda,
      recuperarRegistro,
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
