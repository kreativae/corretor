import { dbFor, withTenant } from "@/db";
import { activities } from "@/db/schema";
import { getAccount, saveAccount } from "@/lib/account";
import { getSuperadmin } from "@/lib/auth";
import { connOf, listTenants } from "@/lib/tenant";
import { NextResponse } from "next/server";

/** Situação, plano, limites e módulos de uma empresa */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const me = await getSuperadmin();
  if (!me) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  const { slug } = await params;
  const t = (await listTenants(true)).find((x) => x.slug === slug);
  if (!t) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  const conn = connOf(t);
  try {
    const body = await req.json();
    const saved = await withTenant(conn, async () => {
      const before = await getAccount();
      // Campos ausentes mantêm o valor atual
      const next = await saveAccount({ ...before, ...body });
      if (before.status !== next.status) {
        await dbFor(conn).insert(activities).values({
          entity: "sistema",
          entityId: null,
          kind: "updated",
          text: next.status === "suspenso" ? `Conta suspensa pela gerência (${me.name}).` : `Conta reativada pela gerência (${me.name}).`,
        });
      }
      return next;
    });
    return NextResponse.json(saved);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}
