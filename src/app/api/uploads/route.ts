import { getCurrentUser } from "@/lib/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
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

/**
 * Upload direto do navegador para o Vercel Blob (sem passar pelo limite
 * de 4,5 MB das funções).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      token: blobToken(),
      onBeforeGenerateToken: async () => {
        if (!(await getCurrentUser())) throw new Error("Faça login para enviar arquivos.");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Falha no upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
