import { getDb } from "@/db";
import {
  partners,
  propertySends,
  waMessages,
  activities,
  contacts,
  deals,
  portals,
  properties,
  propertyDocuments,
  propertyImages,
  propertyViews,
  settings,
  users,
  visits,
  type Activity,
  type Contact,
  type Deal,
  type Portal,
  type Property,
  type PropertySend,
  type WaMessage,
  type PropertyDocument,
  type PropertyImage,
  type User,
  type Visit,
} from "@/db/schema";
import { and, asc, count, countDistinct, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { isMainTenant } from "@/lib/tenant";
import { resolveBadge, type BadgeView } from "@/lib/badges";
import { getBadgeSettings } from "@/lib/features";

/* ─────────────────────── White label ─────────────────────── */

export type WhiteLabel = {
  orgName: string;
  /** Nome curto exibido ao lado do ícone (vazio = primeira palavra do nome) */
  shortName: string;
  /** Linha pequena abaixo do nome curto, ex.: IMÓVEIS */
  brandSub: string;
  domain: string;
  accent: string;
  /** Cor do texto/ícones sobre a cor de destaque (vazio = automática pelo contraste) */
  onAccent: string;
  phone: string; // WhatsApp com DDI, ex: 5511998765432
  email: string;
  instagram: string; // @usuario ou URL
  tagline: string;
  /** Logo horizontal para fundos claros (substitui ícone + nome) */
  logoUrl: string;
  /** Logo para fundos escuros (opcional; usa logoUrl se vazio) */
  logoDarkUrl: string;
  /** Ícone quadrado — favicon e selo da marca */
  iconUrl: string;
  /** Sem ícone enviado: usar o símbolo padrão do sistema (senão, só o nome) */
  showMark: boolean;
  /** Ficha do imóvel: exibir o ícone no cabeçalho */
  fichaShowIcon: boolean;
  /** Ficha do imóvel: exibir o nome da organização no cabeçalho */
  fichaShowName: boolean;
  /** Ficha do imóvel: exibir o domínio no cabeçalho e no rodapé */
  fichaShowDomain: boolean;
  /** Prefixo do código dos imóveis urbanos (NRD-2401) */
  codePrefix: string;
  /** Prefixo do código das propriedades rurais (RUR-2401) */
  codePrefixRural: string;
  /** Prefixo do código dos terrenos (vazio = o mesmo dos imóveis) */
  codePrefixLand: string;
};

export const WL_DEFAULTS: WhiteLabel = {
  orgName: "Carlos Amâncio Imóveis",
  shortName: "Carlos Amâncio",
  brandSub: "IMÓVEIS",
  domain: "kreativae-corretor.vercel.app",
  accent: "#F47525",
  onAccent: "",
  phone: "",
  email: "",
  instagram: "",
  tagline: "Negócios imobiliários",
  logoUrl: "",
  logoDarkUrl: "",
  iconUrl: "",
  showMark: true,
  fichaShowIcon: true,
  fichaShowName: true,
  fichaShowDomain: true,
  codePrefix: "NRD",
  codePrefixRural: "RUR",
  codePrefixLand: "",
};

/** "ca " → "CA" (letras e números, até 6) */
export function cleanCodePrefix(v: string, fallback: string) {
  const s = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return s || fallback;
}

/** Nome curto da marca (cabeçalhos). */
export function brandShortName(wl: Pick<WhiteLabel, "shortName" | "orgName">) {
  return (
    wl.shortName.trim() ||
    wl.orgName.trim().replace(/\s+(im[óo]veis|imobili[áa]ria)$/i, "") ||
    wl.orgName
  );
}

export async function getWhiteLabel(): Promise<WhiteLabel> {
  try {
    const rows = await (await getDb())
      .select()
      .from(settings)
      .where(eq(settings.key, "whiteLabel"));
    const v = (rows[0]?.value ?? {}) as Partial<WhiteLabel>;
    // Valores do modelo antigo (NORD) ainda salvos dão lugar à identidade atual
    const legacy: Partial<Record<keyof WhiteLabel, string[]>> = {
      orgName: ["NORD Imóveis"],
      shortName: ["NORD"],
      domain: ["nordimoveis.com.br"],
      accent: ["#10b981", "#10B981"],
      tagline: ["Imobiliária boutique"],
    };
    // Só enquanto a marca salva ainda é a antiga — depois disso, vale o que foi escolhido
    const isLegacy = !v.orgName || v.orgName === "NORD Imóveis";
    const clean = Object.fromEntries(
      Object.entries(v).filter(
        ([k, x]) => !isLegacy || !legacy[k as keyof WhiteLabel]?.includes(String(x)),
      ),
    ) as Partial<WhiteLabel>;
    // Símbolo padrão é da empresa principal; empresas novas mostram só o nome
    if (clean.showMark === undefined) clean.showMark = await isMainTenant();
    return { ...WL_DEFAULTS, ...clean };
  } catch {
    return WL_DEFAULTS;
  }
}

/* ─────────────────────── Imóveis ─────────────────────── */

export type PropertyWithImages = Property & {
  images: PropertyImage[];
  cover: string | null;
  /** Marca d'água das fotos no site (modo do parceiro; "padrao" = Configurações) */
  wm: string;
  /** Selo do card no site (só nas listas públicas) */
  badgeView?: BadgeView | null;
};

/** Modo de marca d'água de cada parceiro */
async function partnerModes(rows: Property[]) {
  const ids = [...new Set(rows.map((r) => r.partnerId).filter(Boolean))] as string[];
  if (!ids.length) return new Map<string, string>();
  const list = await (await getDb())
    .select({ id: partners.id, mode: partners.watermark })
    .from(partners)
    .where(inArray(partners.id, ids))
    .catch(() => []);
  return new Map(list.map((p) => [p.id, p.mode]));
}

function attachImages(
  rows: Property[],
  imgs: PropertyImage[],
  modes = new Map<string, string>(),
): PropertyWithImages[] {
  const byProp = new Map<string, PropertyImage[]>();
  const sorted = [...imgs].sort((a, b) => a.position - b.position);
  for (const img of sorted) {
    const list = byProp.get(img.propertyId) ?? [];
    list.push(img);
    byProp.set(img.propertyId, list);
  }
  return rows.map((p) => {
    const images = byProp.get(p.id) ?? [];
    return {
      ...p,
      images,
      cover: images[0]?.url ?? null,
      wm: (p.partnerId && modes.get(p.partnerId)) || "padrao",
    };
  });
}

export async function listProperties(): Promise<PropertyWithImages[]> {
  const rows = await (await getDb())
    .select()
    .from(properties)
    .orderBy(desc(properties.createdAt));
  if (!rows.length) return [];
  const imgs = await (await getDb())
    .select()
    .from(propertyImages)
    .where(
      inArray(
        propertyImages.propertyId,
        rows.map((r) => r.id),
      ),
    );
  return attachImages(rows, imgs, await partnerModes(rows));
}

/** Apenas imóveis publicados e comercialmente ativos (site público) */
export async function listPublishedProperties(): Promise<PropertyWithImages[]> {
  const [all, badges] = await Promise.all([listProperties(), getBadgeSettings()]);
  return all
    .filter((p) => p.published && ["disponivel", "reservado"].includes(p.status))
    .map((p) => ({ ...p, badgeView: resolveBadge(p, badges) }));
}

export async function getPropertyById(id: string) {
  const rows = await (await getDb()).select().from(properties).where(eq(properties.id, id));
  if (!rows.length) return null;
  const imgs = await (await getDb())
    .select()
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, id));
  return attachImages(rows, imgs, await partnerModes(rows))[0];
}

