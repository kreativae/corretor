import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Todo o conteúdo textual do site público — editável no painel. */
export type SiteContent = {
  seo: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
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
  footer: {
    tagline: string;
    address: string;
    email: string;
    creci: string;
    coords: string;
  };
};

export const DEFAULT_CONTENT: SiteContent = {
  seo: {
    title: "NORD Imóveis — Imobiliária boutique em São Paulo",
    description:
      "Imóveis excepcionais, curadoria autoral e uma experiência de compra à altura.",
  },
  hero: {
    eyebrow: "São Paulo, Brasil",
    title: "Espaços com assinatura.",
    subtitle:
      "Curadoria autoral de imóveis excepcionais. Do primeiro café à entrega das chaves — uma experiência à altura do endereço.",
    ctaPrimary: "Explorar coleção",
    ctaSecondary: "Conhecer a casa",
    videoUrl:
      "https://videos.pexels.com/video-files/39024321/16605501_3840_2160_30fps.mp4",
    posterUrl:
      "https://images.pexels.com/videos/39024321/aerial-photography-aerial-view-cinematic-coastal-landscape-39024321.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1080&w=1920",
    stats: [
      { value: "auto:properties", label: "Imóveis em curadoria" },
      { value: "auto:neighborhoods", label: "Bairros atendidos" },
      { value: "340", label: "Chaves entregues" },
      { value: "auto:vgv", label: "Em portfólio" },
    ],
  },
  collection: {
    eyebrow: "01 — Coleção",
    title: "Selecionados desta temporada",
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
    title: "O próximo capítulo começa com uma visita.",
    body: "Agende uma visita guiada ou converse com um curador — sem compromisso, sem roteiro de vendas.",
    primary: "Agendar visita",
    secondary: "Falar no WhatsApp",
    whatsappMessage: "Olá! Quero conhecer os imóveis disponíveis.",
  },
  listing: {
    eyebrow: "Portfólio completo",
    title: "Encontre o seu endereço.",
  },
  detail: {
    visitEyebrow: "Visita guiada",
    visitTitle: "Veja com os próprios olhos.",
    visitBullets: [
      "Tour guiado por um curador sênior",
      "Análise honesta de prós e contras",
      "Simulação de financiamento na hora",
    ],
    brokerName: "Rafael Costa",
    brokerRole: "Curador · CRECI 198.442-F",
  },
  footer: {
    tagline: "Espaços com assinatura, escolhidos para durar.",
    address: "Rua Oscar Freire, 1200\nJardins, São Paulo — SP",
    email: "contato@nordimoveis.com.br",
    creci: "CRECI 24.315-J",
    coords: "23°33′S 46°38′W — São Paulo",
  },
};

/** Faz merge profundo do conteúdo salvo sobre os defaults. */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "siteContent"));
    const saved = (rows[0]?.value ?? {}) as Partial<SiteContent>;
    return {
      seo: { ...DEFAULT_CONTENT.seo, ...saved.seo },
      hero: { ...DEFAULT_CONTENT.hero, ...saved.hero },
      collection: { ...DEFAULT_CONTENT.collection, ...saved.collection },
      experience: { ...DEFAULT_CONTENT.experience, ...saved.experience },
      process: { ...DEFAULT_CONTENT.process, ...saved.process },
      cta: { ...DEFAULT_CONTENT.cta, ...saved.cta },
      listing: { ...DEFAULT_CONTENT.listing, ...saved.listing },
      detail: { ...DEFAULT_CONTENT.detail, ...saved.detail },
      footer: { ...DEFAULT_CONTENT.footer, ...saved.footer },
    };
  } catch {
    return DEFAULT_CONTENT;
  }
}
