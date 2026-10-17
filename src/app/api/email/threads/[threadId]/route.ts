import { getDb } from "@/db";
import { mailMessages } from "@/db/schema";
import { mailboxOff, mailUser, visibleTo, type MailUser } from "@/lib/mail-access";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ threadId: string }> };

async function threadMessages(u: MailUser, threadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) return [];
  return (await getDb())
    .select()
    .from(mailMessages)
    .where(and(eq(mailMessages.threadId, threadId), visibleTo(u)))
    .orderBy(asc(mailMessages.createdAt));
}

/** Conversa inteira, da mais antiga para a mais nova; abrir marca como lida */
export async function GET(_req: Request, { params }: Params) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const msgs = await threadMessages(u, (await params).threadId);
  if (!msgs.length) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  const unread = msgs.filter((m) => !m.read).map((m) => m.id);
  if (unread.length) {
    await (await getDb()).update(mailMessages).set({ read: true }).where(inArray(mailMessages.id, unread));
  }
  return NextResponse.json({ messages: msgs.map((m) => ({ ...m, read: true })) });
}

/** { read: false } — marca a última mensagem recebida como não lida */
export async function PATCH(req: Request, { params }: Params) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const msgs = await threadMessages(u, (await params).threadId);
  const body = await req.json().catch(() => ({}));
  const lastIn = msgs.filter((m) => m.direction === "in").pop();
  if (body.read === false && lastIn) {
    await (await getDb()).update(mailMessages).set({ read: false }).where(eq(mailMessages.id, lastIn.id));
  }
  return NextResponse.json({ ok: true });
}

/** Exclui a conversa inteira */
export async function DELETE(_req: Request, { params }: Params) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const msgs = await threadMessages(u, (await params).threadId);
  if (!msgs.length) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  await (await getDb()).delete(mailMessages).where(inArray(mailMessages.id, msgs.map((m) => m.id)));
  return NextResponse.json({ ok: true });
}
