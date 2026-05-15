// Tipos centrais do sistema (MVP - Fase 1)

export type Perfil = "admin" | "gestor" | "executor" | "leitura";
export type StatusComum = "ativo" | "inativo";
export type ModeloVendas = "pdv" | "inside_sales" | "ecommerce";
export type SistemaConexao =
  | "whatsapp"
  | "crm"
  | "ferramenta_call"
  | "gestor_trafego"
  | "drive"
  | "outro";

export type CategoriaV4 = "SABER" | "TER" | "EXECUTAR" | "POTENCIALIZAR";
export type Tier = "tiny" | "small" | "medium" | "large" | "enterprise";

// FaseProjeto agora é uma string livre (id da fase no catálogo dinâmico de
// fases armazenado em store). Os IDs default (inicio, kickoff, etc.) ainda
// existem por padrão, mas o operador pode adicionar/renomear/remover fases.
export type FaseProjeto = string;

export interface Fase {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number; // posição no kanban (asc)
}

export type Segmento =
  | "saude"
  | "educacao"
  | "varejo_fisico"
  | "ecommerce"
  | "saas"
  | "industria"
  | "servicos_b2b"
  | "imobiliario"
  | "alimentacao"
  | "beleza_estetica"
  | "financeiro"
  | "automotivo"
  | "construcao_civil"
  | "outros";

export type RegiaoAtuacao =
  | "local"
  | "regional"
  | "estadual"
  | "nacional"
  | "internacional";
export type StatusProjeto = "ativo" | "pausado" | "concluido" | "churn";
export type SaudeProjeto = "saudavel" | "alerta" | "cuidado" | "critico";
export type OrigemProjeto = "aquisicao" | "upsell" | "indicacao" | "renovacao";

export type FuncaoSquad =
  | "gerente"
  | "coordenador"
  | "designer"
  | "copywriter"
  | "gestor_trafego"
  | "analista"
  | "outro";

export type StatusCliente = "em_fechamento" | "ativo" | "inativo" | "churn";

// Fases visíveis no Kanban de Cliente. Churn é exibido junto com inativo
// porque conceitualmente representa um inativo "perdido" (com motivo).
export type FaseCliente = "em_fechamento" | "ativo" | "inativo";

export const FASES_CLIENTE: {
  value: FaseCliente;
  label: string;
  descricao: string;
}[] = [
  {
    value: "em_fechamento",
    label: "Em fechamento",
    descricao: "Ainda em negociação, sem contrato assinado.",
  },
  {
    value: "ativo",
    label: "Cliente ativo",
    descricao: "Precisa ter ao menos um projeto ativo vinculado.",
  },
  {
    value: "inativo",
    label: "Cliente inativo",
    descricao: "Sem projeto ativo no momento.",
  },
];

export type MotivoChurn =
  | "resultados_abaixo"
  | "restricao_orcamentaria"
  | "reestruturacao_interna"
  | "mudanca_estrategia"
  | "internalizou_marketing"
  | "concorrencia"
  | "insatisfacao_atendimento"
  | "conflito_comercial"
  | "fim_escopo"
  | "outro";

export type SentimentoReuniao =
  | "muito_positivo"
  | "positivo"
  | "neutro"
  | "atencao"
  | "negativo";

export type TipoReuniao =
  | "kickoff"
  | "alinhamento"
  | "checkpoint"
  | "review"
  | "escalonamento"
  | "renovacao"
  | "outro";

export interface ReuniaoProjeto {
  id: string;
  data: string;          // ISO date (yyyy-mm-dd)
  titulo: string;
  tipo: TipoReuniao;
  participantes?: string;
  transcricao_url?: string;
  gravacao_url?: string;
  sentimento: SentimentoReuniao;
  resumo?: string;
  proximos_passos?: string;
}

export type TipoPagamento = "entrada" | "recorrente" | "parcelado";
export type MetodoPagamento =
  | "boleto"
  | "pix"
  | "cartao_credito"
  | "transferencia"
  | "outro";

