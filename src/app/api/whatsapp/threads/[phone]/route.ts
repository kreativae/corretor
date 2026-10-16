import { getDb } from "@/db";
import { waMessages, waThreads } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { lineFor, linkThreadContact, perUserLines } from "@/lib/whatsapp";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ phone: string }> };

const threadOf = (line: string, phone: string) => and(eq(waThreads.line, line), eq(waThreads.phone, phone));

/** Mensagens da conversa; marca como lida */
export async function GET(_req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { line } = await lineFor(user.id);
  const phone = (await params).phone.replace(/\D/g, "");
  const messages = await (await getDb())
    .select()
    .from(waMessages)
    .where(and(eq(waMessages.line, line), eq(waMessages.phone, phone)))
    .orderBy(asc(waMessages.createdAt))
    .limit(500);
  await (await getDb()).update(waThreads).set({ unread: 0 }).where(threadOf(line, phone));
  return NextResponse.json(messages);
}

/**
 * Apaga a conversa do CRM (mensagens e a conversa na lista). No WhatsApp do contato
 * nada muda: o WhatsApp não permite apagar a conversa do outro lado. No número próprio
 * (QR code) o dono apaga; no número compartilhado (API oficial), só administrador.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const cfg = await lineFor(user.id);
  if (!perUserLines(cfg) && !isAdmin(user)) return NextResponse.json({ error: "Só administradores apagam conversas." }, { status: 403 });
  const phone = (await params).phone.replace(/\D/g, "");
  if (!phone) return NextResponse.json({ error: "Conversa inválida." }, { status: 400 });
  const removed = await (await getDb())
    .delete(waMessages)
    .where(and(eq(waMessages.line, cfg.line), eq(waMessages.phone, phone)))
    .returning({ id: waMessages.id });
  await (await getDb()).delete(waThreads).where(threadOf(cfg.line, phone));
  return NextResponse.json({ ok: true, messages: removed.length });
}

/** { action: "lead" | "contato" } cria/vincula o contato · { archived: boolean } arquiva */
export async function PATCH(req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { line } = await lineFor(user.id);
  const phone = (await params).phone.replace(/\D/g, "");
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "lead" || body.action === "contato")
      return NextResponse.json({
        contactId: await linkThreadContact(line, phone, body.action === "lead" ? "lead" : "cliente", {
          name: typeof body.name === "string" ? body.name.slice(0, 120) : undefined,
          email: typeof body.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.slice(0, 200) : undefined,
        }),
      });
    if (typeof body.archived === "boolean") {
      await (await getDb()).update(waThreads).set({ archived: body.archived }).where(threadOf(line, phone));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Nada a fazer." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha." }, { status: 500 });
  }
}
