import { apiUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/db";
import { activities, contacts, deals, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  try {
    const body = await req.json();
    if (!body.contactId) {
      return NextResponse.json({ error: "Contato é obrigatório" }, { status: 400 });
    }

    const [created] = await db
      .insert(deals)
      .values({
        contactId: body.contactId,
        propertyId: body.propertyId ?? null,
        stage: body.stage ?? "novo",
        value: typeof body.value === "number" ? body.value : 0,
      })
      .returning();

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, body.contactId));
    const propName = body.propertyId
      ? (
          await db
            .select({ code: properties.code })
            .from(properties)
            .where(eq(properties.id, body.propertyId))
        )[0]?.code
      : null;

    const label = `Negociação aberta com ${contact?.name ?? "contato"}${propName ? ` · ${propName}` : ""}.`;
    await db.insert(activities).values([
      { entity: "negocio", entityId: created.id, kind: "stage", text: label },
      { entity: "contato", entityId: body.contactId, kind: "stage", text: label },
    ]);

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar negociação" }, { status: 500 });
  }
}