// Forma de pagamento acordada no contrato do projeto. Diferente de
// `MetodoPagamento` (que registra como uma parcela efetiva foi paga).
export type FormaPagamento =
  | "pix"
  | "boleto"
  | "cheque"
  | "cartao_recorrente"
  | "cartao";
export type Periodicidade = "mensal" | "trimestral" | "unica" | "personalizada";
export type StatusPagamento = "ativo" | "concluido" | "cancelado";
export type StatusParcela = "previsto" | "pago" | "atrasado" | "cancelado";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: Perfil;
  status: StatusComum;
  investidor_id?: string;
  criado_em: string;
  ultimo_login?: string;
}

export interface ContatoCliente {
  id: string;
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;

  // Texto livre que mapeia o perfil da pessoa: jeitão, dores, motivações,
  // postura em relação ao projeto, como abordar. Alimentado pelas reuniões
  // de venda/qualificação/plano de vôo e atualizado conforme a operação
  // conhece melhor o cliente. Mantemos como texto único intencionalmente
  // para não engessar a forma como cada operador prefere registrar.
  contexto?: string;
}

export interface ConexaoCliente {
  id: string;
  cliente_id: string;
  sistema: SistemaConexao;
  id_externo?: string;
  url?: string;
  observacao?: string;
}

export interface Cliente {
  id: string;
  sigla: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj?: string;
  segmento?: Segmento;
  // Preenchido apenas quando segmento === "outros"
  segmento_outro?: string;
  nicho?: string;
  regiao_atuacao?: RegiaoAtuacao;
  modelo_vendas: ModeloVendas[];
  tier: Tier;
  endereco?: string;
  cidade?: string;
  estado?: string;
  contatos: ContatoCliente[];
  conexoes: ConexaoCliente[];
  status: StatusCliente;
  data_cadastro: string;
  data_churn?: string;
  motivo_churn?: MotivoChurn;
  observacoes?: string;
}

export interface Investidor {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  funcao_principal: FuncaoSquad;
  funcoes_secundarias: FuncaoSquad[];
  status: StatusComum;
  data_entrada: string;
  data_saida?: string;
  foto_url?: string;
  usuario_id?: string;
  observacoes?: string;
}

export interface SquadMembro {
  id: string;
  investidor_id: string;
  funcao: FuncaoSquad;
  data_entrada: string;
  data_saida?: string;
  principal: boolean;
}

export interface LinkRapido {
  id: string;
  label: string;
  url: string;
}

// Variação (SKU) dentro de um produto. Usada para representar diferentes
// versões/configurações do mesmo produto — ex.: "Compartilhado 10%",
// "Compartilhado 25%", "Dedicado 100%" para um profissional de mídia paga.
export interface VariacaoProduto {
  id: string;
  nome: string;
  // Quando o produto representa alocação de recurso, percentual ajuda a
  // descrever a dedicação. Opcional porque nem toda variação é %.
  percentual?: number;
  // Quando preenchido, sobrescreve o valor sugerido do produto pai.
  valor_sugerido?: number;
  ativo: boolean;
}

// Catálogo de produtos. Pensado para futuramente vir de uma fonte externa
// (banco de produtos V4). A categoria V4 é uma propriedade do produto.
export interface Produto {
  id: string;
  nome: string;
  categoria: CategoriaV4;
  descricao?: string;
  modelo_cobranca_padrao: "one_time" | "recorrente";
  valor_sugerido?: number;
  ativo: boolean;
  externo_id?: string; // ID do produto no banco externo, quando integrado
  variacoes: VariacaoProduto[];
}

