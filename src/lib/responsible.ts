import "server-only";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { and, asc, eq, ne } from "drizzle-orm";

/** Equipe que pode ser responsável por um imóvel (usuários ativos, sem a gerência) */
export async function listResponsibles() {
  return (await getDb())
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), ne(users.role, "superadmin")))
    .orderBy(asc(users.name));
}

/** Id de responsável válido (usuário da equipe) ou null */
export async function sanitizeResponsible(raw: unknown): Promise<string | null> {
  const id = String(raw ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [u] = await (await getDb())
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, id), ne(users.role, "superadmin")));
  return u?.id ?? null;
}
