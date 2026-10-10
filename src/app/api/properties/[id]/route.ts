import { apiUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/db";
import {
  activities,
  deals,
  properties,
  propertyDocuments,
  propertyImages,
  visits,
} from "@/db/schema";
import { blobToken } from "@/lib/blob";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { alqToM2, isRuralType, sanitizeRural } from "@/lib/rural";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json();

    if (Object.keys(body).length === 1 && typeof body.published === "boolean") {
      const [updated] = await db
        .update(properties)
        .set({ published: body.published, updatedAt: new Date() })
        .where(eq(properties.id, id))
        .returning();
      await db.insert(activities).values({
        entity: "imovel",
        entityId: id,
        kind: "updated",
        text: body.published
          ? `${updated.code} publicado na vitrine do site.`
          : `${updated.code} removido da vitrine do site.`,
      });
      return NextResponse.json(updated);
    }

    const { images, id: _ignore, code: _code, createdAt: _c, ...data } = body;
    void _ignore; void _code; void _c;
    if ("type" in data) {
      if (isRuralType(data.type)) {
        data.rural = sanitizeRural(data.rural);
        data.area = alqToM2(data.rural.totalAlq ?? 0);
      } else {
        data.rural = null;
      }
    }

    const [updated] = await db
      .update(properties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }

    if (Array.isArray(images)) {
      await db.delete(propertyImages).where(eq(propertyImages.propertyId, id));
      if (images.length) {
        await db.insert(propertyImages).values(
          images
            .filter((u: unknown) => typeof u === "string" && (u as string).startsWith("http"))
            .map((url: string, i: number) => ({ propertyId: id, url, position: i })),
        );
      }
    }

    await db.insert(activities).values({
      entity: "imovel",
      entityId: id,
      kind: "updated",
      text: `Ficha do imóvel ${updated.code} atualizada.`,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao atualizar imóvel" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const [prop] = await db
      .select({ code: properties.code })
      .from(properties)
      .where(eq(properties.id, id));
    if (!prop) {
      return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    // Documentos internos: apaga os arquivos do Blob (as linhas saem em cascata)
    const docs = await db
      .select({ pathname: propertyDocuments.pathname, url: propertyDocuments.url })
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyId, id))
      .catch(() => []);
    const token = blobToken();
    if (docs.length && token) {
      await del(docs.map((d) => d.url || d.pathname), { token }).catch((e) => console.error(e));
    }
    await db.delete(visits).where(eq(visits.propertyId, id));
    await db.delete(deals).where(eq(deals.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "updated",
      text: `Imóvel ${prop.code} excluído do portfólio.`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao excluir imóvel" }, { status: 500 });
  }
}
