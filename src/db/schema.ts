import type { RuralData } from "@/lib/rural";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ─────────────────────────── Usuários ─────────────────────────── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["superadmin", "admin", "corretor"] })
    .notNull()
    .default("corretor"),
  phone: text("phone"),
  creci: text("creci"),
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ───────────── Integrações & credenciais ───────────── */

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull().unique(), // google_contacts | google_calendar | whatsapp | ...
  name: text("name").notNull(),
  category: text("category", {
    enum: ["google", "mensageria", "portal", "infra"],
  })
    .notNull()
    .default("infra"),
  connected: boolean("connected").notNull().default(false),
  accountEmail: text("account_email"),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  syncCursor: text("sync_cursor"),
  calendarId: text("calendar_id").notNull().default("primary"),
  scopes: jsonb("scopes")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  autoSync: boolean("auto_sync").notNull().default(false),
  syncIntervalMin: integer("sync_interval_min").notNull().default(60),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncCount: integer("last_sync_count").notNull().default(0),
  statusMessage: text("status_message"),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  prefix: text("prefix").notNull(),
  secret: text("secret").notNull(),
  scope: text("scope", { enum: ["leitura", "escrita", "total"] })
    .notNull()
    .default("leitura"),
  revoked: boolean("revoked").notNull().default(false),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────────────── Imóveis ─────────────────────────── */

