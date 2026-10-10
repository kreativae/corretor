import { db } from "@/db";
import { integrations } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { syncGoogleIntegration } from "@/lib/google-sync";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Sincroniza agora Google Contacts e Calendar (botão do topo do CRM). */
export async function POST() {
  if (!(await apiUser())) return unauthorized();
  const connected = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.category, "google"), eq(integrations.connected, true)));
  if (!connected.length) {
    return NextResponse.json(
      { error: "Nenhuma conta Google conectada. Conecte em Admin › Configurações." },
      { status: 400 },
    );
  }
  const results = [];
  for (const integration of connected) {
    try {
      results.push(await syncGoogleIntegration(integration));
    } catch (e) {
      results.push({
        provider: integration.provider,
        pulled: 0,
        pushed: 0,
        unchanged: 0,
        removed: 0,
        errors: [e instanceof Error ? e.message : "Falha na sincronização"],
      });
    }
  }
  return NextResponse.json({ ok: results.every((r) => r.errors.length === 0), results });
}
