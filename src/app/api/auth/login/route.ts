import { dbFor, withTenant } from "@/db";
import { activities, users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { connOf, listTenants, TENANT_COOKIE, type Tenant } from "@/lib/tenant";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Login único para todas as empresas: procura o e-mail em cada empresa
 * (a principal primeiro) e entra naquela em que a senha confere.
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Informe e-mail e senha." },
        { status: 400 },
      );
    }
    const addr = String(email).trim().toLowerCase();

    const tenants = await listTenants(true);
    let found: { tenant: Tenant; user: typeof users.$inferSelect } | null = null;
    let inactive = false;
    for (const tenant of tenants) {
      const [user] = await dbFor(connOf(tenant))
        .select()
        .from(users)
        .where(eq(users.email, addr))
        .catch(() => [] as (typeof users.$inferSelect)[]);
      if (!user || !verifyPassword(String(password), user.passwordHash)) continue;
      if (!user.active) {
        inactive = true;
        continue;
      }
      found = { tenant, user };
      break;
    }

    if (!found) {
      return NextResponse.json(
        inactive ? { error: "Conta desativada. Fale com o administrador." } : { error: "E-mail ou senha incorretos." },
        { status: inactive ? 403 : 401 },
      );
    }
    const { tenant, user } = found;

    // Sessão no banco da empresa + cookie com a empresa escolhida
    await withTenant(connOf(tenant), async () => {
      await createSession(user.id);
      const db = dbFor(connOf(tenant));
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      await db.insert(activities).values({
        entity: "sistema",
        entityId: null,
        kind: "lead",
        text: `${user.name} entrou no sistema.`,
      });
    });
    (await cookies()).set(TENANT_COOKIE, tenant.slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({
      ok: true,
      user: { name: user.name, role: user.role },
      // CRM é a página inicial para todos; admins acessam o painel pelo menu
      redirect: user.role === "superadmin" ? "/gerencia" : "/crm",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao autenticar." }, { status: 500 });
  }
}
