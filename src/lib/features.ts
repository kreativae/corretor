import "server-only";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

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

/** Mantém só módulos conhecidos, como booleano. */
export function sanitizeFeatures(input: Record<string, unknown>): Features {
  const out = { ...FEATURE_DEFAULTS };
  for (const k of Object.keys(FEATURE_DEFAULTS) as (keyof Features)[]) {
    if (typeof input?.[k] === "boolean") out[k] = input[k] as boolean;
  }
  return out;
}
