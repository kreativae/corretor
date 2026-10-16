import { controlDb } from "@/db";
import { users } from "@/db/schema";
import { getSuperadmin } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Remove um acesso de gerência (não pode remover o próprio) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSuperadmin();
  if (!me) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  const { id } = await params;
  if (id === me.id) return NextResponse.json({ error: "Você não pode remover o próprio acesso." }, { status: 400 });
  await controlDb.delete(users).where(and(eq(users.id, id), eq(users.role, "superadmin")));
  return NextResponse.json({ ok: true });
}
