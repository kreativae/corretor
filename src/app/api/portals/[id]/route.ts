import { db } from "@/db";
import { activities, portals, properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { enabled } = await req.json();

    const [updated] = await db
      .update(portals)
      .set({
        enabled: !!enabled,
        status: enabled ? "conectado" : "desconectado",
      })
      .where(eq(portals.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Portal não encontrado" }, { status: 404 });
    }

    await db.insert(activities).values({
      entity: "portal",
      entityId: id,
      kind: "sync",
      text: enabled
        ? `Integração com ${updated.name} ativada — anúncios entrarão no próximo ciclo.`
        : `Integração com ${updated.name} desativada.`,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao atualizar portal" }, { status: 500 });
  }
}

/** Simula um ciclo de sincronização XML com o portal */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.action !== "sync") {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const [portal] = await db.select().from(portals).where(eq(portals.id, id));
    if (!portal) {
      return NextResponse.json({ error: "Portal não encontrado" }, { status: 404 });
    }

    await db
      .update(portals)
      .set({ status: "sincronizando" })
      .where(eq(portals.id, id));

    const published = await db
      .select()
      .from(properties)
      .where(and(eq(properties.published, true)));

    const active = published.filter((p) =>
      ["disponivel", "reservado"].includes(p.status),
    ).length;

    // latência simulada do ciclo de exportação
    await new Promise((r) => setTimeout(r, 900));

    const [updated] = await db
      .update(portals)
      .set({
        status: "conectado",
        enabled: true,
        lastSyncAt: new Date(),
        listings: active,
      })
      .where(eq(portals.id, id))
      .returning();

    await db.insert(activities).values({
      entity: "portal",
      entityId: id,
      kind: "sync",
      text: `Sincronização com ${portal.name} concluída — ${active} anúncios enviados via feed XML.`,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha na sincronização" }, { status: 500 });
  }
}
