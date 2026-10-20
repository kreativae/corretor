import { getDb } from "@/db";
import { activities, contacts, deals, properties } from "@/db/schema";
import { noteHeader } from "@/lib/contact-notes";
import { requestPublicOrigin } from "@/lib/google";
import { notifyNewLead } from "@/lib/notify";
import { getPortalConnect, markPortalLead } from "@/lib/portal-connect";
import { and, eq, ne, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";

/**
 * Leads do Grupo OLX (ZAP Imóveis, Viva Real, OLX), enviados pelo Canal Pro.
 * Endereço com o token secreto: /api/portals/leads?token=… (gerado em Portais).
 * Formato da integração de leads do Grupo OLX: name, email, ddd, phone / phoneNumber,
 * message, clientListingId (código do anúncio no CRM), leadOrigin, originLeadId…
 */
const str = (v: unknown, max: number) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const cfg = await getPortalConnect();
  const ok = !!cfg.token && token.length === cfg.token.length && timingSafeEqual(Buffer.from(token), Buffer.from(cfg.token));
  if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const name = str(b.name, 120) || "Lead de portal";
  const email = str(b.email, 160).toLowerCase();
  let phone = str(b.phoneNumber, 30).replace(/\D/g, "") || `${str(b.ddd, 4)}${str(b.phone, 20)}`.replace(/\D/g, "");
  if (phone.startsWith("55") && phone.length > 11) phone = phone.slice(2);
  const message = str(b.message, 1000);
  const origin = str(b.leadOrigin, 40) || "Grupo OLX";
  const code = str(b.clientListingId, 60);
  if (!phone && !email) return NextResponse.json({ error: "Lead sem telefone nem e-mail" }, { status: 400 });

  const db = await getDb();
  const [property] = code
    ? await db
        .select({ id: properties.id, code: properties.code, title: properties.title, type: properties.type, price: properties.price })
        .from(properties)
        .where(eq(properties.code, code))
    : [];

  // Mesmo telefone (ou e-mail) → reaproveita o contato
  const [existing] = await db
    .select()
    .from(contacts)
    .where(
      phone
        ? sql`regexp_replace(${contacts.phone}, '\\D', '', 'g') = ${phone}`
        : sql`lower(${contacts.email}) = ${email}`,
    )
    .limit(1);

  const note = `${noteHeader([origin, ...(property ? [property.code] : [])])} ${message || (property ? `Pediu contato sobre ${property.title}.` : "Pediu contato pelo portal.")}`;
  let contactId: string;
  if (existing) {
    contactId = existing.id;
    await db
      .update(contacts)
      .set({
        email: existing.email || email || null,
        interestTypes: property ? [...new Set([...existing.interestTypes, property.type])] : existing.interestTypes,
        notes: [existing.notes, note].filter(Boolean).join("\n\n"),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, existing.id));
  } else {
    const [created] = await db
      .insert(contacts)
      .values({
        name,
        phone: phone || "",
        email: email || null,
        source: "portal",
        type: "lead",
        interestTypes: property ? [property.type] : [],
        neighborhoods: [],
        notes: note,
      })
      .returning();
    contactId = created.id;
  }

  const text = `${existing?.name ?? name} entrou em contato pelo ${origin}${property ? ` sobre ${property.code}` : ""}.`;
  await db.insert(activities).values([
    { entity: "contato", entityId: contactId, kind: "lead", text },
    ...(property ? [{ entity: "imovel" as const, entityId: property.id, kind: "lead" as const, text }] : []),
  ]);

  // Interesse num anúncio: abre negociação no pipeline (sem duplicar)
  if (property) {
    const [open] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.contactId, contactId), eq(deals.propertyId, property.id), ne(deals.stage, "fechado")))
      .limit(1);
    if (!open) {
      const [deal] = await db.insert(deals).values({ contactId, propertyId: property.id, stage: "novo", value: property.price }).returning();
      await db.insert(activities).values({
        entity: "negocio",
        entityId: deal.id,
        kind: "stage",
        text: `Negociação aberta automaticamente: ${existing?.name ?? name} · ${property.code} (${origin}).`,
      });
    }
  }

  const baseUrl = requestPublicOrigin(req);
  after(async () => {
    await markPortalLead().catch(() => undefined);
    await notifyNewLead({
      contactId,
      name: existing?.name ?? name,
      phone,
      email: email || existing?.email,
      interest: property?.type,
      message,
      origin,
      detail: property ? `${property.code} · ${property.title}` : null,
      baseUrl,
      returning: !!existing,
      propertyId: property?.id,
    });
  });

  return NextResponse.json({ ok: true });
}
