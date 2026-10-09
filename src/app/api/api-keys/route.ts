import { db } from "@/db";
import { activities, apiKeys } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const { label, scope } = await req.json();
    if (!label?.trim()) {
      return NextResponse.json({ error: "Informe um rótulo." }, { status: 400 });
    }
    const secret = randomBytes(24).toString("hex");
    const prefix = `imob_${scope === "total" ? "live" : "ro"}_${secret.slice(0, 6)}`;

    const [created] = await db
      .insert(apiKeys)
      .values({
        label: label.trim(),
        prefix,
        secret,
        scope: ["leitura", "escrita", "total"].includes(scope) ? scope : "leitura",
      })
      .returning();

    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "created",
      text: `Nova chave de API gerada: ${created.label}.`,
    });

    // Segredo completo retornado apenas nesta resposta
    return NextResponse.json(
      { ...created, fullKey: `${prefix}_${secret}` },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao gerar chave" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  await requireAdmin();
  try {
    const { id } = await req.json();
    const [revoked] = await db
      .update(apiKeys)
      .set({ revoked: true })
      .where(eq(apiKeys.id, id))
      .returning();
    if (!revoked) {
      return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 });
    }
    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "updated",
      text: `Chave de API revogada: ${revoked.label}.`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao revogar chave" }, { status: 500 });
  }
}
