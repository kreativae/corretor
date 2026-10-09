import { db } from "@/db";
import { activities, properties, propertyImages } from "@/db/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { images = [], ...data } = body as Record<string, unknown> & {
      images?: string[];
    };

    if (!data.title || typeof data.price !== "number" || typeof data.area !== "number") {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const existing = await db.select({ id: properties.id }).from(properties);
    const code = `NRD-${2401 + existing.length}`;

    const [created] = await db
      .insert(properties)
      .values({
        ...(data as typeof properties.$inferInsert),
        code,
      })
      .returning();

    if (images.length) {
      await db.insert(propertyImages).values(
        images
          .filter((u) => typeof u === "string" && u.startsWith("http"))
          .map((url, i) => ({ propertyId: created.id, url, position: i })),
      );
    }

    await db.insert(activities).values({
      entity: "imovel",
      entityId: created.id,
      kind: "created",
      text: `Imóvel ${created.code} cadastrado por Rafael Costa.`,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar imóvel" }, { status: 500 });
  }
}