export async function getPropertyByCode(code: string) {
  let rows = await (await getDb())
    .select()
    .from(properties)
    .where(eq(properties.code, code));
  // Link antigo (prefixo trocado no White Label): mesmo número, único anúncio
  const num = code.match(/^[A-Za-z0-9]+-(\d+)$/)?.[1];
  if (!rows.length && num) {
    const same = await (await getDb())
      .select()
      .from(properties)
      .where(sql`${properties.code} ~ ${`^[A-Za-z0-9]+-${num}$`}`);
    if (same.length === 1) rows = same;
  }
  if (!rows.length) return null;
  const imgs = await (await getDb())
    .select()
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, rows[0].id));
  return attachImages(rows, imgs, await partnerModes(rows))[0];
}

/* ─────────────────────── Contatos / CRM ─────────────────────── */

export async function listContacts(): Promise<Contact[]> {
  return (await getDb()).select().from(contacts).orderBy(desc(contacts.createdAt));
}

export async function getContact(id: string): Promise<Contact | null> {
  const rows = await (await getDb()).select().from(contacts).where(eq(contacts.id, id));
  return rows[0] ?? null;
}

export type VisitFull = {
  visit: Visit;
  property: Property | null;
  contact: Contact | null;
};

export async function listVisits(): Promise<VisitFull[]> {
  const rows = await (await getDb())
    .select({ visit: visits, property: properties, contact: contacts })
    .from(visits)
    .leftJoin(properties, eq(visits.propertyId, properties.id))
    .leftJoin(contacts, eq(visits.contactId, contacts.id))
    .orderBy(visits.scheduledAt);
  return rows;
}

