import { getCurrentUser } from "@/lib/auth";
import { requestPublicOrigin } from "@/lib/google";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { evolutionWebhookUrl, getWhatsAppConfig, mainLineOwner, mask, saveWhatsAppConfig, whatsappReady } from "@/lib/whatsapp";
import { asc, eq } from "drizzle-orm";
import { tenantParam } from "@/lib/tenant";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/roles";

async function admin() {
  const u = await getCurrentUser();
  return isAdmin(u) ? u : null;
}

async function view(c: Awaited<ReturnType<typeof getWhatsAppConfig>>, req: Request, tenant: string | null) {
  const team = await (await getDb())
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
  return {
    ...c,
    accessToken: mask(c.accessToken),
    appSecret: mask(c.appSecret),
    evolutionKey: mask(c.evolutionKey),
    webhookToken: undefined,
    ready: whatsappReady(c),
    webhookUrl: `${requestPublicOrigin(req)}/api/whatsapp/webhook${tenant ? `?t=${tenant}` : ""}`,
    evolutionWebhookUrl: evolutionWebhookUrl(requestPublicOrigin(req), c, tenant),
    mainOwnerResolved: await mainLineOwner(c),
    users: team,
  };
}

export async function GET(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  return NextResponse.json(await view(await getWhatsAppConfig(), req, await tenantParam()));
}

export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    const saved = await saveWhatsAppConfig(await req.json());
    return NextResponse.json(await view(saved, req, await tenantParam()));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}
