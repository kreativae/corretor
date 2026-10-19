import { getFile } from "@/lib/blob";
import { kmzAccess, kmzPathname } from "@/lib/kmz-lock";
import { getPropertyByCode } from "@/lib/queries";
import { normalizeRural, acceptsKmz } from "@/lib/rural";
import { NextResponse } from "next/server";

/**
 * Link fixo do KMZ (download do mapa e leitura pelo mapa do site). Entrega o arquivo atual, então
 * fichas impressas seguem válidas se o KMZ mudar. Com senha no imóvel, só depois de liberar no mapa
 * (ou para quem está logado no CRM). ?inline=1: leitura pelo mapa, sem forçar download.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPropertyByCode(id);
  const r = p && acceptsKmz(p.type) ? normalizeRural(p.rural) : null;
  if (!p || !r?.kmzUrl) {
    return new NextResponse("KMZ não encontrado para esta propriedade.", { status: 404 });
  }
  if ((await kmzAccess(p.id)) === "locked") {
    // Caminho relativo: atrás do proxy (Coolify) o req.url é o endereço interno do container
    return new NextResponse(null, { status: 302, headers: { Location: `/imoveis/${p.code}/mapa`, "Cache-Control": "no-store" } });
  }

  const pathname = kmzPathname(r.kmzUrl);
  const file = pathname ? await getFile(pathname) : null;
  if (!file) {
    // Arquivo antigo fora do armazenamento do sistema (ex.: Blob público): segue o endereço salvo
    const target = new URL(r.kmzUrl, req.url);
    if (target.hostname.endsWith("blob.vercel-storage.com")) target.searchParams.set("download", "1");
    return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const name = (r.kmzName || `${p.code}.kmz`).replace(/["\r\n]/g, "");
  return new Response(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      ...(file.size > 0 ? { "Content-Length": String(file.size) } : {}),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      // Pode ter senha: nunca em cache compartilhado
      "Cache-Control": "private, no-store",
    },
  });
}
