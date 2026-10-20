import "server-only";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

/**
 * Conexão com o Grupo OLX (ZAP Imóveis, Viva Real e OLX), configurada no Canal Pro:
 * - anúncios: o portal lê o feed XML (/api/feed.xml) de tempos em tempos;
 * - leads: o portal envia cada contato para /api/portais/leads?token=… e ele cai no CRM.
 * Aqui ficam o token dos leads e o registro da última leitura do feed / último lead.
 */
export type PortalConnect = {
  token: string;
  /** Última leitura do feed por um portal (data ISO e quem leu) */
  feedReadAt: string;
  feedReader: string;
  /** Último lead recebido de portal */
  leadAt: string;
  leadCount: number;
};

const KEY = "portalConnect";
const EMPTY: PortalConnect = { token: "", feedReadAt: "", feedReader: "", leadAt: "", leadCount: 0 };

export async function getPortalConnect(): Promise<PortalConnect> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, KEY));
    return { ...EMPTY, ...((row?.value ?? {}) as Partial<PortalConnect>) };
  } catch {
    return EMPTY;
  }
}

async function save(next: PortalConnect) {
  const db = await getDb();
  const [row] = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, KEY));
  if (row) await db.update(settings).set({ value: next }).where(eq(settings.key, KEY));
  else await db.insert(settings).values({ key: KEY, value: next });
}

/** Token dos leads (cria na primeira vez) */
export async function ensurePortalToken() {
  const cur = await getPortalConnect();
  if (cur.token) return cur;
  const next = { ...cur, token: randomBytes(18).toString("base64url") };
  await save(next);
  return next;
}

export async function rotatePortalToken() {
  const next = { ...(await getPortalConnect()), token: randomBytes(18).toString("base64url") };
  await save(next);
  return next;
}

/** Quem está lendo o feed, pelo navegador/robô que pediu */
export function portalFromAgent(ua: string) {
  if (/zap|vivareal|grupo ?zap|olx|canalpro/i.test(ua)) return "Grupo OLX (ZAP, Viva Real, OLX)";
  if (/imovelweb|wimoveis/i.test(ua)) return "Imovelweb";
  if (/chavesnamao/i.test(ua)) return "Chaves na Mão";
  return "";
}

/** Registra a leitura do feed por um portal (no máximo 1 gravação a cada 10 min) */
export async function markFeedRead(reader: string) {
  const cur = await getPortalConnect();
  if (cur.feedReadAt && Date.now() - Date.parse(cur.feedReadAt) < 10 * 60_000 && cur.feedReader === reader) return;
  await save({ ...cur, feedReadAt: new Date().toISOString(), feedReader: reader });
}

export async function markPortalLead() {
  const cur = await getPortalConnect();
  await save({ ...cur, leadAt: new Date().toISOString(), leadCount: cur.leadCount + 1 });
}
