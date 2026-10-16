import { db } from "@/db";
import { activities } from "@/db/schema";
import { getAccount, saveAccount } from "@/lib/account";
import { getSuperadmin } from "@/lib/auth";
import { NextResponse } from "next/server";

/** Situação, plano, limites e módulos da conta — só a gerência */
export async function POST(req: Request) {
  const me = await getSuperadmin();
  if (!me) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  try {
    const before = await getAccount();
    const saved = await saveAccount(await req.json());
    if (before.status !== saved.status) {
      await db.insert(activities).values({
        entity: "sistema",
        entityId: null,
        kind: "updated",
        text: saved.status === "suspenso" ? `Conta suspensa pela gerência (${me.name}).` : `Conta reativada pela gerência (${me.name}).`,
      });
    }
    return NextResponse.json(saved);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}
