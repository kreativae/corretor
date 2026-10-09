import { blobToken, MEDIA_PREFIX } from "@/lib/blob";
import { get } from "@vercel/blob";

/**
 * Serve fotos de um Blob Store privado. Os nomes têm sufixo aleatório e
 * nunca mudam, então a resposta é cacheada por 1 ano no navegador e na CDN.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  if (!pathname.startsWith(MEDIA_PREFIX) || pathname.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const token = blobToken();
  if (!token) return new Response("Storage not configured", { status: 500 });

  const result = await get(pathname, { access: "private", token }).catch(() => null);
  if (!result || result.statusCode !== 200) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Length": String(result.blob.size),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
