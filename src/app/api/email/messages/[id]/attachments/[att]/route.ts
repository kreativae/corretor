import { receivedAttachmentUrl } from "@/lib/mail";
import { findVisibleMessage, mailUser } from "@/lib/mail-access";
import { NextResponse } from "next/server";

/** Baixa um anexo recebido (link temporário do Resend) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; att: string }> }) {
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { id, att } = await params;
  const msg = await findVisibleMessage(u, id);
  const file = msg?.attachments.find((a) => a.id === att);
  if (!msg?.providerId || msg.direction !== "in" || !file) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
  try {
    return NextResponse.redirect(await receivedAttachmentUrl(msg.providerId, file.id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao baixar" }, { status: 502 });
  }
}
