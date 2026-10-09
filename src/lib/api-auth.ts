import "server-only";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const SCOPE_RANK = { leitura: 1, escrita: 2, total: 3 } as const;
type Scope = keyof typeof SCOPE_RANK;

export type ApiCaller =
  | { kind: "user"; user: SessionUser }
  | { kind: "key"; keyId: string; label: string };

/** Lê a chave de `x-api-key` ou `Authorization: Bearer <chave>`. */
function readKey(req: Request) {
  const header = req.headers.get("x-api-key") ?? req.headers.get("authorization") ?? "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

/**
 * Autoriza chamadas às rotas internas: sessão logada ou chave de API
 * (gerada em Admin → Configurações) com escopo suficiente.
 */
export async function apiAuth(req: Request, need: Scope = "leitura"): Promise<ApiCaller | null> {
  const user = await getCurrentUser();
  if (user) return { kind: "user", user };

  const fullKey = readKey(req);
  if (!fullKey) return null;
  // Formato: <prefixo>_<segredo hex>
  const secret = fullKey.slice(fullKey.lastIndexOf("_") + 1);
  if (!/^[0-9a-f]{48}$/.test(secret)) return null;

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.secret, secret), eq(apiKeys.revoked, false)))
    .limit(1);
  if (!key) return null;
  const expected = Buffer.from(`${key.prefix}_${key.secret}`);
  const given = Buffer.from(fullKey);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (SCOPE_RANK[key.scope] < SCOPE_RANK[need]) return null;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  return { kind: "key", keyId: key.id, label: key.label };
}

/** Exige usuário logado (sem redirecionar — rotas de API respondem 401). */
export async function apiUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

export function unauthorized() {
  return NextResponse.json({ error: "Não autorizado. Faça login novamente." }, { status: 401 });
}
