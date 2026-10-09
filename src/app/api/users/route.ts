import { db } from "@/db";
import { activities, users } from "@/db/schema";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const body = await req.json();
    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json({ error: "Nome e e-mail obrigatórios" }, { status: 400 });
    }
    if (body.password && String(body.password).length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter ao menos 6 caracteres." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const exists = await db.select().from(users).where(eq(users.email, email));
    if (exists.length) {
      return NextResponse.json(
        { error: "Já existe um usuário com este e-mail." },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(users)
      .values({
        name: body.name.trim(),
        email,
        role: body.role === "admin" ? "admin" : "corretor",
        creci: body.creci || null,
        passwordHash: body.password ? hashPassword(String(body.password)) : null,
      })
      .returning();

    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "created",
      text: `${created.name} entrou para a equipe como ${ROLE_LABELS[created.role].toLowerCase()}.`,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar usuário" }, { status: 500 });
  }
}