export interface Projeto {
  id: string;
  codigo: string;
  cliente_id: string;
  produto_id: string;          // ← agora referencia o catálogo
  variacao_id?: string;        // SKU específico dentro do produto (opcional)
  nome: string;
  modelo_cobranca: "one_time" | "recorrente";
  // Em projetos recorrentes, este é o valor MENSAL. Em one-time, o valor total.
  valor_total: number;
  // TCV (Total Contract Value): valor total do contrato ao longo do LT.
  // Aplica principalmente a projetos recorrentes (valor_total é o mensal,
  // valor_tcv é o total). Em one-time, costuma igualar valor_total.
  valor_tcv?: number;
  // Forma de pagamento acordada no contrato (PIX, Boleto, Cheque, Cartão,
  // Cartão Recorrente).
  forma_pagamento?: FormaPagamento;
  // Número de parcelas (1 a 12). Junto com forma_pagamento e o valor do
  // contrato, define o valor da parcela considerado no financeiro.
  num_parcelas?: number;
  fase_atual: FaseProjeto;
  // Quando o contrato foi assinado (evento comercial / aquisição).
  data_assinatura: string;
  // Quando a equipe efetivamente começou a operação.
  data_inicio: string;
  // Reunião de kickoff agendada (separada do início efetivo).
  data_kickoff?: string;
  // Quando o ciclo de cobrança começa — referência para o financeiro.
  // Em projetos recorrentes, costuma ser a data da 1ª mensalidade. Em
  // projetos one-time, a data da entrada/única parcela.
  data_inicio_pagamento?: string;
  lt_meses?: number;

  // ─── Documentos e links do handoff comercial → operações ───
  // Todos são URLs opcionais. Preenchidos pelo vendedor no momento do
  // handoff (ou depois) para centralizar a localização de tudo.
  oportunidade_crm_url?: string;
  whatsapp_grupo_url?: string;
  contrato_url?: string;
  transcricao_venda_url?: string;
  transcricao_qualificacao_url?: string;
  transcricao_plano_voo_url?: string;

  // ─── Passagem de bastão comercial → operação ───
  // Texto livre que o vendedor (ou quem fez o handoff) escreve no momento
  // que o projeto entra na operação. Inclui contexto do cliente, promessas
  // feitas, expectativas, dores, restrições, decisores. É a "fonte da
  // verdade" para a operação não começar do zero.
  contexto_inicial?: string;

  // ─── Reuniões realizadas durante o projeto ───
  // Cada item registra uma reunião com link de transcrição/gravação e o
  // sentimento percebido. Usado para mapear evolução do humor do cliente
  // ao longo da operação. Opcional para compatibilidade com projetos
  // criados antes da feature.
  reunioes?: ReuniaoProjeto[];

  data_conclusao_prevista?: string;
  data_conclusao_real?: string;
  status: StatusProjeto;
  motivo_churn?: MotivoChurn;
  plano_roi?: string;
  saude_atual: SaudeProjeto;
  links_rapidos: LinkRapido[];
  origem: OrigemProjeto;
  observacoes?: string;
  squad: SquadMembro[];
}

export interface Parcela {
  id: string;
  pagamento_id: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: StatusParcela;
  comprovante_url?: string;
  observacao?: string;
}

export interface Pagamento {
  id: string;
  projeto_id: string;
  tipo: TipoPagamento;
  metodo: MetodoPagamento;
  valor_total: number;
  num_parcelas: number;
  data_primeira_parcela: string;
  periodicidade: Periodicidade;
  status_geral: StatusPagamento;
  observacoes?: string;
  parcelas: Parcela[];
}

// ---------- Auditoria ----------
//
// Princípio: a tabela `auditoria` é APPEND-ONLY. Nunca sobrescrevemos nem
// removemos registros. Cada mudança em qualquer entidade gera um novo registro
// com timestamp, autor, diff campo a campo. É a base para audit trail e para
// uma futura camada de IA / MCP que precise reconstruir a história.

export type EntidadeAuditavel =
  | "cliente"
  | "projeto"
  | "investidor"
  | "produto"
  | "pagamento"
  | "parcela";

export type AcaoAuditoria =
  | "criar"
  | "atualizar"
  | "remover"
  | "evento"; // eventos manuais ou anotações livres

export interface CampoMudanca {
  campo: string;
  label: string;
  de?: string;
  para?: string;
}

export interface RegistroAuditoria {
  id: string;
  timestamp: string;
  usuario_id?: string;
  usuario_nome?: string;
  entidade: EntidadeAuditavel;
  entidade_id: string;
  entidade_label: string;
  // Pai do registro auditado, quando aplicável.
  // Ex.: parcela pertence a pagamento, pagamento pertence a projeto.
  // Permite mostrar histórico financeiro dentro do projeto.
  pai_entidade?: EntidadeAuditavel;
  pai_id?: string;
  acao: AcaoAuditoria;
  resumo: string;
  mudancas: CampoMudanca[];
}

