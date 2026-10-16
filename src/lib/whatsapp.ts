import "server-only";
import { getDb } from "@/db";
import { activities, contacts, settings, users, waMessages, waThreads, type WaMessage } from "@/db/schema";
import { noteHeader } from "@/lib/contact-notes";
import { tenantParam } from "@/lib/tenant";
import { formatPhone } from "@/lib/utils";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

/**
 * WhatsApp pela API oficial da Meta (WhatsApp Cloud API).
 * Configuração em Configurações › WhatsApp (ou variáveis WHATSAPP_* na Vercel).
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type WhatsAppProvider = "evolution" | "meta";

export type WhatsAppConfig = {
  /** evolution = QR code (Evolution API) · meta = API oficial (Cloud API) */
  provider: WhatsAppProvider;
  /** Evolution API: endereço do servidor, chave global e nome da instância */
  evolutionUrl: string;
  evolutionKey: string;
  evolutionInstance: string;
  /** Segredo na URL do webhook da Evolution (ela não assina as chamadas) */
  webhookToken: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  /** Número desconhecido vira lead no CRM */
  autoLead: boolean;
  /** E-mail para a equipe a cada lead novo vindo do WhatsApp */
  notify: boolean;
  /** Modelo aprovado para reabrir conversa fora da janela de 24 h */
  templateName: string;
  templateLang: string;
  /** Usuário dono do número principal (vazio = primeiro administrador) */
  mainOwner: string;
};

const DEFAULTS: WhatsAppConfig = {
  provider: "evolution",
  evolutionUrl: "",
  evolutionKey: "",
  evolutionInstance: "corretor",
  webhookToken: "",
  phoneNumberId: "",
  wabaId: "",
  accessToken: "",
  appSecret: "",
  verifyToken: "",
  autoLead: true,
  notify: true,
  templateName: "",
  templateLang: "pt_BR",
  mainOwner: "",
};

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  let saved: Partial<WhatsAppConfig> = {};
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "whatsapp"));
    saved = (row?.value ?? {}) as Partial<WhatsAppConfig>;
  } catch {
    /* sem banco: só variáveis */
  }
  const env = process.env;
  return {
    ...DEFAULTS,
    ...saved,
    evolutionUrl: (saved.evolutionUrl || env.EVOLUTION_API_URL || "").replace(/\/+$/, ""),
    evolutionKey: saved.evolutionKey || env.EVOLUTION_API_KEY || "",
    evolutionInstance: saved.evolutionInstance || env.EVOLUTION_INSTANCE || "corretor",
    phoneNumberId: saved.phoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID || "",
    wabaId: saved.wabaId || env.WHATSAPP_WABA_ID || "",
    accessToken: saved.accessToken || env.WHATSAPP_TOKEN || "",
    appSecret: saved.appSecret || env.WHATSAPP_APP_SECRET || "",
    verifyToken: saved.verifyToken || env.WHATSAPP_VERIFY_TOKEN || "",
  };
}

export async function saveWhatsAppConfig(input: Partial<WhatsAppConfig>) {
  const cur = await getWhatsAppConfig();
  const str = (v: unknown, max = 600) => String(v ?? "").trim().slice(0, max);
  // Segredos: campo vazio (ou mascarado) mantém o valor atual
  const secret = (v: unknown, prev: string) => {
    const s = str(v, 1000);
    return !s || s.includes("•") ? prev : s;
  };
  const next: WhatsAppConfig = {
    provider: input.provider === "meta" ? "meta" : "evolution",
    evolutionUrl: str(input.evolutionUrl, 300).replace(/\/+$/, ""),
    evolutionKey: secret(input.evolutionKey, cur.evolutionKey),
    evolutionInstance: str(input.evolutionInstance, 60).replace(/[^\w-]/g, "") || "corretor",
    webhookToken: cur.webhookToken || randomBytes(18).toString("hex"),
    phoneNumberId: str(input.phoneNumberId, 40).replace(/\D/g, ""),
    wabaId: str(input.wabaId, 40).replace(/\D/g, ""),
    accessToken: secret(input.accessToken, cur.accessToken),
    appSecret: secret(input.appSecret, cur.appSecret),
    verifyToken: str(input.verifyToken, 120) || cur.verifyToken || randomBytes(16).toString("hex"),
    autoLead: input.autoLead !== false,
    notify: input.notify !== false,
    templateName: str(input.templateName, 120).replace(/[^\w]/g, ""),
    templateLang: str(input.templateLang, 10) || "pt_BR",
    mainOwner: input.mainOwner === undefined ? cur.mainOwner : str(input.mainOwner, 40).replace(/[^0-9a-f-]/gi, ""),
  };
  const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "whatsapp"));
  if (row) await (await getDb()).update(settings).set({ value: next }).where(eq(settings.key, "whatsapp"));
  else await (await getDb()).insert(settings).values({ key: "whatsapp", value: next });
  return next;
}

