import { db } from "@/db";
import { activities, contacts, properties, visits } from "@/db/schema";
import { VISIT_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // monta o patch: status, feedback ou reagendamento (mantém o horário)
    const update: Partial<typeof visits.$inferInsert> = { updatedAt: new Date() };
    if (body.status) update.status = body.status;
    if (body.feedback !== undefined) update.feedback = body.feedback;

    let rescheduled = false;
    if (body.date) {
      const [current] = await db
        .select()
        .from(visits)
        .where(eq(visits.id, id));
      if (current) {
        const [y, m, d] = String(body.date).split("-").map(Number);
        const next = new Date(current.scheduledAt);
        next.setFullYear(y, m - 1, d);
        update.scheduledAt = next;
        rescheduled = true;
      }
    }

    const [updated] = await db
      .update(visits)
      .set(update)
      .where(eq(visits.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });
    }

    const [prop] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, updated.propertyId));
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, updated.contactId));

    const label = rescheduled
      ? `Visita reagendada: ${contact?.name ?? "cliente"} · ${prop?.code ?? "imóvel"} · ${formatDateTime(updated.scheduledAt)}`
      : `Visita ${VISIT_STATUS_LABELS[updated.status].toLowerCase()}: ${contact?.name ?? "cliente"} · ${prop?.code ?? "imóvel"}`;

    await db.insert(activities).values([
      { entity: "visita", entityId: updated.id, kind: "visit", text: label },
      { entity: "imovel", entityId: updated.propertyId, kind: "visit", text: label },
      { entity: "contato", entityId: updated.contactId, kind: "visit", text: label },
    ]);

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao atualizar visita" }, { status: 500 });
  }
}
