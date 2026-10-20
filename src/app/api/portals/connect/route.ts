import { requireAdmin } from "@/lib/auth";
import { requestPublicOrigin } from "@/lib/google";
import { ensurePortalToken, rotatePortalToken } from "@/lib/portal-connect";
import { NextResponse } from "next/server";

/** Dados da conexão com os portais: feed, endereço dos leads e últimas leituras */
function view(req: Request, c: Awaited<ReturnType<typeof ensurePortalToken>>) {
  const base = requestPublicOrigin(req);
  return {
    feedUrl: `${base}/api/feed.xml`,
    leadsUrl: `${base}/api/portals/leads?token=${c.token}`,
    feedReadAt: c.feedReadAt || null,
    feedReader: c.feedReader || null,
    leadAt: c.leadAt || null,
    leadCount: c.leadCount,
  };
}

export async function GET(req: Request) {
  await requireAdmin();
  return NextResponse.json(view(req, await ensurePortalToken()));
}

/** Gera um novo endereço de leads (o antigo para de funcionar) */
export async function POST(req: Request) {
  await requireAdmin();
  return NextResponse.json(view(req, await rotatePortalToken()));
}
