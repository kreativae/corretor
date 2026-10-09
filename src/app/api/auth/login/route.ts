import { db } from "@/db";
import { activities, users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Informe e-mail e senha." },
        { status: 400 },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, String(email).trim().toLowerCase()));

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 },
      );
    }
    if (!user.active) {
      return NextResponse.json(
        { error: "Conta desativada. Fale com o administrador." },
        { status: 403 },
      );
    }

    await createSession(user.id);
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "lead",
      text: `${user.name} entrou no sistema.`,
    });

    return NextResponse.json({
      ok: true,
      user: { name: user.name, role: user.role },
      redirect: user.role === "admin" ? "/admin" : "/crm",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao autenticar." }, { status: 500 });
  }
}
