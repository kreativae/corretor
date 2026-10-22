import { apiUser, unauthorized } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { requestPublicOrigin } from "@/lib/google";
import { evolutionBackfill, forLine, getWhatsAppConfig, lineFor, MAIN_LINE } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

/**
 * Busca na Evolution as mensagens dos últimos dias e grava as que faltam no CRM
 * (as repetidas são ignoradas). { line: "main" }: número principal; { days }: 1 a 30.
 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { line?: unknown; days?: unknown };
  const main = body.line === MAIN_LINE;
  if (main && !isAdmin(user)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  const days = Math.min(30, Math.max(1, Math.round(Number(body.days) || 7)));
  try {
    const base = await getWhatsAppConfig();
    const cfg = main ? forLine(base, MAIN_LINE) : await lineFor(user.id, base);
    const found = await evolutionBackfill(cfg, requestPublicOrigin(req), days);
    return NextResponse.json({ ok: true, found });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha." }, { status: 502 });
  }
}
