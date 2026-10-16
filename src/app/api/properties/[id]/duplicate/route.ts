import { apiUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/db";
import { activities, properties, propertyImages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { nextPropertyCode } from "@/lib/property-code";
import { isRuralType } from "@/lib/rural";
import { asc, eq } from "drizzle-orm";
import { propertyLimitError } from "@/lib/account";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * Duplica um imóvel/propriedade: copia dados e fotos com novo código, fora do
 * site (rascunho). Documentos internos, visitas e negócios não são copiados.
 */
export async function POST(_req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const limit = await propertyLimitError();
  if (limit) return NextResponse.json({ error: limit }, { status: 403 });
  try {
    const { id } = await params;
    const [src] = await db.select().from(properties).where(eq(properties.id, id));
    if (!src) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });

    const rural = isRuralType(src.type);
    const code = await nextPropertyCode(rural);
    const { id: _id, code: _code, createdAt: _c, updatedAt: _u, ...data } = src;

    const [created] = await db
      .insert(properties)
      .values({
        ...data,
        code,
        title: `${src.title} (cópia)`.slice(0, 200),
        published: false,
      })
      .returning();

    const imgs = await db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, id))
      .orderBy(asc(propertyImages.position));
    if (imgs.length) {
      await db.insert(propertyImages).values(
        imgs.map((img) => ({ propertyId: created.id, url: img.url, position: img.position })),
      );
    }

    const author = await getCurrentUser();
    await db.insert(activities).values({
      entity: "imovel",
      entityId: created.id,
      kind: "created",
      text: `${rural ? "Propriedade rural" : "Imóvel"} ${created.code} criad${rural ? "a" : "o"} a partir de ${src.code}${author ? ` por ${author.name}` : ""}.`,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao duplicar" }, { status: 500 });
  }
}
