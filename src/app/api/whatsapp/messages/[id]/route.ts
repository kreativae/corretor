import { getDb } from "@/db";
import { waMessages } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { deleteMessage, WhatsAppError } from "@/lib/whatsapp";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * Apaga uma mensagem: { scope: "all" } apaga também no WhatsApp do contato,
 * { scope: "me" } tira só do CRM. Quem enviou apaga a própria; o administrador, qualquer uma.
 */
export async function DELETE(req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const scope = body.scope === "all" ? "all" : "me";

  const [m] = await (await getDb()).select().from(waMessages).where(eq(waMessages.id, id));
  if (!m) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  const own = m.direction === "out" && !!m.sentBy && m.sentBy === user.name;
  if (!isAdmin(user) && !own) {
    return NextResponse.json({ error: "Só quem enviou ou um administrador pode apagar esta mensagem." }, { status: 403 });
  }
  try {
    return NextResponse.json(await deleteMessage(id, scope));
  } catch (e) {
    const status = e instanceof WhatsAppError ? 400 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao apagar." }, { status });
  }
}
