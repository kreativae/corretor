import { dbFor, DEFAULT_SCHEMA } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth";
import { finishLogin, LOGIN_MAX_PER_EMAIL, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS, waitMessage } from "@/lib/login";
import { addHit, clearHits, clientIp, countHits, retryAfter } from "@/lib/rate-limit";
import { connOf, listTenants, type Tenant } from "@/lib/tenant";
import { PENDING_2FA_COOKIE, PENDING_2FA_SECONDS, pendingToken } from "@/lib/two-factor";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Login único para todas as empresas: procura o e-mail em cada empresa
 * (a principal primeiro) e entra naquela em que a senha confere.
 * Limite de tentativas por e-mail e por IP; com duas etapas ativadas, pede o código do app.
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
    const byEmail = `login:email:${addr}`;
    const byIp = `login:ip:${clientIp(req)}`;
    for (const [key, max] of [[byEmail, LOGIN_MAX_PER_EMAIL], [byIp, LOGIN_MAX_PER_IP]] as const) {
      if (countHits(key, LOGIN_WINDOW_MS) >= max) {
        const wait = retryAfter(key, LOGIN_WINDOW_MS);
        return NextResponse.json({ error: waitMessage(wait) }, { status: 429, headers: { "Retry-After": String(wait) } });
      }
    }

    // No domínio de uma empresa, procura nela primeiro (e-mail igual em duas empresas)
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
      .split(",")[0]
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, "")
      .replace(/^www\./, "");
    const all = await listTenants(true);
    const hostTenant = host ? all.find((t) => t.domains.includes(host)) : undefined;
    const tenants = hostTenant ? [hostTenant, ...all.filter((t) => t !== hostTenant)] : all;
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
      addHit(byEmail);
      addHit(byIp);
      return NextResponse.json(
        inactive ? { error: "Conta desativada. Fale com o administrador." } : { error: "E-mail ou senha incorretos." },
        { status: inactive ? 403 : 401 },
      );
    }
    clearHits(byEmail);
    const { tenant, user } = found;

    // Conta de outra empresa no domínio desta: a sessão não valeria aqui (cookie por domínio).
    // Avisa e manda para o endereço certo (a gerência entra em qualquer domínio).
    if (hostTenant && tenant.slug !== hostTenant.slug && user.role !== "superadmin") {
      const url = tenant.domains[0]
        ? `https://www.${tenant.domains[0]}/login`
        : tenant.schemaName === DEFAULT_SCHEMA && process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/login`
          : null;
      return NextResponse.json(
        {
          error: url
            ? `Esta conta é de ${tenant.name}. Abrindo o endereço certo…`
            : `Esta conta é de ${tenant.name}. Entre pelo endereço dessa empresa.`,
          url,
        },
        { status: 409 },
      );
    }

    // Duas etapas: a sessão só nasce depois do código do app (/api/auth/2fa)
    if (user.totpEnabledAt && user.totpSecret) {
      (await cookies()).set(PENDING_2FA_COOKIE, pendingToken(user.id, tenant.slug), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: PENDING_2FA_SECONDS,
      });
      return NextResponse.json({ ok: true, twoFactor: true });
    }

    const redirect = await finishLogin(tenant, user);
    return NextResponse.json({ ok: true, user: { name: user.name, role: user.role }, redirect });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao autenticar." }, { status: 500 });
  }
}
