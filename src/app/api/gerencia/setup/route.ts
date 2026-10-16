import { controlDb, DEFAULT_SCHEMA, withTenant } from "@/db";
import { activities, users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * Primeiro acesso da gerência: exige a chave GERENCIA_KEY (variável da Vercel).
 * Cria o usuário de gerência — ou promove um e-mail já existente — e já entra.
 */
export async function POST(req: Request) {
  const expected = process.env.GERENCIA_KEY ?? "";
  if (expected.length < 12) {
    return NextResponse.json(
      { error: "Defina a variável GERENCIA_KEY (mínimo 12 caracteres) na Vercel e faça um novo deploy." },
      { status: 400 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = String(body.key ?? "");
  if (!timingSafeEqual(digest(key), digest(expected))) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Chave de gerência incorreta." }, { status: 401 });
  }
  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(body.password ?? "");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe nome e e-mail válidos." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
  }

  const [existing] = await controlDb.select().from(users).where(eq(users.email, email));
  let id: string;
  if (existing) {
    await controlDb
      .update(users)
      .set({ role: "superadmin", name, passwordHash: hashPassword(password), active: true })
      .where(eq(users.id, existing.id));
    id = existing.id;
  } else {
    const [created] = await controlDb
      .insert(users)
      .values({ name, email, role: "superadmin", passwordHash: hashPassword(password) })
      .returning({ id: users.id });
    id = created.id;
  }
  await controlDb.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  // Sessão da gerência fica sempre no banco principal
  await withTenant({ schema: DEFAULT_SCHEMA }, () => createSession(id));
  await controlDb.insert(activities).values({ entity: "sistema", entityId: null, kind: "updated", text: `${name} recebeu acesso de gerência.` });
  return NextResponse.json({ ok: true });
}
