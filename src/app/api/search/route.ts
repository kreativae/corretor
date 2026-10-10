import { db } from "@/db";
import { contacts, deals, properties, visits } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Busca de contatos e imóveis é interna: exige sessão
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ properties: [], contacts: [], visits: [], deals: [] });
  }

  const pattern = `%${q.replace(/[%_]/g, "")}%`;

  // Visitas e negociações: pelo nome/telefone do cliente ou código/título do imóvel
  const related = or(
    ilike(contacts.name, pattern),
    ilike(contacts.phone, pattern),
    ilike(properties.code, pattern),
    ilike(properties.title, pattern),
  );

  const [props, people, visitRows, dealRows] = await Promise.all([
    db
      .select({
        id: properties.id,
        code: properties.code,
        title: properties.title,
        neighborhood: properties.neighborhood,
        city: properties.city,
        price: properties.price,
        type: properties.type,
        rural: properties.rural,
      })
      .from(properties)
      .where(
        or(
          ilike(properties.title, pattern),
          ilike(properties.code, pattern),
          ilike(properties.neighborhood, pattern),
          ilike(properties.city, pattern),
        ),
      )
      .limit(8),
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        type: contacts.type,
      })
      .from(contacts)
      .where(
        or(
          ilike(contacts.name, pattern),
          ilike(contacts.phone, pattern),
          ilike(contacts.email, pattern),
        ),
      )
      .limit(5),
    db
      .select({
        id: visits.id,
        scheduledAt: visits.scheduledAt,
        status: visits.status,
        contactName: contacts.name,
        propertyCode: properties.code,
        propertyTitle: properties.title,
        propertyType: properties.type,
      })
      .from(visits)
      .innerJoin(contacts, eq(visits.contactId, contacts.id))
      .innerJoin(properties, eq(visits.propertyId, properties.id))
      .where(related)
      .orderBy(desc(visits.scheduledAt))
      .limit(5),
    db
      .select({
        id: deals.id,
        stage: deals.stage,
        value: deals.value,
        contactName: contacts.name,
        propertyCode: properties.code,
        propertyTitle: properties.title,
        propertyType: properties.type,
      })
      .from(deals)
      .innerJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(properties, eq(deals.propertyId, properties.id))
      .where(related)
      .orderBy(desc(deals.updatedAt))
      .limit(5),
  ]);

  return NextResponse.json({
    properties: props,
    contacts: people,
    visits: visitRows,
    deals: dealRows,
  });
}
