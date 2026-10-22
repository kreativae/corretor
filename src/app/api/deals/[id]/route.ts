import { apiUser, unauthorized } from "@/lib/api-auth";
import { getDb } from "@/db";
import { activities, contacts, deals } from "@/db/schema";
import { DEAL_STAGE_LABELS } from "@/lib/labels";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json();

    const [updated] = await (await getDb())
      .update(deals)
      .set({
        ...(body.stage ? { stage: body.stage } : {}),
        ...(typeof body.value === "number" ? { value: body.value } : {}),
        updatedAt: new Date(),
      })
      .where(eq(deals.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Negociação não encontrada" }, { status: 404 });
    }

    if (body.stage) {
      const [contact] = await (await getDb())
        .select()
        .from(contacts)
        .where(eq(contacts.id, updated.contactId));
      const label = `Negociação de ${contact?.name ?? "contato"} movida para “${DEAL_STAGE_LABELS[updated.stage]}”.`;
      await (await getDb()).insert(activities).values([
        { entity: "negocio", entityId: updated.id, kind: "stage", text: label },
        { entity: "contato", entityId: updated.contactId, kind: "stage", text: label },
      ]);
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao atualizar negociação" }, { status: 500 });
  }
}

/** Tira a negociação do pipeline: só o card sai; o contato, o imóvel e o histórico continuam */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const [removed] = await (await getDb()).delete(deals).where(eq(deals.id, id)).returning();
    if (!removed) return NextResponse.json({ error: "Negociação não encontrada" }, { status: 404 });
    await (await getDb()).insert(activities).values({
      entity: "contato",
      entityId: removed.contactId,
      kind: "stage",
      text: `Negociação tirada do pipeline (estava em “${DEAL_STAGE_LABELS[removed.stage]}”).`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao tirar do pipeline" }, { status: 500 });
  }
}
