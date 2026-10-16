import { getDb } from "@/db";
import { activities, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_CONTENT, getSiteContent } from "@/lib/site-content";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(await getSiteContent());
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const content = await req.json();
    const existing = await (await getDb())
      .select()
      .from(settings)
      .where(eq(settings.key, "siteContent"));

    if (existing.length) {
      await (await getDb())
        .update(settings)
        .set({ value: content })
        .where(eq(settings.key, "siteContent"));
    } else {
      await (await getDb()).insert(settings).values({ key: "siteContent", value: content });
    }

    await (await getDb()).insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "updated",
      text: "Conteúdo do site público atualizado e publicado.",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao publicar" }, { status: 500 });
  }
}

export async function DELETE() {
  await requireAdmin();
  await (await getDb()).delete(settings).where(eq(settings.key, "siteContent"));
  await (await getDb()).insert(activities).values({
    entity: "sistema",
    entityId: null,
    kind: "updated",
    text: "Conteúdo do site restaurado para o padrão de fábrica.",
  });
  return NextResponse.json({ ok: true, content: DEFAULT_CONTENT });
}