/* ─────────────────────── linhas (um número por usuário) ─────────────────────── */

/**
 * Na conexão por QR code cada usuário tem o próprio número (uma instância na
 * Evolution), e as conversas ficam separadas por linha. O número principal
 * (instância configurada pelo administrador) é a linha "main", do dono
 * escolhido em Configurações. Na API oficial há um número só, compartilhado.
 */
export const MAIN_LINE = "main";

export type LineConfig = WhatsAppConfig & { line: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valor de linha recebido de fora (URL, formulário): "main" ou id de usuário */
export const parseLine = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : MAIN_LINE);

/** Números separados por usuário? (só na conexão por QR code) */
export const perUserLines = (cfg: WhatsAppConfig) => cfg.provider === "evolution";

/** Dono do número principal: o escolhido em Configurações ou o primeiro administrador */
export async function mainLineOwner(cfg: WhatsAppConfig) {
  if (cfg.mainOwner) return cfg.mainOwner;
  const [first] = await (await getDb())
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, ["superadmin", "admin"]), eq(users.active, true)))
    .orderBy(asc(users.createdAt))
    .limit(1)
    .catch(() => []);
  return first?.id ?? "";
}

/** Configuração apontando para a instância da linha */
export function forLine(cfg: WhatsAppConfig, line: string): LineConfig {
  if (line === MAIN_LINE) return { ...cfg, line };
  return { ...cfg, line, evolutionInstance: `${cfg.evolutionInstance || "corretor"}-${line.replace(/-/g, "").slice(0, 12)}` };
}

/** Linha (número) do usuário logado */
export async function lineFor(userId: string, cfg?: WhatsAppConfig): Promise<LineConfig> {
  const c = cfg ?? (await getWhatsAppConfig());
  if (!perUserLines(c)) return forLine(c, MAIN_LINE);
  return forLine(c, (await mainLineOwner(c)) === userId ? MAIN_LINE : userId);
}

const threadKey = (line: string, phone: string) => and(eq(waThreads.line, line), eq(waThreads.phone, phone));

export const mask = (s: string) => (s ? `${"•".repeat(8)}${s.slice(-4)}` : "");

export function whatsappReady(c: WhatsAppConfig) {
  return c.provider === "evolution" ? !!(c.evolutionUrl && c.evolutionKey) : !!(c.phoneNumberId && c.accessToken);
}

/* ─────────────────────── números ─────────────────────── */

/** Só dígitos; número brasileiro sem DDI ganha o 55 */
export function waPhone(raw: string) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

/** Número nacional para o cadastro do contato (sem o 55) */
export function nationalPhone(d: string) {
  return d.startsWith("55") && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
}

/**
 * Chave para achar o contato: DDD + 8 últimos dígitos. O WhatsApp às vezes
 * entrega celulares antigos sem o 9 (554399664756 x 5543999664756).
 */
function matchKey(raw: string) {
  const n = nationalPhone(String(raw ?? "").replace(/\D/g, ""));
  if (n.length < 10) return null;
  return { ddd: n.slice(0, 2), last8: n.slice(-8) };
}

export async function findContactByPhone(raw: string) {
  const key = matchKey(raw);
  if (!key) return null;
  const rows = await (await getDb())
    .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
    .from(contacts)
    .where(sql`right(regexp_replace(${contacts.phone}, '\\D', '', 'g'), 8) = ${key.last8}`);
  return rows.find((c) => matchKey(c.phone)?.ddd === key.ddd) ?? null;
}

/* ─────────────────────── API da Meta ─────────────────────── */

async function graph<T>(path: string, cfg: WhatsAppConfig, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error;
    const code = err?.code as number | undefined;
    // 131047: mais de 24 h desde a última mensagem do cliente
    if (code === 131047 || code === 131026 || /24 ?hours?|re-engagement/i.test(err?.message ?? "")) {
      throw new WhatsAppError("Fora da janela de 24 h: o cliente precisa responder antes, ou envie um modelo aprovado.", "window");
    }
    throw new WhatsAppError(err?.error_user_msg || err?.message || `WhatsApp: HTTP ${res.status}`);
  }
  return data as T;
}

export class WhatsAppError extends Error {
  constructor(
    message: string,
    public kind: "window" | "other" = "other",
  ) {
    super(message);
  }
}