// Sessão simples (MVP)
export interface Sessao {
  usuario_id: string;
  email: string;
  nome: string;
  perfil: Perfil;
  expira_em: string;
}

// ---------- Constantes / labels ----------

// Fases default que populam o catálogo na primeira execução. Depois disso,
// elas vivem em estado e podem ser editadas pelo operador via UI.
export const FASES_DEFAULT: Fase[] = [
  { id: "inicio", nome: "Início", descricao: "Cliente recém-fechado.", ordem: 1 },
  { id: "kickoff", nome: "Kickoff", descricao: "Reunião de início realizada.", ordem: 2 },
  { id: "diagnostico", nome: "Diagnóstico / Setup", descricao: "Levantamento e estrutura.", ordem: 3 },
  { id: "execucao", nome: "Execução", descricao: "Operação rodando.", ordem: 4 },
  { id: "entrega", nome: "Entrega / Proposta", descricao: "Entrega de marcos.", ordem: 5 },
  { id: "followup", nome: "Follow-up", descricao: "Acompanhamento próximo.", ordem: 6 },
  { id: "concluido", nome: "Concluído", descricao: "Projeto encerrado.", ordem: 7 },
];

export const CATEGORIAS: { value: CategoriaV4; label: string; descricao: string }[] = [
  { value: "SABER", label: "Saber", descricao: "Consultoria estratégica." },
  { value: "TER", label: "Ter", descricao: "Implementação pontual." },
  { value: "EXECUTAR", label: "Executar", descricao: "Execução contínua." },
  { value: "POTENCIALIZAR", label: "Potencializar", descricao: "Sucesso direcionado." },
];

export const TIERS: { value: Tier; label: string }[] = [
  { value: "tiny", label: "Tiny" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "enterprise", label: "Enterprise" },
];

export const SEGMENTOS: { value: Segmento; label: string }[] = [
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "varejo_fisico", label: "Varejo físico" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS" },
  { value: "industria", label: "Indústria" },
  { value: "servicos_b2b", label: "Serviços B2B" },
  { value: "imobiliario", label: "Imobiliário" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "beleza_estetica", label: "Beleza e Estética" },
  { value: "financeiro", label: "Financeiro" },
  { value: "automotivo", label: "Automotivo" },
  { value: "construcao_civil", label: "Construção Civil" },
  { value: "outros", label: "Outros" },
];

export const SEGMENTO_LABEL: Record<Segmento, string> = Object.fromEntries(
  SEGMENTOS.map((s) => [s.value, s.label])
) as Record<Segmento, string>;

export const REGIOES_ATUACAO: { value: RegiaoAtuacao; label: string }[] = [
  { value: "local", label: "Local" },
  { value: "regional", label: "Regional" },
  { value: "estadual", label: "Estadual" },
  { value: "nacional", label: "Nacional" },
  { value: "internacional", label: "Internacional" },
];

export const REGIAO_ATUACAO_LABEL: Record<RegiaoAtuacao, string> = Object.fromEntries(
  REGIOES_ATUACAO.map((r) => [r.value, r.label])
) as Record<RegiaoAtuacao, string>;

export const MODELOS_VENDAS: { value: ModeloVendas; label: string }[] = [
  { value: "pdv", label: "PDV" },
  { value: "inside_sales", label: "Inside Sales" },
  { value: "ecommerce", label: "E-commerce" },
];

export const FUNCOES_SQUAD: { value: FuncaoSquad; label: string }[] = [
  { value: "gerente", label: "Gerente" },
  { value: "coordenador", label: "Coordenador" },
  { value: "designer", label: "Designer" },
  { value: "copywriter", label: "Copywriter" },
  { value: "gestor_trafego", label: "Gestor de Tráfego" },
  { value: "analista", label: "Analista" },
  { value: "outro", label: "Outro" },
];

