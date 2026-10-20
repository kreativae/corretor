import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { loggedUser, SESSION_COOKIE } from "@/lib/auth";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Sair dos outros aparelhos (Minha conta): apaga as sessões da conta, menos a atual */
export async function DELETE() {
  const me = await loggedUser();
  if (!me) return NextResponse.json({ error: "Entre de novo." }, { status: 401 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await (await getDb()).delete(sessions).where(and(eq(sessions.userId, me.id), ne(sessions.token, token)));
  return NextResponse.json({ ok: true });
}
