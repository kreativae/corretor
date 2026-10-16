import { getCurrentUser } from "@/lib/auth";
import { putFile, STORAGE_MISSING, storageReady } from "@/lib/blob";
import { NextResponse } from "next/server";

const MAX_BYTES = 4 * 1024 * 1024;

/** Recebe a ficha em PDF gerada no navegador e guarda no armazenamento (pasta envios/). */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Faça login para enviar arquivos." }, { status: 401 });
  }
  if (!storageReady()) return NextResponse.json({ error: STORAGE_MISSING }, { status: 500 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Envie um PDF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF acima de 4 MB." }, { status: 413 });
    const name = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "ficha.pdf";
    // Privado; num store público do Blob grava público (o nome tem sufixo aleatório)
    const saved = await putFile(`envios/${name}`, file, { contentType: "application/pdf", prefer: "private" });
    return NextResponse.json({ pathname: saved.pathname, name, size: file.size, access: saved.access });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao salvar o PDF" }, { status: 500 });
  }
}