/** Confere token e número: devolve o nome verificado e o número exibido */
export async function testConnection(cfg: WhatsAppConfig) {
  return graph<{ display_phone_number: string; verified_name: string; quality_rating?: string }>(
    `${cfg.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    cfg,
  );
}

type SendResult = { messages?: { id: string }[] };

async function send(cfg: WhatsAppConfig, to: string, payload: Record<string, unknown>) {
  const data = await graph<SendResult>(`${cfg.phoneNumberId}/messages`, cfg, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  return data.messages?.[0]?.id ?? null;
}

/** Envia texto e grava na conversa */
export async function sendText(cfg: LineConfig, phone: string, text: string, sentBy: string) {
  if (!whatsappReady(cfg)) throw new WhatsAppError("WhatsApp não configurado.");
  const to = waPhone(phone);
  const id =
    cfg.provider === "evolution"
      ? await evoSendText(cfg, to, text)
      : await send(cfg, to, { type: "text", text: { body: text, preview_url: true } });
  return recordOutgoing(cfg.line, to, { type: "text", body: text, waMessageId: id, sentBy });
}

/** Envia o modelo aprovado (reabre a conversa fora da janela de 24 h) */
export async function sendTemplate(cfg: LineConfig, phone: string, sentBy: string) {
  if (cfg.provider === "evolution") throw new WhatsAppError("Modelos só existem na API oficial — pela conexão por QR code a mensagem normal funciona sempre.");
  if (!whatsappReady(cfg)) throw new WhatsAppError("WhatsApp não configurado.");
  if (!cfg.templateName) throw new WhatsAppError("Cadastre o nome do modelo aprovado em Configurações › WhatsApp.");
  const to = waPhone(phone);
  const id = await send(cfg, to, {
    type: "template",
    template: { name: cfg.templateName, language: { code: cfg.templateLang || "pt_BR" } },
  });
  return recordOutgoing(cfg.line, to, { type: "template", body: `Modelo: ${cfg.templateName}`, waMessageId: id, sentBy });
}

async function recordOutgoing(
  line: string,
  phone: string,
  m: { type: string; body: string; waMessageId: string | null; sentBy: string },
) {
  const [thread] = await (await getDb()).select().from(waThreads).where(threadKey(line, phone));
  const contactId = thread?.contactId ?? (await findContactByPhone(phone))?.id ?? null;
  const [row] = await (await getDb())
    .insert(waMessages)
    .values({ line, phone, contactId, direction: "out", type: m.type, body: m.body, waMessageId: m.waMessageId, status: "sent", sentBy: m.sentBy })
    .returning();
  await (await getDb())
    .insert(waThreads)
    .values({ line, phone, contactId, lastMessage: m.body.slice(0, 200), lastMessageAt: new Date() })
    .onConflictDoUpdate({
      target: [waThreads.line, waThreads.phone],
      set: { lastMessage: m.body.slice(0, 200), lastMessageAt: new Date(), archived: false, ...(contactId ? { contactId } : {}) },
    });
  return row;
}

/** Arquivo de mídia recebida (foto, áudio, documento) */
export async function fetchMedia(cfg: LineConfig, mediaId: string) {
  if (cfg.provider === "evolution") return evoMedia(cfg, mediaId);
  const meta = await graph<{ url: string; mime_type: string }>(mediaId, cfg);
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
  if (!res.ok || !res.body) throw new WhatsAppError("Mídia indisponível.");
  return { body: res.body, type: meta.mime_type || res.headers.get("content-type") || "application/octet-stream" };
}

/* ─────────────────────── webhook ─────────────────────── */

export function validSignature(raw: string, header: string | null, appSecret: string) {
  if (!appSecret) return true; // sem App Secret configurado, não há como conferir
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Incoming = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  voice?: { id: string; mime_type?: string };
  document?: { id: string; mime_type?: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  contacts?: { name?: { formatted_name?: string } }[];
};

function describe(m: Incoming): { body: string; mediaId?: string; mime?: string } {
  switch (m.type) {
    case "text":
      return { body: m.text?.body ?? "" };
    case "image":
      return { body: m.image?.caption || "📷 Foto", mediaId: m.image?.id, mime: m.image?.mime_type };
    case "video":
      return { body: m.video?.caption || "🎬 Vídeo", mediaId: m.video?.id, mime: m.video?.mime_type };
    case "audio":
    case "voice": {
      const a = m.audio ?? m.voice;
      return { body: "🎤 Áudio", mediaId: a?.id, mime: a?.mime_type };
    }
    case "document":
      return { body: m.document?.caption || `📄 ${m.document?.filename || "Documento"}`, mediaId: m.document?.id, mime: m.document?.mime_type };
    case "sticker":
      return { body: "Figurinha", mediaId: m.sticker?.id, mime: m.sticker?.mime_type };
    case "location": {
      const l = m.location;
      return { body: l ? `📍 ${[l.name, l.address].filter(Boolean).join(" — ") || "Localização"}\nhttps://maps.google.com/?q=${l.latitude},${l.longitude}` : "📍 Localização" };
    }
    case "button":
      return { body: m.button?.text ?? "" };
    case "interactive":
      return { body: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "" };
    case "contacts":
      return { body: `👤 Contato: ${m.contacts?.[0]?.name?.formatted_name ?? ""}` };
    default:
      return { body: "Mensagem não suportada" };
  }
}

