import type { Role } from "./brand";

export const TERMS_VERSION = "1.1";

/**
 * Encarregado pelo Tratamento de Dados (DPO) — exigência do art. 41 da LGPD.
 * ⚠️ Os dados abaixo aparecem nos Termos e na Política: confirmar com o dono
 * antes de publicar mudança (nome e e-mail precisam existir de verdade).
 */
export const DPO = {
  nome: "Encarregado de Dados do Fixly",
  email: "privacidade@fixly.company",
  canal: "Perfil → Suporte, na plataforma",
};

type Section = { h: string; p: string };
type Terms = { title: string; sections: Section[] };

const COMMON_LGPD: Section = {
  h: "Proteção de dados (LGPD)",
  p: "O Fixly coleta e trata dados pessoais e documentos exclusivamente para verificação de identidade, prevenção a fraudes, prestação do serviço e cumprimento de obrigações legais, nos termos da Lei nº 13.709/2018 (LGPD). Os documentos enviados ficam armazenados de forma privada e criptografada, acessíveis apenas à equipe de análise. O usuário pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento, ressalvadas as hipóteses de guarda obrigatória.",
};

/**
 * Encarregado de dados (LGPD art. 41). Fica junto da cláusula de LGPD nos dois
 * papéis — o titular precisa saber a quem recorrer sem procurar.
 */
const COMMON_DPO: Section = {
  h: "Encarregado pelo Tratamento de Dados (DPO)",
  p: `Para exercer seus direitos, esclarecer dúvidas ou apresentar reclamações relativas a dados pessoais, o titular pode contatar o Encarregado do Fixly: ${DPO.nome} — ${DPO.email} — canal na plataforma: ${DPO.canal}. O titular também pode apresentar reclamação diretamente à Autoridade Nacional de Proteção de Dados (ANPD).`,
};

/**
 * Isenção de garantias. É o ponto que o dono fez questão de deixar escrito: o
 * Fixly aproxima as partes e protege o pagamento — quem responde pela execução,
 * pelos danos e pelos acidentes é o profissional.
 */
const COMMON_ISENCAO: Section = {
  h: "Natureza da plataforma e limites de garantia",
  p: "O Fixly é um FACILITADOR entre contratante e profissional autônomo: não executa serviços, não é parte no contrato firmado entre as partes e não atua como empregador, seguradora ou fiadora. O Fixly NÃO garante e não se responsabiliza por: furto, roubo ou extravio de bens; danos materiais ao imóvel, a móveis, equipamentos ou a terceiros; vícios, defeitos ou refazimento do serviço; nem por lesões, acidentes ou doenças ocupacionais ocorridos durante a execução. Essas responsabilidades são integralmente do profissional que executa o serviço, que declara possuir capacitação, equipamentos de proteção e, quando aplicável, seguro próprio. O papel do Fixly limita-se a aproximar as partes, reter o pagamento até a aprovação do contratante, manter o registro da negociação e mediar conflitos administrativamente, sem assumir obrigação de indenizar.",
};

const COMMON_JURIS: Section = {
  h: "Foro e legislação aplicável",
  p: "Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de domicílio do usuário para dirimir quaisquer controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.",
};

