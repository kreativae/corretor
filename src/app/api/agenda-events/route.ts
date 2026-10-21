import { getDb } from "@/db";
import { activities, agendaEvents } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { eventFields } from "./shared";
import { ensureMeet } from "@/lib/google-meet";

/** Novo evento ou reunião na agenda */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const data = await eventFields(body);
  if (!data.title) return NextResponse.json({ error: "Informe o título." }, { status: 400 });
  if (!data.startsAt) return NextResponse.json({ error: "Informe data e horário." }, { status: 400 });
  const [row] = await (await getDb())
    .insert(agendaEvents)
    .values({ ...(data as typeof agendaEvents.$inferInsert), createdBy: user.name })
    .returning();
  if (row.contactId) {
    await (await getDb()).insert(activities).values({
      entity: "contato",
      entityId: row.contactId,
      kind: "visit",
      text: `${row.kind === "evento" ? "Evento agendado" : "Reunião agendada"}: ${row.title}.`,
    });
  }
  // Link do Google Meet já na criação (se pedido)
  if (body.meet === true) {
    try {
      return NextResponse.json(await ensureMeet(row));
    } catch (e) {
      return NextResponse.json({ ...row, meetError: e instanceof Error ? e.message : "Não foi possível gerar o Meet." });
    }
  }
  return NextResponse.json(row);
}
