import "server-only";
import { dbFor, withTenant } from "@/db";
import { activities, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { connOf, TENANT_COOKIE, type Tenant } from "@/lib/tenant";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

/** Login concluído (senha e, se ativada, a verificação em duas etapas): cria a sessão na empresa */
export async function finishLogin(tenant: Tenant, user: { id: string; name: string; role: string }, how = "") {
  await withTenant(connOf(tenant), async () => {
    await createSession(user.id);
    const db = dbFor(connOf(tenant));
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "lead",
      text: `${user.name} entrou no sistema${how}.`,
    });
  });
  (await cookies()).set(TENANT_COOKIE, tenant.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // CRM é a página inicial para todos; admins acessam o painel pelo menu
  return user.role === "superadmin" ? "/gerencia" : "/crm";
}

/** Limites contra tentativa e erro de senha/código */
export const LOGIN_WINDOW_MS = 15 * 60_000;
export const LOGIN_MAX_PER_EMAIL = 5;
export const LOGIN_MAX_PER_IP = 20;

export const waitMessage = (seconds: number) =>
  `Muitas tentativas. Aguarde ${Math.max(1, Math.ceil(seconds / 60))} min e tente de novo.`;
