import type { RuralData } from "@/lib/rural";
import type { LandData } from "@/lib/land";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
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
  /** Cargo mostrado na ficha do imóvel (ex.: "Corretor de imóveis"); vazio = "Corretor" */
  title: text("title"),
  passwordHash: text("password_hash"),
  /** Parte antes do @ do e-mail do usuário no domínio da empresa (ex.: "fabio"); vazio = sem caixa */
  mailbox: text("mailbox"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** Verificação em duas etapas (app autenticador): segredo base32, ativa desde, último passo usado */
  totpSecret: text("totp_secret"),
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  totpLastStep: integer("totp_last_step"),
  /** Hashes dos códigos de recuperação, separados por vírgula */
  recoveryCodes: text("recovery_codes").notNull().default(""),
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
  /** Aparelho e IP de onde entrou (Minha conta › Aparelhos conectados) */
  userAgent: text("user_agent"),
  ip: text("ip"),
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
  /** Imposto padrão sobre a comissão (%); vazio = não calcula */
  taxPct: real("tax_pct"),
  /** Base do imposto: total = comissão inteira (antes do repasse) · ours = só a parte da imobiliária */
  taxBase: text("tax_base", { enum: ["total", "ours"] }).notNull().default("total"),
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
      "lote_condominio",
      "terreno_comercial",
      "area",
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
  /** Observações: informações complementares do anúncio (site e ficha); vazio = não aparece */
  notes: text("notes"),
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
  /** Dados de terreno (medidas, zoneamento, vantagens…) — ver src/lib/land.ts */
  land: jsonb("land").$type<LandData>(),
  /** Imóvel de parceiro (captado por outro corretor/imobiliária) */
  videoUrl: text("video_url"),
  /** Destaque: vai primeiro (ou só ele) nas seções da home, conforme Conteúdo do site › Exibição */
  featured: boolean("featured").notNull().default(false),
  /** Selo no card do site: id de um selo de Configurações › Selos (vazio = sem selo) */
  badge: text("badge"),
  /** Texto próprio do selo neste imóvel (vazio = texto do selo) */
  badgeLabel: text("badge_label"),
  partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
  /** Corretor responsável: assina a ficha (nome, cargo e telefone do cadastro da equipe) */
  responsibleId: uuid("responsible_id").references(() => users.id, { onDelete: "set null" }),
  /** Comissão total combinada na venda/locação (%) */
  commissionPct: real("commission_pct"),
  /** Parte da comissão que vai para o parceiro (% da comissão) */
  partnerSharePct: real("partner_share_pct"),
  /** Imposto sobre a comissão deste imóvel (%) e a base (total | ours) */
  taxPct: real("tax_pct"),
  taxBase: text("tax_base", { enum: ["total", "ours"] }),
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

/** Biometria do login (passkey): uma chave pública por aparelho cadastrado em Minha conta */
export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Chave pública em base64url */
  publicKey: text("public_key").notNull(),
  counter: bigint("counter", { mode: "number" }).notNull().default(0),
  transports: jsonb("transports").$type<string[]>().notNull().default([]),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
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

/** Agenda: eventos e reuniões (com ou sem cliente), ao lado das visitas */
export const agendaEvents = pgTable("agenda_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: ["evento", "reuniao"] }).notNull().default("reuniao"),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  location: text("location"),
  notes: text("notes"),
  /** Cliente vinculado (vazio = evento livre) */
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  status: text("status", { enum: ["agendado", "realizado", "cancelado"] }).notNull().default("agendado"),
  createdBy: text("created_by"),
  remindedAt: timestamp("reminded_at", { withTimezone: true }),
  googleEventId: text("google_event_id"),
  googleEtag: text("google_etag"),
  googleSyncedAt: timestamp("google_synced_at", { withTimezone: true }),
  /** Link do Google Meet (gerado pela agenda) */
  meetUrl: text("meet_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  /** Lembrete por WhatsApp já enviado para este horário (reagendar zera) */
  remindedAt: timestamp("reminded_at", { withTimezone: true }),
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
  /** "email" ou "whatsapp" */
  channel: text("channel", { enum: ["email", "whatsapp"] }).notNull().default("email"),
  toEmail: text("to_email"),
  toPhone: text("to_phone"),
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

/**
 * WhatsApp: uma conversa por número (dígitos com DDI) em cada linha.
 * Linha "main" = número principal da empresa; as outras são o id do usuário
 * dono do número (cada um conecta o seu pelo QR code).
 */
export const waThreads = pgTable("wa_threads", {
  line: text("line").notNull().default("main"),
  phone: text("phone").notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  profileName: text("profile_name"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  /** Última mensagem do cliente — abre a janela de 24 h para responder livremente */
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  unread: integer("unread").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.line, t.phone] })]);

export const waMessages = pgTable("wa_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  line: text("line").notNull().default("main"),
  phone: text("phone").notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  type: text("type").notNull().default("text"),
  body: text("body"),
  mediaId: text("media_id"),
  mediaMime: text("media_mime"),
  waMessageId: text("wa_message_id"),
  /** received | sent | delivered | read | failed */
  status: text("status").notNull().default("received"),
  error: text("error"),
  sentBy: text("sent_by"),
  /** Quando o contato recebeu e quando leu (mensagens enviadas) */
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("wa_messages_line_wa_id_key").on(t.line, t.waMessageId)]);

