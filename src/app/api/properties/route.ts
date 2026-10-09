import { db } from "@/db";
import { activities, properties, propertyImages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { alqToM2, isRuralType, sanitizeRural } from "@/lib/rural";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { images = [], ...data } = body as Record<string, unknown> & {
      images?: string[];
    };

    const rural = isRuralType(data.type as string);
    if (rural) {
      // Área em m² derivada dos alqueires (usada em buscas e ordenação)
      const ruralData = sanitizeRural(data.rural);
      data.rural = ruralData;
      data.area = alqToM2(ruralData.totalAlq ?? 0);
    } else {
      data.rural = null;
    }

    if (!data.title || typeof data.price !== "number" || typeof data.area !== "number") {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Próximo código livre (RUR- para rurais, NRD- para urbanos)
    const prefix = rural ? "RUR" : "NRD";
    const taken = new Set(
      (await db.select({ code: properties.code }).from(properties)).map((r) => r.code),
    );
    let seq = 2401 + taken.size;
    while (taken.has(`${prefix}-${seq}`)) seq += 1;
    const code = `${prefix}-${seq}`;

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

    const author = await getCurrentUser();
    await db.insert(activities).values({
      entity: "imovel",
      entityId: created.id,
      kind: "created",
      text: `${rural ? "Propriedade rural" : "Imóvel"} ${created.code} cadastrad${rural ? "a" : "o"}${author ? ` por ${author.name}` : ""}.`,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar imóvel" }, { status: 500 });
  }
}
