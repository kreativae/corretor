import { db } from "@/db";
import { activities, properties, propertyDocuments } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { blobToken } from "@/lib/blob";
import {
  DOC_CATEGORIES,
  DOC_EXTENSIONS,
  DOC_MAX_BYTES,
  docExtension,
  safeDocName,
  type DocCategory,
} from "@/lib/documents";
import { listPropertyDocuments } from "@/lib/queries";
import { head, put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** Lista os documentos internos do imóvel (só equipe logada). */
export async function GET(_req: Request, { params }: Params) {
  if (!(await apiUser())) return unauthorized();
  const { id } = await params;
  return NextResponse.json(await listPropertyDocuments(id));
}

/** Anexa um documento interno (multipart: file, category). Nunca é exposto no site. */
export async function POST(req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "Token do Vercel Blob não encontrado. Conecte o Blob Store e faça um novo deploy." },
      { status: 500 },
    );
  }
  try {
    const { id } = await params;
    const [prop] = await db
      .select({ id: properties.id, code: properties.code })
      .from(properties)
      .where(eq(properties.id, id));
    if (!prop) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });

    // Arquivo grande já enviado direto ao Blob pelo navegador: só registra
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = (await req.json()) as {
        pathname?: string;
        url?: string;
        public?: boolean;
        name?: string;
        category?: string;
      };
      const pathname = String(body.pathname ?? "");
      if (!pathname.startsWith(`documentos/${id}/`) || pathname.includes("..")) {
        return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
      }
      const info = await head(body.public && body.url ? body.url : pathname, { token }).catch(
        () => null,
      );
      if (!info) {
        return NextResponse.json({ error: "Arquivo não encontrado no armazenamento." }, { status: 400 });
      }
      const name = String(body.name ?? pathname.split("/").pop()).slice(0, 200);
      const cat = String(body.category ?? "outro");
      const category: DocCategory = cat in DOC_CATEGORIES ? (cat as DocCategory) : "outro";
      return NextResponse.json(
        await register({
          id,
          name,
          category,
          pathname: info.pathname,
          url: body.public ? info.url : "",
          size: info.size,
          contentType: DOC_EXTENSIONS[docExtension(name)] ?? info.contentType,
          user: user.name,
        }),
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    const ext = docExtension(file.name);
    const contentType = DOC_EXTENSIONS[ext];
    if (!contentType) {
      return NextResponse.json(
        { error: "Formato não aceito. Use PDF, imagem, Word, Excel, texto, KMZ ou ZIP." },
        { status: 400 },
      );
    }
    if (file.size > DOC_MAX_BYTES) {
      return NextResponse.json(
        { error: "Arquivo acima de 4 MB. Comprima o PDF ou divida em partes." },
        { status: 413 },
      );
    }
    const requested = String(form.get("category") ?? "outro");
    const category: DocCategory = requested in DOC_CATEGORIES ? (requested as DocCategory) : "outro";
    const name = file.name.slice(0, 200);
    const safe = safeDocName(name);

    const options = { token, addRandomSuffix: true, contentType } as const;
    let pathname: string;
    let url = "";
    try {
      // Privado: só sai pelo proxy autenticado deste módulo
      const blob = await put(`documentos/${id}/${safe}`, file, { ...options, access: "private" });
      pathname = blob.pathname;
    } catch (e) {
      // Store público: o arquivo fica num endereço aleatório, não listado em lugar nenhum
      if (!(e instanceof Error && /public/i.test(e.message))) throw e;
      const blob = await put(`documentos/${id}/${safe}`, file, { ...options, access: "public" });
      pathname = blob.pathname;
      url = blob.url;
    }

    return NextResponse.json(
      await register({ id, name, category, pathname, url, size: file.size, contentType, user: user.name }),
    );
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Falha no envio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Grava o documento e registra na linha do tempo do imóvel. */
async function register(d: {
  id: string;
  name: string;
  category: DocCategory;
  pathname: string;
  url: string;
  size: number;
  contentType: string;
  user: string;
}) {
  const [doc] = await db
    .insert(propertyDocuments)
    .values({
      propertyId: d.id,
      name: d.name,
      category: d.category,
      pathname: d.pathname,
      url: d.url,
      size: d.size,
      contentType: d.contentType,
      uploadedBy: d.user,
    })
    .returning();
  await db.insert(activities).values({
    entity: "imovel",
    entityId: d.id,
    kind: "updated",
    text: `Documento interno anexado: ${d.name} (${DOC_CATEGORIES[d.category]}) por ${d.user}.`,
  });
  return doc;
}