/** Processa o corpo do webhook da Meta (mensagens recebidas e status das enviadas). */
export async function handleWebhook(payload: unknown, baseUrl: string) {
  const cfg = forLine(await getWhatsAppConfig(), MAIN_LINE);
  type Value = {
    contacts?: { wa_id: string; profile?: { name?: string } }[];
    messages?: Incoming[];
    statuses?: { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string }[] }[];
  };
  const entries = (payload as { entry?: { changes?: { value?: Value }[] }[] })?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      for (const st of v.statuses ?? []) {
        const ts = Number(st.timestamp);
        await setMessageStatus(cfg.line, st.id, st.status, ts ? new Date(ts * 1000) : new Date(), st.errors?.[0]?.message || st.errors?.[0]?.title);
      }
      for (const m of v.messages ?? []) {
        const profile = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        await ingest(m, profile, cfg, baseUrl);
      }
    }
  }
}

async function ingest(m: Incoming, profileName: string | undefined, cfg: LineConfig, baseUrl: string) {
  const { body, mediaId, mime } = describe(m);
  await ingestNormalized(
    {
      phone: m.from.replace(/\D/g, ""),
      id: m.id,
      at: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
      type: m.type,
      body,
      mediaId,
      mime,
      profileName,
    },
    cfg,
    baseUrl,
  );
}

export type NormalizedMessage = {
  phone: string;
  id: string;
  at: Date;
  type: string;
  body: string;
  mediaId?: string;
  mime?: string;
  profileName?: string;
};

/** Mensagem enviada pelo próprio celular (aparece na conversa do CRM) */
export async function ingestFromMe(line: string, m: NormalizedMessage) {
  const [dup] = await (await getDb()).select({ id: waMessages.id }).from(waMessages).where(and(eq(waMessages.line, line), eq(waMessages.waMessageId, m.id)));
  if (dup) return;
  const [thread] = await (await getDb()).select().from(waThreads).where(threadKey(line, m.phone));
  const contactId = thread?.contactId ?? (await findContactByPhone(m.phone))?.id ?? null;
  await (await getDb())
    .insert(waMessages)
    .values({ line, phone: m.phone, contactId, direction: "out", type: m.type, body: m.body, mediaId: m.mediaId, mediaMime: m.mime, waMessageId: m.id, status: "sent", sentBy: "Celular", createdAt: m.at })
    .onConflictDoNothing();
  await (await getDb())
    .insert(waThreads)
    .values({ line, phone: m.phone, contactId, lastMessage: m.body.slice(0, 200), lastMessageAt: m.at })
    .onConflictDoUpdate({
      target: [waThreads.line, waThreads.phone],
      set: { lastMessage: m.body.slice(0, 200), lastMessageAt: m.at, ...(contactId ? { contactId } : {}) },
    });
}

export async function ingestNormalized(n: NormalizedMessage, cfg: LineConfig, baseUrl: string) {
  const line = cfg.line;
  const m = { id: n.id };
  const phone = n.phone;
  const at = n.at;
  const { body, mediaId, mime } = n;
  const profileName = n.profileName;

  // Mensagem repetida (a Meta reenvia em caso de falha): ignora
  const [dup] = await (await getDb()).select({ id: waMessages.id }).from(waMessages).where(and(eq(waMessages.line, line), eq(waMessages.waMessageId, m.id)));
  if (dup) return;

  const [thread] = await (await getDb()).select().from(waThreads).where(threadKey(line, phone));
  const contactId = thread?.contactId ?? (await findContactByPhone(phone))?.id ?? null;
  // Número novo não vira contato sozinho: só pelos botões da conversa
  if (contactId && (!thread?.lastInboundAt || at.getTime() - thread.lastInboundAt.getTime() > 12 * 3600_000)) {
    // Contato conhecido voltando a falar: uma linha na linha do tempo (não a cada mensagem)
    await (await getDb()).insert(activities).values({
      entity: "contato",
      entityId: contactId,
      kind: "message",
      text: `Nova conversa pelo WhatsApp: “${body.slice(0, 120)}”`,
    });
  }

  await (await getDb())
    .insert(waMessages)
    .values({ line, phone, contactId, direction: "in", type: n.type, body, mediaId, mediaMime: mime, waMessageId: m.id, status: "received", createdAt: at })
    .onConflictDoNothing();

  await (await getDb())
    .insert(waThreads)
    .values({ line, phone, contactId, profileName: profileName ?? null, lastMessage: body.slice(0, 200), lastMessageAt: at, lastInboundAt: at, unread: 1 })
    .onConflictDoUpdate({
      target: [waThreads.line, waThreads.phone],
      set: {
        ...(profileName ? { profileName } : {}),
        ...(contactId ? { contactId } : {}),
        lastMessage: body.slice(0, 200),
        lastMessageAt: at,
        lastInboundAt: at,
        unread: sql`${waThreads.unread} + 1`,
        archived: false,
      },
    });
}

