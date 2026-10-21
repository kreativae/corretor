/** Mensagens automáticas do sistema — editáveis em Configurações › Mensagens e e-mails. */

export type MessageKey =
  | "waSiteInterest"
  | "waFichaInterest"
  | "waShare"
  | "selSubjectOne"
  | "selSubjectMany"
  | "selGreeting"
  | "selMessage"
  | "selAttachNote"
  | "selBtnDetails"
  | "selBtnFicha"
  | "selWaCard"
  | "remindVisit"
  | "remindEvent"
  | "leadSubject"
  | "leadReturnSubject"
  | "leadFooter";

export type Messages = Record<MessageKey, string>;

/** Variáveis da mensagem de cada imóvel no WhatsApp */
export const WA_CARD_VARS = ["titulo", "tipo", "codigo", "regiao", "dimensao", "valor", "finalidade", "link", "ficha"];

export const MESSAGE_DEFAULTS: Messages = {
  waSiteInterest: "Olá! Tenho interesse no imóvel {codigo} — {titulo} ({preco}). Podemos conversar?",
  waFichaInterest: "Olá! Tenho interesse no imóvel {codigo} — {titulo}.",
  waShare: "Confira este imóvel: {titulo} ({codigo}) — {preco}",
  selSubjectOne: "{titulo} — {codigo}",
  selSubjectMany: "{quantidade} imóveis selecionados para você, {primeiro_nome}",
  selGreeting: "Olá, {primeiro_nome}!",
  selMessage:
    "Separei algumas opções que combinam com o que você procura. Dê uma olhada e me diga quais gostaria de visitar — fico à disposição para tirar qualquer dúvida.",
  selAttachNote: "📎 As fichas completas em PDF seguem anexas a este e-mail.",
  selBtnDetails: "Ver fotos e detalhes",
  selBtnFicha: "Ficha completa",
  selWaCard:
    "*{titulo}*\n_{tipo} · {codigo}_\n\n*Região* - {regiao}\n*Dimensão* - {dimensao}\n*Valor* - {valor}\n\nVer fotos e detalhes: {link}\nFicha completa: {ficha}",
  remindVisit:
    "Olá, {primeiro_nome}! Passando para lembrar da sua visita:\n\n*{imovel}* ({codigo})\n*Quando* - {data} às {hora}\n*Onde* - {endereco}\n\nQualquer imprevisto, é só responder aqui.",
  remindEvent:
    "Olá, {primeiro_nome}! Passando para lembrar:\n\n*{titulo}*\n*Quando* - {data} às {hora}\n*Onde* - {local}\n*Link da reunião* - {meet}\n\nQualquer imprevisto, é só responder aqui.",
  leadSubject: "Novo lead: {nome} · {interesse}",
  leadReturnSubject: "Lead retornou: {nome} · {interesse}",
  leadFooter: "Aviso automático do CRM — altere os destinatários em Admin → Configurações.",
};

