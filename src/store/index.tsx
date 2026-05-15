import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  Produto,
  Projeto,
  RegistroAuditoria,
  Sessao,
  Usuario,
} from "@/types";
import { readKey, STORAGE_KEYS, writeKey } from "./storage";
import { seedInicial } from "./seed";
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
  usuarios: Usuario[];
  sessao: Sessao | null;
}

interface AppActions {
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;

  saveCliente: (cliente: Cliente) => void;
  deleteCliente: (id: string) => void;
  moveClienteStatus: (clienteId: string, novoStatus: Cliente["status"]) => void;

  saveInvestidor: (inv: Investidor) => void;
  deleteInvestidor: (id: string) => void;

  // Catálogo de produtos: read-only no front. A função abaixo é o ponto de
  // entrada para sincronizar com o banco externo (V4). Hoje recebe o payload
  // já pronto; amanhã será chamada pelo job/integração.
  sincronizarProdutos: (produtos: Produto[]) => void;

  saveProjeto: (projeto: Projeto) => void;
  deleteProjeto: (id: string) => void;
  moveProjetoFase: (projetoId: string, novaFase: Projeto["fase_atual"]) => void;

  savePagamento: (pag: Pagamento) => void;
  deletePagamento: (id: string) => void;
  atualizarParcela: (pagamentoId: string, parcela: Parcela) => void;