/** Parceiros: corretores/imobiliárias que trazem imóveis para a carteira. */
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  company: text("company"),
  phone: text("phone"),
  email: text("email"),
  creci: text("creci"),
  /** Comissão padrão combinada com o parceiro (% do valor do negócio) */
  commissionPct: real("commission_pct"),
  /** Parte padrão do parceiro (% da comissão) */
  partnerSharePct: real("partner_share_pct"),
  /** Marca d'água nas fotos dos imóveis dele: padrao | logo | linhas | nenhuma */
  watermark: text("watermark", { enum: ["padrao", "logo", "linhas", "nenhuma"] })
    .notNull()
    .default("padrao"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  type: text("type", {
    enum: [
      "apartamento",
      "casa",
      "cobertura",
      "estudio",
      "terreno",
      "fazenda",
      "sitio",
      "chacara",
    ],
  }).notNull(),
  purpose: text("purpose", { enum: ["venda", "aluguel"] })
    .notNull()
    .default("venda"),
  status: text("status", {
    enum: ["disponivel", "reservado", "vendido", "alugado", "inativo"],
  })
    .notNull()
    .default("disponivel"),
  price: integer("price").notNull(), // valor em reais
  condoFee: integer("condo_fee"),
  iptu: integer("iptu"),
  area: integer("area").notNull(), // m²
  lotArea: integer("lot_area"),
  bedrooms: integer("bedrooms").notNull().default(0),
  suites: integer("suites").notNull().default(0),
  bathrooms: integer("bathrooms").notNull().default(0),
  garage: integer("garage").notNull().default(0),
  description: text("description").notNull().default(""),
  street: text("street").notNull().default(""),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull().default("São Paulo"),
  state: text("state").notNull().default("SP"),
  lat: real("lat"),
  lng: real("lng"),
  features: jsonb("features")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  published: boolean("published").notNull().default(true),
  /** Dados de propriedade rural (fazenda, sítio, chácara) — ver src/lib/rural.ts */
  rural: jsonb("rural").$type<RuralData>(),
  /** Imóvel de parceiro (captado por outro corretor/imobiliária) */
  videoUrl: text("video_url"),
  partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
  /** Comissão total combinada na venda/locação (%) */
  commissionPct: real("commission_pct"),
  /** Parte da comissão que vai para o parceiro (% da comissão) */
  partnerSharePct: real("partner_share_pct"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const propertyImages = pgTable("property_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
});

/** Documentos internos do imóvel (escritura, matrícula…) — nunca vão para o site. */
export const propertyDocuments = pgTable("property_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("outro"),
  /** Caminho no Blob (privado) ou URL pública, quando o store é público */
  pathname: text("pathname").notNull(),
  url: text("url").notNull().default(""),
  size: integer("size").notNull().default(0),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────────────── Contatos ─────────────────────────── */

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  type: text("type", { enum: ["lead", "cliente", "proprietario"] })
    .notNull()
    .default("lead"),
  source: text("source", {
    enum: ["site", "whatsapp", "portal", "indicacao", "visita", "google"],
  })
    .notNull()
    .default("site"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  interestTypes: jsonb("interest_types")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  neighborhoods: jsonb("neighborhoods")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  notes: text("notes"),
  googleResourceName: text("google_resource_name"),
  googleEtag: text("google_etag"),
  googleRemoteUpdatedAt: timestamp("google_remote_updated_at", { withTimezone: true }),
  googleSyncedAt: timestamp("google_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────────────── Visitas ─────────────────────────── */

export const visits = pgTable("visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status", {
    enum: ["agendada", "confirmada", "realizada", "cancelada"],
  })
    .notNull()
    .default("agendada"),
  feedback: text("feedback"),
  googleEventId: text("google_event_id"),
  googleEtag: text("google_etag"),
  googleSyncedAt: timestamp("google_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────────────── Pipeline (CRM) ─────────────────────────── */

export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  stage: text("stage", {
    enum: ["novo", "contato", "visita", "proposta", "documentacao", "fechado"],
  })
    .notNull()
    .default("novo"),
  value: integer("value").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────── Analytics de imóveis ─────────────────── */

export const propertyViews = pgTable("property_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  visitorId: text("visitor_id").notNull(),
  referrer: text("referrer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────────── Linha do tempo ─────────────────────── */

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  entity: text("entity", {
    enum: ["imovel", "contato", "visita", "negocio", "portal", "sistema"],
  }).notNull(),
  entityId: uuid("entity_id"),
  kind: text("kind").notNull(), // created | updated | visit | sync | pdf | stage | message ...
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────── Portais / Integrações ─────────────────── */

export const portals = pgTable("portals", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  status: text("status", {
    enum: ["conectado", "desconectado", "sincronizando", "erro"],
  })
    .notNull()
    .default("desconectado"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  listings: integer("listings").notNull().default(0),
  apiKey: text("api_key"),
});

/* ─────────────────────── Configurações ─────────────────────── */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** Seleções de imóveis enviadas por e-mail ao cliente (página Negociação) */
export type SentProperty = { id: string; code: string; title: string; price: number; city: string };
export type SentAttachment = { pathname: string; name: string; size: number; access?: "public" | "private" };

export const propertySends = pgTable("property_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  toName: text("to_name"),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  message: text("message"),
  properties: jsonb("properties").$type<SentProperty[]>().notNull().default(sql`'[]'::jsonb`),
  attachments: jsonb("attachments").$type<SentAttachment[]>().notNull().default(sql`'[]'::jsonb`),
  status: text("status", { enum: ["enviado", "falhou"] }).notNull().default("enviado"),
  error: text("error"),
  providerId: text("provider_id"),
  sentBy: text("sent_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Mapa do m²: amostras de mercado registradas à mão (anúncios, vendas de colegas, avaliações) */
export const marketSamples = pgTable("market_samples", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  purpose: text("purpose", { enum: ["venda", "aluguel"] }).notNull().default("venda"),
  price: integer("price").notNull(),
  /** m² (rurais: alqueires convertidos) */
  area: integer("area").notNull(),
  neighborhood: text("neighborhood").notNull().default(""),
  city: text("city").notNull(),
  state: text("state").notNull().default(""),
  source: text("source"),
  notes: text("notes"),
  sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Centro de bairros/cidades já localizados no mapa (cache da busca) */
export const regionGeo = pgTable("region_geo", {
  key: text("key").primaryKey(),
  lat: real("lat"),
  lng: real("lng"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** WhatsApp: uma conversa por número (dígitos com DDI) */
export const waThreads = pgTable("wa_threads", {
  phone: text("phone").primaryKey(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  profileName: text("profile_name"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  /** Última mensagem do cliente — abre a janela de 24 h para responder livremente */
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  unread: integer("unread").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waMessages = pgTable("wa_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  type: text("type").notNull().default("text"),
  body: text("body"),
  mediaId: text("media_id"),
  mediaMime: text("media_mime"),
  waMessageId: text("wa_message_id").unique(),
  /** received | sent | delivered | read | failed */
  status: text("status").notNull().default("received"),
  error: text("error"),
  sentBy: text("sent_by"),
  /** Quando o contato recebeu e quando leu (mensagens enviadas) */
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─────────────────────────── Tipos ─────────────────────────── */

export type Partner = typeof partners.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type PropertyImage = typeof propertyImages.$inferSelect;
export type PropertyDocument = typeof propertyDocuments.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Portal = typeof portals.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type PropertyView = typeof propertyViews.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type PropertySend = typeof propertySends.$inferSelect;
export type WaThread = typeof waThreads.$inferSelect;
export type WaMessage = typeof waMessages.$inferSelect;
export type MarketSampleRow = typeof marketSamples.$inferSelect;
