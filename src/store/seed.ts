import {
  Cliente,
  Fase,
  FASES_DEFAULT,
  Investidor,
  Pagamento,
  Produto,
  Projeto,
  Usuario,
} from "@/types";
import { uid } from "@/lib/utils";

function hashSenha(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return "h_" + Math.abs(h).toString(36);
}

// Helpers de data relativa a hoje, para o seed sempre ficar dentro da
// janela de "últimos 12 meses" do gráfico de evolução.
function dataRelativa(mesesOffset: number, dia = 1): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(dia);
  d.setMonth(d.getMonth() + mesesOffset);
  return d.toISOString().slice(0, 10);
}

export function seedInicial() {
  const adminId = uid("usr_");
  const usuarios: Usuario[] = [
    {
      id: adminId,
      nome: "Gina (V4)",
      email: "gina@v4company.com",
      senha_hash: hashSenha("v4admin"),
      perfil: "admin",
      status: "ativo",
      criado_em: new Date().toISOString(),
    },
  ];

  const inv1Id = uid("inv_");
  const inv2Id = uid("inv_");
  const inv3Id = uid("inv_");

  const investidores: Investidor[] = [
    {
      id: inv1Id,
      nome: "Lucas Almeida",
      email: "lucas@v4company.com",
      funcao_principal: "gerente",
      funcoes_secundarias: ["coordenador"],
      status: "ativo",
      data_entrada: dataRelativa(-18, 1),
    },
    {
      id: inv2Id,
      nome: "Mariana Souza",
      email: "mariana@v4company.com",
      funcao_principal: "gestor_trafego",
      funcoes_secundarias: ["analista"],
      status: "ativo",
      data_entrada: dataRelativa(-12, 10),
    },
    {
      id: inv3Id,
      nome: "Pedro Henrique",
      email: "pedro@v4company.com",
      funcao_principal: "designer",
      funcoes_secundarias: ["copywriter"],
      status: "ativo",
      data_entrada: dataRelativa(-6, 15),
    },
  ];

  // ---------- Catálogo de produtos (variações inclusas) ----------
  const prodTrafegoId = uid("prd_");
  const prodAssessoriaId = uid("prd_");
  const prodConsultoriaCRMId = uid("prd_");
  const prodDiagnosticoMaturidadeId = uid("prd_");
  const prodSetupAdsId = uid("prd_");
  const prodAssessoriaIA = uid("prd_");

  const varTrafegoComp10 = uid("vrn_");
  const varTrafegoComp25 = uid("vrn_");
  const varTrafegoComp50 = uid("vrn_");
  const varTrafegoDedicado = uid("vrn_");

  const varAssessoriaBasica = uid("vrn_");
  const varAssessoriaPlus = uid("vrn_");
  const varAssessoriaPremium = uid("vrn_");

  const produtos: Produto[] = [
    {
      id: prodTrafegoId,
      nome: "Profissional de Mídia Paga",
      categoria: "EXECUTAR",
      descricao: "Operação contínua de mídia paga (Meta + Google Ads).",
      modelo_cobranca_padrao: "recorrente",
      valor_sugerido: 8500,
      ativo: true,
      variacoes: [
        { id: varTrafegoComp10, nome: "Compartilhado 10%", percentual: 10, valor_sugerido: 2500, ativo: true },
        { id: varTrafegoComp25, nome: "Compartilhado 25%", percentual: 25, valor_sugerido: 5500, ativo: true },
        { id: varTrafegoComp50, nome: "Compartilhado 50%", percentual: 50, valor_sugerido: 9500, ativo: true },
        { id: varTrafegoDedicado, nome: "Dedicado 100%", percentual: 100, valor_sugerido: 18000, ativo: true },
      ],
    },
    {
      id: prodAssessoriaId,
      nome: "Assessoria de Marketing",
      categoria: "POTENCIALIZAR",
      descricao: "Acompanhamento estratégico mensal com cadência semanal.",
      modelo_cobranca_padrao: "recorrente",
      valor_sugerido: 6800,
      ativo: true,
      variacoes: [
        { id: varAssessoriaBasica, nome: "Básica (bimestral)", valor_sugerido: 3800, ativo: true },
        { id: varAssessoriaPlus, nome: "Plus (quinzenal)", valor_sugerido: 6800, ativo: true },
        { id: varAssessoriaPremium, nome: "Premium (semanal)", valor_sugerido: 12500, ativo: true },
      ],
    },
    {
      id: prodConsultoriaCRMId,
      nome: "Consultoria CRM",
      categoria: "SABER",
      descricao: "Diagnóstico e plano de implementação de CRM + pós-venda.",
      modelo_cobranca_padrao: "one_time",
      valor_sugerido: 12000,
      ativo: true,
      variacoes: [],
    },
    {
      id: prodDiagnosticoMaturidadeId,
      nome: "Diagnóstico de Maturidade Digital",
      categoria: "SABER",
      descricao: "Avaliação 360 da maturidade digital do cliente.",
      modelo_cobranca_padrao: "one_time",
      valor_sugerido: 4500,
      ativo: true,
      variacoes: [],
    },
    {
      id: prodSetupAdsId,
      nome: "Setup de Mídia",
      categoria: "TER",
      descricao: "Estruturação inicial de contas de Meta Ads e Google Ads.",
      modelo_cobranca_padrao: "one_time",
      valor_sugerido: 3500,
      ativo: true,
      variacoes: [],
    },
    {
      id: prodAssessoriaIA,
      nome: "Estruturação IA",
      categoria: "TER",
      descricao: "Implementação de SDR IA, CRM e automações.",
      modelo_cobranca_padrao: "one_time",
      valor_sugerido: 15000,
      ativo: true,
      variacoes: [],
    },
  ];

  // ---------- Clientes ----------
  // Cinco clientes distribuídos ao longo dos últimos 10 meses, para o gráfico
  // de evolução de aquisição mostrar movimento real.
  const cli1Id = uid("cli_");
  const cli2Id = uid("cli_");
  const cli3Id = uid("cli_");
  const cli4Id = uid("cli_");
  const cli5Id = uid("cli_");
  const cli6Id = uid("cli_");

  const clientes: Cliente[] = [
    {
      id: cli1Id,
      sigla: "CRJM",
      razao_social: "Cereja Moda Íntima LTDA",
      nome_fantasia: "Cereja Moda Íntima",
      cnpj: "12.345.678/0001-90",
      segmento: "varejo_fisico",
      nicho: "Moda íntima",
      regiao_atuacao: "nacional",
      modelo_vendas: ["ecommerce", "pdv"],
      tier: "medium",
      endereco: "Rua das Cerejeiras, 100 — São Paulo/SP",
      contatos: [{ id: uid("ct_"), nome: "Ana Cereja", cargo: "CEO", email: "ana@cerejamoda.com" }],
      conexoes: [],
      status: "ativo",
      data_cadastro: dataRelativa(-10, 15),
    },
    {
      id: cli2Id,
      sigla: "BYLN",
      razao_social: "Byline Comunicação ME",
      nome_fantasia: "Byline",
      cnpj: "98.765.432/0001-21",
      segmento: "servicos_b2b",
      nicho: "Comunicação corporativa",
      regiao_atuacao: "regional",
      modelo_vendas: ["inside_sales"],
      tier: "small",
      contatos: [{ id: uid("ct_"), nome: "Carlos Mendes", cargo: "Diretor", email: "carlos@byline.com.br" }],
      conexoes: [],
      status: "ativo",
      data_cadastro: dataRelativa(-7, 2),
    },
    {
      id: cli3Id,
      sigla: "FITV",
      razao_social: "FitVitta Estúdio LTDA",
      nome_fantasia: "FitVitta",
      cnpj: "55.111.222/0001-33",
      segmento: "beleza_estetica",
      nicho: "Estúdios de pilates",
      regiao_atuacao: "estadual",
      modelo_vendas: ["pdv"],
      tier: "small",
      contatos: [{ id: uid("ct_"), nome: "Marina Vitta", cargo: "Sócia", email: "marina@fitvitta.com" }],
      conexoes: [],
      status: "ativo",
      data_cadastro: dataRelativa(-5, 8),
    },
    {
      id: cli4Id,
      sigla: "EDUC",
      razao_social: "EduCasa Ensino LTDA",
      nome_fantasia: "EduCasa",
      cnpj: "44.222.333/0001-44",
      segmento: "educacao",
      nicho: "Cursos preparatórios online",
      regiao_atuacao: "nacional",
      modelo_vendas: ["inside_sales", "ecommerce"],
      tier: "large",
      contatos: [{ id: uid("ct_"), nome: "Roberto Lima", cargo: "Head de Marketing", email: "roberto@educasa.com" }],
      conexoes: [],
      status: "ativo",
      data_cadastro: dataRelativa(-3, 20),
    },
    {
      id: cli5Id,
      sigla: "MEDX",
      razao_social: "MedExpress Clínicas SA",
      nome_fantasia: "MedExpress",
      cnpj: "33.444.555/0001-66",
      segmento: "saude",
      nicho: "Clínicas multi-especialidade",
      regiao_atuacao: "regional",
      modelo_vendas: ["pdv"],
      tier: "enterprise",
      contatos: [{ id: uid("ct_"), nome: "Patricia Soares", cargo: "Diretora Comercial" }],
      conexoes: [],
      status: "ativo",
      data_cadastro: dataRelativa(-1, 5),
    },
    {
      id: cli6Id,
      sigla: "PASTL",
      razao_social: "Pastéis do Zé LTDA",
      nome_fantasia: "Pastéis do Zé",
      cnpj: "11.222.333/0001-77",
      segmento: "alimentacao",
      nicho: "Restaurantes fast-food",
      regiao_atuacao: "local",
      modelo_vendas: ["pdv"],
      tier: "tiny",
      contatos: [{ id: uid("ct_"), nome: "José Ramirez", cargo: "Proprietário" }],
      conexoes: [],
      status: "churn",
      data_cadastro: dataRelativa(-8, 10),
      data_churn: dataRelativa(-2, 18),
      motivo_churn: "restricao_orcamentaria",
    },
  ];

  // ---------- Projetos ----------
  const proj1Id = uid("prj_");
  const proj2Id = uid("prj_");
  const proj3Id = uid("prj_");
  const proj4Id = uid("prj_");
  const proj5Id = uid("prj_");
  const proj6Id = uid("prj_");
  const proj7Id = uid("prj_");

  const projetos: Projeto[] = [
    {
      id: proj1Id,
      codigo: "CRJM-01",
      cliente_id: cli1Id,
      produto_id: prodTrafegoId,
      variacao_id: varTrafegoComp50,
      nome: "Mídia Paga Performance",
      modelo_cobranca: "recorrente",
      valor_total: 9500,
      fase_atual: "execucao",
      data_assinatura: dataRelativa(-10, 15),
      data_inicio: dataRelativa(-9, 1),
      data_kickoff: dataRelativa(-9, 5),
      oportunidade_crm_url: "https://crm.exemplo.com/oportunidades/CRJM-01",
      whatsapp_grupo_url: "https://chat.whatsapp.com/exemplo-crjm",
      contrato_url: "https://drive.google.com/file/d/exemplo-crjm-contrato",
      transcricao_venda_url: "https://meet.exemplo.com/transcricao/venda-crjm",
      transcricao_qualificacao_url: "https://meet.exemplo.com/transcricao/qualif-crjm",
      transcricao_plano_voo_url: "https://meet.exemplo.com/transcricao/planovoo-crjm",
      lt_meses: 12,
      status: "ativo",
      saude_atual: "saudavel",
      links_rapidos: [],
      origem: "aquisicao",
      squad: [
        { id: uid("sqm_"), investidor_id: inv1Id, funcao: "gerente", data_entrada: dataRelativa(-9, 1), principal: true },
        { id: uid("sqm_"), investidor_id: inv2Id, funcao: "gestor_trafego", data_entrada: dataRelativa(-9, 1), principal: false },
      ],
    },
    {
      id: proj2Id,
      codigo: "CRJM-02",
      cliente_id: cli1Id,
      produto_id: prodConsultoriaCRMId,
      nome: "Consultoria CRM e Pós-venda",
      modelo_cobranca: "one_time",
      valor_total: 12000,
      fase_atual: "diagnostico",
      data_assinatura: dataRelativa(-3, 5),
      data_inicio: dataRelativa(-2, 10),
      lt_meses: 2,
      status: "ativo",
      saude_atual: "alerta",
      links_rapidos: [],
      origem: "upsell",
      squad: [
        { id: uid("sqm_"), investidor_id: inv1Id, funcao: "coordenador", data_entrada: dataRelativa(-2, 10), principal: true },
      ],
    },
    {
      id: proj3Id,
      codigo: "BYLN-01",
      cliente_id: cli2Id,
      produto_id: prodAssessoriaId,
      variacao_id: varAssessoriaPlus,
      nome: "Assessoria Byline",
      modelo_cobranca: "recorrente",
      valor_total: 6800,
      fase_atual: "kickoff",
      data_assinatura: dataRelativa(-7, 2),
      data_inicio: dataRelativa(-6, 1),
      lt_meses: 6,
      status: "ativo",
      saude_atual: "saudavel",
      links_rapidos: [],
      origem: "aquisicao",
      squad: [
        { id: uid("sqm_"), investidor_id: inv3Id, funcao: "designer", data_entrada: dataRelativa(-6, 1), principal: true },
      ],
    },
    {
      id: proj4Id,
      codigo: "FITV-01",
      cliente_id: cli3Id,
      produto_id: prodTrafegoId,
      variacao_id: varTrafegoComp25,
      nome: "Tráfego Pago FitVitta",
      modelo_cobranca: "recorrente",
      valor_total: 5500,
      fase_atual: "execucao",
      data_assinatura: dataRelativa(-5, 8),
      data_inicio: dataRelativa(-4, 12),
      lt_meses: 12,
      status: "ativo",
      saude_atual: "saudavel",
      links_rapidos: [],
      origem: "aquisicao",
      squad: [
        { id: uid("sqm_"), investidor_id: inv2Id, funcao: "gestor_trafego", data_entrada: dataRelativa(-4, 12), principal: true },
      ],
    },
    {
      id: proj5Id,
      codigo: "EDUC-01",
      cliente_id: cli4Id,
      produto_id: prodTrafegoId,
      variacao_id: varTrafegoDedicado,
      nome: "Performance EduCasa",
      modelo_cobranca: "recorrente",
      valor_total: 18000,
      fase_atual: "execucao",
      data_assinatura: dataRelativa(-3, 20),
      data_inicio: dataRelativa(-2, 20),
      lt_meses: 12,
      status: "ativo",
      saude_atual: "cuidado",
      links_rapidos: [],
      origem: "aquisicao",
      squad: [
        { id: uid("sqm_"), investidor_id: inv1Id, funcao: "gerente", data_entrada: dataRelativa(-2, 20), principal: true },
        { id: uid("sqm_"), investidor_id: inv2Id, funcao: "gestor_trafego", data_entrada: dataRelativa(-2, 20), principal: false },
      ],
    },
    {
      id: proj6Id,
      codigo: "MEDX-01",
      cliente_id: cli5Id,
      produto_id: prodAssessoriaIA,
      nome: "Estruturação IA MedExpress",
      modelo_cobranca: "one_time",
      valor_total: 15000,
      fase_atual: "kickoff",
      data_assinatura: dataRelativa(-1, 5),
      data_inicio: dataRelativa(-1, 5),
      lt_meses: 3,
      status: "ativo",
      saude_atual: "saudavel",
      links_rapidos: [],
      origem: "aquisicao",
      squad: [
        { id: uid("sqm_"), investidor_id: inv1Id, funcao: "gerente", data_entrada: dataRelativa(-1, 5), principal: true },
      ],
    },
    {
      id: proj7Id,
      codigo: "PASTL-01",
      cliente_id: cli6Id,
      produto_id: prodTrafegoId,
      variacao_id: varTrafegoComp10,
      nome: "Tráfego Pago Pastéis",
      modelo_cobranca: "recorrente",
      valor_total: 2500,
      fase_atual: "concluido",
      data_assinatura: dataRelativa(-8, 10),
      data_inicio: dataRelativa(-7, 1),
      lt_meses: 12,
      status: "churn",
      motivo_churn: "restricao_orcamentaria",
      saude_atual: "critico",
      links_rapidos: [],
      origem: "aquisicao",
      squad: [
        { id: uid("sqm_"), investidor_id: inv2Id, funcao: "gestor_trafego", data_entrada: dataRelativa(-7, 1), principal: true },
      ],
    },
  ];

  // ---------- Pagamentos / parcelas ----------
  // Gera parcelas mensais a partir do offset inicial (em meses relativos a hoje).
  function gerarParcelasMensais(
    pagamentoId: string,
    qtd: number,
    valor: number,
    offsetInicialMeses: number,
    diaVencimento: number
  ) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Array.from({ length: qtd }).map((_, i) => {
      const venc = new Date();
      venc.setHours(0, 0, 0, 0);
      venc.setDate(diaVencimento);
      venc.setMonth(venc.getMonth() + offsetInicialMeses + i);
      const ja_venceu = venc < hoje;
      const ja_passou_no_mes_atual =
        venc.getFullYear() === hoje.getFullYear() &&
        venc.getMonth() === hoje.getMonth() &&
        venc.getDate() <= hoje.getDate();
      const paga = ja_venceu || ja_passou_no_mes_atual;
      return {
        id: uid("par_"),
        pagamento_id: pagamentoId,
        numero: i + 1,
        valor,
        data_vencimento: venc.toISOString().slice(0, 10),
        data_pagamento: paga ? venc.toISOString().slice(0, 10) : undefined,
        status: paga ? ("pago" as const) : ("previsto" as const),
      };
    });
  }

  const pag1Id = uid("pag_");
  const pag2Id = uid("pag_");
  const pag3Id = uid("pag_");
  const pag4Id = uid("pag_");
  const pag5Id = uid("pag_");
  const pag6Id = uid("pag_");

  const pagamentos: Pagamento[] = [
    {
      id: pag1Id,
      projeto_id: proj1Id,
      tipo: "recorrente",
      metodo: "pix",
      valor_total: 9500,
      num_parcelas: 12,
      data_primeira_parcela: dataRelativa(-9, 5),
      periodicidade: "mensal",
      status_geral: "ativo",
      parcelas: gerarParcelasMensais(pag1Id, 12, 9500, -9, 5),
    },
    {
      id: pag2Id,
      projeto_id: proj2Id,
      tipo: "parcelado",
      metodo: "boleto",
      valor_total: 12000,
      num_parcelas: 3,
      data_primeira_parcela: dataRelativa(-2, 15),
      periodicidade: "mensal",
      status_geral: "ativo",
      parcelas: gerarParcelasMensais(pag2Id, 3, 4000, -2, 15),
    },
    {
      id: pag3Id,
      projeto_id: proj3Id,
      tipo: "recorrente",
      metodo: "pix",
      valor_total: 6800,
      num_parcelas: 6,
      data_primeira_parcela: dataRelativa(-6, 10),
      periodicidade: "mensal",
      status_geral: "ativo",
      parcelas: gerarParcelasMensais(pag3Id, 6, 6800, -6, 10),
    },
    {
      id: pag4Id,
      projeto_id: proj4Id,
      tipo: "recorrente",
      metodo: "pix",
      valor_total: 5500,
      num_parcelas: 12,
      data_primeira_parcela: dataRelativa(-4, 12),
      periodicidade: "mensal",
      status_geral: "ativo",
      parcelas: gerarParcelasMensais(pag4Id, 12, 5500, -4, 12),
    },
    {
      id: pag5Id,
      projeto_id: proj5Id,
      tipo: "recorrente",
      metodo: "transferencia",
      valor_total: 18000,
      num_parcelas: 12,
      data_primeira_parcela: dataRelativa(-2, 20),
      periodicidade: "mensal",
      status_geral: "ativo",
      parcelas: gerarParcelasMensais(pag5Id, 12, 18000, -2, 20),
    },
    {
      id: pag6Id,
      projeto_id: proj6Id,
      tipo: "entrada",
      metodo: "pix",
      valor_total: 15000,
      num_parcelas: 1,
      data_primeira_parcela: dataRelativa(-1, 10),
      periodicidade: "unica",
      status_geral: "ativo",
      parcelas: gerarParcelasMensais(pag6Id, 1, 15000, -1, 10),
    },
  ];

  const fases: Fase[] = FASES_DEFAULT.map((f) => ({ ...f }));

  return {
    usuarios,
    investidores,
    produtos,
    clientes,
    projetos,
    pagamentos,
    fases,
  };
}
