import { apiUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/db";
import { activities, contacts, integrations, properties, visits } from "@/db/schema";
import { googleApi } from "@/lib/google";
import { VISIT_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
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

    // monta o patch: status, feedback, edição completa ou reagendamento (mantém o horário)
    const update: Partial<typeof visits.$inferInsert> = { updatedAt: new Date() };
    if (body.status) update.status = body.status;
    if (body.feedback !== undefined) update.feedback = body.feedback ? String(body.feedback) : null;
    if (body.propertyId) update.propertyId = String(body.propertyId);
    if (body.contactId) update.contactId = String(body.contactId);

    let rescheduled = false;
    let edited = !!(body.propertyId || body.contactId || body.feedback !== undefined);
    // Data e hora completas (enviadas pelo navegador, já no fuso de quem agenda)
    if (body.scheduledAt) {
      const when = new Date(String(body.scheduledAt));
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json({ error: "Data inválida" }, { status: 400 });
      }
      update.scheduledAt = when;
      edited = true;
    }
    if (body.date && !body.scheduledAt) {
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

    const label = edited
      ? `Visita alterada: ${contact?.name ?? "cliente"} · ${prop?.code ?? "imóvel"} · ${formatDateTime(updated.scheduledAt)}`
      : rescheduled
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

/** Exclui a visita (e o evento no Google Calendar, se estiver sincronizada). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const [visit] = await db.select().from(visits).where(eq(visits.id, id));
    if (!visit) return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });

    if (visit.googleEventId) {
      const [cal] = await db
        .select()
        .from(integrations)
        .where(eq(integrations.provider, "google_calendar"));
      if (cal?.connected) {
        const calendarId = encodeURIComponent(cal.calendarId || "primary");
        await googleApi<Record<string, never>>(
          cal,
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(visit.googleEventId)}?sendUpdates=all`,
          { method: "DELETE" },
        ).catch((e) => console.error("[google] excluir evento", e));
      }
    }

    await db.delete(visits).where(eq(visits.id, id));

    const [prop] = await db.select().from(properties).where(eq(properties.id, visit.propertyId));
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, visit.contactId));
    const label = `Visita excluída: ${contact?.name ?? "cliente"} · ${prop?.code ?? "imóvel"} · ${formatDateTime(visit.scheduledAt)}`;
    await db.insert(activities).values([
      { entity: "imovel", entityId: visit.propertyId, kind: "visit", text: label },
      { entity: "contato", entityId: visit.contactId, kind: "visit", text: label },
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao excluir visita" }, { status: 500 });
  }
}
