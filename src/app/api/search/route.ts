import { db } from "@/db";
import { contacts, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Busca de contatos e imóveis é interna: exige sessão
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ properties: [], contacts: [] });
  }

  const pattern = `%${q.replace(/[%_]/g, "")}%`;

  const [props, people] = await Promise.all([
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
  ]);

  return NextResponse.json({ properties: props, contacts: people });
}