export type DealFull = {
  deal: Deal;
  property: Property | null;
  contact: Contact | null;
};

export async function listDeals(): Promise<DealFull[]> {
  return (await getDb())
    .select({ deal: deals, property: properties, contact: contacts })
    .from(deals)
    .leftJoin(properties, eq(deals.propertyId, properties.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .orderBy(desc(deals.createdAt));
}

/**
 * Data em que cada negócio foi movido para "Fechado" (última vez), pelo
 * histórico da linha do tempo. Negócios criados já fechados não têm registro.
 */
export async function listDealClosedDates(): Promise<Record<string, string>> {
  const rows = await (await getDb())
    .select({ id: activities.entityId, at: sql<string>`max(${activities.createdAt})` })
    .from(activities)
    .where(
      and(
        eq(activities.entity, "negocio"),
        eq(activities.kind, "stage"),
        sql`${activities.text} like ${"%“Fechado”%"}`,
      ),
    )
    .groupBy(activities.entityId);
  const out: Record<string, string> = {};
  for (const r of rows) if (r.id) out[r.id] = new Date(r.at).toISOString();
  return out;
}

export async function listActivities(limit = 30): Promise<Activity[]> {
  return (await getDb()).select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
}

/** Quando o contato entrou como lead (mais antigos primeiro) — data das mensagens antigas */
export async function listLeadDates(contactId: string) {
  const rows = await (await getDb())
    .select({ entity: activities.entity, kind: activities.kind, createdAt: activities.createdAt })
    .from(activities)
    .where(eq(activities.entityId, contactId))
    .orderBy(asc(activities.createdAt));
  return rows
    .filter((a) => a.entity === "contato" && a.kind === "lead")
    .map((a) => new Date(a.createdAt).toISOString());
}

export async function listActivitiesFor(
  entity: string,
  entityId: string,
  limit = 20,
) {
  const all = await (await getDb())
    .select()
    .from(activities)
    .where(eq(activities.entityId, entityId))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
  return all.filter((a) => a.entity === entity);
}

export async function listPortals(): Promise<Portal[]> {
  return (await getDb()).select().from(portals).orderBy(portals.name);
}

/** Equipe do cliente — a gerência não aparece aqui */
export async function listUsers(): Promise<User[]> {
  return (await getDb()).select().from(users).where(ne(users.role, "superadmin")).orderBy(users.createdAt);
}

/* ─────────────────── Analytics de imóveis ─────────────────── */

export type ViewStats = {
  total: number;
  unique: number;
  last7: number;
  last30: number;
  unique30: number;
  daily: { date: Date; count: number }[];
};

export async function getPropertyViewStats(
  propertyId: string,
): Promise<ViewStats> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 864e5);
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const d14 = new Date(now.getTime() - 13 * 864e5);
  d14.setHours(0, 0, 0, 0);

  const rows = await (await getDb())
    .select({
      createdAt: propertyViews.createdAt,
      visitorId: propertyViews.visitorId,
    })
    .from(propertyViews)
    .where(eq(propertyViews.propertyId, propertyId));

  const total = rows.length;
  const unique = new Set(rows.map((r) => r.visitorId)).size;
  const recent = rows.filter((r) => r.createdAt >= d30);
  const last30 = recent.length;
  const unique30 = new Set(recent.map((r) => r.visitorId)).size;
  const last7 = rows.filter((r) => r.createdAt >= d7).length;

  const days: { date: Date; count: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 864e5);
    d.setHours(0, 0, 0, 0);
    days.push({ date: d, count: 0 });
  }
  for (const r of rows) {
    if (r.createdAt < d14) continue;
    const k = new Date(r.createdAt);
    k.setHours(0, 0, 0, 0);
    const day = days.find((x) => x.date.getTime() === k.getTime());
    if (day) day.count += 1;
  }

  return { total, unique, last7, last30, unique30, daily: days };
}

/** Totais por imóvel para a coluna da tabela de portfólio. */
/** Visualizações por imóvel; com `range`, só as do período (ms, limites opcionais). */
export async function listPropertyViewTotals(range?: {
  from?: number | null;
  to?: number | null;
}): Promise<Record<string, { total: number; unique: number }>> {
  const conds = [
    range?.from != null ? gte(propertyViews.createdAt, new Date(range.from)) : undefined,
    range?.to != null ? lte(propertyViews.createdAt, new Date(range.to)) : undefined,
  ].filter(Boolean);
  const rows = await (await getDb())
    .select({
      propertyId: propertyViews.propertyId,
      total: count(),
      unique: countDistinct(propertyViews.visitorId),
    })
    .from(propertyViews)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(propertyViews.propertyId);
  return Object.fromEntries(
    rows.map((r) => [
      r.propertyId,
      { total: Number(r.total), unique: Number(r.unique) },
    ]),
  );
}