/** Cria (ou vincula) o contato de uma conversa — botões "Criar lead" e "Salvar contato" */
export async function linkThreadContact(line: string, phone: string, kind: "lead" | "cliente" = "lead", opts: { name?: string; email?: string } = {}) {
  const [thread] = await (await getDb()).select().from(waThreads).where(threadKey(line, phone));
  if (!thread) throw new WhatsAppError("Conversa não encontrada.");
  if (thread.contactId) return thread.contactId;
  let contactId = (await findContactByPhone(phone))?.id ?? null;
  if (!contactId) {
    const name = opts.name?.trim() || thread.profileName?.trim() || formatPhone(nationalPhone(phone));
    const email = opts.email?.trim() || null;
    const [first] = await (await getDb())
      .select({ body: waMessages.body, createdAt: waMessages.createdAt })
      .from(waMessages)
      .where(sql`${waMessages.line} = ${line} and ${waMessages.phone} = ${phone} and ${waMessages.direction} = 'in'`)
      .orderBy(waMessages.createdAt)
      .limit(1);
    const [created] = await (await getDb())
      .insert(contacts)
      .values({
        name: name.slice(0, 120),
        phone: nationalPhone(phone),
        source: "whatsapp",
        type: kind,
        email,
        notes: first?.body ? `${noteHeader(["WhatsApp"], first.createdAt)} ${first.body}` : null,
      })
      .returning({ id: contacts.id });
    contactId = created.id;
    await (await getDb()).insert(activities).values({
      entity: "contato",
      entityId: contactId,
      kind: kind === "lead" ? "lead" : "note",
      text: kind === "lead" ? `${name} virou lead a partir de uma conversa do WhatsApp.` : `${name} foi salvo nos contatos a partir do WhatsApp.`,
    });
  }
  await (await getDb()).update(waThreads).set({ contactId }).where(threadKey(line, phone));
  await (await getDb()).update(waMessages).set({ contactId }).where(and(eq(waMessages.line, line), eq(waMessages.phone, phone)));
  return contactId;
}

/* ─────────────────────── Evolution API (QR code) ─────────────────────── */

