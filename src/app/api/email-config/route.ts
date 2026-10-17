import { getCurrentUser } from "@/lib/auth";
import { getEmailConfig, maskKey, saveEmailConfig, type EmailConfig } from "@/lib/notify";
import { NextResponse } from "next/server";
import { requestPublicOrigin } from "@/lib/google";
import { tenantParam } from "@/lib/tenant";
import { getDb } from "@/db";
import { mailMessages, users } from "@/db/schema";
import { and, count, eq, isNotNull, max } from "drizzle-orm";
import { isAdmin } from "@/lib/roles";

const view = (c: EmailConfig) => ({
  ...c,
  resendApiKey: maskKey(c.resendApiKey),
  hasKey: !!c.resendApiKey,
  webhookSecret: maskKey(c.webhookSecret),
});

/** Conta do Resend (chave e remetente) — só administradores */
export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  // Endereço para cadastrar no Resend (Webhooks › evento email.received)
  const t = await tenantParam();
  const inboundUrl = `${requestPublicOrigin(req)}/api/email/inbound${t ? `?t=${t}` : ""}`;
  const db = await getDb();
  const [[boxes], [last]] = await Promise.all([
    db.select({ n: count() }).from(users).where(and(isNotNull(users.mailbox), eq(users.active, true))),
    db.select({ at: max(mailMessages.createdAt) }).from(mailMessages).where(eq(mailMessages.direction, "in")),
  ]);
  return NextResponse.json({
    ...view(await getEmailConfig()),
    inboundUrl,
    usersWithMailbox: boxes?.n ?? 0,
    lastReceivedAt: last?.at ?? null,
  });
}

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    return NextResponse.json(view(await saveEmailConfig(await req.json())));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}
