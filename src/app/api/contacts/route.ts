import { db } from "@/db";
import { activities, contacts } from "@/db/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
    }

    const [created] = await db
      .insert(contacts)
      .values({
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: body.email || null,
        type: body.type ?? "lead",
        source: body.source ?? "site",
        budgetMin: body.budgetMin ?? null,
        budgetMax: body.budgetMax ?? null,
        interestTypes: body.interestTypes ?? [],
        neighborhoods: body.neighborhoods ?? [],
        notes: body.notes || null,
      })
      .returning();

    await db.insert(activities).values({
      entity: "contato",
      entityId: created.id,
      kind: "lead",
      text: `${created.name} entrou para a agenda (origem: ${created.source}).`,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar contato" }, { status: 500 });
  }
}
