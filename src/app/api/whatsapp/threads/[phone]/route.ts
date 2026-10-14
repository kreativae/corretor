import { db } from "@/db";
import { waMessages, waThreads } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { linkThreadContact } from "@/lib/whatsapp";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ phone: string }> };

/** Mensagens da conversa; marca como lida */
export async function GET(_req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const phone = (await params).phone.replace(/\D/g, "");
  const messages = await db
    .select()
    .from(waMessages)
    .where(eq(waMessages.phone, phone))
    .orderBy(asc(waMessages.createdAt))
    .limit(500);
  await db.update(waThreads).set({ unread: 0 }).where(eq(waThreads.phone, phone));
  return NextResponse.json(messages);
}

/** { action: "lead" | "contato" } cria/vincula o contato · { archived: boolean } arquiva */
export async function PATCH(req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const phone = (await params).phone.replace(/\D/g, "");
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "lead" || body.action === "contato")
      return NextResponse.json({
        contactId: await linkThreadContact(phone, body.action === "lead" ? "lead" : "cliente", {
          name: typeof body.name === "string" ? body.name.slice(0, 120) : undefined,
          email: typeof body.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.slice(0, 200) : undefined,
        }),
      });
    if (typeof body.archived === "boolean") {
      await db.update(waThreads).set({ archived: body.archived }).where(eq(waThreads.phone, phone));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Nada a fazer." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha." }, { status: 500 });
  }
}
