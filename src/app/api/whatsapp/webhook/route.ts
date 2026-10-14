import { requestPublicOrigin } from "@/lib/google";
import { getWhatsAppConfig, handleWebhook, validSignature } from "@/lib/whatsapp";
import { after, NextResponse } from "next/server";

export const maxDuration = 30;

/** Verificação do webhook (Meta › WhatsApp › Configuração › Webhook) */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const cfg = await getWhatsAppConfig();
  if (sp.get("hub.mode") === "subscribe" && cfg.verifyToken && sp.get("hub.verify_token") === cfg.verifyToken) {
    return new Response(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Mensagens recebidas e status das enviadas. Responde 200 rápido e processa depois. */
export async function POST(req: Request) {
  const raw = await req.text();
  const cfg = await getWhatsAppConfig();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const baseUrl = requestPublicOrigin(req);
  after(() => handleWebhook(payload, baseUrl).catch((e) => console.error("[whatsapp webhook]", e)));
  return NextResponse.json({ ok: true });
}
