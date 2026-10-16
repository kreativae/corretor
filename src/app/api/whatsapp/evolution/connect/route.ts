import { apiUser, unauthorized } from "@/lib/api-auth";
import { requestPublicOrigin } from "@/lib/google";
import { isAdmin } from "@/lib/roles";
import { evolutionConnect, forLine, getWhatsAppConfig, lineFor, MAIN_LINE } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * Gera o QR code (cria a instância e aponta o webhook para o CRM).
 * { line: "main" }: número principal (só administrador); sem line: o número de quem está logado.
 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { number?: unknown; line?: unknown };
    const main = body.line === MAIN_LINE;
    if (main && !isAdmin(user)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
    const base = await getWhatsAppConfig();
    if (base.provider !== "evolution") return NextResponse.json({ error: "A conexão por QR code não está ativa." }, { status: 400 });
    const digits = typeof body.number === "string" ? body.number.replace(/\D/g, "") : "";
    const number = digits.length >= 10 ? digits : undefined;
    const cfg = main ? forLine(base, MAIN_LINE) : await lineFor(user.id, base);
    return NextResponse.json(await evolutionConnect(cfg, requestPublicOrigin(req), number));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao conectar." }, { status: 502 });
  }
}
