import { withTenant } from "@/db";
import { connOf, listTenants } from "@/lib/tenant";
import { requireAdmin } from "@/lib/auth";
import { syncDueIntegrations } from "@/lib/google-sync";
import { NextResponse } from "next/server";

/**
 * Agendador de sincronização automática.
 * Produção: configure CRON_SECRET e envie Authorization: Bearer <secret>.
 * No plano Hobby, é executado diariamente; cada integração respeita seu intervalo.
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

  // Cada empresa tem as próprias integrações
  const report = [];
  for (const tenant of await listTenants(true)) {
    report.push({ empresa: tenant.slug, ...(await withTenant(connOf(tenant), syncDueIntegrations)) });
  }
  return NextResponse.json({ empresas: report });
}

export async function GET(req: Request) {
  return POST(req);
}
