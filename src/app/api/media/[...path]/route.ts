import { blobToken, isMediaPath } from "@/lib/blob";
import { get } from "@vercel/blob";
import { getWatermarkSettings } from "@/lib/features";
import { watermark } from "@/lib/watermark";

/**
 * Serve fotos e logos de um Blob Store privado. Os nomes têm sufixo aleatório e
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
  const token = blobToken();
  if (!token) return new Response("Storage not configured", { status: 500 });

  const result = await get(pathname, { access: "private", token }).catch(() => null);
  if (!result || result.statusCode !== 200) {
    return new Response("Not found", { status: 404 });
  }
  // ?wm=padrao|logo|linhas (ou 1): fotos de imóveis exibidas no site saem com marca
  // d'água. O modo vem na URL (definido pelo parceiro dono do imóvel) — assim a
  // mesma foto usada em dois anúncios respeita o modo de cada um.
  const mode = new URL(req.url).searchParams.get("wm") ?? "";
  const wantsMark =
    ["1", "padrao", "logo", "linhas"].includes(mode) &&
    pathname.startsWith("imoveis/") &&
    /^image\/(jpeg|png|webp)/.test(result.blob.contentType ?? "");
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
      const { data, type } = await watermark(buf, wm);
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
      const again = await get(pathname, { access: "private", token }).catch(() => null);
      if (!again || again.statusCode !== 200) return new Response("Not found", { status: 404 });
      return new Response(again.stream, {
        headers: { "Content-Type": again.blob.contentType, "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      // Sem content-length quando o Blob responde compactado (size = 0): repassar
      // "0" faria o navegador descartar o corpo — o KMZ chegava vazio.
      ...(result.blob.size > 0 ? { "Content-Length": String(result.blob.size) } : {}),
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
