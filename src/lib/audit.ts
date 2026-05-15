import {
  CampoMudanca,
  CATEGORIAS,
  Cliente,
  Fase,
  FORMA_PAGAMENTO_LABEL,
  FUNCOES_SQUAD,
  Investidor,
  MetodoPagamento,
  METODOS_PAGAMENTO,
  MODELOS_VENDAS,
  MOTIVO_CHURN_LABEL,
  MotivoChurn,
  ORIGENS,
  Pagamento,
  Parcela,
  Produto,
  Projeto,
  REGIAO_ATUACAO_LABEL,
  RegiaoAtuacao,
  SAUDE_LABEL,
  SEGMENTO_LABEL,
  Segmento,
  STATUS_CLIENTE_LABEL,
  STATUS_PROJETO_LABEL,
  TIERS,
} from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type AnyRecord = Record<string, unknown>;

interface CampoDef {
  key: string;
  label: string;
  format?: (v: unknown) => string;
  // Array comparison: compare via length or stringified content
  isArray?: boolean;
  isCount?: boolean; // Para arrays onde queremos contar mudanças de quantidade
}

function fmtMaybe(v: unknown, fmt?: (v: unknown) => string): string {
  if (v === undefined || v === null || v === "") return "—";
  if (fmt) return fmt(v);
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

function arrayDiff(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? []) !== JSON.stringify(b ?? []);
}

function gerarDiff(
  antes: AnyRecord | undefined,
  depois: AnyRecord,
  fields: CampoDef[]
): CampoMudanca[] {
  const out: CampoMudanca[] = [];
  for (const f of fields) {
    const a = antes ? antes[f.key] : undefined;
    const b = depois[f.key];
    if (f.isArray) {
      if (arrayDiff(a, b)) {
        const ac = Array.isArray(a) ? a.length : 0;
        const bc = Array.isArray(b) ? b.length : 0;
        out.push({
          campo: f.key,
          label: f.label,
          de: f.isCount ? String(ac) : fmtMaybe(a, f.format),
          para: f.isCount ? String(bc) : fmtMaybe(b, f.format),
        });
      }
      continue;
    }
    if (a !== b) {
      out.push({
        campo: f.key,
        label: f.label,
        de: fmtMaybe(a, f.format),
        para: fmtMaybe(b, f.format),
      });
    }
  }
  return out;
}

// ------- Definição de campos por entidade -------

const fmtTier = (v: unknown) => TIERS.find((t) => t.value === v)?.label ?? String(v);
// Resolver de fase precisa de contexto dinâmico (fases configuráveis).
// Recebe a lista atual de fases e retorna um formatter.
function makeFmtFase(fases: Fase[]) {
  return (v: unknown) => fases.find((f) => f.id === v)?.nome ?? String(v ?? "—");
}
const fmtCategoria = (v: unknown) =>
  CATEGORIAS.find((c) => c.value === v)?.label ?? String(v);
const fmtSaude = (v: unknown) =>
  SAUDE_LABEL[v as keyof typeof SAUDE_LABEL] ?? String(v);
const fmtStatusProj = (v: unknown) =>
  STATUS_PROJETO_LABEL[v as keyof typeof STATUS_PROJETO_LABEL] ?? String(v);
const fmtStatusCli = (v: unknown) =>
  STATUS_CLIENTE_LABEL[v as keyof typeof STATUS_CLIENTE_LABEL] ?? String(v);
const fmtMotivo = (v: unknown) =>
  MOTIVO_CHURN_LABEL[v as MotivoChurn] ?? String(v);
const fmtOrigem = (v: unknown) => ORIGENS.find((o) => o.value === v)?.label ?? String(v);
const fmtFormaPag = (v: unknown) =>
  v ? FORMA_PAGAMENTO_LABEL[v as keyof typeof FORMA_PAGAMENTO_LABEL] ?? String(v) : "—";
const fmtFuncao = (v: unknown) =>
  FUNCOES_SQUAD.find((f) => f.value === v)?.label ?? String(v);
