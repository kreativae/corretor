import { apiUser, unauthorized } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { currentConn, withTenant } from "@/db";
import { requestPublicOrigin } from "@/lib/google";
import { ensureEvolutionWebhook, evolutionBackfill, evolutionState, forLine, getWhatsAppConfig, lineFor, MAIN_LINE } from "@/lib/whatsapp";
import { after, NextResponse } from "next/server";

/** Último estado visto por número: ao voltar a conectar, busca o que chegou enquanto estava fora */
const lastState = new Map<string, string>();

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
    const st = await evolutionState(cfg);
    const conn = await currentConn();
    const k = `${conn.schema}|${cfg.evolutionInstance}`;
    const reconnected = st.state === "open" && lastState.get(k) !== "open";
    lastState.set(k, st.state);
    if (st.state === "open") {
      // Endereço do webhook desatualizado (domínio mudou) ou número que acabou de reconectar:
      // corrige e recupera as mensagens perdidas
      const baseUrl = requestPublicOrigin(req);
      after(() =>
        withTenant(conn, async () => {
          const moved = await ensureEvolutionWebhook(cfg, baseUrl);
          if (moved || reconnected) await evolutionBackfill(cfg, baseUrl, reconnected ? 7 : 3);
        }).catch((e) => console.error("[evolution webhook]", e)),
      );
    }
    return NextResponse.json({ ...st, line: cfg.line });
  } catch (e) {
    return NextResponse.json({ state: "error", error: e instanceof Error ? e.message : "Falha." });
  }
}
