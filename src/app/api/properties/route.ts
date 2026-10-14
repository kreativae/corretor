import { apiUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/db";
import { activities, properties, propertyImages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { sanitizePropertyPartnerFields } from "@/lib/partners";
import { nextPropertyCode } from "@/lib/property-code";
import { alqToM2, isRuralType, sanitizeRural, kmzOnly } from "@/lib/rural";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  try {
    const body = await req.json();
    const { images = [], ...data } = body as Record<string, unknown> & {
      images?: string[];
    };

    // Parceria: só valores válidos (id do parceiro, percentuais 0–100)
    delete data.partnerId;
    delete data.commissionPct;
    delete data.partnerSharePct;
    Object.assign(data, sanitizePropertyPartnerFields(body));

    const rural = isRuralType(data.type as string);
    if (rural) {
      // Área em m² derivada dos alqueires (usada em buscas e ordenação)
      const ruralData = sanitizeRural(data.rural);
      data.rural = ruralData;
      data.area = alqToM2(ruralData.totalAlq ?? 0);
    } else if (data.type === "terreno") {
      // Terreno: só o KMZ do perímetro
      data.rural = kmzOnly(data.rural);
    } else {
      data.rural = null;
    }

    if (!data.title || typeof data.price !== "number" || typeof data.area !== "number") {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const code = await nextPropertyCode(rural);

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
