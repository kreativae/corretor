import { db } from "@/db";
import { activities, contacts } from "@/db/schema";
import { apiAuth, unauthorized } from "@/lib/api-auth";
import { requestPublicOrigin } from "@/lib/google";
import { notifyNewLead } from "@/lib/notify";
import { after, NextResponse } from "next/server";

/**
 * Cria contato. Usado pelo CRM (sessão) e pelo "Webhook de leads" de sistemas
 * externos, que enviam a chave de API (escopo escrita/total) em
 * `Authorization: Bearer <chave>` ou `x-api-key`.
 */
export async function POST(req: Request) {
  const caller = await apiAuth(req, "escrita");
  if (!caller) return unauthorized();
  try {
    const body = await req.json();
    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
    }

    const [created] = await db
      .insert(contacts)
      .values({
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: body.email || null,
        type: body.type ?? "lead",
        source: body.source ?? "site",
        budgetMin: body.budgetMin ?? null,
        budgetMax: body.budgetMax ?? null,
        interestTypes: body.interestTypes ?? [],
        neighborhoods: body.neighborhoods ?? [],
        notes: body.notes || null,
      })
      .returning();

    await db.insert(activities).values({
      entity: "contato",
      entityId: created.id,
      kind: "lead",
      text: `${created.name} entrou para a agenda (origem: ${created.source}).`,
    });

    // Lead vindo de integração externa (chave de API) gera aviso por e-mail
    if (caller.kind === "key") {
      const baseUrl = requestPublicOrigin(req);
      after(() =>
        notifyNewLead({
          contactId: created.id,
          name: created.name,
          phone: created.phone,
          email: created.email,
          interest: created.interestTypes[0],
          message: created.notes,
          origin: `Integração: ${caller.label}`,
          baseUrl,
        }),
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar contato" }, { status: 500 });
  }
}
