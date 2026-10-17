import { apiUser, unauthorized } from "@/lib/api-auth";
import { getDb } from "@/db";
import {
  activities,
  deals,
  properties,
  propertyDocuments,
  propertyImages,
  visits,
} from "@/db/schema";
import { deleteFiles } from "@/lib/blob";
import { eq } from "drizzle-orm";
import { alqToM2, isRuralType, kmzOnly, sanitizeRural } from "@/lib/rural";
import { sanitizePropertyPartnerFields } from "@/lib/partners";
import { parseYouTubeUrl } from "@/lib/utils";
import { NextResponse } from "next/server";
import { sanitizeResponsible } from "@/lib/responsible";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json();

    if (Object.keys(body).length === 1 && typeof body.published === "boolean") {
      const [updated] = await (await getDb())
        .update(properties)
        .set({ published: body.published, updatedAt: new Date() })
        .where(eq(properties.id, id))
        .returning();
      await (await getDb()).insert(activities).values({
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
      } else if (data.type === "terreno") {
        data.rural = kmzOnly(data.rural);
      } else {
        data.rural = null;
      }
    }

    // Parceria: só valores válidos (id do parceiro, percentuais 0–100)
    delete data.partnerId;
    delete data.commissionPct;
    delete data.partnerSharePct;
    Object.assign(data, sanitizePropertyPartnerFields(body));
    if ("responsibleId" in data) data.responsibleId = await sanitizeResponsible(data.responsibleId);
    // Vídeo: só link válido do YouTube
    if ("videoUrl" in data) {
      const v = String(data.videoUrl ?? "").trim();
      data.videoUrl = parseYouTubeUrl(v) ? v.slice(0, 300) : null;
    }

    const [updated] = await (await getDb())
      .update(properties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }

    if (Array.isArray(images)) {
      await (await getDb()).delete(propertyImages).where(eq(propertyImages.propertyId, id));
      if (images.length) {
        await (await getDb()).insert(propertyImages).values(
          images
            .filter((u: unknown) => typeof u === "string" && (u as string).startsWith("http"))
            .map((url: string, i: number) => ({ propertyId: id, url, position: i })),
        );
      }
    }

    await (await getDb()).insert(activities).values({
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
    const [prop] = await (await getDb())
      .select({ code: properties.code })
      .from(properties)
      .where(eq(properties.id, id));
    if (!prop) {
      return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    // Documentos internos: apaga os arquivos (as linhas saem em cascata)
    const docs = await (await getDb())
      .select({ pathname: propertyDocuments.pathname, url: propertyDocuments.url })
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyId, id))
      .catch(() => []);
    await deleteFiles(docs.map((d) => d.url || d.pathname));
    await (await getDb()).delete(visits).where(eq(visits.propertyId, id));
    await (await getDb()).delete(deals).where(eq(deals.propertyId, id));
    await (await getDb()).delete(properties).where(eq(properties.id, id));
    await (await getDb()).insert(activities).values({
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
