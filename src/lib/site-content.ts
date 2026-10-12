import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Todo o conteúdo textual do site público — editável no painel. */
export type SiteContent = {
  seo: { title: string; description: string };
  header: {
    /** Links do menu do topo (o link de rurais some se não houver rurais publicadas) */
    links: { label: string; href: string }[];
    /** Botão "Acessar sistema" (vazio = esconde) */
    loginLabel: string;
    /** Botão de destaque (vazio = esconde) */
    ctaLabel: string;
    ctaHref: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    /** Título quando a busca está na aba Rurais */
    titleRural: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    videoUrl: string;
    posterUrl: string;
    stats: { value: string; label: string }[];
  };
  collection: { eyebrow: string; title: string; linkLabel: string };
  experience: {
    eyebrow: string;
    title: string;
    body: string;
    imageA: string;
    imageB: string;
    stats: { value: string; label: string }[];
  };
  process: {
    eyebrow: string;
    title: string;
    steps: { n: string; title: string; body: string }[];
  };
  cta: {
    title: string;
    body: string;
    primary: string;
    secondary: string;
    whatsappMessage: string;
  };
  listing: { eyebrow: string; title: string };
  detail: {
    visitEyebrow: string;
    visitTitle: string;
    visitBullets: string[];
    brokerName: string;
    brokerRole: string;
  };
  /** Janela "Agendar visita" da página do imóvel */
  visit: {
    /** Texto dos botões que abrem a janela */
    cta: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    dateLabel: string;
    timeLabel: string;
    /** Horários oferecidos */
    times: string[];
    button: string;
    note: string;
    successTitle: string;
    /** Use {nome}, {codigo}, {data} e {hora} */
    successText: string;
  };
  footer: {
    tagline: string;
    /** Botão abaixo da frase (vazio = esconde) */
    buttonLabel: string;
    navTitle: string;
    links: { label: string; href: string }[];
    contactTitle: string;
    /** Telefone exibido (vazio = WhatsApp do white label) */
    phone: string;
    /** E-mail exibido (vazio = e-mail do white label) */
    email: string;
    address: string;
    /** Nome grande vazado (vazio = nome da marca) */
    bigName: string;
    showBigName: boolean;
    creci: string;
    coords: string;
  };
};