export type PortfolioViews = { total30d: number; unique30d: number };

export async function getPortfolioViews(): Promise<PortfolioViews> {
  const d30 = new Date(Date.now() - 30 * 864e5);
  const [row] = await (await getDb())
    .select({
      total30d: count(),
      unique30d: countDistinct(propertyViews.visitorId),
    })
    .from(propertyViews)
    .where(gte(propertyViews.createdAt, d30));
  return {
    total30d: Number(row?.total30d ?? 0),
    unique30d: Number(row?.unique30d ?? 0),
  };
}

export type TopViewed = {
  propertyId: string;
  total: number;
  unique: number;
};

export async function getTopViewedProperties(limit = 5): Promise<TopViewed[]> {
  const rows = await (await getDb())
    .select({
      propertyId: propertyViews.propertyId,
      total: count(),
      unique: countDistinct(propertyViews.visitorId),
    })
    .from(propertyViews)
    .groupBy(propertyViews.propertyId)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({
    propertyId: r.propertyId,
    total: Number(r.total),
    unique: Number(r.unique),
  }));
}

/* ─────────────────────── Smart Match ─────────────────────── */

export type Match = { property: PropertyWithImages; score: number };

export async function getMatchesFor(contact: Contact): Promise<Match[]> {
  const props = await listPublishedProperties();
  const scored = props.map((p) => {
    let score = 0;
    const reasons: string[] = [];
    // tipo
    if (contact.interestTypes.length) {
      if (contact.interestTypes.includes(p.type)) {
        score += 40;
        reasons.push("tipo");
      }
    } else score += 20;
    // orçamento
    if (contact.budgetMax) {
      if (p.price <= contact.budgetMax) score += 35;
      else if (p.price <= contact.budgetMax * 1.15) score += 18;
    } else score += 15;
    // bairro
    if (contact.neighborhoods.length) {
      if (contact.neighborhoods.includes(p.neighborhood)) score += 25;
    } else score += 10;
    void reasons;
    return { property: p, score: Math.min(score, 100) };
  });
  return scored
    .filter((m) => m.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/** Documentos internos de um imóvel, mais recentes primeiro. */
export async function listPropertyDocuments(propertyId: string): Promise<PropertyDocument[]> {
  try {
    return await (await getDb())
      .select()
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyId, propertyId))
      .orderBy(desc(propertyDocuments.createdAt));
  } catch {
    // Tabela ainda sendo criada pela migração em runtime
    return [];
  }
}

/* ─────────────────────── Parceiros ─────────────────────── */

/** Parceiros com a quantidade de imóveis de cada um. */
export async function listPartners() {
  try {
    const [rows, props] = await Promise.all([
      (await getDb()).select().from(partners).orderBy(asc(partners.name)),
      (await getDb())
        .select({ partnerId: properties.partnerId, type: properties.type, published: properties.published })
        .from(properties),
    ]);
    return rows.map((p) => {
      const mine = props.filter((x) => x.partnerId === p.id);
      return {
        ...p,
        propertyCount: mine.length,
        publishedCount: mine.filter((x) => x.published).length,
      };
    });
  } catch {
    return [];
  }
}

export async function getPartner(id: string) {
  try {
    const [p] = await (await getDb()).select().from(partners).where(eq(partners.id, id));
    return p ?? null;
  } catch {
    return null;
  }
}



/** Histórico da Negociação (e-mails com imóveis enviados ao cliente) */
export async function listPropertySends(contactId?: string, limit = 200): Promise<PropertySend[]> {
  try {
    const q = (await getDb()).select().from(propertySends);
    const rows = contactId ? await q.where(eq(propertySends.contactId, contactId)) : await q;
    return rows.sort((a, b) => +b.createdAt - +a.createdAt).slice(0, limit);
  } catch {
    return [];
  }
}

/** Últimas mensagens de WhatsApp do contato no número (linha) de quem vê — mais recentes por último */
export async function listContactWhatsApp(contactId: string, line: string, limit = 6): Promise<WaMessage[]> {
  try {
    const rows = await (await getDb())
      .select()
      .from(waMessages)
      .where(and(eq(waMessages.contactId, contactId), eq(waMessages.line, line)))
      .orderBy(desc(waMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  } catch {
    return [];
  }
}
