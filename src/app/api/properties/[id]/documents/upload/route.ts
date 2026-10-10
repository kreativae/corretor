import { apiUser } from "@/lib/api-auth";
import { blobToken } from "@/lib/blob";
import { DOC_DIRECT_MAX_BYTES, DOC_EXTENSIONS } from "@/lib/documents";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * Autoriza o envio direto do navegador ao Blob (arquivos acima de 4 MB, que
 * não cabem no corpo de uma função da Vercel). Só gera token para usuário
 * logado e só dentro de documentos/<id do imóvel>/.
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request: req,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!(await apiUser())) throw new Error("Faça login para enviar arquivos.");
        if (!pathname.startsWith(`documentos/${id}/`) || pathname.includes("..")) {
          throw new Error("Destino inválido.");
        }
        return {
          allowedContentTypes: [...new Set(Object.values(DOC_EXTENSIONS))],
          maximumSizeInBytes: DOC_DIRECT_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao autorizar o envio";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
