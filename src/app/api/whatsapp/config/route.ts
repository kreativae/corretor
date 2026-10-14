import { getCurrentUser } from "@/lib/auth";
import { requestPublicOrigin } from "@/lib/google";
import { evolutionWebhookUrl, getWhatsAppConfig, mask, saveWhatsAppConfig, whatsappReady } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

async function admin() {
  const u = await getCurrentUser();
  return u?.role === "admin" ? u : null;
}

function view(c: Awaited<ReturnType<typeof getWhatsAppConfig>>, req: Request) {
  return {
    ...c,
    accessToken: mask(c.accessToken),
    appSecret: mask(c.appSecret),
    evolutionKey: mask(c.evolutionKey),
    webhookToken: undefined,
    ready: whatsappReady(c),
    webhookUrl: `${requestPublicOrigin(req)}/api/whatsapp/webhook`,
    evolutionWebhookUrl: evolutionWebhookUrl(requestPublicOrigin(req), c),
  };
}

export async function GET(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  return NextResponse.json(view(await getWhatsAppConfig(), req));
}

export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    const saved = await saveWhatsAppConfig(await req.json());
    return NextResponse.json(view(saved, req));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}
