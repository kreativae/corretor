import { db } from "@/db";
import { activities, contacts } from "@/db/schema";
import { TYPE_LABELS } from "@/lib/labels";
import { requestPublicOrigin } from "@/lib/google";
import { notifyNewLead } from "@/lib/notify";
import { sql } from "drizzle-orm";
import { after, NextResponse } from "next/server";

/**
 * Formulário "Fale com a gente" do site público — sem login e sem chave.
 * Proteções: campo isca (honeypot), limite por IP e validação de campos.
 * Telefone já cadastrado reaproveita o contato em vez de duplicar.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
// Limite em memória (por instância): suficiente contra abuso casual
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  // Robôs preenchem o campo invisível: finge sucesso e descarta
  if (clean(body.website, 200)) return NextResponse.json({ ok: true }, { status: 201 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Muitos envios em sequência. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 30).replace(/\D/g, "");
  const email = clean(body.email, 160).toLowerCase();
  const message = clean(body.message, 1000);
  const interest = clean(body.interest, 30);

  if (name.length < 2) return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  if (phone.length < 10 || phone.length > 13) {
    return NextResponse.json({ error: "Informe um WhatsApp com DDD." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  const interestTypes = interest && interest in TYPE_LABELS ? [interest] : [];

  try {
    // Mesmo telefone (ignorando máscara) → reaproveita o contato
    const [existing] = await db
      .select()
      .from(contacts)
      .where(sql`regexp_replace(${contacts.phone}, '\\D', '', 'g') = ${phone}`)
      .limit(1);

    const note = message ? `[Site] ${message}` : "";
    let contactId: string;
    if (existing) {
      contactId = existing.id;
      await db
        .update(contacts)
        .set({
          email: existing.email || email || null,
          interestTypes: [...new Set([...existing.interestTypes, ...interestTypes])],
          notes: note ? [existing.notes, note].filter(Boolean).join("\n\n") : existing.notes,
          updatedAt: new Date(),
        })
        .where(sql`${contacts.id} = ${existing.id}`);
    } else {
      const [created] = await db
        .insert(contacts)
        .values({
          name,
          phone,
          email: email || null,
          source: "site",
          type: "lead",
          interestTypes,
          notes: note || null,
        })
        .returning();
      contactId = created.id;
    }

    const interestLabel = interestTypes[0] ? ` · interesse: ${TYPE_LABELS[interestTypes[0]].toLowerCase()}` : "";
    await db.insert(activities).values({
      entity: "contato",
      entityId: contactId,
      kind: "lead",
      text: existing
        ? `${existing.name} voltou a entrar em contato pelo site${interestLabel}.`
        : `${name} entrou em contato pelo formulário do site${interestLabel}.`,
    });

    // E-mail de aviso depois da resposta, sem atrasar o visitante
    const baseUrl = requestPublicOrigin(req);
    after(() =>
      notifyNewLead({
        contactId,
        name: existing?.name ?? name,
        phone,
        email: email || existing?.email,
        interest: interestTypes[0],
        message,
        origin: "Formulário do site",
        baseUrl,
        returning: !!existing,
      }),
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente pelo WhatsApp." }, { status: 500 });
  }
}
