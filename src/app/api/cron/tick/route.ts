import { withTenant } from "@/db";
import { syncDueIntegrations } from "@/lib/google-sync";
import { runReminders } from "@/lib/reminders";
import { connOf, listTenants } from "@/lib/tenant";
import { NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * Batida do agendador interno (src/instrumentation.ts, a cada 10 min): lembretes da agenda
 * por WhatsApp e Google (Calendar e Contatos) das integrações com o intervalo vencido.
 * Aceita o token do próprio processo ou o CRON_SECRET (agendador externo).
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const ok = [process.env.TICK_TOKEN, process.env.CRON_SECRET].some((t) => t && auth === `Bearer ${t}`);
  if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const report = [];
  for (const tenant of await listTenants(true)) {
    const conn = connOf(tenant);
    const reminders = await withTenant(conn, runReminders).catch((e) => ({ error: String(e) }));
    const google = await withTenant(conn, syncDueIntegrations).catch((e) => ({ error: String(e) }));
    report.push({ empresa: tenant.slug, reminders, google });
  }
  return NextResponse.json({ empresas: report });
}

export async function GET(req: Request) {
  return POST(req);
}
