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
  role: text("role", { enum: ["admin", "corretor"] })
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

/* ─────────────────────────── Tipos ─────────────────────────── */

export type Property = typeof properties.$inferSelect;
export type PropertyImage = typeof propertyImages.$inferSelect;
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
