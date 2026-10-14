import "server-only";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitizeWatermark, WATERMARK_DEFAULTS, type WatermarkSettings } from "@/lib/watermark-settings";
import { MAP_OPTIONS_DEFAULTS, sanitizeMapOptions, type MapOptions } from "@/lib/map-options";
import { sanitizeStatCards, STAT_CARDS_DEFAULTS, type StatCards } from "@/lib/stat-cards";

/** Módulos opcionais do CRM, ligados em Configurações. */
export type Features = {
  /** Página /crm/fechados (lista e indicadores de negócios fechados) */
  closedDeals: boolean;
};

export const FEATURE_DEFAULTS: Features = { closedDeals: false };

export async function getFeatures(): Promise<Features> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "features"));
    return { ...FEATURE_DEFAULTS, ...((row?.value ?? {}) as Partial<Features>) };
  } catch {
    return FEATURE_DEFAULTS;
  }
}

export async function getStatCards(): Promise<StatCards> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "statCards"));
    return sanitizeStatCards((row?.value ?? {}) as Record<string, unknown>);
  } catch {
    return STAT_CARDS_DEFAULTS;
  }
}

export async function getMapOptions(): Promise<MapOptions> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "mapOptions"));
    return sanitizeMapOptions((row?.value ?? {}) as Record<string, unknown>);
  } catch {
    return MAP_OPTIONS_DEFAULTS;
  }
}

// Lida a cada foto servida: guarda por 1 min para não consultar o banco toda hora
let wmCache: { at: number; value: WatermarkSettings } | null = null;

export async function getWatermarkSettings(fresh = false): Promise<WatermarkSettings> {
  if (!fresh && wmCache && Date.now() - wmCache.at < 60_000) return wmCache.value;
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "watermark"));
    const value = sanitizeWatermark((row?.value ?? {}) as Record<string, unknown>);
    wmCache = { at: Date.now(), value };
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
    const [row] = await db.select().from(settings).where(eq(settings.key, "customFeatures"));
    return Array.isArray(row?.value) ? (row.value as unknown[]).filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function saveCustomFeatures(list: string[]) {
  const [row] = await db.select().from(settings).where(eq(settings.key, "customFeatures"));
  if (row) {
    await db.update(settings).set({ value: list }).where(eq(settings.key, "customFeatures"));
  } else {
    await db.insert(settings).values({ key: "customFeatures", value: list });
  }
}

/** Mensagens automáticas (WhatsApp, e-mails) com os padrões preenchidos. */
export async function getMessages() {
  const { mergeMessages } = await import("@/lib/messages");
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "messages"));
    return mergeMessages(row?.value);
  } catch {
    return mergeMessages({});
  }
}
