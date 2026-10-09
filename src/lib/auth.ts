import "server-only";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "imob_session";
const SESSION_DAYS = 7;

/**
 * Controle de acesso por ambiente.
 * AUTH_OPEN=1 (padrão atual) → painéis abertos, agindo como admin logado
 * AUTH_OPEN=0 (produção)     → login obrigatório + RBAC por papel
 * Espelhar a mesma variável em src/middleware.ts.
 */
export const AUTH_TEMP_DISABLED = process.env.AUTH_OPEN !== "0";

/* ─────────────────────── Senhas ─────────────────────── */

export { hashPassword, verifyPassword };

/* ─────────────────────── Sessões ─────────────────────── */

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(sessions).values({ token, userId, expiresAt });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "creci" | "lastLoginAt"
>;

/** Usuário logado (ou null). Seguro para usar em layouts/páginas. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // Acesso liberado: opera como o primeiro administrador da base
  if (AUTH_TEMP_DISABLED) {
    try {
      const [admin] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          creci: users.creci,
        })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);
      if (admin) return { ...admin, lastLoginAt: null };
    } catch {
      /* segue para o fallback */
    }
    return {
      id: "temp-admin",
      name: "Marina Duarte",
      email: "marina@nordimoveis.com.br",
      role: "admin",
      creci: "112.334-F",
      lastLoginAt: null,
    };
  }

  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        creci: users.creci,
        lastLoginAt: users.lastLoginAt,
        active: users.active,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
      )
      .limit(1);

    const u = rows[0];
    if (!u || !u.active) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      creci: u.creci,
      lastLoginAt: u.lastLoginAt,
    };
  } catch {
    return null;
  }
}

/** Exige login — redireciona para /login mantendo o destino. */
export async function requireUser(from?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(from ? `/login?next=${encodeURIComponent(from)}` : "/login");
  }
  return user;
}

/** Exige papel de administrador. */
export async function requireAdmin(from?: string): Promise<SessionUser> {
  const user = await requireUser(from);
  if (user.role !== "admin") redirect("/crm?forbidden=1");
  return user;
}
