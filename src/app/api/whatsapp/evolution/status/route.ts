import { apiUser, unauthorized } from "@/lib/api-auth";
import { evolutionState, getWhatsAppConfig } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

/** Conectado? (open) e qual número */
export async function GET() {
  if (!(await apiUser())) return unauthorized();
  const cfg = await getWhatsAppConfig();
  if (cfg.provider !== "evolution" || !cfg.evolutionUrl || !cfg.evolutionKey) {
    return NextResponse.json({ state: "unconfigured" });
  }
  try {
    return NextResponse.json(await evolutionState(cfg));
  } catch (e) {
    return NextResponse.json({ state: "error", error: e instanceof Error ? e.message : "Falha." });
  }
}
