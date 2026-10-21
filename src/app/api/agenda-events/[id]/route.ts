import { getDb } from "@/db";
import { agendaEvents } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { eventFields } from "../shared";

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
  const [row] = await (await getDb())
    .update(agendaEvents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agendaEvents.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const { id } = await params;
  await (await getDb()).delete(agendaEvents).where(eq(agendaEvents.id, id));
  return NextResponse.json({ ok: true });
}
