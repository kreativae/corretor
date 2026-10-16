import { apiUser, unauthorized } from "@/lib/api-auth";
import { fetchMedia, lineFor } from "@/lib/whatsapp";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
};

/**
 * Foto, áudio ou documento da conversa. O arquivo fica no WhatsApp e é buscado na
 * hora (nada é guardado no servidor); só logado acessa. ?download=1 baixa o arquivo.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const id = (await params).id.replace(/[^\w-]/g, "");
  try {
    const m = await fetchMedia(await lineFor(user.id), id);
    const type = m.type.split(";")[0].trim();
    const headers: Record<string, string> = { "Content-Type": m.type, "Cache-Control": "private, max-age=86400" };
    if (new URL(req.url).searchParams.get("download") === "1") {
      headers["Content-Disposition"] = `attachment; filename="whatsapp-${id.slice(0, 12)}.${EXT[type] ?? type.split("/")[1]?.replace(/\W/g, "") ?? "bin"}"`;
    }
    return new Response(m.body, { headers });
  } catch {
    return new Response("Mídia indisponível", { status: 404 });
  }
}
