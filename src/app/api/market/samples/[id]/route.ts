import { getDb } from "@/db";
import { marketSamples } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiUser())) return unauthorized();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Amostra inválida." }, { status: 400 });
  await (await getDb()).delete(marketSamples).where(eq(marketSamples.id, id));
  return NextResponse.json({ ok: true });
}
