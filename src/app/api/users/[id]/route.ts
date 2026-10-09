import { db } from "@/db";
import { activities, sessions, users } from "@/db/schema";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireAdmin();
  try {
    const { id } = await params;
    const body = await req.json();

    const patch: Partial<typeof users.$inferInsert> = {};
    if (body.name?.trim()) patch.name = body.name.trim();
    if (body.creci !== undefined) patch.creci = String(body.creci ?? "").trim() || null;
    if (body.phone !== undefined) patch.phone = String(body.phone ?? "").replace(/\D/g, "") || null;
    if (body.role && ["admin", "corretor"].includes(body.role)) {
      if (id === me.id && body.role !== "admin") {
        return NextResponse.json(
          { error: "Você não pode remover o próprio acesso de administrador." },
          { status: 400 },
        );
      }
      patch.role = body.role;
    }
    if (typeof body.active === "boolean") {
      if (id === me.id && !body.active) {
        return NextResponse.json(
          { error: "Você não pode desativar a própria conta." },
          { status: 400 },
        );
      }
      patch.active = body.active;
    }
    if (body.password) {
      if (String(body.password).length < 6) {
        return NextResponse.json(
          { error: "A senha deve ter ao menos 6 caracteres." },
          { status: 400 },
        );
      }
      patch.passwordHash = hashPassword(String(body.password));
    }

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Senha trocada ou conta desativada → encerra sessões ativas
    if (body.password || body.active === false) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    const what = body.password
      ? "teve a senha redefinida"
      : body.active === false
        ? "foi desativado"
        : body.active === true
          ? "foi reativado"
          : body.role
            ? `agora é ${ROLE_LABELS[updated.role].toLowerCase()}`
            : "teve o cadastro atualizado";

    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "updated",
      text: `${updated.name} ${what}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao atualizar usuário" }, { status: 500 });
  }
}
