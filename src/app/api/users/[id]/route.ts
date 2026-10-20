import { getDb } from "@/db";
import { activities, sessions, users } from "@/db/schema";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { passwordProblem } from "@/lib/password";
import { ROLE_LABELS } from "@/lib/labels";
import { isAdmin, isSuperadmin } from "@/lib/roles";
import { and, eq, ne } from "drizzle-orm";
import { cleanMailbox } from "@/lib/mail";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireAdmin();
  try {
    const { id } = await params;
    const body = await req.json();

    // Contas da gerência só são alteradas pela própria gerência
    const [target] = await (await getDb()).select({ role: users.role }).from(users).where(eq(users.id, id));
    if (target?.role === "superadmin" && !isSuperadmin(me)) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const patch: Partial<typeof users.$inferInsert> = {};
    if (body.name?.trim()) patch.name = body.name.trim();
    if (body.creci !== undefined) patch.creci = String(body.creci ?? "").trim() || null;
    if (body.title !== undefined) patch.title = String(body.title ?? "").trim().slice(0, 60) || null;
    if (body.phone !== undefined) patch.phone = String(body.phone ?? "").replace(/\D/g, "") || null;
    if (body.mailbox !== undefined) {
      const mailbox = cleanMailbox(body.mailbox) || null;
      if (mailbox) {
        const [taken] = await (await getDb())
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.mailbox, mailbox), ne(users.id, id)));
        if (taken) {
          return NextResponse.json({ error: "Este endereço de e-mail já é de outro usuário." }, { status: 409 });
        }
      }
      patch.mailbox = mailbox;
    }
    if (body.role && ["admin", "corretor"].includes(body.role) && target?.role !== "superadmin") {
      if (id === me.id && !isAdmin({ role: body.role })) {
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
      const weak = passwordProblem(String(body.password));
      if (weak) return NextResponse.json({ error: weak }, { status: 400 });
      patch.passwordHash = hashPassword(String(body.password));
    }

    // Perdeu o celular: o administrador desliga as duas etapas e a pessoa ativa de novo
    if (body.resetTwoFactor === true) {
      patch.totpSecret = null;
      patch.totpEnabledAt = null;
      patch.totpLastStep = null;
      patch.recoveryCodes = "";
    }

    const [updated] = await (await getDb())
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Senha trocada ou conta desativada → encerra sessões ativas
    if (body.password || body.active === false || body.resetTwoFactor === true) {
      await (await getDb()).delete(sessions).where(eq(sessions.userId, id));
    }

    const what = body.resetTwoFactor === true
      ? "teve a verificação em duas etapas desativada pelo administrador"
      : body.password
      ? "teve a senha redefinida"
      : body.active === false
        ? "foi desativado"
        : body.active === true
          ? "foi reativado"
          : body.role
            ? `agora é ${ROLE_LABELS[updated.role].toLowerCase()}`
            : "teve o cadastro atualizado";

    await (await getDb()).insert(activities).values({
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
