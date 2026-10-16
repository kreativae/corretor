import { controlDb } from "@/db";
import { users } from "@/db/schema";
import { getSuperadmin, hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Novo acesso de gerência (ou promove um usuário existente) */
export async function POST(req: Request) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(b.password ?? "");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe nome e e-mail válidos." }, { status: 400 });
  }
  if (password.length < 8) return NextResponse.json({ error: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
  const [existing] = await controlDb.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    await controlDb.update(users).set({ role: "superadmin", name, passwordHash: hashPassword(password), active: true }).where(eq(users.id, existing.id));
  } else {
    await controlDb.insert(users).values({ name, email, role: "superadmin", passwordHash: hashPassword(password) });
  }
  return NextResponse.json({ ok: true });
}
