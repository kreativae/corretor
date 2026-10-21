import { getDb } from "@/db";
import { agendaEvents, integrations } from "@/db/schema";
import { googleApi } from "@/lib/google";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { eventFields } from "../shared";
import { ensureMeet } from "@/lib/google-meet";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data = await eventFields(body);
  if ("title" in data && !data.title) return NextResponse.json({ error: "Informe o título." }, { status: 400 });
  // Mover o início (arrastar para outro dia) leva o fim junto, mantendo a duração
  if (data.startsAt && !("endsAt" in body)) {
    const [cur] = await (await getDb()).select().from(agendaEvents).where(eq(agendaEvents.id, id));
    if (cur?.endsAt) data.endsAt = new Date((data.startsAt as Date).getTime() + (cur.endsAt.getTime() - cur.startsAt.getTime()));
  }
  // Novo horário: o lembrete por WhatsApp sai de novo
  if (data.startsAt) data.remindedAt = null;
  const [row] = await (await getDb())
    .update(agendaEvents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agendaEvents.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (body.meet === true && !row.meetUrl) {
    try {
      return NextResponse.json(await ensureMeet(row));
    } catch (e) {
      return NextResponse.json({ ...row, meetError: e instanceof Error ? e.message : "Não foi possível gerar o Meet." });
    }
  }
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const { id } = await params;
  const [ev] = await (await getDb()).select().from(agendaEvents).where(eq(agendaEvents.id, id));
  // Já estava no Google Calendar: sai de lá também
  if (ev?.googleEventId) {
    const [cal] = await (await getDb()).select().from(integrations).where(eq(integrations.provider, "google_calendar"));
    if (cal?.connected) {
      const calendarId = encodeURIComponent(cal.calendarId || "primary");
      await googleApi<Record<string, never>>(
        cal,
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(ev.googleEventId)}?sendUpdates=all`,
        { method: "DELETE" },
      ).catch((e) => console.error("[google] excluir evento", e));
    }
  }
  await (await getDb()).delete(agendaEvents).where(eq(agendaEvents.id, id));
  return NextResponse.json({ ok: true });
}
