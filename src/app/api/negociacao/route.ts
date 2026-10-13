import { db } from "@/db";
import { propertySends } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { blobToken } from "@/lib/blob";
import { del } from "@vercel/blob";
import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Apaga envios do histórico (e os PDFs guardados). O e-mail já entregue não volta. */
export async function DELETE(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.map(String).filter((id: string) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500)
      : [];
    if (!ids.length) return NextResponse.json({ error: "Nada para apagar." }, { status: 400 });

    const rows = await db.select().from(propertySends).where(inArray(propertySends.id, ids));
    const files = rows.flatMap((r) => r.attachments.map((a) => a.pathname)).filter((p) => p.startsWith("envios/"));
    const token = blobToken();
    if (files.length && token) await del(files, { token }).catch((e) => console.error(e));
    await db.delete(propertySends).where(inArray(propertySends.id, ids));
    return NextResponse.json({ deleted: rows.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao apagar." }, { status: 500 });
  }
}