const fmtSegmento = (v: unknown) =>
  v ? SEGMENTO_LABEL[v as Segmento] ?? String(v) : "—";
const fmtRegiao = (v: unknown) =>
  v ? REGIAO_ATUACAO_LABEL[v as RegiaoAtuacao] ?? String(v) : "—";
const fmtMetodo = (v: unknown) =>
  METODOS_PAGAMENTO.find((m) => m.value === v)?.label ?? String(v);
const fmtModelos = (v: unknown) => {
  if (!Array.isArray(v)) return "—";
  return v
    .map((m) => MODELOS_VENDAS.find((mv) => mv.value === m)?.label ?? m)
    .join(", ");
};
const fmtMoeda = (v: unknown) =>
  typeof v === "number" ? formatCurrency(v) : String(v ?? "—");
const fmtData = (v: unknown) =>
  typeof v === "string" ? formatDate(v) : String(v ?? "—");

const CAMPOS_CLIENTE: CampoDef[] = [
  { key: "sigla", label: "Sigla" },
  { key: "nome_fantasia", label: "Nome fantasia" },
  { key: "razao_social", label: "Razão social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "segmento", label: "Segmento", format: fmtSegmento },
  { key: "segmento_outro", label: "Segmento (descrição)" },
  { key: "nicho", label: "Nicho" },
  { key: "regiao_atuacao", label: "Região", format: fmtRegiao },
  { key: "tier", label: "Tier", format: fmtTier },
  { key: "endereco", label: "Endereço" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "status", label: "Status", format: fmtStatusCli },
  { key: "motivo_churn", label: "Motivo do churn", format: fmtMotivo },
  { key: "observacoes", label: "Observações" },
  { key: "modelo_vendas", label: "Modelo de vendas", isArray: true, format: fmtModelos },
  { key: "contatos", label: "Contatos", isArray: true, isCount: true },
  { key: "conexoes", label: "Conexões", isArray: true, isCount: true },
];

function camposProjeto(fases: Fase[]): CampoDef[] {
  return [
    { key: "codigo", label: "Código" },
    { key: "cliente_id", label: "Cliente" },
    { key: "produto_id", label: "Produto" },
    { key: "variacao_id", label: "Variação" },
    { key: "nome", label: "Nome" },
    { key: "modelo_cobranca", label: "Modelo de cobrança" },
    { key: "valor_total", label: "Valor", format: fmtMoeda },
    { key: "valor_tcv", label: "TCV", format: fmtMoeda },
    { key: "forma_pagamento", label: "Forma de pagamento", format: fmtFormaPag },
    { key: "num_parcelas", label: "Nº de parcelas" },
    { key: "fase_atual", label: "Fase", format: makeFmtFase(fases) },
    { key: "data_assinatura", label: "Data de assinatura", format: fmtData },
    { key: "data_inicio", label: "Início da operação", format: fmtData },
    { key: "data_kickoff", label: "Data de kickoff", format: fmtData },
    { key: "data_inicio_pagamento", label: "Início do pagamento", format: fmtData },
    { key: "lt_meses", label: "LT (meses)" },
    { key: "oportunidade_crm_url", label: "Oportunidade CRM" },
    { key: "whatsapp_grupo_url", label: "Grupo WhatsApp" },
    { key: "contrato_url", label: "Contrato" },
    { key: "transcricao_venda_url", label: "Transcrição de Venda" },
    { key: "transcricao_qualificacao_url", label: "Transcrição de Qualificação" },
    { key: "transcricao_plano_voo_url", label: "Transcrição de Plano de Vôo" },
    { key: "contexto_inicial", label: "Contexto inicial (handoff)" },
    { key: "reunioes", label: "Reuniões registradas", isArray: true, isCount: true },
    { key: "status", label: "Status", format: fmtStatusProj },
    { key: "motivo_churn", label: "Motivo do churn", format: fmtMotivo },
    { key: "saude_atual", label: "Saúde", format: fmtSaude },
    { key: "origem", label: "Origem", format: fmtOrigem },
    { key: "observacoes", label: "Observações" },
    { key: "squad", label: "Squad", isArray: true, isCount: true },
    { key: "links_rapidos", label: "Links rápidos", isArray: true, isCount: true },
  ];
}

const CAMPOS_INVESTIDOR: CampoDef[] = [
  { key: "nome", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "telefone", label: "Telefone" },
  { key: "funcao_principal", label: "Função principal", format: fmtFuncao },
  { key: "status", label: "Status" },
  { key: "data_entrada", label: "Entrada", format: fmtData },
  { key: "data_saida", label: "Saída", format: fmtData },
  { key: "observacoes", label: "Observações" },
  { key: "funcoes_secundarias", label: "Funções secundárias", isArray: true, isCount: true },
];

const CAMPOS_PRODUTO: CampoDef[] = [
  { key: "nome", label: "Nome" },
  { key: "categoria", label: "Categoria", format: fmtCategoria },
  { key: "descricao", label: "Descrição" },
  { key: "modelo_cobranca_padrao", label: "Modelo de cobrança" },
  { key: "valor_sugerido", label: "Valor sugerido", format: fmtMoeda },
  { key: "ativo", label: "Ativo" },
  { key: "externo_id", label: "ID externo" },
  { key: "variacoes", label: "Variações", isArray: true, isCount: true },
];

const CAMPOS_PAGAMENTO: CampoDef[] = [
  { key: "tipo", label: "Tipo" },
  { key: "metodo", label: "Método", format: fmtMetodo as (v: unknown) => string },
  { key: "valor_total", label: "Valor total", format: fmtMoeda },
  { key: "num_parcelas", label: "Nº parcelas" },
  { key: "data_primeira_parcela", label: "1ª parcela", format: fmtData },
  { key: "periodicidade", label: "Periodicidade" },
  { key: "status_geral", label: "Status" },
  { key: "observacoes", label: "Observações" },
];

const CAMPOS_PARCELA: CampoDef[] = [
  { key: "valor", label: "Valor", format: fmtMoeda },
  { key: "data_vencimento", label: "Vencimento", format: fmtData },
  { key: "data_pagamento", label: "Pagamento", format: fmtData },
  { key: "status", label: "Status" },
  { key: "observacao", label: "Observação" },
];

export function diffCliente(antes: Cliente | undefined, depois: Cliente) {
  return gerarDiff(
    antes as unknown as AnyRecord | undefined,
    depois as unknown as AnyRecord,
    CAMPOS_CLIENTE
  );
}
export function diffProjeto(
  antes: Projeto | undefined,
  depois: Projeto,
  fases: Fase[] = []
) {
  return gerarDiff(
    antes as unknown as AnyRecord | undefined,
    depois as unknown as AnyRecord,
    camposProjeto(fases)
  );
}
export function diffInvestidor(antes: Investidor | undefined, depois: Investidor) {
  return gerarDiff(
    antes as unknown as AnyRecord | undefined,
    depois as unknown as AnyRecord,
    CAMPOS_INVESTIDOR
  );
}
export function diffProduto(antes: Produto | undefined, depois: Produto) {
  return gerarDiff(
    antes as unknown as AnyRecord | undefined,
    depois as unknown as AnyRecord,
    CAMPOS_PRODUTO
  );
}
export function diffPagamento(antes: Pagamento | undefined, depois: Pagamento) {
  return gerarDiff(
    antes as unknown as AnyRecord | undefined,
    depois as unknown as AnyRecord,
    CAMPOS_PAGAMENTO
  );
}
export function diffParcela(antes: Parcela | undefined, depois: Parcela) {
  return gerarDiff(
    antes as unknown as AnyRecord | undefined,
    depois as unknown as AnyRecord,
    CAMPOS_PARCELA
  );
}

export function resumoMudancas(mudancas: CampoMudanca[]): string {
  if (mudancas.length === 0) return "sem alterações";
  if (mudancas.length === 1) return `${mudancas[0].label} alterado(a)`;
  return `${mudancas.length} campos alterados`;
}

export function _fmtMetodo(v: MetodoPagamento) {
  return fmtMetodo(v);
}
