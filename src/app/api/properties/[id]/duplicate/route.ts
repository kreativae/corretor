import { apiUser, unauthorized } from "@/lib/api-auth";
import { getDb } from "@/db";
import { activities, properties, propertyImages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { nextPropertyCode } from "@/lib/property-code";
import { kindOf } from "@/lib/rural";
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
    const [src] = await (await getDb()).select().from(properties).where(eq(properties.id, id));
    if (!src) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });

    const code = await nextPropertyCode(kindOf(src.type));
    const { id: _id, code: _code, createdAt: _c, updatedAt: _u, ...data } = src;

    const [created] = await (await getDb())
      .insert(properties)
      .values({
        ...data,
        code,
        title: `${src.title} (cópia)`.slice(0, 200),
        published: false,
        featured: false,
      })
      .returning();

    const imgs = await (await getDb())
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, id))
      .orderBy(asc(propertyImages.position));
    if (imgs.length) {
      await (await getDb()).insert(propertyImages).values(
        imgs.map((img) => ({ propertyId: created.id, url: img.url, position: img.position })),
      );
    }

    const author = await getCurrentUser();
    await (await getDb()).insert(activities).values({
      entity: "imovel",
      entityId: created.id,
      kind: "created",
      text: `${{ rural: "Propriedade rural", terreno: "Terreno", urbano: "Imóvel" }[kindOf(src.type)]} ${created.code} criad${kindOf(src.type) === "rural" ? "a" : "o"} a partir de ${src.code}${author ? ` por ${author.name}` : ""}.`,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao duplicar" }, { status: 500 });
  }
}