export const SAUDE_LABEL: Record<SaudeProjeto, string> = {
  saudavel: "Saudável",
  alerta: "Em alerta",
  cuidado: "Em cuidado",
  critico: "Crítico",
};

export const STATUS_PROJETO_LABEL: Record<StatusProjeto, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  churn: "Churn",
};

export const STATUS_CLIENTE_LABEL: Record<StatusCliente, string> = {
  em_fechamento: "Em fechamento",
  ativo: "Ativo",
  inativo: "Inativo",
  churn: "Churn",
};

export const ORIGENS: { value: OrigemProjeto; label: string }[] = [
  { value: "aquisicao", label: "Aquisição" },
  { value: "upsell", label: "Upsell" },
  { value: "indicacao", label: "Indicação" },
  { value: "renovacao", label: "Renovação" },
];

export const SISTEMAS_CONEXAO: { value: SistemaConexao; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "crm", label: "CRM" },
  { value: "ferramenta_call", label: "Ferramenta de Call" },
  { value: "gestor_trafego", label: "Gestor de Tráfego" },
  { value: "drive", label: "Drive" },
  { value: "outro", label: "Outro" },
];

export const METODOS_PAGAMENTO: { value: MetodoPagamento; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

export const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cheque", label: "Cheque" },
  { value: "cartao_recorrente", label: "Cartão Recorrente" },
  { value: "cartao", label: "Cartão" },
];

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = Object.fromEntries(
  FORMAS_PAGAMENTO.map((f) => [f.value, f.label])
) as Record<FormaPagamento, string>;

export const MOTIVOS_CHURN: { value: MotivoChurn; label: string }[] = [
  { value: "resultados_abaixo", label: "Resultados abaixo da expectativa" },
  { value: "restricao_orcamentaria", label: "Restrição orçamentária" },
  { value: "reestruturacao_interna", label: "Reestruturação interna do cliente" },
  { value: "mudanca_estrategia", label: "Mudança de estratégia / marca" },
  { value: "internalizou_marketing", label: "Internalizou a operação de marketing" },
  { value: "concorrencia", label: "Foi para outra agência / concorrência" },
  { value: "insatisfacao_atendimento", label: "Insatisfação com atendimento" },
  { value: "conflito_comercial", label: "Conflito comercial" },
  { value: "fim_escopo", label: "Fim do escopo contratado" },
  { value: "outro", label: "Outro" },
];

export const MOTIVO_CHURN_LABEL: Record<MotivoChurn, string> = Object.fromEntries(
  MOTIVOS_CHURN.map((m) => [m.value, m.label])
) as Record<MotivoChurn, string>;

export const TIPOS_REUNIAO: { value: TipoReuniao; label: string }[] = [
  { value: "kickoff", label: "Kickoff" },
  { value: "alinhamento", label: "Alinhamento" },
  { value: "checkpoint", label: "Checkpoint" },
  { value: "review", label: "Review de resultados" },
  { value: "escalonamento", label: "Escalonamento" },
  { value: "renovacao", label: "Renovação / Expansão" },
  { value: "outro", label: "Outro" },
];

export const TIPO_REUNIAO_LABEL: Record<TipoReuniao, string> = Object.fromEntries(
  TIPOS_REUNIAO.map((t) => [t.value, t.label])
) as Record<TipoReuniao, string>;

export const SENTIMENTOS_REUNIAO: {
  value: SentimentoReuniao;
  label: string;
  emoji: string;
}[] = [
  { value: "muito_positivo", label: "Muito positivo", emoji: "😄" },
  { value: "positivo", label: "Positivo", emoji: "🙂" },
  { value: "neutro", label: "Neutro", emoji: "😐" },
  { value: "atencao", label: "Em atenção", emoji: "😕" },
  { value: "negativo", label: "Negativo", emoji: "😟" },
];

export const SENTIMENTO_REUNIAO_LABEL: Record<SentimentoReuniao, string> =
  Object.fromEntries(
    SENTIMENTOS_REUNIAO.map((s) => [s.value, s.label])
  ) as Record<SentimentoReuniao, string>;