export const DEFAULT_CONTENT: SiteContent = {
  header: {
    links: [
      { label: "Comprar", href: "/imoveis?finalidade=venda" },
      { label: "Alugar", href: "/imoveis?finalidade=aluguel" },
      { label: "Rurais", href: "/imoveis?categoria=rurais" },
      { label: "Todos os imóveis", href: "/imoveis" },
      { label: "Contato", href: "/#fale-conosco" },
    ],
    loginLabel: "Acessar sistema",
    ctaLabel: "Falar com corretor",
    ctaHref: "/#fale-conosco",
  },
  seo: {
    title: "Carlos Amâncio Imóveis — Casas, apartamentos e imóveis rurais",
    description:
      "Encontre casas, apartamentos e propriedades rurais à venda e para alugar. Busque por bairro, tipo e preço.",
  },
  hero: {
    eyebrow: "Negócios imobiliários",
    title: "Encontre o imóvel ideal.",
    titleRural: "Encontre a propriedade ideal.",
    subtitle:
      "Apartamentos, casas e propriedades rurais à venda e para alugar. Busque pelo bairro, tipo e preço — e fale direto com um corretor.",
    ctaPrimary: "Buscar",
    ctaSecondary: "Prefere ajuda? Fale com um corretor",
    videoUrl:
      "https://videos.pexels.com/video-files/39024321/16605501_3840_2160_30fps.mp4",
    posterUrl:
      "https://images.pexels.com/videos/39024321/aerial-photography-aerial-view-cinematic-coastal-landscape-39024321.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1080&w=1920",
    stats: [
      { value: "auto:properties", label: "Imóveis disponíveis" },
      { value: "auto:neighborhoods", label: "Bairros atendidos" },
      { value: "340", label: "Chaves entregues" },
      { value: "auto:vgv", label: "Em portfólio" },
    ],
  },
  collection: {
    eyebrow: "Destaques",
    title: "Imóveis em destaque",
    linkLabel: "Ver todos os imóveis",
  },
  experience: {
    eyebrow: "02 — A experiência",
    title: "Menos imóveis. Mais os imóveis certos.",
    body: "Não acreditamos em vitrines infinitas. Cada endereço do nosso portfólio foi visitado, fotografado e aprovado por um curador — porque seu tempo vale mais do que o nosso estoque.",
    imageA:
      "https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1100&w=880",
    imageB:
      "https://images.pexels.com/photos/10610733/pexels-photo-10610733.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    stats: [
      { value: "98%", label: "Clientes que indicam" },
      { value: "14", label: "Dias em média até a proposta" },
      { value: "340", label: "Chaves entregues" },
      { value: "12", label: "Anos de praça" },
    ],
  },
  process: {
    eyebrow: "03 — Processo",
    title: "Três passos até a chave",
    steps: [
      {
        n: "01",
        title: "Escuta",
        body: "Entendemos ritmo, rotina e não-negociáveis. A busca certa começa com as perguntas certas.",
      },
      {
        n: "02",
        title: "Curadoria",
        body: "Apresentamos apenas endereços que sobreviveriam à nossa própria régua. Menos visitas, mais certeza.",
      },
      {
        n: "03",
        title: "Chave",
        body: "Proposta, documentação e entrega conduzidas por especialistas. Você só assina — e comemora.",
      },
    ],
  },
  cta: {
    title: "Não encontrou o que procura?",
    body: "Conte o que você precisa e um corretor busca pra você — inclusive imóveis que ainda não estão no site.",
    primary: "Ver todos os imóveis",
    secondary: "Falar no WhatsApp",
    whatsappMessage: "Olá! Quero conhecer os imóveis disponíveis.",
  },
  listing: {
    eyebrow: "Imóveis à venda e para alugar",
    title: "Encontre o seu endereço.",
  },
  detail: {
    visitEyebrow: "Visita guiada",
    visitTitle: "Veja com os próprios olhos.",
    visitBullets: [
      "Visita acompanhada por um corretor",
      "Análise honesta de prós e contras",
      "Simulação de financiamento na hora",
    ],
    // Vazio = usa o nome da organização (página do imóvel) ou o corretor logado (ficha)
    brokerName: "",
    brokerRole: "",
  },
  visit: {
    cta: "Agendar visita",
    nameLabel: "Seu nome",
    namePlaceholder: "Como podemos te chamar?",
    phoneLabel: "WhatsApp",
    phonePlaceholder: "(43) 99999-9999",
    dateLabel: "Data",
    timeLabel: "Horário",
    times: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
    button: "Reservar visita",
    note: "Sem compromisso. Seus dados ficam apenas com a equipe e nunca são compartilhados.",
    successTitle: "Visita reservada",
    successText:
      "{nome}, reservamos {codigo} para {data} às {hora}. Um corretor confirma pelo seu WhatsApp em até 30 min.",
  },
  footer: {
    tagline: "Imóveis à venda e para alugar, com atendimento direto do corretor.",
    buttonLabel: "Área do corretor",
    navTitle: "Navegação",
    links: [
      { label: "Todos os imóveis", href: "/imoveis" },
      { label: "Comprar", href: "/imoveis?finalidade=venda" },
      { label: "Alugar", href: "/imoveis?finalidade=aluguel" },
      { label: "Fale com um corretor", href: "/#fale-conosco" },
      { label: "Acessar plataforma", href: "/login" },
    ],
    contactTitle: "Contato",
    phone: "",
    email: "",
    address: "",
    bigName: "",
    showBigName: true,
    creci: "CRECI F27617",
    coords: "",
  },
};

/** Textos padrão antigos (site "autoral") trocados pelos novos quando ainda
 *  estão salvos sem edição — quem personalizou mantém o próprio texto. */
