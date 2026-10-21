import "server-only";
import { currentConn, dbFor, getDb } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitizeWatermark, WATERMARK_DEFAULTS, type WatermarkSettings } from "@/lib/watermark-settings";
import { REMINDER_DEFAULTS, sanitizeReminders, type ReminderSettings } from "@/lib/reminder-settings";
import { BADGE_DEFAULTS, sanitizeBadges, type BadgeSettings } from "@/lib/badges";
import { MAP_OPTIONS_DEFAULTS, sanitizeMapOptions, type MapOptions } from "@/lib/map-options";
import { sanitizeStatCards, STAT_CARDS_DEFAULTS, type StatCards } from "@/lib/stat-cards";
import { sanitizeSecurity, SECURITY_DEFAULTS, type SecuritySettings } from "@/lib/security-settings";

/** Módulos opcionais do CRM, ligados em Configurações. */
export type Features = {
  /** Página /crm/fechados (lista e indicadores de negócios fechados) */
  closedDeals: boolean;
};

export const FEATURE_DEFAULTS: Features = { closedDeals: false };

export async function getFeatures(): Promise<Features> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "features"));
    return { ...FEATURE_DEFAULTS, ...((row?.value ?? {}) as Partial<Features>) };
  } catch {
    return FEATURE_DEFAULTS;
  }
}

export async function getStatCards(): Promise<StatCards> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "statCards"));
    return sanitizeStatCards((row?.value ?? {}) as Record<string, unknown>);
  } catch {
    return STAT_CARDS_DEFAULTS;
  }
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "reminders"));
    return row ? sanitizeReminders(row.value as Record<string, unknown>) : REMINDER_DEFAULTS;
  } catch {
    return REMINDER_DEFAULTS;
  }
}

export async function getBadgeSettings(): Promise<BadgeSettings> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "badges"));
    return row ? sanitizeBadges(row.value as Record<string, unknown>) : BADGE_DEFAULTS;
  } catch {
    return BADGE_DEFAULTS;
  }
}

export async function getMapOptions(): Promise<MapOptions> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "mapOptions"));
    return sanitizeMapOptions((row?.value ?? {}) as Record<string, unknown>);
  } catch {
    return MAP_OPTIONS_DEFAULTS;
  }
}

// Lida a cada foto servida: guarda por 1 min (por empresa) para não consultar o banco toda hora
const wmCache = new Map<string, { at: number; value: WatermarkSettings }>();

export async function getWatermarkSettings(fresh = false): Promise<WatermarkSettings> {
  const conn = await currentConn();
  const hit = wmCache.get(conn.schema);
  if (!fresh && hit && Date.now() - hit.at < 60_000) return hit.value;
  try {
    const [row] = await dbFor(conn).select().from(settings).where(eq(settings.key, "watermark"));
    const value = sanitizeWatermark((row?.value ?? {}) as Record<string, unknown>);
    wmCache.set(conn.schema, { at: Date.now(), value });
    return value;
  } catch {
    return WATERMARK_DEFAULTS;
  }
}

/** Mantém só módulos conhecidos, como booleano. */
export function sanitizeFeatures(input: Record<string, unknown>): Features {
  const out = { ...FEATURE_DEFAULTS };
  for (const k of Object.keys(FEATURE_DEFAULTS) as (keyof Features)[]) {
    if (typeof input?.[k] === "boolean") out[k] = input[k] as boolean;
  }
  return out;
}

/** Comodidades extras cadastradas pela equipe (somam-se às de FEATURES). */
export async function getCustomFeatures(): Promise<string[]> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "customFeatures"));
    return Array.isArray(row?.value) ? (row.value as unknown[]).filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function saveCustomFeatures(list: string[]) {
  const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "customFeatures"));
  if (row) {
    await (await getDb()).update(settings).set({ value: list }).where(eq(settings.key, "customFeatures"));
  } else {
    await (await getDb()).insert(settings).values({ key: "customFeatures", value: list });
  }
}

/** Mensagens automáticas (WhatsApp, e-mails) com os padrões preenchidos. */
export async function getMessages() {
  const { mergeMessages } = await import("@/lib/messages");
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "messages"));
    return mergeMessages(row?.value);
  } catch {
    return mergeMessages({});
  }
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "security"));
    return sanitizeSecurity((row?.value ?? {}) as Record<string, unknown>);
  } catch {
    return SECURITY_DEFAULTS;
  }
}
