import { currentConn } from "@/db";
import { loggedUser } from "@/lib/auth";
import { getFile, isMediaPath } from "@/lib/blob";
import { getWatermarkSettings } from "@/lib/features";
import {
  isHotlink,
  photoMode,
  PUBLIC_MAX_PX,
  publicCacheKey,
  readPublicCache,
  validSignature,
  writePublicCache,
} from "@/lib/media-guard";
import { clientIp, overLimit } from "@/lib/rate-limit";
import { getWatermarkLogo, watermark } from "@/lib/watermark";

/**
 * Serve fotos, logos e KMZ do Blob privado ou do disco do servidor.
 * Fotos de imóveis (imoveis/): a original só vai para a equipe logada (no CRM, sem ?wm) e para o
 * feed dos portais (endereço assinado, ?k=). O resto recebe a versão pública: reduzida, sem
 * metadados e com a marca d'água do parceiro dono do imóvel (ver lib/media-guard.ts).
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
  // KMZ: endereço direto só para a equipe logada. O site entrega pelo /imoveis/<código>/kmz,
  // que respeita a senha do imóvel
  const isKmz = pathname.startsWith("kmz/");
  if (isKmz && !(await loggedUser())) return new Response("Not found", { status: 404 });

  if (pathname.startsWith("imoveis/")) {
    const url = new URL(req.url);
    // ?wm= vem das páginas do site: mesmo logado, a foto sai como o visitante vê
    const original =
      validSignature(pathname, url.searchParams.get("k")) || (!url.searchParams.has("wm") && !!(await loggedUser()));
    if (!original) return publicPhoto(req, pathname);
  }

  const result = await getFile(pathname);
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.contentType,
      // Sem content-length quando o Blob responde compactado (size = 0): repassar
      // "0" faria o navegador descartar o corpo — o KMZ chegava vazio.
      ...(result.size > 0 ? { "Content-Length": String(result.size) } : {}),
      "Cache-Control": isKmz
        ? "private, no-store"
        : pathname.startsWith("imoveis/")
          ? "private, max-age=86400"
          : "public, max-age=31536000, s-maxage=31536000, immutable",
      ...(pathname.startsWith("imoveis/") ? { Vary: "Cookie" } : {}),
      ...(isKmz ? { "Content-Disposition": `attachment; filename="${pathname.split("/").pop()}"` } : {}),
    },
  });
}

/** Foto para o público: reduzida, sem metadados e com a marca d'água do imóvel */
async function publicPhoto(req: Request, pathname: string) {
  if (isHotlink(req)) return new Response("Forbidden", { status: 403 });
  // Uma página do site com muitas fotos fica bem abaixo disso; robôs baixando tudo, não
  if (overLimit(`media:${clientIp(req)}`, 1200, 10 * 60_000)) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": "600" } });
  }

  const mode = await photoMode(pathname);
  const base = await getWatermarkSettings();
  const off = { ...base, logo: false, lines: false };
  const wm =
    !base.enabled || mode === "nenhuma"
      ? off
      : mode === "logo"
        ? { ...base, logo: true, lines: false }
        : mode === "linhas"
          ? { ...base, logo: false, lines: true }
          : base;
  const logo = wm.logo ? await getWatermarkLogo() : null;
  const logoTag = !logo ? "-" : logo.kind === "padrao" ? "padrao" : `${logo.png.length}:${logo.ratio}`;
  const key = publicCacheKey((await currentConn()).schema, pathname, JSON.stringify(wm), logoTag, String(PUBLIC_MAX_PX));
  const headers = (type: string, size: number) => ({
    "Content-Type": type,
    "Content-Length": String(size),
    // Mudanças em Configurações › Marca d'água aparecem em até ~1 h
    "Cache-Control": "public, max-age=3600",
    Vary: "Cookie",
    "Content-Disposition": "inline",
  });

  const cached = await readPublicCache(key);
  if (cached) return new Response(new Uint8Array(cached.data), { headers: headers(cached.type, cached.data.length) });

  const result = await getFile(pathname);
  if (!result) return new Response("Not found", { status: 404 });
  if (!/^image\/(jpeg|png|webp|avif|gif)/.test(result.contentType)) {
    // Outros formatos não são processados: só a equipe logada vê
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
    const { data, type } = await watermark(buf, wm, logo, PUBLIC_MAX_PX);
    await writePublicCache(key, type, data);
    return new Response(new Uint8Array(data), { headers: headers(type, data.length) });
  } catch (e) {
    console.error("[fotos] versão pública", e);
    return new Response("Not found", { status: 404 });
  }
}