/**
 * E-mail pelo Resend: cada linha é uma mensagem na caixa de um usuário (userId) ou, sem
 * dono, na caixa geral da empresa. Um e-mail para dois usuários vira duas linhas.
 */
export const mailMessages = pgTable("mail_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  fromAddr: text("from_addr").notNull(),
  fromName: text("from_name"),
  toAddrs: jsonb("to_addrs").$type<string[]>().notNull().default([]),
  ccAddrs: jsonb("cc_addrs").$type<string[]>().notNull().default([]),
  subject: text("subject").notNull().default(""),
  text: text("text"),
  html: text("html"),
  attachments: jsonb("attachments").$type<MailAttachment[]>().notNull().default([]),
  /** Message-ID do e-mail (para responder na mesma conversa) e o que ele responde */
  messageId: text("message_id"),
  inReplyTo: text("in_reply_to"),
  /** Conversa: mensagens da mesma caixa ligadas por resposta ou mesmo assunto */
  threadId: uuid("thread_id").notNull(),
  /** Id do e-mail no Resend (recebido ou enviado) */
  providerId: text("provider_id"),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  read: boolean("read").notNull().default(false),
  sentBy: text("sent_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Anexos que subiram para um e-mail ainda não enviado (apagados ao remover, cancelar ou após 24 h) */
/**
 * Senha para ver/baixar o KMZ de um imóvel no site (mapa do QR code e download). Fica fora da
 * tabela de imóveis para nunca ir junto com os dados do anúncio para o navegador.
 */
export const propertyKmzLocks = pgTable("property_kmz_locks", {
  propertyId: uuid("property_id")
    .primaryKey()
    .references(() => properties.id, { onDelete: "cascade" }),
  password: text("password").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mailUploads = pgTable("mail_uploads", {
  pathname: text("pathname").primaryKey(),
  access: text("access").notNull().default("private"),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Recebido: id do anexo no Resend. Enviado: caminho no armazenamento (id) e o acesso. */
export type MailAttachment = {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  access?: "public" | "private";
};

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
export type AgendaEvent = typeof agendaEvents.$inferSelect;
export type WaThread = typeof waThreads.$inferSelect;
export type WaMessage = typeof waMessages.$inferSelect;
export type MailMessage = typeof mailMessages.$inferSelect;
export type MarketSampleRow = typeof marketSamples.$inferSelect;
