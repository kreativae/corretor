import { getDb } from "@/db";
import { activities, sessions, users } from "@/db/schema";
import { hashPassword, loggedUser, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { passwordProblem } from "@/lib/password";
import { addHit, countHits } from "@/lib/rate-limit";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Troca da própria senha (Minha conta): pede a atual e encerra os outros aparelhos */
export async function POST(req: Request) {
  const me = await loggedUser();
  if (!me) return NextResponse.json({ error: "Entre de novo." }, { status: 401 });
  const key = `senha:${me.id}`;
  if (countHits(key, 15 * 60_000) >= 5) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const { current, next } = await req.json().catch(() => ({}));
  const db = await getDb();
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id));
  if (!u || !verifyPassword(String(current ?? ""), u.hash)) {
    addHit(key);
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
  }
  const pass = String(next ?? "");
  const problem = passwordProblem(pass, me.email);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await db.update(users).set({ passwordHash: hashPassword(pass) }).where(eq(users.id, me.id));
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await db.delete(sessions).where(and(eq(sessions.userId, me.id), ne(sessions.token, token)));
  await db.insert(activities).values({ entity: "sistema", entityId: null, kind: "updated", text: `${me.name} trocou a própria senha.` });
  return NextResponse.json({ ok: true });
}
