import { currentConn, withTenant } from "@/db";
import { requestPublicOrigin } from "@/lib/google";
import { getWhatsAppConfig, handleEvolutionWebhook, parseLine } from "@/lib/whatsapp";
import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";

export const maxDuration = 30;

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Webhook da Evolution API (conexão por QR code). Protegido pelo token na URL. */
export async function POST(req: Request) {
  const cfg = await getWhatsAppConfig();
  const sp = new URL(req.url).searchParams;
  const token = sp.get("token") ?? "";
  if (!cfg.webhookToken || !same(token, cfg.webhookToken)) {
    return new Response("Forbidden", { status: 403 });
  }
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });
  const baseUrl = requestPublicOrigin(req);
  // Número de cada usuário: ?l=<id do usuário>; sem l, o número principal
  const line = parseLine(sp.get("l"));
  // A empresa vem do ?t= da URL; o processamento roda depois da resposta
  const conn = await currentConn();
  after(() => withTenant(conn, () => handleEvolutionWebhook(payload, baseUrl, line)).catch((e) => console.error("[evolution webhook]", e)));
  return NextResponse.json({ ok: true });
}

/** Aberto no navegador: só confirma que o endereço existe (quem usa é a Evolution, via POST) */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Webhook do WhatsApp ativo. Este endereço é usado pela Evolution API — não precisa abrir no navegador.",
  });
}
