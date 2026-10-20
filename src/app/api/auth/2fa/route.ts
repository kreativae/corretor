import { dbFor, withTenant } from "@/db";
import { users } from "@/db/schema";
import { finishLogin, LOGIN_MAX_PER_EMAIL, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS, waitMessage } from "@/lib/login";
import { addHit, clearHits, clientIp, countHits, retryAfter } from "@/lib/rate-limit";
import { connOf, listTenants } from "@/lib/tenant";
import { checkTwoFactorCode, PENDING_2FA_COOKIE, readPendingToken } from "@/lib/two-factor";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Segunda etapa do login: código de 6 dígitos do app ou um código de recuperação */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const pending = readPendingToken(jar.get(PENDING_2FA_COOKIE)?.value);
    if (!pending) {
      return NextResponse.json({ error: "O tempo para digitar o código acabou. Entre de novo.", restart: true }, { status: 401 });
    }
    const byUser = `2fa:user:${pending.userId}`;
    const byIp = `login:ip:${clientIp(req)}`;
    for (const [key, max] of [[byUser, LOGIN_MAX_PER_EMAIL], [byIp, LOGIN_MAX_PER_IP]] as const) {
      if (countHits(key, LOGIN_WINDOW_MS) >= max) {
        const wait = retryAfter(key, LOGIN_WINDOW_MS);
        return NextResponse.json({ error: waitMessage(wait) }, { status: 429, headers: { "Retry-After": String(wait) } });
      }
    }

    const tenant = (await listTenants()).find((t) => t.slug === pending.tenantSlug);
    if (!tenant) return NextResponse.json({ error: "Entre de novo.", restart: true }, { status: 401 });
    const { code } = await req.json();

    const result = await withTenant(connOf(tenant), async () => {
      const [user] = await dbFor(connOf(tenant)).select().from(users).where(eq(users.id, pending.userId));
      if (!user?.active || !user.totpEnabledAt) return null;
      const how = await checkTwoFactorCode(user.id, String(code ?? ""), true);
      return how ? { user, how } : undefined;
    });
    if (result === null) return NextResponse.json({ error: "Entre de novo.", restart: true }, { status: 401 });
    if (!result) {
      addHit(byUser);
      addHit(byIp);
      return NextResponse.json({ error: "Código incorreto. Confira o horário do celular e use o código atual do app." }, { status: 401 });
    }

    clearHits(byUser);
    jar.delete(PENDING_2FA_COOKIE);
    const redirect = await finishLogin(tenant, result.user, result.how === "recovery" ? " (com código de recuperação)" : "");
    return NextResponse.json({ ok: true, redirect });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao conferir o código." }, { status: 500 });
  }
}
