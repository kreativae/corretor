import { getDb } from "@/db";
import { activities, contacts, properties, visits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { requestPublicOrigin } from "@/lib/google";
import { notifyNewLead } from "@/lib/notify";
import { getSiteContent } from "@/lib/site-content";
import { visitAllowed } from "@/lib/visit-slots";
import { after, NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let contactId: string | null = body.contactId ?? null;
    const fromSite = !contactId;
    // Agendar com contato existente (agenda do CRM) exige login
    if (contactId && !(await apiUser())) return unauthorized();

    // fluxo público (site): nome + telefone, só para imóveis publicados
    if (!contactId) {
      if (!body.name?.trim() || !body.phone?.trim() || !body.propertyId) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
      }
      const [prop] = await (await getDb())
        .select({ published: properties.published })
        .from(properties)
        .where(eq(properties.id, String(body.propertyId)));
      if (!prop?.published) {
        return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
      }
      // Dias da semana, antecedência e horários definidos em Conteúdo do site › Visita guiada
      const rules = (await getSiteContent()).visit;
      if (!visitAllowed(String(body.date ?? ""), String(body.time ?? ""), rules)) {
        return NextResponse.json(
          { error: "Esse dia ou horário não está disponível. Escolha outra data." },
          { status: 400 },
        );
      }
    }
    if (!contactId && body.name && body.phone) {
      const found = await (await getDb())
        .select()
        .from(contacts)
        .where(eq(contacts.phone, String(body.phone).trim()));
      if (found.length) {
        contactId = found[0].id;
      } else {
        const [c] = await (await getDb())
          .insert(contacts)
          .values({
            name: String(body.name).trim(),
            phone: String(body.phone).trim(),
            source: "site",
          })
          .returning();
        contactId = c.id;
        await (await getDb()).insert(activities).values({
          entity: "contato",
          entityId: c.id,
          kind: "lead",
          text: `${c.name} entrou para a agenda (origem: ${c.source}).`,
        });
      }
    }

    if (!contactId || !body.propertyId || !body.date) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const time = body.time ?? "10:00";
    // Navegador manda o instante exato; sem ele, data/hora valem no horário de Brasília
    const scheduledAt = body.scheduledAt
      ? new Date(String(body.scheduledAt))
      : new Date(`${body.date}T${time}:00-03:00`);

    const [created] = await (await getDb())
      .insert(visits)
      .values({ propertyId: body.propertyId, contactId, scheduledAt })
      .returning();

    const [prop] = await (await getDb())
      .select()
      .from(properties)
      .where(eq(properties.id, body.propertyId));
    const [contact] = await (await getDb())
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));

    const label = `Visita agendada: ${contact?.name ?? "cliente"} · ${prop?.code ?? "imóvel"} · ${formatDate(scheduledAt)} ${time}`;

    await (await getDb()).insert(activities).values([
      { entity: "visita", entityId: created.id, kind: "visit", text: label },
      { entity: "imovel", entityId: body.propertyId, kind: "visit", text: label },
      { entity: "contato", entityId: contactId, kind: "visit", text: label },
    ]);

    if (fromSite && contact) {
      const baseUrl = requestPublicOrigin(req);
      after(() =>
        notifyNewLead({
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          interest: prop?.type,
          origin: "Visita agendada pelo site",
          detail: `${prop?.code ?? ""} ${prop?.title ?? ""} · ${formatDate(scheduledAt)} ${time}`.trim(),
          baseUrl,
          propertyId: String(body.propertyId),
        }),
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao agendar visita" }, { status: 500 });
  }
}
