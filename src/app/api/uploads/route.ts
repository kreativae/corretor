import { getCurrentUser } from "@/lib/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * Upload direto do navegador para o Vercel Blob (sem passar pelo limite
 * de 4,5 MB das funções). Requer BLOB_READ_WRITE_TOKEN na Vercel.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
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
    const message = e instanceof Error ? e.message : "Falha no upload";
    const missingToken = /BLOB_READ_WRITE_TOKEN|No token found/i.test(message);
    return NextResponse.json(
      {
        error: missingToken
          ? "Armazenamento de imagens não configurado (crie um Blob Store na Vercel)."
          : message,
      },
      { status: 400 },
    );
  }
}