/** Onde cada mensagem aparece (tela de Configurações) */
export const MESSAGE_GROUPS: {
  title: string;
  desc: string;
  items: { key: MessageKey; label: string; where: string; vars: string[]; multiline?: boolean }[];
}[] = [
  {
    title: "WhatsApp",
    desc: "Texto que já vem escrito quando alguém toca no botão do WhatsApp.",
    items: [
      { key: "waSiteInterest", label: "Interesse no anúncio (site)", where: "Botões de WhatsApp da página do imóvel", vars: ["codigo", "titulo", "preco"] },
      { key: "waFichaInterest", label: "Interesse pela ficha", where: "Ficha PDF e página de contato do QR code", vars: ["codigo", "titulo", "preco"] },
      { key: "waShare", label: "Compartilhar imóvel (CRM)", where: "Botão WhatsApp na página do imóvel no CRM", vars: ["codigo", "titulo", "preco"] },
    ],
  },
  {
    title: "E-mail ao cliente (Negociação)",
    desc: "Seleção de imóveis enviada pela página Negociação.",
    items: [
      { key: "selSubjectOne", label: "Assunto — 1 imóvel", where: "Assunto sugerido com um imóvel", vars: ["codigo", "titulo", "nome", "primeiro_nome"] },
      { key: "selSubjectMany", label: "Assunto — vários imóveis", where: "Assunto sugerido com 2 ou mais", vars: ["quantidade", "nome", "primeiro_nome"] },
      { key: "selGreeting", label: "Saudação", where: "Primeira linha do e-mail", vars: ["nome", "primeiro_nome"] },
      { key: "selMessage", label: "Mensagem padrão", where: "Texto sugerido (dá para mudar a cada envio)", vars: ["nome", "primeiro_nome", "corretor"], multiline: true },
      { key: "selAttachNote", label: "Aviso dos anexos", where: "Quando as fichas em PDF vão anexas", vars: [] },
      { key: "selBtnDetails", label: "Botão do site", where: "Botão laranja de cada imóvel", vars: [] },
      { key: "selBtnFicha", label: "Botão da ficha", where: "Botão azul de cada imóvel", vars: [] },
    ],
  },
  {
    title: "WhatsApp ao cliente (Negociação)",
    desc: "Mensagem de cada imóvel enviada pelo WhatsApp (Negociação e smart match). Linha com variável vazia some.",
    items: [
      {
        key: "selWaCard",
        label: "Mensagem de cada imóvel",
        where: "Legenda da foto de cada imóvel. *texto* = negrito, _texto_ = itálico",
        vars: WA_CARD_VARS,
        multiline: true,
      },
    ],
  },
  {
    title: "Lembretes da agenda (WhatsApp)",
    desc: "Enviados ao cliente antes da visita, reunião ou evento (antecedência em Configurações › Lembretes da agenda). Linha com variável vazia some.",
    items: [
      {
        key: "remindVisit",
        label: "Lembrete de visita",
        where: "Visitas agendadas ou confirmadas",
        vars: ["nome", "primeiro_nome", "data", "hora", "imovel", "codigo", "endereco"],
        multiline: true,
      },
      {
        key: "remindEvent",
        label: "Lembrete de reunião ou evento",
        where: "Reuniões e eventos com cliente vinculado",
        vars: ["nome", "primeiro_nome", "data", "hora", "titulo", "tipo", "local", "meet"],
        multiline: true,
      },
    ],
  },
  {
    title: "Aviso de novo lead (interno)",
    desc: "E-mail que a equipe recebe a cada novo contato.",
    items: [
      { key: "leadSubject", label: "Assunto — novo lead", where: "Primeiro contato", vars: ["nome", "interesse", "origem"] },
      { key: "leadReturnSubject", label: "Assunto — lead retornou", where: "Contato que já estava na base", vars: ["nome", "interesse", "origem"] },
      { key: "leadFooter", label: "Rodapé", where: "Linha final do aviso", vars: [] },
    ],
  },
];

/**
 * Mensagem de um imóvel no WhatsApp a partir do modelo: linha cujas variáveis ficaram
 * todas vazias some (ex.: sem medidas, some a linha "Dimensão").
 */
export function waCardText(template: string, vars: Record<string, string | null | undefined>) {
  const lines = template.replace(/\r/g, "").split("\n").filter((line) => {
    const used = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return !used.length || used.some((k) => (vars[k] ?? "").toString().trim());
  });
  return lines
    .join("\n")
    .replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] ?? "").toString())
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Completa os valores salvos com os padrões (campo vazio = padrão). */
export function mergeMessages(saved: unknown): Messages {
  const v = (saved ?? {}) as Partial<Record<MessageKey, unknown>>;
  const out = { ...MESSAGE_DEFAULTS };
  for (const k of Object.keys(MESSAGE_DEFAULTS) as MessageKey[]) {
    const s = v[k];
    if (typeof s === "string" && s.trim()) out[k] = s.slice(0, 3000);
  }
  return out;
}

/** "{nome} · {interesse}" → texto final; variável vazia leva junto o separador que sobrar. */
export function fillMessage(template: string, vars: Record<string, string | number | null | undefined>) {
  return template
    .replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] == null ? "" : String(vars[k])))
    .replace(/\s*[·—|,-]\s*(?=$|\n)/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
