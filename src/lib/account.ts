import "server-only";
import { db } from "@/db";
import { properties, settings } from "@/db/schema";
import { ACCOUNT_DEFAULTS, sanitizeAccount, type Account, type ModuleKey } from "@/lib/modules";
import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

/** Conta do cliente (gerência): situação, plano, limites e módulos liberados */
export async function getAccount(): Promise<Account> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "account"));
    return row ? sanitizeAccount(row.value as Record<string, unknown>) : ACCOUNT_DEFAULTS;
  } catch {
    return ACCOUNT_DEFAULTS;
  }
}

export async function saveAccount(input: Record<string, unknown>) {
  const next = sanitizeAccount(input);
  const [row] = await db.select().from(settings).where(eq(settings.key, "account"));
  if (row) await db.update(settings).set({ value: next }).where(eq(settings.key, "account"));
  else await db.insert(settings).values({ key: "account", value: next });
  return next;
}

/** Página de um módulo bloqueado pela gerência não existe para o cliente */
export async function requireModule(key: ModuleKey) {
  const acct = await getAccount();
  if (!acct.modules[key]) notFound();
}

/** Mensagem de erro quando o plano já atingiu o limite de imóveis (ou null) */
export async function propertyLimitError(): Promise<string | null> {
  const acct = await getAccount();
  if (!acct.maxProperties) return null;
  const [{ n }] = await db.select({ n: count() }).from(properties);
  return n >= acct.maxProperties
    ? `Seu plano permite até ${acct.maxProperties} imóveis cadastrados. Exclua algum ou fale com o suporte para ampliar.`
    : null;
}