async function evo<T>(cfg: WhatsAppConfig, path: string, init?: RequestInit): Promise<T> {
  if (!cfg.evolutionUrl || !cfg.evolutionKey) throw new WhatsAppError("Informe o endereço e a chave da Evolution API.");
  let res: Response;
  try {
    res = await fetch(`${cfg.evolutionUrl}${path}`, {
      ...init,
      headers: { apikey: cfg.evolutionKey, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new WhatsAppError("Não foi possível falar com o servidor da Evolution API. Confira o endereço.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.response?.message ?? data?.message ?? data?.error;
    throw new WhatsAppError(
      Array.isArray(msg) ? msg.flat().join(" ") : typeof msg === "string" ? msg : `Evolution API: HTTP ${res.status}`,
    );
  }
  return data as T;
}

const inst = (cfg: WhatsAppConfig) => encodeURIComponent(cfg.evolutionInstance || "corretor");

export function evolutionWebhookUrl(baseUrl: string, cfg: WhatsAppConfig, tenant?: string | null, line: string = MAIN_LINE) {
  return `${baseUrl}/api/whatsapp/evolution?token=${cfg.webhookToken}${tenant ? `&t=${tenant}` : ""}${line !== MAIN_LINE ? `&l=${line}` : ""}`;
}

const EVO_EVENTS = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"];

/** Estado da conexão: open (conectado) · connecting (aguardando QR) · close · missing (instância não existe) */
export async function evolutionState(cfg: WhatsAppConfig) {
  try {
    const d = await evo<{ instance?: { state?: string } }>(cfg, `/instance/connectionState/${inst(cfg)}`);
    const state = d.instance?.state ?? "close";
    let number: string | null = null;
    let name: string | null = null;
    if (state === "open") {
      const list = await evo<{ ownerJid?: string; profileName?: string; name?: string }[]>(
        cfg,
        `/instance/fetchInstances?instanceName=${inst(cfg)}`,
      ).catch(() => []);
      const me = Array.isArray(list) ? list[0] : null;
      number = me?.ownerJid?.split("@")[0] ?? null;
      name = me?.profileName ?? null;
    }
    return { state, number, name };
  } catch (e) {
    if (e instanceof WhatsAppError && /not.*exist|não existe|404/i.test(e.message)) return { state: "missing", number: null, name: null };
    throw e;
  }
}

/** Cria a instância (se preciso), aponta o webhook para o CRM e devolve o QR code */
export async function evolutionConnect(cfg: LineConfig, baseUrl: string, pairNumber?: string) {
  const pairQs = pairNumber ? `?number=${waPhone(pairNumber)}` : "";
  const webhook = { enabled: true, url: evolutionWebhookUrl(baseUrl, cfg, await tenantParam(), cfg.line), byEvents: false, base64: false, events: EVO_EVENTS };
  const { state } = await evolutionState(cfg);
  type QrResp = { base64?: string; code?: string; pairingCode?: string; qrcode?: { base64?: string; pairingCode?: string } };
  if (state === "missing") {
    const created = await evo<QrResp>(cfg, "/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: cfg.evolutionInstance || "corretor",
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        webhook,
      }),
    });
    if (created.qrcode?.base64 && !pairNumber) return { state: "connecting", qr: created.qrcode.base64, pairingCode: created.qrcode.pairingCode ?? null };
  } else {
    await evo(cfg, `/webhook/set/${inst(cfg)}`, { method: "POST", body: JSON.stringify({ webhook }) }).catch(() => undefined);
    if (state === "open") return { state: "open", qr: null, pairingCode: null };
  }
  // O QR leva alguns segundos para ser gerado: tenta por até ~12 s
  for (let i = 0; i < 6; i++) {
    const qr = await evo<QrResp>(cfg, `/instance/connect/${inst(cfg)}${pairQs}`);
    const base64 = qr.base64 ?? qr.qrcode?.base64;
    const pairingCode = qr.pairingCode ?? qr.qrcode?.pairingCode ?? null;
    if (pairNumber && pairingCode) return { state: "connecting", qr: base64 ?? null, pairingCode };
    if (base64 && !pairNumber) return { state: "connecting", qr: base64, pairingCode };
    const now = await evolutionState(cfg).catch(() => null);
    if (now?.state === "open") return { state: "open", qr: null, pairingCode: null };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { state: "connecting", qr: null, pairingCode: null };
}

export async function evolutionLogout(cfg: WhatsAppConfig) {
  await evo(cfg, `/instance/logout/${inst(cfg)}`, { method: "DELETE" });
}

async function evoSendText(cfg: WhatsAppConfig, to: string, text: string) {
  const d = await evo<{ key?: { id?: string } }>(cfg, `/message/sendText/${inst(cfg)}`, {
    method: "POST",
    body: JSON.stringify({ number: to, text, linkPreview: true }),
  });
  return d.key?.id ?? null;
}

/** Envia arquivo (foto ou PDF) por URL pública */
export async function sendMediaUrl(cfg: LineConfig, phone: string, url: string, opts: { caption?: string; fileName?: string; mime?: string; sentBy: string }) {
  if (cfg.provider !== "evolution") throw new WhatsAppError("Envio de arquivos disponível na conexão por QR code.");
  const to = waPhone(phone);
  const mediatype = (opts.mime ?? "").startsWith("image/") ? "image" : "document";
  const d = await evo<{ key?: { id?: string } }>(cfg, `/message/sendMedia/${inst(cfg)}`, {
    method: "POST",
    body: JSON.stringify({ number: to, mediatype, mimetype: opts.mime, caption: opts.caption ?? "", media: url, fileName: opts.fileName }),
  });
  return recordOutgoing(cfg.line, to, {
    type: mediatype,
    body: opts.caption || (mediatype === "image" ? "📷 Foto" : `📄 ${opts.fileName ?? "Arquivo"}`),
    waMessageId: d.key?.id ?? null,
    sentBy: opts.sentBy,
  });
}

async function evoMedia(cfg: WhatsAppConfig, messageId: string) {
  const d = await evo<{ base64?: string; mimetype?: string }>(cfg, `/chat/getBase64FromMediaMessage/${inst(cfg)}`, {
    method: "POST",
    body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
  });
  if (!d.base64) throw new WhatsAppError("Mídia indisponível.");
  const buf = Buffer.from(d.base64.replace(/^data:[^,]+,/, ""), "base64");
  return { body: new Blob([new Uint8Array(buf)]).stream(), type: d.mimetype || "application/octet-stream" };
}

type EvoKey = { id?: string; remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean };
type EvoMessage = Record<string, unknown> & {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; mimetype?: string };
  videoMessage?: { caption?: string; mimetype?: string };
  audioMessage?: { mimetype?: string };
  documentMessage?: { caption?: string; fileName?: string; mimetype?: string };
  documentWithCaptionMessage?: { message?: { documentMessage?: { caption?: string; fileName?: string; mimetype?: string } } };
  stickerMessage?: { mimetype?: string };
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string; address?: string };
  contactMessage?: { displayName?: string };
  buttonsResponseMessage?: { selectedDisplayText?: string };
  listResponseMessage?: { title?: string };
  reactionMessage?: unknown;
  protocolMessage?: unknown;
};

