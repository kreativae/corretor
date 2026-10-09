import { db } from "@/db";
import { activities, contacts, integrations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { GoogleApiError, googleApi } from "@/lib/google";
import { getContact, getMatchesFor, listDeals, listVisits } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  const [allVisits, allDeals, matches] = await Promise.all([
    listVisits(),
    listDeals(),
    getMatchesFor(contact),
  ]);

  const myVisits = allVisits
    .filter((v) => v.contact?.id === contact.id)
    .map((v) => ({
      id: v.visit.id,
      scheduledAt: v.visit.scheduledAt,
      status: v.visit.status,
      propertyCode: v.property?.code ?? null,
      propertyTitle: v.property?.title ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );

  const myDeals = allDeals
    .filter((d) => d.contact?.id === contact.id)
    .map((d) => ({
      id: d.deal.id,
      stage: d.deal.stage,
      value: d.deal.value,
      propertyCode: d.property?.code ?? null,
      propertyTitle: d.property?.title ?? null,
    }));

  const topMatches = matches.slice(0, 3).map((m) => ({
    id: m.property.id,
    code: m.property.code,
    title: m.property.title,
    neighborhood: m.property.neighborhood,
    price: m.property.price,
    cover: m.property.cover,
    score: m.score,
  }));

  return NextResponse.json({
    contact,
    visits: myVisits,
    deals: myDeals,
    matches: topMatches,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ error: "Nome e telefone obrigatórios" }, { status: 400 });
    }

    const [updated] = await db
      .update(contacts)
      .set({
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: body.email || null,
        type: body.type ?? undefined,
        source: body.source ?? undefined,
        budgetMin: typeof body.budgetMin === "number" ? body.budgetMin : null,
        budgetMax: typeof body.budgetMax === "number" ? body.budgetMax : null,
        interestTypes: Array.isArray(body.interestTypes)
          ? body.interestTypes
          : undefined,
        neighborhoods: Array.isArray(body.neighborhoods)
          ? body.neighborhoods
          : undefined,
        notes: body.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
    }

    await db.insert(activities).values({
      entity: "contato",
      entityId: id,
      kind: "updated",
      text: `Dados de ${updated.name} atualizados na agenda.`,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao atualizar contato" }, { status: 500 });
  }
}

/** Exclui o contato do CRM; com ?google=1 apaga também no Google Contacts. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  try {
    const { id } = await params;
    const alsoGoogle = new URL(req.url).searchParams.get("google") === "1";

    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    if (!contact) {
      return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
    }

    let deletedInGoogle = false;
    if (alsoGoogle && contact.googleResourceName) {
      const [integration] = await db
        .select()
        .from(integrations)
        .where(eq(integrations.provider, "google_contacts"));
      if (!integration?.connected) {
        return NextResponse.json(
          { error: "Google Contacts não está conectado. Conecte ou exclua só no CRM." },
          { status: 400 },
        );
      }
      try {
        await googleApi(
          integration,
          `https://people.googleapis.com/v1/${contact.googleResourceName}:deleteContact`,
          { method: "DELETE" },
        );
      } catch (e) {
        // Já apagado no Google: segue com a exclusão no CRM
        if (!(e instanceof GoogleApiError && e.status === 404)) throw e;
      }
      deletedInGoogle = true;
    }

    await db.delete(contacts).where(eq(contacts.id, id));

    await db.insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "updated",
      text: `${contact.name} foi excluído da agenda${deletedInGoogle ? " e do Google Contacts" : ""}.`,
    });

    return NextResponse.json({ ok: true, deletedInGoogle });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Falha ao excluir contato";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
