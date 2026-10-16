import { apiUser, unauthorized } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { evolutionState, forLine, getWhatsAppConfig, lineFor, MAIN_LINE } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

/** Conectado? (open) e qual número. ?line=main: o número principal (Configurações, só administrador) */
export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const main = new URL(req.url).searchParams.get("line") === MAIN_LINE;
  if (main && !isAdmin(user)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  const base = await getWhatsAppConfig();
  if (base.provider !== "evolution" || !base.evolutionUrl || !base.evolutionKey) {
    return NextResponse.json({ state: "unconfigured" });
  }
  const cfg = main ? forLine(base, MAIN_LINE) : await lineFor(user.id, base);
  try {
    return NextResponse.json({ ...(await evolutionState(cfg)), line: cfg.line });
  } catch (e) {
    return NextResponse.json({ state: "error", error: e instanceof Error ? e.message : "Falha." });
  }
}