/** Número real do remetente (contas novas chegam como @lid) */
function jidPhone(key: EvoKey, data: Record<string, unknown>) {
  const jid = key.remoteJid ?? "";
  if (!jid || jid.endsWith("@g.us") || jid.includes("broadcast") || jid.endsWith("@newsletter")) return null;
  if (jid.endsWith("@lid")) {
    const alt = key.senderPn || key.remoteJidAlt || (data.senderPn as string | undefined);
    return alt ? alt.split("@")[0].replace(/\D/g, "") : null;
  }
  return jid.split("@")[0].replace(/\D/g, "");
}

function describeEvo(m: EvoMessage): { type: string; body: string; media: boolean; mime?: string } | null {
  if (!m || m.reactionMessage || m.protocolMessage) return null;
  if (m.conversation) return { type: "text", body: m.conversation, media: false };
  if (m.extendedTextMessage) return { type: "text", body: m.extendedTextMessage.text ?? "", media: false };
  if (m.imageMessage) return { type: "image", body: m.imageMessage.caption || "📷 Foto", media: true, mime: m.imageMessage.mimetype };
  if (m.videoMessage) return { type: "video", body: m.videoMessage.caption || "🎬 Vídeo", media: true, mime: m.videoMessage.mimetype };
  if (m.audioMessage) return { type: "audio", body: "🎤 Áudio", media: true, mime: m.audioMessage.mimetype };
  const doc = m.documentMessage ?? m.documentWithCaptionMessage?.message?.documentMessage;
  if (doc) return { type: "document", body: doc.caption || `📄 ${doc.fileName || "Documento"}`, media: true, mime: doc.mimetype };
  if (m.stickerMessage) return { type: "sticker", body: "Figurinha", media: true, mime: m.stickerMessage.mimetype };
  if (m.locationMessage) {
    const l = m.locationMessage;
    return {
      type: "location",
      body: `📍 ${[l.name, l.address].filter(Boolean).join(" — ") || "Localização"}\nhttps://maps.google.com/?q=${l.degreesLatitude},${l.degreesLongitude}`,
      media: false,
    };
  }
  if (m.contactMessage) return { type: "contacts", body: `👤 Contato: ${m.contactMessage.displayName ?? ""}`, media: false };
  if (m.buttonsResponseMessage) return { type: "text", body: m.buttonsResponseMessage.selectedDisplayText ?? "", media: false };
  if (m.listResponseMessage) return { type: "text", body: m.listResponseMessage.title ?? "", media: false };
  return { type: "other", body: "Mensagem não suportada", media: false };
}

const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/**
 * Atualiza o status de uma mensagem enviada sem voltar atrás (um "entregue" atrasado
 * não desfaz o "lida") e guarda o horário de entrega e de leitura.
 */
async function setMessageStatus(line: string, waMessageId: string, status: string, at: Date, error?: string) {
  const where = and(eq(waMessages.line, line), eq(waMessages.waMessageId, waMessageId));
  if (status === "failed") {
    await (await getDb()).update(waMessages).set({ status, error: error || null }).where(where);
    return;
  }
  const rank = STATUS_RANK[status];
  if (!rank) return;
  const ranks = Object.entries(STATUS_RANK)
    .filter(([, r]) => r < rank)
    .map(([s]) => s);
  await (await getDb())
    .update(waMessages)
    .set({
      status: sql`case when ${waMessages.status} = any(${sql.raw(`array[${ranks.map((r) => `'${r}'`).join(",") || "''"}]`)}) then ${status} else ${waMessages.status} end`,
      ...(rank >= 2 ? { deliveredAt: sql`coalesce(${waMessages.deliveredAt}, ${at.toISOString()}::timestamptz)` } : {}),
      ...(rank >= 3 ? { readAt: sql`coalesce(${waMessages.readAt}, ${at.toISOString()}::timestamptz)` } : {}),
    })
    .where(where);
}

const EVO_STATUS: Record<string, string> = {
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
  ERROR: "failed",
};

