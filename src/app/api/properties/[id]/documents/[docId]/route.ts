import { db } from "@/db";
import { activities, propertyDocuments } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { blobToken } from "@/lib/blob";
import { del, get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; docId: string }> };

async function findDoc(id: string, docId: string) {
  const [doc] = await db
    .select()
    .from(propertyDocuments)
    .where(and(eq(propertyDocuments.id, docId), eq(propertyDocuments.propertyId, id)));
  return doc ?? null;
}

/** Abre/baixa o documento — exige login; nunca é cacheado em CDN. */
export async function GET(req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const { id, docId } = await params;
  const doc = await findDoc(id, docId).catch(() => null);
  if (!doc) return new Response("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`;
  const headers = {
    "Content-Type": doc.contentType,
    "Content-Disposition": disposition,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  const token = blobToken();
  if (!token) return new Response("Storage not configured", { status: 500 });
  if (doc.url) {
    // Store público: repassa o conteúdo sem expor o endereço
    const res = await fetch(doc.url);
    if (!res.ok || !res.body) return new Response("Not found", { status: 404 });
    return new Response(res.body, { headers });
  }
  const result = await get(doc.pathname, { access: "private", token }).catch(() => null);
  if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(result.stream, {
    headers: {
      ...headers,
      ...(result.blob.size > 0 ? { "Content-Length": String(result.blob.size) } : {}),
    },
  });
}

/** Remove o documento do Blob e do banco. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  try {
    const { id, docId } = await params;
    const doc = await findDoc(id, docId);
    if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    const token = blobToken();
    if (token) await del(doc.url || doc.pathname, { token }).catch((e) => console.error(e));
    await db.delete(propertyDocuments).where(eq(propertyDocuments.id, doc.id));
    await db.insert(activities).values({
      entity: "imovel",
      entityId: id,
      kind: "updated",
      text: `Documento interno removido: ${doc.name} por ${user.name}.`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao remover documento" }, { status: 500 });
  }
}
