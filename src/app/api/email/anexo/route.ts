import { getCurrentUser } from "@/lib/auth";
import { putFile, STORAGE_MISSING, storageReady } from "@/lib/blob";
import { cleanupStaleUploads, discardUploads, MAIL_ATTACHMENT_MAX, trackUpload } from "@/lib/mail";
import { NextResponse } from "next/server";
import { mailboxOff } from "@/lib/mail-access";

/** Guarda um anexo do e-mail que o usuário está escrevendo (pasta email/<usuário>/). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para enviar arquivos." }, { status: 401 });
  const off = await mailboxOff();
  if (off) return off;
  if (!storageReady()) return NextResponse.json({ error: STORAGE_MISSING }, { status: 500 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    if (file.size > MAIL_ATTACHMENT_MAX) {
      return NextResponse.json({ error: `"${file.name}" passa de 10 MB.` }, { status: 413 });
    }
    const name = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100) || "anexo";
    const contentType = file.type || "application/octet-stream";
    const saved = await putFile(`email/${user.id}/${name}`, file, { contentType, prefer: "private" });
    await trackUpload(user.id, saved.pathname, saved.access);
    // Aproveita para apagar o que ficou esquecido de outros rascunhos
    cleanupStaleUploads().catch((e) => console.error("[anexos esquecidos]", e));
    return NextResponse.json({
      id: saved.pathname,
      filename: file.name.slice(0, 150) || name,
      size: file.size,
      contentType,
      access: saved.access,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao salvar o arquivo" }, { status: 500 });
  }
}

/** Remove anexos de um e-mail que não foi enviado: { ids: string[] } */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 20) : [];
  const removed = await discardUploads(user.id, ids);
  return NextResponse.json({ removed });
}
