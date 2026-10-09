import { db } from "@/db";
import { activities, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getWhiteLabel } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET() {
  const wl = await getWhiteLabel();
  return NextResponse.json({ whiteLabel: wl });
}

export async function POST(req: Request) {
  try {
    const { key, value } = await req.json();
    if (!key || value === undefined) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    if (existing.length) {
      await db
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }

    if (key === "whiteLabel") {
      await db.insert(activities).values({
        entity: "sistema",
        entityId: null,
        kind: "updated",
        text: "Identidade visual (white label) atualizada pelo administrador.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar configuração" }, { status: 500 });
  }
}
