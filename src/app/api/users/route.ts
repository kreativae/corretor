import { getDb } from "@/db";
import { activities, users } from "@/db/schema";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { getAccount } from "@/lib/account";
import { and, count, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cleanMailbox } from "@/lib/mail";

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

    // Limite de usuários do plano (definido pela gerência)
    const acct = await getAccount();
    if (acct.maxUsers) {
      const [{ n }] = await (await getDb())
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.active, true), ne(users.role, "superadmin")));
      if (n >= acct.maxUsers) {
        return NextResponse.json(
          { error: `Seu plano permite até ${acct.maxUsers} usuários ativos. Desative alguém ou fale com o suporte para ampliar.` },
          { status: 403 },
        );
      }
    }

    const email = body.email.trim().toLowerCase();
    const exists = await (await getDb()).select().from(users).where(eq(users.email, email));
    if (exists.length) {
      return NextResponse.json(
        { error: "Já existe um usuário com este e-mail." },
        { status: 409 },
      );
    }

    const mailbox = cleanMailbox(body.mailbox) || null;
    if (mailbox) {
      const [taken] = await (await getDb()).select({ id: users.id }).from(users).where(eq(users.mailbox, mailbox));
      if (taken) {
        return NextResponse.json({ error: "Este endereço de e-mail já é de outro usuário." }, { status: 409 });
      }
    }

    const [created] = await (await getDb())
      .insert(users)
      .values({
        name: body.name.trim(),
        email,
        role: body.role === "admin" ? "admin" : "corretor",
        creci: body.creci || null,
        mailbox,
        phone: String(body.phone ?? "").replace(/\D/g, "") || null,
        passwordHash: body.password ? hashPassword(String(body.password)) : null,
      })
      .returning();

    await (await getDb()).insert(activities).values({
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
