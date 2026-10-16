import { getFile, isMediaPath } from "@/lib/blob";
import { getWatermarkSettings } from "@/lib/features";
import { getWatermarkLogo, watermark } from "@/lib/watermark";

/**
 * Serve fotos e logos de um Blob Store privado ou do disco do servidor. Os nomes têm sufixo aleatório e
 * nunca mudam, então a resposta é cacheada por 1 ano no navegador e na CDN.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  if (!isMediaPath(pathname)) {
    return new Response("Not found", { status: 404 });
  }
  const result = await getFile(pathname);
  if (!result) return new Response("Not found", { status: 404 });
  // ?wm=padrao|logo|linhas (ou 1): fotos de imóveis exibidas no site saem com marca
  // d'água. O modo vem na URL (definido pelo parceiro dono do imóvel) — assim a
  // mesma foto usada em dois anúncios respeita o modo de cada um.
  const mode = new URL(req.url).searchParams.get("wm") ?? "";
  const wantsMark =
    ["1", "padrao", "logo", "linhas"].includes(mode) &&
    pathname.startsWith("imoveis/") &&
    /^image\/(jpeg|png|webp)/.test(result.contentType);
  const base = wantsMark ? await getWatermarkSettings() : null;
  const wm = !base
    ? null
    : mode === "logo"
      ? { ...base, enabled: true, logo: true, lines: false }
      : mode === "linhas"
        ? { ...base, enabled: true, logo: false, lines: true }
        : base;
  if (wm?.enabled && (wm.logo || wm.lines)) {
    try {
      const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
      const { data, type } = await watermark(buf, wm, await getWatermarkLogo());
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": type,
          "Content-Length": String(data.length),
          // Cache mais curto: mudanças em Configurações › Marca d'água aparecem em até ~1 h
          "Cache-Control": "public, max-age=600, s-maxage=3600",
        },
      });
    } catch (e) {
      console.error("[marca d'água]", e);
      // Falhou: cai para a foto original abaixo (busca de novo, o stream já foi lido)
      const again = await getFile(pathname);
      if (!again) return new Response("Not found", { status: 404 });
      return new Response(again.stream, {
        headers: { "Content-Type": again.contentType, "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.contentType,
      // Sem content-length quando o Blob responde compactado (size = 0): repassar
      // "0" faria o navegador descartar o corpo — o KMZ chegava vazio.
      ...(result.size > 0 ? { "Content-Length": String(result.size) } : {}),
      // ?wm=1 servido sem marca (desligada): cache curto para religar sem esperar
      "Cache-Control": wantsMark
        ? "public, max-age=600, s-maxage=3600"
        : "public, max-age=31536000, s-maxage=31536000, immutable",
      // CORS: o mapa público lê o KMZ via fetch
      "Access-Control-Allow-Origin": "*",
      ...(pathname.startsWith("kmz/")
        ? { "Content-Disposition": `attachment; filename="${pathname.split("/").pop()}"` }
        : {}),
    },
  });
}
