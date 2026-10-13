import { getCurrentUser } from "@/lib/auth";
import { blobToken } from "@/lib/blob";
import { get } from "@vercel/blob";

/** Baixa um PDF enviado (histórico da Negociação) — só para quem está logado. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  if (!pathname.startsWith("envios/") || pathname.includes("..")) return new Response("Not found", { status: 404 });
  const token = blobToken();
  if (!token) return new Response("Storage not configured", { status: 500 });
  const access = new URL(req.url).searchParams.get("a") === "public" ? "public" : "private";
  const result = await get(pathname, { access, token }).catch(() => null);
  if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pathname.split("/").pop()}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
