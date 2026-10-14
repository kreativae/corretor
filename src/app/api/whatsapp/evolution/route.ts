import { requestPublicOrigin } from "@/lib/google";
import { getWhatsAppConfig, handleEvolutionWebhook } from "@/lib/whatsapp";
import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";

export const maxDuration = 30;

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Webhook da Evolution API (conexão por QR code). Protegido pelo token na URL. */
export async function POST(req: Request) {
  const cfg = await getWhatsAppConfig();
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!cfg.webhookToken || !same(token, cfg.webhookToken)) {
    return new Response("Forbidden", { status: 403 });
  }
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });
  const baseUrl = requestPublicOrigin(req);
  after(() => handleEvolutionWebhook(payload, baseUrl).catch((e) => console.error("[evolution webhook]", e)));
  return NextResponse.json({ ok: true });
}
