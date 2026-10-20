import "server-only";
import { controlDb, getDb } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";
import { isAdmin, isSuperadmin } from "./roles";
import { isMainTenant } from "./tenant";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "imob_session";
const SESSION_DAYS = 7;

/**
 * Controle de acesso por ambiente.
 * AUTH_OPEN=1 (só desenvolvimento) → painéis abertos, agindo como admin logado
 * qualquer outro valor (padrão)    → login obrigatório + RBAC por papel
 * Espelhar a mesma variável em src/middleware.ts.
 */
export const AUTH_TEMP_DISABLED = process.env.AUTH_OPEN === "1";

/* ─────────────────────── Senhas ─────────────────────── */

export { hashPassword, verifyPassword };

/* ─────────────────────── Sessões ─────────────────────── */

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent")?.slice(0, 300) || null;
  await (await getDb()).insert(sessions).values({ token, userId, expiresAt, ip, userAgent });

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
    await (await getDb()).delete(sessions).where(eq(sessions.token, token));
    // Gerência em outra empresa: a sessão fica no banco principal
    await controlDb.delete(sessions).where(eq(sessions.token, token)).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "creci" | "phone" | "lastLoginAt"
>;

/** Usuário da sessão (cookie), se houver */
async function sessionUser(fromControl = false): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const rows = await (fromControl ? controlDb : await getDb())
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        creci: users.creci,
        phone: users.phone,
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
    if (!u || !u.active) {
      // Gerência navegando em outra empresa: a sessão dela fica no banco principal
      if (!fromControl && !(await isMainTenant())) {
        const g = await sessionUser(true);
        return isSuperadmin(g) ? g : null;
      }
      return null;
    }
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      creci: u.creci,
      phone: u.phone,
      lastLoginAt: u.lastLoginAt,
    };
  } catch {
    return null;
  }
}

/** Só quem fez login de verdade (ignora o acesso liberado do AUTH_OPEN). */
export async function loggedUser(): Promise<SessionUser | null> {
  return sessionUser();
}

/** Usuário logado (ou null). Seguro para usar em layouts/páginas. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // Acesso liberado: quem fez login continua sendo quem é (ex.: gerência);
  // sem sessão, opera como o primeiro administrador da base
  // Empresas criadas pela gerência sempre exigem login
  if (AUTH_TEMP_DISABLED && (await isMainTenant())) {
    const logged = await sessionUser();
    if (logged) return logged;
    try {
      const [admin] = await (await getDb())
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          creci: users.creci,
          phone: users.phone,
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
      name: "Administrador",
      email: "",
      role: "admin",
      creci: null,
      phone: null,
      lastLoginAt: null,
    };
  }
  return sessionUser();
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
  if (!isAdmin(user)) redirect("/crm?forbidden=1");
  return user;
}

/** Exige gerência (sempre com login real, mesmo com o acesso liberado). */
export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await superadminSession();
  if (!isSuperadmin(user)) redirect("/gerencia/entrar");
  return user as SessionUser;
}

/** Gerência logada (para APIs) ou null */
export async function getSuperadmin(): Promise<SessionUser | null> {
  return superadminSession();
}

/** Sessão de gerência (sempre no banco principal, em qualquer empresa) */
async function superadminSession(): Promise<SessionUser | null> {
  const user = await sessionUser(true);
  return isSuperadmin(user) ? user : null;
}

/** Cookie que marca o navegador de quem usa o painel (modo de acesso liberado). */
export const CRM_MARK_COOKIE = "imob_crm";

/**
 * Quem vê a barra de edição no site público. Com login ativo, é a sessão real.
 * Com o acesso liberado (AUTH_OPEN), todos "estão logados" — então só mostra
 * para o navegador que já abriu o painel (cookie marcado pelo middleware).
 */
export async function getSiteEditor(): Promise<SessionUser | null> {
  if (AUTH_TEMP_DISABLED) {
    const jar = await cookies();
    if (!jar.has(CRM_MARK_COOKIE)) return null;
  }
  return getCurrentUser();
}
