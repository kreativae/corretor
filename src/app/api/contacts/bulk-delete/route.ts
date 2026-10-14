import { apiUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/db";
import { activities, contacts, integrations } from "@/db/schema";
import { GoogleApiError, googleApi } from "@/lib/google";
import { inArray, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/** Exclui vários contatos de uma vez · { ids: string[], google?: boolean } */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; google?: unknown };
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 1000)
    : [];
  if (!ids.length) return NextResponse.json({ error: "Nenhum contato selecionado." }, { status: 400 });

  try {
    const rows = await db
      .select({ id: contacts.id, name: contacts.name, googleResourceName: contacts.googleResourceName })
      .from(contacts)
      .where(inArray(contacts.id, ids));
    if (!rows.length) return NextResponse.json({ error: "Contatos não encontrados." }, { status: 404 });

    // Apaga também no Google Contacts quando pedido (senão voltam na próxima sincronização)
    let deletedInGoogle = 0;
    const linked = rows.filter((r) => r.googleResourceName);
    if (body.google === true && linked.length) {
      const [integration] = await db.select().from(integrations).where(eq(integrations.provider, "google_contacts"));
      if (!integration?.connected) {
        return NextResponse.json(
          { error: "Google Contacts não está conectado. Conecte ou exclua só no CRM." },
          { status: 400 },
        );
      }
      for (const r of linked) {
        try {
          await googleApi(integration, `https://people.googleapis.com/v1/${r.googleResourceName}:deleteContact`, {
            method: "DELETE",
          });
          deletedInGoogle++;
        } catch (e) {
          if (e instanceof GoogleApiError && e.status === 404) deletedInGoogle++;
          else throw e;
        }
      }
    }

    await db.delete(contacts).where(inArray(contacts.id, rows.map((r) => r.id)));

    const names = rows.slice(0, 5).map((r) => r.name).join(", ");
    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "updated",
      text:
        rows.length === 1
          ? `${rows[0].name} foi excluído da agenda${deletedInGoogle ? " e do Google Contacts" : ""}.`
          : `${rows.length} contatos excluídos da agenda${deletedInGoogle ? ` (${deletedInGoogle} também do Google Contacts)` : ""}: ${names}${rows.length > 5 ? "…" : ""}.`,
    });

    return NextResponse.json({ ok: true, deleted: rows.map((r) => r.id), deletedInGoogle });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao excluir contatos" }, { status: 500 });
  }
}
