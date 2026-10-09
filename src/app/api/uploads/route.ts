import { getCurrentUser } from "@/lib/auth";
import { blobToken, MEDIA_FOLDERS, type MediaFolder } from "@/lib/blob";
import { requestPublicOrigin } from "@/lib/google";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

/** Diagnóstico: o armazenamento está configurado e o usuário está logado? */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Faça login para enviar arquivos." });
  if (!blobToken()) {
    return NextResponse.json({
      ok: false,
      error:
        "Token do Vercel Blob não encontrado. Conecte o Blob Store ao projeto e faça um novo deploy.",
    });
  }
  return NextResponse.json({ ok: true });
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
// Funções da Vercel aceitam corpo de até 4,5 MB; o navegador já comprime antes.
const MAX_BYTES = 4 * 1024 * 1024;

/** Recebe a foto (multipart/form-data, campo "file") e grava no Vercel Blob. */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Faça login para enviar arquivos." }, { status: 401 });
  }
  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "Token do Vercel Blob não encontrado. Conecte o Blob Store e faça um novo deploy." },
      { status: 500 },
    );
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    const requested = String(form.get("folder") ?? "imoveis");
    const folder: MediaFolder = (MEDIA_FOLDERS as readonly string[]).includes(requested)
      ? (requested as MediaFolder)
      : "imoveis";

    let pathname: string;
    let contentType: string;
    if (folder === "kmz") {
      // Navegadores costumam enviar KMZ sem tipo; valida pela extensão
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "kmz" && ext !== "kml") {
        return NextResponse.json({ error: "Envie um arquivo .kmz ou .kml." }, { status: 400 });
      }
      contentType = ext === "kmz" ? "application/vnd.google-earth.kmz" : "application/vnd.google-earth.kml+xml";
      pathname = `kmz/perimetro.${ext}`;
    } else {
      if (!ALLOWED.includes(file.type)) {
        return NextResponse.json({ error: "Formato não suportado (use JPG, PNG ou WebP)." }, { status: 400 });
      }
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      contentType = file.type;
      pathname = `${folder}/${folder === "marca" ? "logo" : "foto"}.${ext}`;
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo acima de 4 MB." }, { status: 413 });
    }
    const options = { token, addRandomSuffix: true, contentType } as const;
    try {
      const blob = await put(pathname, file, { ...options, access: "public" });
      return NextResponse.json({ url: blob.url });
    } catch (e) {
      // Store privado: grava privado e serve pelo proxy /api/media (com cache de CDN)
      if (!(e instanceof Error && /private/i.test(e.message))) throw e;
      const blob = await put(pathname, file, { ...options, access: "private" });
      return NextResponse.json({
        url: `${requestPublicOrigin(req)}/api/media/${blob.pathname}`,
      });
    }
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Falha no upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
