import { getFile } from "@/lib/blob";
import { receivedAttachmentUrl } from "@/lib/mail";
import { findVisibleMessage, mailboxOff, mailUser } from "@/lib/mail-access";
import { NextResponse } from "next/server";

/** Baixa um anexo: recebido (link temporário do Resend) ou enviado (armazenamento) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; att: string }> }) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { id, att } = await params;
  const msg = await findVisibleMessage(u, id);
  const attId = decodeURIComponent(att);
  const file = msg?.attachments.find((a) => a.id === attId);
  if (!msg || !file) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });

  if (msg.direction === "out") {
    const r = await getFile(file.id, file.access ?? "private");
    if (!r) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
    return new Response(r.stream, {
      headers: {
        "Content-Type": file.contentType || r.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  if (!msg.providerId) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  try {
    return NextResponse.redirect(await receivedAttachmentUrl(msg.providerId, file.id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao baixar" }, { status: 502 });
  }
}
