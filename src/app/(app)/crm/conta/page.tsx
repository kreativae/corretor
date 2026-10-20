import { AccountSecurity } from "@/components/crm/account-security";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { loggedUser, SESSION_COOKIE } from "@/lib/auth";
import { recoveryCount } from "@/lib/totp";
import { and, desc, eq, gt } from "drizzle-orm";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta" };

/** Navegador e sistema, em poucas palavras */
function device(ua: string | null) {
  if (!ua) return "Aparelho desconhecido";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  return os ? `${browser} no ${os}` : browser;
}

export default async function ContaPage() {
  const me = await loggedUser();
  if (!me) redirect("/login?next=/crm/conta");
  const db = await getDb();
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const [[u], list] = await Promise.all([
    db.select({ enabled: users.totpEnabledAt, codes: users.recoveryCodes }).from(users).where(eq(users.id, me.id)),
    db
      .select({ token: sessions.token, ua: sessions.userAgent, ip: sessions.ip, createdAt: sessions.createdAt })
      .from(sessions)
      .where(and(eq(sessions.userId, me.id), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt)),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">{me.email}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Minha conta e segurança</h1>
        <p className="mt-1 text-sm text-subtle">Senha, verificação em duas etapas e aparelhos conectados.</p>
      </div>
      <AccountSecurity
        twoFactor={!!u?.enabled}
        recoveryLeft={u ? recoveryCount(u.codes) : 0}
        devices={list.map((s) => ({
          id: s.token.slice(0, 8),
          label: device(s.ua),
          ip: s.ip,
          createdAt: s.createdAt.toISOString(),
          current: s.token === token,
        }))}
      />
    </div>
  );
}
