import { getDb } from "@/db";
import { mailMessages } from "@/db/schema";
import { findVisibleMessage, mailboxOff, mailUser } from "@/lib/mail-access";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** Mensagem completa; abrir marca como lida */
export async function GET(_req: Request, { params }: Params) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const msg = await findVisibleMessage(u, (await params).id);
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  if (!msg.read) {
    await (await getDb()).update(mailMessages).set({ read: true }).where(eq(mailMessages.id, msg.id));
  }
  return NextResponse.json({ ...msg, read: true });
}

/** { read: boolean } */
export async function PATCH(req: Request, { params }: Params) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const msg = await findVisibleMessage(u, (await params).id);
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.read === "boolean") {
    await (await getDb()).update(mailMessages).set({ read: body.read }).where(eq(mailMessages.id, msg.id));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const msg = await findVisibleMessage(u, (await params).id);
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  await (await getDb()).delete(mailMessages).where(eq(mailMessages.id, msg.id));
  return NextResponse.json({ ok: true });
}
