import { getCurrentUser } from "@/lib/auth";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

/** Token do Blob — aceita prefixo customizado (ex.: CORRETOR_BLOB_READ_WRITE_TOKEN). */
function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN"));
  return key ? process.env[key] : undefined;
}

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
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Formato não suportado (use JPG, PNG ou WebP)." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo acima de 4 MB." }, { status: 413 });
    }
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const blob = await put(`imoveis/foto.${ext}`, file, {
      access: "public",
      token,
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Falha no upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