export const TERMS: Record<Exclude<Role, "admin">, Terms> = {
  prestador: {
    title: "Termos de Uso — Prestador de Serviços",
    sections: [
      {
        h: "1. Objeto e natureza da relação",
        p: "O Fixly é uma plataforma tecnológica de intermediação que conecta prestadores de serviços autônomos a contratantes. Ao aceitar estes Termos, o prestador declara atuar de forma independente e autônoma, NÃO existindo qualquer vínculo empregatício, societário ou de subordinação com o Fixly. O prestador é o único responsável pela execução técnica e pela qualidade dos serviços que oferecer.",
      },
      {
        h: "2. Cadastro e veracidade das informações",
        p: "O prestador compromete-se a fornecer informações verdadeiras, completas e atualizadas, bem como documentos autênticos (identidade, comprovante de residência, foto, dados bancários e, quando aplicável, certificados e antecedentes). A constatação de falsidade documental acarreta o cancelamento imediato do cadastro e poderá ser comunicada às autoridades competentes.",
      },
      {
        h: "3. Análise e aprovação",
        p: "O cadastro passa por análise da equipe do Fixly, que poderá aprová-lo, reprová-lo ou solicitar informações adicionais, a seu exclusivo critério, visando à segurança da comunidade. A aprovação não constitui garantia de demanda ou de rendimentos.",
      },
      {
        h: "4. Preços, comissão e tarifas",
        p: "O prestador define o valor dos seus serviços. Sobre cada serviço concluído incidem: (a) a comissão do Fixly, correspondente a 15% (quinze por cento) do valor do serviço; e (b) as tarifas do meio de pagamento (gateway), repassadas conforme a modalidade escolhida pelo contratante. O valor líquido a receber é apresentado de forma transparente ao prestador em cada serviço, com o detalhamento de cada desconto até o valor final.",
      },
      {
        h: "5. Pagamento protegido (escrow) e repasse",
        p: "O valor pago pelo contratante fica retido pelo Fixly até a confirmação da conclusão do serviço. Após a aprovação do contratante, o valor líquido (já descontadas comissão e tarifas) é liberado para repasse ao prestador, na conta bancária ou chave PIX informada no cadastro, nos prazos operacionais do meio de pagamento.",
      },
      {
        h: "6. Obrigações e conduta",
        p: "O prestador compromete-se a: comparecer nos horários combinados; executar os serviços com zelo, segurança e boa técnica; tratar contratantes com respeito; manter sigilo sobre informações do contratante; e responsabilizar-se por eventuais danos causados por dolo ou culpa. É vedado combinar pagamentos por fora da plataforma, sob pena de suspensão.",
      },
      {
        h: "7. Responsabilidade tributária",
        p: "O prestador é integralmente responsável pelo recolhimento de tributos e contribuições incidentes sobre a sua atividade, na condição de trabalhador autônomo.",
      },
      {
        h: "8. Avaliações e suspensão",
        p: "A qualidade é aferida por avaliações dos contratantes. Avaliações reiteradamente baixas, denúncias ou descumprimento destes Termos podem levar à suspensão temporária ou ao encerramento definitivo do cadastro, a critério do Fixly.",
      },
      {
        h: "9. Selo Fixly — concessão e perda",
        p: "O Selo Fixly é um reconhecimento de qualidade concedido automaticamente ao profissional que mantém avaliação média de 4,5 estrelas ou mais, com histórico de serviços concluídos. Ele NÃO é permanente: cai sozinho quando a média deixa de atender ao critério, e o profissional é avisado nos dois sentidos (ao ganhar e ao perder).",
      },
      {
        h: "9.1. Revogação imediata do Selo",
        p: "Enseja revogação imediata do Selo, sem prazo prévio de regularização: fraude, tentativa de fraude ou falsidade documental confirmada; manipulação comprovada de avaliações; dano grave causado a cliente ou a terceiro, com apuração concluída; conduta de assédio, ameaça, violência ou discriminação; e solicitação reiterada de pagamento fora da plataforma. A revogação é comunicada ao profissional com indicação da motivação e das evidências consideradas, resguardados dados de terceiros.",
      },
      COMMON_ISENCAO,
      COMMON_LGPD,
      COMMON_DPO,
      {
        h: "10. Denúncias",
        p: "O profissional pode denunciar condutas irregulares do contratante (ameaça, assédio, discriminação, tentativa de fraude, local inseguro ou proposta de pagamento por fora) pela tela do serviço. As denúncias são analisadas pela equipe do Fixly e podem levar à suspensão do contratante.",
      },
      {
        h: "11. Encerramento",
        p: "Qualquer das partes pode encerrar a relação a qualquer tempo. Valores de serviços já concluídos e pendentes de repasse serão honrados conforme estes Termos.",
      },
      COMMON_JURIS,
    ],
  },
  contratante: {
    title: "Termos de Uso — Contratante",
    sections: [
      {
        h: "1. Objeto",
        p: "O Fixly é uma plataforma que permite ao contratante solicitar serviços a prestadores autônomos, com preço estimado, pagamento protegido e acompanhamento. O Fixly atua como intermediador tecnológico e não presta diretamente os serviços contratados.",
      },
      {
        h: "2. Cadastro",
        p: "O contratante compromete-se a fornecer dados verdadeiros e documentos válidos quando solicitados, mantendo a confidencialidade de suas credenciais de acesso e responsabilizando-se pelas ações realizadas em sua conta.",
      },
      {
        h: "3. Solicitação e preço",
        p: "Ao solicitar um serviço, o contratante recebe um preço estimado com base na categoria, urgência e distância, e pode escolher entre as propostas de prestadores disponíveis. O valor final é confirmado antes do pagamento.",
      },
      {
        h: "4. Pagamento protegido (escrow)",
        p: "O pagamento é realizado no ato da contratação e fica retido pelo Fixly até que o contratante confirme a conclusão satisfatória do serviço. Somente após essa confirmação o valor é liberado ao prestador. O contratante tem acesso ao valor final do serviço.",
      },
      {
        h: "5. Cancelamento",
        p: "O contratante pode cancelar antes do início do serviço. Cancelamentos após o deslocamento ou início do prestador poderão gerar cobrança proporcional, informada previamente, para remunerar o tempo e o deslocamento do profissional.",
      },
      {
        h: "6. Conduta",
        p: "O contratante compromete-se a tratar os prestadores com respeito, fornecer informações corretas sobre o serviço e o local, e garantir condições seguras de acesso. É vedado combinar pagamentos por fora da plataforma.",
      },
      {
        h: "7. Avaliações",
        p: "Após cada serviço, o contratante pode avaliar o prestador. As avaliações devem ser verdadeiras e de boa-fé, contribuindo para a qualidade e a segurança da comunidade.",
      },
      {
        h: "8. Limitação de responsabilidade",
        p: "O Fixly emprega esforços de verificação de prestadores, mas não é parte no contrato de prestação de serviço em si. A responsabilidade pela execução técnica é do prestador. O Fixly atua na mediação de conflitos e na proteção do pagamento.",
      },
      {
        h: "9. Denúncias",
        p: "O contratante pode denunciar condutas irregulares a qualquer momento — pela tela do serviço ou ao avaliar. São exemplos: cobrança por fora da plataforma, fraude, dano causado no atendimento, assédio, ameaça ou discriminação. As denúncias são analisadas pela equipe do Fixly e podem levar à perda do Selo, à suspensão ou ao encerramento do cadastro do profissional.",
      },
      COMMON_ISENCAO,
      COMMON_LGPD,
      COMMON_DPO,
      COMMON_JURIS,
    ],
  },
};

/** Texto simples dos termos, usado para gerar o documento aceito. */
export function termsPlainText(role: Exclude<Role, "admin">): string {
  const t = TERMS[role];
  const body = t.sections.map((s) => `${s.h}\n${s.p}`).join("\n\n");
  return `FIXLY — ${t.title}\nVersão ${TERMS_VERSION}\n\n${body}`;
}
