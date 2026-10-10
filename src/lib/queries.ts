import { db } from "@/db";
import {
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
  type PropertyDocument,
  type PropertyImage,
  type User,
  type Visit,
} from "@/db/schema";
import { and, count, countDistinct, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

/* ─────────────────────── White label ─────────────────────── */

export type WhiteLabel = {
  orgName: string;
  /** Nome curto exibido ao lado do ícone (vazio = primeira palavra do nome) */
  shortName: string;
  /** Linha pequena abaixo do nome curto, ex.: IMÓVEIS */
  brandSub: string;
  domain: string;
  accent: string;
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
  /** Ficha do imóvel: exibir o ícone no cabeçalho */
  fichaShowIcon: boolean;
  /** Ficha do imóvel: exibir o nome da organização no cabeçalho */
  fichaShowName: boolean;
  /** Ficha do imóvel: exibir o domínio no cabeçalho e no rodapé */
  fichaShowDomain: boolean;
};

export const WL_DEFAULTS: WhiteLabel = {
  orgName: "NORD Imóveis",
  shortName: "",
  brandSub: "IMÓVEIS",
  domain: "nordimoveis.com.br",
  accent: "#10b981",
  phone: "",
  email: "",
  instagram: "",
  tagline: "Imobiliária boutique",
  logoUrl: "",
  logoDarkUrl: "",
  iconUrl: "",
  fichaShowIcon: true,
  fichaShowName: true,
  fichaShowDomain: true,
};

/** Nome curto da marca (cabeçalhos). */
export function brandShortName(wl: Pick<WhiteLabel, "shortName" | "orgName">) {
  return wl.shortName.trim() || wl.orgName.trim().split(/\s+/)[0] || wl.orgName;
}

export async function getWhiteLabel(): Promise<WhiteLabel> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "whiteLabel"));
    const v = (rows[0]?.value ?? {}) as Partial<WhiteLabel>;
    return { ...WL_DEFAULTS, ...v };
  } catch {
    return WL_DEFAULTS;
  }
}

/* ─────────────────────── Imóveis ─────────────────────── */

export type PropertyWithImages = Property & {
  images: PropertyImage[];
  cover: string | null;
};

function attachImages(rows: Property[], imgs: PropertyImage[]): PropertyWithImages[] {
  const byProp = new Map<string, PropertyImage[]>();
  const sorted = [...imgs].sort((a, b) => a.position - b.position);
  for (const img of sorted) {
    const list = byProp.get(img.propertyId) ?? [];
    list.push(img);
    byProp.set(img.propertyId, list);
  }
  return rows.map((p) => {
    const images = byProp.get(p.id) ?? [];
    return { ...p, images, cover: images[0]?.url ?? null };
  });
}

export async function listProperties(): Promise<PropertyWithImages[]> {
  const rows = await db
    .select()
    .from(properties)
    .orderBy(desc(properties.createdAt));
  if (!rows.length) return [];
  const imgs = await db
    .select()
    .from(propertyImages)
    .where(
      inArray(
        propertyImages.propertyId,
        rows.map((r) => r.id),
      ),
    );
  return attachImages(rows, imgs);
}

/** Apenas imóveis publicados e comercialmente ativos (site público) */
export async function listPublishedProperties(): Promise<PropertyWithImages[]> {
  const all = await listProperties();
  return all.filter(
    (p) => p.published && ["disponivel", "reservado"].includes(p.status),
  );
}

export async function getPropertyById(id: string) {
  const rows = await db.select().from(properties).where(eq(properties.id, id));
  if (!rows.length) return null;
  const imgs = await db
    .select()
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, id));
  return attachImages(rows, imgs)[0];
}

export async function getPropertyByCode(code: string) {
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.code, code));
  if (!rows.length) return null;
  const imgs = await db
    .select()
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, rows[0].id));
  return attachImages(rows, imgs)[0];
}

/* ─────────────────────── Contatos / CRM ─────────────────────── */

export async function listContacts(): Promise<Contact[]> {
  return db.select().from(contacts).orderBy(desc(contacts.createdAt));
}

export async function getContact(id: string): Promise<Contact | null> {
  const rows = await db.select().from(contacts).where(eq(contacts.id, id));
  return rows[0] ?? null;
}

export type VisitFull = {
  visit: Visit;
  property: Property | null;
  contact: Contact | null;
};

export async function listVisits(): Promise<VisitFull[]> {
  const rows = await db
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
  return db
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
  const rows = await db
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
  return db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
}

export async function listActivitiesFor(
  entity: string,
  entityId: string,
  limit = 20,
) {
  const all = await db
    .select()
    .from(activities)
    .where(eq(activities.entityId, entityId))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
  return all.filter((a) => a.entity === entity);
}

export async function listPortals(): Promise<Portal[]> {
  return db.select().from(portals).orderBy(portals.name);
}

export async function listUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(users.createdAt);
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

  const rows = await db
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
  const rows = await db
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
  const [row] = await db
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
  const rows = await db
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
    return await db
      .select()
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyId, propertyId))
      .orderBy(desc(propertyDocuments.createdAt));
  } catch {
    // Tabela ainda sendo criada pela migração em runtime
    return [];
  }
}
