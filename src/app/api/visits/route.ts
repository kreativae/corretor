import { db } from "@/db";
import { activities, contacts, properties, visits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let contactId: string | null = body.contactId ?? null;

    // fluxo público: nome + telefone criam/reutilizam o contato
    if (!contactId && body.name && body.phone) {
      const found = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, String(body.phone).trim()));
      if (found.length) {
        contactId = found[0].id;
      } else {
        const [c] = await db
          .insert(contacts)
          .values({
            name: String(body.name).trim(),
            phone: String(body.phone).trim(),
            source: body.source ?? "site",
          })
          .returning();
        contactId = c.id;
        await db.insert(activities).values({
          entity: "contato",
          entityId: c.id,
          kind: "lead",
          text: `${c.name} entrou para a agenda (origem: ${c.source}).`,
        });
      }
    }

    if (!contactId || !body.propertyId || !body.date) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const time = body.time ?? "10:00";
    const scheduledAt = new Date(`${body.date}T${time}:00`);

    const [created] = await db
      .insert(visits)
      .values({ propertyId: body.propertyId, contactId, scheduledAt })
      .returning();

    const [prop] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, body.propertyId));
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));

    const label = `Visita agendada: ${contact?.name ?? "cliente"} · ${prop?.code ?? "imóvel"} · ${formatDate(scheduledAt)} ${time}`;

    await db.insert(activities).values([
      { entity: "visita", entityId: created.id, kind: "visit", text: label },
      { entity: "imovel", entityId: body.propertyId, kind: "visit", text: label },
      { entity: "contato", entityId: contactId, kind: "visit", text: label },
    ]);

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao agendar visita" }, { status: 500 });
  }
}
