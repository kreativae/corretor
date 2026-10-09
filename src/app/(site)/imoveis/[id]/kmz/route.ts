import { getPropertyByCode } from "@/lib/queries";
import { isRuralType, normalizeRural } from "@/lib/rural";
import { NextResponse } from "next/server";

/**
 * Link fixo de download do KMZ (destino do QR code da ficha). Redireciona
 * para o arquivo atual, então fichas impressas seguem válidas se o KMZ mudar.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPropertyByCode(id);
  const r = p && isRuralType(p.type) ? normalizeRural(p.rural) : null;
  if (!p || !r?.kmzUrl) {
    return new NextResponse("KMZ não encontrado para esta propriedade.", { status: 404 });
  }
  const target = new URL(r.kmzUrl, req.url);
  // Blob público: força download; o proxy privado (/api/media) já envia como anexo
  if (target.hostname.endsWith("blob.vercel-storage.com")) target.searchParams.set("download", "1");
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
