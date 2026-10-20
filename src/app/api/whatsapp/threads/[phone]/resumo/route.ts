import { getDb } from "@/db";
import { contacts, waMessages, waThreads } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { landDimensions, normalizeLand } from "@/lib/land";
import { CONTACT_TYPE_LABELS, TYPE_LABELS } from "@/lib/labels";
import { listProperties } from "@/lib/queries";
import { alqToM2, crmPropertyPath, formatAlq, isRuralType, kindOf, normalizeRural } from "@/lib/rural";
import {
  conversationTopics,
  describeIntent,
  hasCriteria,
  parseIntent,
  smartMatch,
  type MatchCandidate,
} from "@/lib/smart-match";
import { formatNumber } from "@/lib/utils";
import { lineFor } from "@/lib/whatsapp";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ phone: string }> };

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Resumo da conversa e smart match: imóveis da carteira que batem com o que o cliente pediu */
export async function GET(_req: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { line } = await lineFor(user.id);
  const phone = (await params).phone.replace(/\D/g, "");

  const db = await getDb();
  const [msgs, [thread], props] = await Promise.all([
    db
      .select({ direction: waMessages.direction, body: waMessages.body, type: waMessages.type, createdAt: waMessages.createdAt })
      .from(waMessages)
      .where(and(eq(waMessages.line, line), eq(waMessages.phone, phone)))
      .orderBy(desc(waMessages.createdAt))
      .limit(300),
    db.select({ contactId: waThreads.contactId }).from(waThreads).where(and(eq(waThreads.line, line), eq(waThreads.phone, phone))),
    listProperties(),
  ]);
  msgs.reverse();

  const contact = thread?.contactId
    ? (
        await db
          .select({
            id: contacts.id,
            name: contacts.name,
            type: contacts.type,
            budgetMax: contacts.budgetMax,
            interestTypes: contacts.interestTypes,
            neighborhoods: contacts.neighborhoods,
          })
          .from(contacts)
          .where(eq(contacts.id, thread.contactId))
      )[0]
    : undefined;

  const texts = msgs.flatMap((m) => (m.type !== "deleted" && m.body ? [{ ...m, body: m.body }] : []));
  const inbound = texts.filter((m) => m.direction === "in").map((m) => m.body);
  const places = [...new Set(props.flatMap((p) => [p.neighborhood, p.city]).filter(Boolean))];
  const intent = parseIntent(inbound, places);

  // O que a conversa não disse, o cadastro do contato completa
  const fromProfile: string[] = [];
  if (contact) {
    if (!intent.types.length && contact.interestTypes.length) {
      intent.types = contact.interestTypes;
      fromProfile.push("tipo");
    }
    if (!intent.priceMax && contact.budgetMax) {
      intent.priceMax = contact.budgetMax;
      fromProfile.push("orçamento");
    }
    if (!intent.places.length && contact.neighborhoods.length) {
      intent.places = contact.neighborhoods;
      fromProfile.push("região");
    }
  }

  // Códigos de imóveis citados na conversa (de quem enviou e de quem perguntou)
  const byCode = new Map(props.map((p) => [p.code.toUpperCase(), p]));
  const cited = new Map<string, { sent: boolean; asked: boolean }>();
  for (const m of texts) {
    for (const [code] of m.body.toUpperCase().matchAll(/\b[A-Z]{1,4}-?\d{2,6}\b/g)) {
      if (!byCode.has(code)) continue;
      const c = cited.get(code) ?? { sent: false, asked: false };
      if (m.direction === "out") c.sent = true;
      else c.asked = true;
      cited.set(code, c);
    }
  }

  const specs = (p: (typeof props)[number]) => {
    if (isRuralType(p.type)) {
      const alq = normalizeRural(p.rural).totalAlq;
      return alq ? `${formatAlq(alq)} alq` : "";
    }
    if (kindOf(p.type) === "terreno")
      return [p.area ? `${formatNumber(p.area)} m²` : "", landDimensions(normalizeLand(p.land))].filter(Boolean).join(" · ");
    return [p.bedrooms ? `${p.bedrooms} qts` : "", p.area ? `${formatNumber(p.area)} m²` : ""].filter(Boolean).join(" · ");
  };

  const candidates: MatchCandidate[] = props.map((p) => {
    const alq = isRuralType(p.type) ? normalizeRural(p.rural).totalAlq : null;
    return {
      id: p.id,
      type: p.type,
      purpose: p.purpose,
      status: p.status,
      price: p.price,
      area: alq ? alqToM2(alq) : p.area,
      bedrooms: p.bedrooms,
      neighborhood: p.neighborhood,
      city: p.city,
      text: [p.title, p.description, ...p.features, ...normalizeLand(p.land).vantagens, ...normalizeLand(p.land).infraestrutura].join(" "),
    };
  });
  const byId = new Map(props.map((p) => [p.id, p]));
  const matches = smartMatch(candidates, intent, 8).map((r) => {
    const p = byId.get(r.id)!;
    return {
      id: p.id,
      code: p.code,
      title: p.title,
      type: TYPE_LABELS[p.type] ?? p.type,
      price: p.price,
      purpose: p.purpose,
      place: [p.neighborhood, p.city].filter(Boolean).join(", "),
      specs: specs(p),
      cover: p.cover,
      href: crmPropertyPath(p),
      score: r.score,
      reasons: r.reasons,
      sent: !!cited.get(p.code.toUpperCase())?.sent,
    };
  });

  const ins = texts.filter((m) => m.direction === "in");
  const last = msgs[msgs.length - 1];
  const lastIn = ins[ins.length - 1];
  return NextResponse.json({
    contact: contact
      ? { id: contact.id, name: contact.name, type: CONTACT_TYPE_LABELS[contact.type] ?? contact.type }
      : null,
    stats: {
      first: msgs[0]?.createdAt ?? null,
      inbound: msgs.filter((m) => m.direction === "in").length,
      outbound: msgs.filter((m) => m.direction === "out").length,
      lastInboundAt: lastIn?.createdAt ?? null,
      /** Cliente falou por último: está esperando resposta */
      waitingSince: last?.direction === "in" ? last.createdAt : null,
    },
    wants: describeIntent(intent, (t) => TYPE_LABELS[t] ?? t),
    fromProfile,
    topics: conversationTopics(inbound),
    questions: ins
      .filter((m) => m.body.includes("?"))
      .slice(-3)
      .map((m) => ({ text: clip(m.body.trim()), at: m.createdAt })),
    lastClient: lastIn ? { text: clip(lastIn.body.trim(), 220), at: lastIn.createdAt } : null,
    cited: [...cited].map(([code, c]) => {
      const p = byCode.get(code)!;
      return { code: p.code, title: p.title, href: crmPropertyPath(p), ...c };
    }),
    hasCriteria: hasCriteria(intent),
    matches,
  });
}
