import { apiUser, unauthorized } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { evolutionLogout, forLine, getWhatsAppConfig, lineFor, MAIN_LINE } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

/** Desconecta o número (o celular sai da lista de aparelhos conectados). { line: "main" }: número principal */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { line?: unknown };
  const main = body.line === MAIN_LINE;
  if (main && !isAdmin(user)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    const base = await getWhatsAppConfig();
    await evolutionLogout(main ? forLine(base, MAIN_LINE) : await lineFor(user.id, base));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha." }, { status: 502 });
  }
}
