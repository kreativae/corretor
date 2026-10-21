import { getDb } from "@/db";
import { activities, partners } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { clearPhotoModeCache } from "@/lib/media-guard";
import { sanitizePartner } from "@/lib/partners";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const data = sanitizePartner(await req.json());
    if (data.name.length < 2) return NextResponse.json({ error: "Informe o nome do parceiro." }, { status: 400 });
    const [updated] = await (await getDb())
      .update(partners)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });
    clearPhotoModeCache();
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar parceiro" }, { status: 500 });
  }
}

/** Exclui o parceiro; os imóveis dele continuam, apenas sem vínculo. */
export async function DELETE(_req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  try {
    const { id } = await params;
    const [removed] = await (await getDb()).delete(partners).where(eq(partners.id, id)).returning();
    if (!removed) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });
    await (await getDb()).insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "updated",
      text: `Parceiro ${removed.name} excluído (imóveis mantidos, sem vínculo).`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao excluir parceiro" }, { status: 500 });
  }
}
