/**
 * As oito perguntas do FAQ.
 *
 * Vivem aqui, e não dentro do componente, porque a MESMA lista alimenta dois
 * consumidores: o accordion na tela e o `FAQPage` do JSON-LD. Duplicar o texto
 * criaria o clássico dado estruturado que discorda da página — que o Google
 * trata como má-fé, não como descuido.
 *
 * Cada resposta corresponde a comportamento real do produto. A da pergunta
 * "e se ninguém responder" descreve o retorno do `dispatch_request`, que devolve
 * quantos profissionais o pedido alcançou e avisa quando é zero.
 */
export const PERGUNTAS = [
  {
    p: "Quanto custa para mim?",
    r: "Nada para ter conta e nada para pedir orçamento. Você paga o serviço, e só. A Fixly fica com 15% do valor combinado, que sai da parte do profissional. No Pix, o preço que vocês combinaram é exatamente o que você paga. No cartão entra a tarifa da operadora, mostrada antes de você confirmar.",
  },
  {
    p: "Por que meu cadastro precisa ser aprovado? Eu só quero contratar.",
    r: "Porque o profissional que vai até a sua casa também quer saber quem está do outro lado. A conferência vale para os dois. É ela que faz bons profissionais aceitarem trabalhar aqui em vez de comprar contato de desconhecido. Nossa equipe confere e avisa por e-mail quando estiver liberado, normalmente em até 24 horas.",
  },
  {
    p: "E se o serviço ficar mal feito?",
    r: "O dinheiro fica retido na Fixly até você aprovar. Se o serviço não ficou bom, não aprove: converse pelo chat do serviço e, se não resolver, abra uma denúncia. Nossa equipe olha caso a caso antes de qualquer valor ser liberado.",
  },
  {
    p: "Como vocês conferem os profissionais?",
    r: "Uma pessoa da equipe abre e confere sete documentos antes de o profissional aparecer para você: RG ou CNH frente e verso, CPF, comprovante de residência, foto 3x4, selfie segurando o documento, certidão de antecedentes criminais e comprovante de conta bancária. Faltou um, não entra.",
  },
  {
    p: "O profissional vai saber onde eu moro?",
    r: "Só depois que você aceitar a proposta dele. Antes disso ele vê o bairro e um círculo de aproximadamente 1 km, o suficiente para calcular deslocamento e longe o bastante para não ser o seu endereço. Telefone e e-mail digitados no chat são apagados automaticamente.",
  },
  {
    p: "Preciso pagar antes do serviço?",
    r: "O pagamento é feito antes, mas o valor não vai para o profissional: fica retido. É o que dá segurança aos dois lados: você sabe que ele só recebe se entregar, e ele sabe que o dinheiro existe antes de pegar a ferramenta.",
  },
  {
    p: "E se ninguém responder meu pedido?",
    r: "A Fixly te avisa na hora se o pedido não alcançou nenhum profissional na sua região e categoria, em vez de deixar você esperando à toa. Aí dá para ajustar a categoria ou tentar de novo mais tarde.",
  },
  {
    p: "Dá para negociar o preço?",
    r: "Dá, dos dois lados. Cada profissional manda o preço dele. Achou caro, você faz uma contra-proposta com o valor que quer pagar; ele pode aceitar, recusar ou responder com outro valor. Vocês fecham quando os dois concordarem.",
  },
] as const;
