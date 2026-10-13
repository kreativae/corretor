import { getCurrentUser } from "@/lib/auth";
import { blobToken } from "@/lib/blob";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_BYTES = 4 * 1024 * 1024;

/** Recebe a ficha em PDF gerada no navegador e guarda no Blob (pasta envios/). */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Faça login para enviar arquivos." }, { status: 401 });
  }
  const token = blobToken();
  if (!token) return NextResponse.json({ error: "Armazenamento (Vercel Blob) não configurado." }, { status: 500 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Envie um PDF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF acima de 4 MB." }, { status: 413 });
    const name = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "ficha.pdf";
    const options = { token, addRandomSuffix: true, contentType: "application/pdf" } as const;
    let blob;
    let access: "private" | "public" = "private";
    try {
      blob = await put(`envios/${name}`, file, { ...options, access: "private" });
    } catch (e) {
      // Store público: grava público (o nome tem sufixo aleatório)
      if (!(e instanceof Error && /public|private/i.test(e.message))) throw e;
      blob = await put(`envios/${name}`, file, { ...options, access: "public" });
      access = "public";
    }
    return NextResponse.json({ pathname: blob.pathname, name, size: file.size, access });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao salvar o PDF" }, { status: 500 });
  }
}
