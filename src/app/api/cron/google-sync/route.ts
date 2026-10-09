import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { syncGoogleIntegration } from "@/lib/google-sync";
import { NextResponse } from "next/server";

/**
 * Agendador de sincronização automática.
 * Produção: configure CRON_SECRET e envie Authorization: Bearer <secret>.
 * Pode ser acionado a cada 5 minutos; cada integração respeita seu intervalo.
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  } else {
    await requireAdmin();
  }

  const candidates = (await db.select().from(integrations)).filter(
    (item) => item.category === "google" && item.connected && item.autoSync,
  );
  const now = Date.now();
  const due = candidates.filter(
    (item) =>
      !item.lastSyncAt ||
      now - item.lastSyncAt.getTime() >= item.syncIntervalMin * 60_000,
  );

  const results: {
    provider: string;
    ok: boolean;
    pulled?: number;
    pushed?: number;
    error?: string;
  }[] = [];

  for (const integration of due) {
    try {
      const result = await syncGoogleIntegration(integration);
      results.push({
        provider: integration.provider,
        ok: result.errors.length === 0,
        pulled: result.pulled,
        pushed: result.pushed,
        ...(result.errors.length ? { error: result.errors.join("; ") } : {}),
      });
    } catch (error) {
      results.push({
        provider: integration.provider,
        ok: false,
        error: error instanceof Error ? error.message : "Falha desconhecida",
      });
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    synced: due.length,
    results,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