const LEGACY_DEFAULTS: Record<string, string> = {
  "Espaços com assinatura.": DEFAULT_CONTENT.hero.title,
  "Encontre a casa ideal.": DEFAULT_CONTENT.hero.title,
  "Curadoria autoral de imóveis excepcionais. Do primeiro café à entrega das chaves — uma experiência à altura do endereço.":
    DEFAULT_CONTENT.hero.subtitle,
  "Explorar coleção": DEFAULT_CONTENT.hero.ctaPrimary,
  "Conhecer a casa": DEFAULT_CONTENT.hero.ctaSecondary,
  "Imóveis em curadoria": "Imóveis disponíveis",
  "01 — Coleção": DEFAULT_CONTENT.collection.eyebrow,
  "Selecionados desta temporada": DEFAULT_CONTENT.collection.title,
  "O próximo capítulo começa com uma visita.": DEFAULT_CONTENT.cta.title,
  "Agende uma visita guiada ou converse com um curador — sem compromisso, sem roteiro de vendas.":
    DEFAULT_CONTENT.cta.body,
  "Agendar visita": DEFAULT_CONTENT.cta.primary,
  "NORD Imóveis — Imobiliária boutique em São Paulo": DEFAULT_CONTENT.seo.title,
  "Imóveis excepcionais, curadoria autoral e uma experiência de compra à altura.":
    DEFAULT_CONTENT.seo.description,
  "Tour guiado por um curador sênior": "Visita acompanhada por um corretor",
  "Espaços com assinatura, escolhidos para durar.": DEFAULT_CONTENT.footer.tagline,
  "Portfólio completo": DEFAULT_CONTENT.listing.eyebrow,
  "NORD Imóveis — Casas, apartamentos e imóveis rurais": DEFAULT_CONTENT.seo.title,
  "São Paulo, Brasil": DEFAULT_CONTENT.hero.eyebrow,
  "Rua Oscar Freire, 1200\nJardins, São Paulo — SP": DEFAULT_CONTENT.footer.address,
  "contato@nordimoveis.com.br": DEFAULT_CONTENT.footer.email,
  "CRECI 24.315-J": DEFAULT_CONTENT.footer.creci,
  "23°33′S 46°38′W — São Paulo": DEFAULT_CONTENT.footer.coords,
};

function upgrade<T>(v: T): T {
  if (typeof v === "string") return (LEGACY_DEFAULTS[v] ?? v) as T;
  if (Array.isArray(v)) return v.map(upgrade) as T;
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, upgrade(x)])) as T;
  return v;
}

/** Faz merge profundo do conteúdo salvo sobre os defaults. */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "siteContent"));
    const raw = (rows[0]?.value ?? {}) as Partial<SiteContent>;
    const saved = {
      ...raw,
      seo: upgrade(raw.seo),
      hero: upgrade(raw.hero),
      collection: upgrade(raw.collection),
      cta: upgrade(raw.cta),
      listing: upgrade(raw.listing),
      detail: upgrade(raw.detail),
      footer: upgrade(raw.footer),
    };
    return {
      seo: { ...DEFAULT_CONTENT.seo, ...saved.seo },
      header: {
        ...DEFAULT_CONTENT.header,
        ...saved.header,
        links: Array.isArray(saved.header?.links) ? saved.header.links : DEFAULT_CONTENT.header.links,
      },
      hero: { ...DEFAULT_CONTENT.hero, ...saved.hero },
      collection: { ...DEFAULT_CONTENT.collection, ...saved.collection },
      experience: { ...DEFAULT_CONTENT.experience, ...saved.experience },
      process: { ...DEFAULT_CONTENT.process, ...saved.process },
      cta: { ...DEFAULT_CONTENT.cta, ...saved.cta },
      listing: { ...DEFAULT_CONTENT.listing, ...saved.listing },
      detail: { ...DEFAULT_CONTENT.detail, ...saved.detail },
      visit: {
        ...DEFAULT_CONTENT.visit,
        ...saved.visit,
        times:
          Array.isArray(saved.visit?.times) && saved.visit.times.length
            ? saved.visit.times
            : DEFAULT_CONTENT.visit.times,
      },
      footer: {
        ...DEFAULT_CONTENT.footer,
        ...saved.footer,
        links: Array.isArray(saved.footer?.links) ? saved.footer.links : DEFAULT_CONTENT.footer.links,
      },
    };
  } catch {
    return DEFAULT_CONTENT;
  }
}