  // Fases do kanban (CRUD + reordenar). deleteFase devolve mensagem de erro
  // quando há projetos vinculados; null = ok.
  saveFase: (fase: Fase) => void;
  deleteFase: (id: string) => string | null;
  reordenarFases: (idsEmOrdem: string[]) => void;
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
  const [state, setState] = useState<AppState>(() => {
    const seedDone = readKey(STORAGE_KEYS.seedDone, false);
    if (!seedDone) {
      const seeded = seedInicial();
      writeKey(STORAGE_KEYS.clientes, seeded.clientes);
      writeKey(STORAGE_KEYS.investidores, seeded.investidores);
      writeKey(STORAGE_KEYS.produtos, seeded.produtos);
      writeKey(STORAGE_KEYS.projetos, seeded.projetos);
      writeKey(STORAGE_KEYS.pagamentos, seeded.pagamentos);
      writeKey(STORAGE_KEYS.usuarios, seeded.usuarios);
      writeKey(STORAGE_KEYS.fases, seeded.fases);
      writeKey(STORAGE_KEYS.auditoria, []);
      writeKey(STORAGE_KEYS.seedDone, true);
      return {
        ...seeded,
        auditoria: [],
        sessao: readKey<Sessao | null>(STORAGE_KEYS.sessao, null),
      };
    }
    // Migração defensiva: corrige produtos antigos que possam ter categoria
    // em lowercase (versões prévias do mapper do Supabase). Garante que
    // todo produto no store tenha categoria UPPERCASE válida.
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
      clientes: readKey<Cliente[]>(STORAGE_KEYS.clientes, []),
      investidores: readKey<Investidor[]>(STORAGE_KEYS.investidores, []),
      produtos: produtosNormalizados,
      projetos: readKey<Projeto[]>(STORAGE_KEYS.projetos, []),
      pagamentos: readKey<Pagamento[]>(STORAGE_KEYS.pagamentos, []),
      fases: readKey<Fase[]>(STORAGE_KEYS.fases, FASES_DEFAULT),
      auditoria: readKey<RegistroAuditoria[]>(STORAGE_KEYS.auditoria, []),
      usuarios: readKey<Usuario[]>(STORAGE_KEYS.usuarios, []),
      sessao: readKey<Sessao | null>(STORAGE_KEYS.sessao, null),
    };
  });

  useEffect(() => writeKey(STORAGE_KEYS.clientes, state.clientes), [state.clientes]);
  useEffect(() => writeKey(STORAGE_KEYS.investidores, state.investidores), [state.investidores]);
  useEffect(() => writeKey(STORAGE_KEYS.produtos, state.produtos), [state.produtos]);
  useEffect(() => writeKey(STORAGE_KEYS.projetos, state.projetos), [state.projetos]);
  useEffect(() => writeKey(STORAGE_KEYS.pagamentos, state.pagamentos), [state.pagamentos]);
  useEffect(() => writeKey(STORAGE_KEYS.fases, state.fases), [state.fases]);
  useEffect(() => writeKey(STORAGE_KEYS.auditoria, state.auditoria), [state.auditoria]);
  useEffect(() => writeKey(STORAGE_KEYS.usuarios, state.usuarios), [state.usuarios]);
  useEffect(() => {
    if (state.sessao) writeKey(STORAGE_KEYS.sessao, state.sessao);
    else localStorage.removeItem("v4gp:" + STORAGE_KEYS.sessao);
  }, [state.sessao]);

  const login = useCallback(
    async (email: string, senha: string): Promise<boolean> => {
      const u = state.usuarios.find(
        (x) => x.email.toLowerCase() === email.toLowerCase() && x.status === "ativo"
      );
      if (!u) return false;
      if (u.senha_hash !== hashSenha(senha)) return false;
      const sessao: Sessao = {
        usuario_id: u.id,
        email: u.email,
        nome: u.nome,
        perfil: u.perfil,
        expira_em: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      };
      setState((s) => ({
        ...s,
        sessao,
        usuarios: s.usuarios.map((x) => (x.id === u.id ? { ...x, ultimo_login: new Date().toISOString() } : x)),
      }));
      return true;
    },
    [state.usuarios]
  );

  const logout = useCallback(() => {
    setState((s) => ({ ...s, sessao: null }));
  }, []);

  // ----- CLIENTE -----
  const saveCliente = useCallback((cliente: Cliente) => {
    setState((s) => {
      const existing = s.clientes.find((c) => c.id === cliente.id);
      const mudancas = diffCliente(existing, cliente);
      const novosClientes = existing
        ? s.clientes.map((c) => (c.id === cliente.id ? cliente : c))
        : [...s.clientes, cliente];

      const registro = fazerRegistro(
        {
          entidade: "cliente",
          entidade_id: cliente.id,
          entidade_label: `${cliente.sigla} · ${cliente.nome_fantasia}`,
          acao: existing ? "atualizar" : "criar",
          resumo: existing ? resumoMudancas(mudancas) : "Cliente criado",
          mudancas,
        },
        s.sessao
      );

      // Se não houve mudança real, não polui o log
      if (existing && mudancas.length === 0) {
        return { ...s, clientes: novosClientes };
      }
      return {
        ...s,
        clientes: novosClientes,
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  const deleteCliente = useCallback((id: string) => {
    setState((s) => {
      const cli = s.clientes.find((c) => c.id === id);
      if (!cli) return s;
      const novo = { ...cli, status: "inativo" as const };
      const registro = fazerRegistro(
        {
          entidade: "cliente",
          entidade_id: id,
          entidade_label: `${cli.sigla} · ${cli.nome_fantasia}`,
          acao: "remover",
          resumo: "Cliente marcado como inativo",
          mudancas: diffCliente(cli, novo),
        },
        s.sessao
      );
      return {
        ...s,
        clientes: s.clientes.map((c) => (c.id === id ? novo : c)),
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  // Atualiza apenas o status do cliente (usado no drag-and-drop do kanban).
  // Quando muda PARA churn, registra a data automaticamente; quando sai de
  // churn, limpa data_churn e motivo_churn.
  const moveClienteStatus = useCallback(
    (clienteId: string, novoStatus: Cliente["status"]) => {
      setState((s) => {
        const cli = s.clientes.find((c) => c.id === clienteId);
        if (!cli || cli.status === novoStatus) return s;
        const novo: Cliente = { ...cli, status: novoStatus };
        if (novoStatus === "churn" && !novo.data_churn) {
          novo.data_churn = new Date().toISOString().slice(0, 10);
        } else if (novoStatus !== "churn") {
          novo.data_churn = undefined;
          novo.motivo_churn = undefined;
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
          s.sessao
        );
        return {
          ...s,
          clientes: s.clientes.map((c) => (c.id === clienteId ? novo : c)),
          auditoria: [registro, ...s.auditoria],
        };
      });
    },
    []
  );

  // ----- INVESTIDOR -----
  const saveInvestidor = useCallback((inv: Investidor) => {
    setState((s) => {
      const existing = s.investidores.find((i) => i.id === inv.id);
      const mudancas = diffInvestidor(existing, inv);
      const novos = existing
        ? s.investidores.map((i) => (i.id === inv.id ? inv : i))
        : [...s.investidores, inv];
      const registro = fazerRegistro(
        {
          entidade: "investidor",
          entidade_id: inv.id,
          entidade_label: inv.nome,
          acao: existing ? "atualizar" : "criar",
          resumo: existing ? resumoMudancas(mudancas) : "Investidor criado",
          mudancas,
        },
        s.sessao
      );
      if (existing && mudancas.length === 0) {
        return { ...s, investidores: novos };
      }
      return {
        ...s,
        investidores: novos,
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  const deleteInvestidor = useCallback((id: string) => {
    setState((s) => {
      const inv = s.investidores.find((i) => i.id === id);
      if (!inv) return s;
      const novo = { ...inv, status: "inativo" as const };
      const registro = fazerRegistro(
        {
          entidade: "investidor",
          entidade_id: id,
          entidade_label: inv.nome,
          acao: "remover",
          resumo: "Investidor marcado como inativo",
          mudancas: diffInvestidor(inv, novo),
        },
        s.sessao
      );
      return {
        ...s,
        investidores: s.investidores.map((i) => (i.id === id ? novo : i)),
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

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
  const saveProjeto = useCallback((projeto: Projeto) => {
    setState((s) => {
      const existing = s.projetos.find((p) => p.id === projeto.id);
      const mudancas = diffProjeto(existing, projeto, s.fases);
      const novos = existing
        ? s.projetos.map((p) => (p.id === projeto.id ? projeto : p))
        : [...s.projetos, projeto];
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: projeto.id,
          entidade_label: `${projeto.codigo} · ${projeto.nome}`,
          acao: existing ? "atualizar" : "criar",
          resumo: existing ? resumoMudancas(mudancas) : "Projeto criado",
          mudancas,
        },
        s.sessao
      );
      if (existing && mudancas.length === 0) {
        return { ...s, projetos: novos };
      }
      return {
        ...s,
        projetos: novos,
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  const deleteProjeto = useCallback((id: string) => {
    setState((s) => {
      const prj = s.projetos.find((p) => p.id === id);
      if (!prj) return s;
      const novo = { ...prj, status: "concluido" as const };
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: id,
          entidade_label: `${prj.codigo} · ${prj.nome}`,
          acao: "remover",
          resumo: "Projeto encerrado",
          mudancas: diffProjeto(prj, novo, s.fases),
        },
        s.sessao
      );
      return {
        ...s,
        projetos: s.projetos.map((p) => (p.id === id ? novo : p)),
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  const moveProjetoFase = useCallback((projetoId: string, novaFase: Projeto["fase_atual"]) => {
    setState((s) => {
      const proj = s.projetos.find((p) => p.id === projetoId);
      if (!proj || proj.fase_atual === novaFase) return s;
      const novo = { ...proj, fase_atual: novaFase };
      const registro = fazerRegistro(
        {
          entidade: "projeto",
          entidade_id: projetoId,
          entidade_label: `${proj.codigo} · ${proj.nome}`,
          acao: "atualizar",
          resumo: "Movido entre fases no kanban",
          mudancas: diffProjeto(proj, novo, s.fases),
        },
        s.sessao
      );
      return {
        ...s,
        projetos: s.projetos.map((p) => (p.id === projetoId ? novo : p)),
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  // ----- PAGAMENTO -----
  const savePagamento = useCallback((pag: Pagamento) => {
    setState((s) => {
      const existing = s.pagamentos.find((p) => p.id === pag.id);
      const mudancas = diffPagamento(existing, pag);
      const novos = existing
        ? s.pagamentos.map((p) => (p.id === pag.id ? pag : p))
        : [...s.pagamentos, pag];
      const proj = s.projetos.find((p) => p.id === pag.projeto_id);
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
        s.sessao
      );
      if (existing && mudancas.length === 0) {
        return { ...s, pagamentos: novos };
      }
      return {
        ...s,
        pagamentos: novos,
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  const deletePagamento = useCallback((id: string) => {
    setState((s) => {
      const pag = s.pagamentos.find((p) => p.id === id);
      if (!pag) return s;
      const novo = { ...pag, status_geral: "cancelado" as const };
      const proj = s.projetos.find((p) => p.id === pag.projeto_id);
      const registro = fazerRegistro(
        {
          entidade: "pagamento",
          entidade_id: id,
          entidade_label: proj
            ? `${proj.codigo} · pagamento`
            : "Pagamento",
          pai_entidade: "projeto",
          pai_id: pag.projeto_id,
          acao: "remover",
          resumo: "Pagamento cancelado",
          mudancas: diffPagamento(pag, novo),
        },
        s.sessao
      );
      return {
        ...s,
        pagamentos: s.pagamentos.map((p) => (p.id === id ? novo : p)),
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  const atualizarParcela = useCallback((pagamentoId: string, parcela: Parcela) => {
    setState((s) => {
      const pag = s.pagamentos.find((p) => p.id === pagamentoId);
      if (!pag) return s;
      const anterior = pag.parcelas.find((p) => p.id === parcela.id);
      const mudancas = diffParcela(anterior, parcela);
      const novoPag = {
        ...pag,
        parcelas: pag.parcelas.map((par) => (par.id === parcela.id ? parcela : par)),
      };
      const proj = s.projetos.find((p) => p.id === pag.projeto_id);
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
        s.sessao
      );
      if (mudancas.length === 0) {
        return {
          ...s,
          pagamentos: s.pagamentos.map((p) => (p.id === pagamentoId ? novoPag : p)),
        };
      }
      return {
        ...s,
        pagamentos: s.pagamentos.map((p) => (p.id === pagamentoId ? novoPag : p)),
        auditoria: [registro, ...s.auditoria],
      };
    });
  }, []);

  // ----- FASES (kanban) -----
  const saveFase = useCallback((fase: Fase) => {
    setState((s) => {
      const existing = s.fases.find((f) => f.id === fase.id);
      const novas = existing
        ? s.fases.map((f) => (f.id === fase.id ? fase : f))
        : [...s.fases, fase];
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
        s.sessao
      );
      return { ...s, fases: novas, auditoria: [registro, ...s.auditoria] };
    });
  }, []);

  const deleteFase = useCallback(
    (id: string): string | null => {
      const fase = state.fases.find((f) => f.id === id);
      if (!fase) return "Fase não encontrada.";
      const projetosNaFase = state.projetos.filter(
        (p) => p.fase_atual === id
      ).length;
      if (projetosNaFase > 0) {
        return `Não é possível excluir: ${projetosNaFase} projeto(s) estão nesta fase. Mova-os primeiro.`;
      }
      setState((s) => {
        const registro = fazerRegistro(
          {
            entidade: "projeto",
            entidade_id: id,
            entidade_label: `Fase: ${fase.nome}`,
            acao: "remover",
            resumo: `Fase "${fase.nome}" excluída`,
            mudancas: [],
          },
          s.sessao
        );
        return {
          ...s,
          fases: s.fases.filter((f) => f.id !== id),
          auditoria: [registro, ...s.auditoria],
        };
      });
      return null;
    },
    [state.fases, state.projetos]
  );

  const reordenarFases = useCallback((idsEmOrdem: string[]) => {
    setState((s) => {
      const novas = s.fases
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
              de: s.fases.map((f) => f.nome).join(" → "),
              para: novas.map((f) => f.nome).join(" → "),
            },
          ],
        },
        s.sessao
      );
      return { ...s, fases: novas, auditoria: [registro, ...s.auditoria] };
    });
  }, []);

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

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      login,
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
    }),
    [
      state,
      login,
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