/** Eventos da Evolution API (mensagens recebidas, enviadas pelo celular e status) */
export async function handleEvolutionWebhook(payload: unknown, baseUrl: string, line: string = MAIN_LINE) {
  const cfg = forLine(await getWhatsAppConfig(), line);
  const p = payload as { event?: string; data?: unknown };
  const event = String(p?.event ?? "").toLowerCase().replace(/_/g, ".");
  const items = Array.isArray(p?.data) ? p.data : p?.data ? [p.data] : [];

  if (event === "messages.upsert") {
    for (const raw of items as Record<string, unknown>[]) {
      const key = (raw.key ?? {}) as EvoKey;
      // Contato (ou o próprio celular) apagou para todos: mostra o aviso no lugar
      const proto = (raw.message as EvoMessage | undefined)?.protocolMessage as
        | { type?: string | number; key?: { id?: string } }
        | undefined;
      if (proto && (proto.type === "REVOKE" || proto.type === 0) && proto.key?.id) {
        await markDeleted(and(eq(waMessages.line, line), eq(waMessages.waMessageId, proto.key.id)));
        continue;
      }
      const phone = jidPhone(key, raw);
      const d = describeEvo(raw.message as EvoMessage);
      if (!phone || !key.id || !d) continue;
      const ts = Number(raw.messageTimestamp);
      const n: NormalizedMessage = {
        phone,
        id: key.id,
        at: ts ? new Date(ts * 1000) : new Date(),
        type: d.type,
        body: d.body,
        mediaId: d.media ? key.id : undefined,
        mime: d.mime,
        profileName: key.fromMe ? undefined : (raw.pushName as string | undefined),
      };
      if (key.fromMe) await ingestFromMe(line, n);
      else await ingestNormalized(n, cfg, baseUrl);
    }
  } else if (event === "messages.update") {
    for (const raw of items as Record<string, unknown>[]) {
      const id = (raw.keyId as string) ?? ((raw.key as EvoKey | undefined)?.id) ?? (raw.messageId as string);
      const rawStatus = String(raw.status ?? "").toUpperCase();
      if (id && rawStatus === "DELETED") {
        await markDeleted(and(eq(waMessages.line, line), eq(waMessages.waMessageId, id)));
        continue;
      }
      const status = EVO_STATUS[rawStatus];
      if (id && status) await setMessageStatus(line, id, status, new Date());
    }
  }
}

/* ─────────────────────── Apagar mensagens ─────────────────────── */

export const DELETED_TYPE = "deleted";
const DELETED_BODY = "🚫 Mensagem apagada";
/** O WhatsApp aceita "apagar para todos" por cerca de 2 dias e meio; 2 dias por segurança */
export const REVOKE_WINDOW_MS = 48 * 3600_000;

/** Último texto da conversa depois de apagar uma mensagem */
async function refreshThreadPreview(line: string, phone: string) {
  const [last] = await (await getDb())
    .select({ body: waMessages.body, createdAt: waMessages.createdAt })
    .from(waMessages)
    .where(and(eq(waMessages.line, line), eq(waMessages.phone, phone)))
    .orderBy(desc(waMessages.createdAt))
    .limit(1);
  await (await getDb())
    .update(waThreads)
    .set({ lastMessage: last?.body?.slice(0, 200) ?? null, ...(last ? { lastMessageAt: last.createdAt } : {}) })
    .where(threadKey(line, phone));
}

/** Troca o conteúdo pelo aviso de apagada (fica o registro na conversa) */
async function markDeleted(where: SQL | undefined) {
  const rows = await (await getDb())
    .update(waMessages)
    .set({ type: DELETED_TYPE, body: DELETED_BODY, mediaId: null, mediaMime: null, error: null })
    .where(where)
    .returning();
  for (const key of new Set(rows.map((r) => `${r.line}|${r.phone}`))) {
    const [line, phone] = key.split("|");
    await refreshThreadPreview(line, phone);
  }
  return rows[0] ?? null;
}

/** Pode apagar para todos: enviada pelo CRM/celular, com id do WhatsApp, dentro do prazo */
export function canRevoke(m: Pick<WaMessage, "direction" | "waMessageId" | "type" | "status" | "createdAt">, provider: string) {
  return (
    provider === "evolution" &&
    m.direction === "out" &&
    !!m.waMessageId &&
    m.type !== DELETED_TYPE &&
    m.status !== "failed" &&
    Date.now() - new Date(m.createdAt).getTime() < REVOKE_WINDOW_MS
  );
}

/**
 * Apaga uma mensagem. "all": apaga no WhatsApp do contato também (só enviadas,
 * conexão por QR code) e deixa o aviso na conversa. "me": tira só do CRM.
 */
export async function deleteMessage(cfg: LineConfig, id: string, scope: "all" | "me") {
  const [m] = await (await getDb()).select().from(waMessages).where(and(eq(waMessages.id, id), eq(waMessages.line, cfg.line)));
  if (!m) throw new WhatsAppError("Mensagem não encontrada.");
  if (scope === "me") {
    await (await getDb()).delete(waMessages).where(eq(waMessages.id, id));
    await refreshThreadPreview(m.line, m.phone);
    return { deleted: true as const, message: null };
  }
  if (!canRevoke(m, cfg.provider)) {
    throw new WhatsAppError(
      cfg.provider !== "evolution"
        ? "A API oficial do WhatsApp não permite apagar para todos. Use \"Apagar só no CRM\"."
        : m.direction !== "out"
          ? "Só dá para apagar para todos as mensagens enviadas por vocês."
          : "Passou o prazo do WhatsApp para apagar para todos (cerca de 2 dias).",
    );
  }
  await evo(cfg, `/chat/deleteMessageForEveryone/${inst(cfg)}`, {
    method: "DELETE",
    body: JSON.stringify({ id: m.waMessageId, remoteJid: `${m.phone}@s.whatsapp.net`, fromMe: true }),
  });
  return { deleted: false as const, message: await markDeleted(eq(waMessages.id, id)) };
}
