import { apiUser, unauthorized } from "@/lib/api-auth";
import { fetchMedia } from "@/lib/whatsapp";

/** Foto, áudio ou documento recebido (o arquivo fica na Meta; só logado acessa) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiUser())) return unauthorized();
  const id = (await params).id.replace(/[^\w-]/g, "");
  try {
    const m = await fetchMedia(id);
    return new Response(m.body, { headers: { "Content-Type": m.type, "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response("Mídia indisponível", { status: 404 });
  }
}
