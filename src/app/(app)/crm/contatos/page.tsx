import { ContactsClient } from "@/components/crm/contacts-client";
import type { ContactMeta } from "@/components/crm/contact-filters";
import { listContacts, listDeals, listVisits, type DealFull, type VisitFull } from "@/lib/queries";
import { isRuralType } from "@/lib/rural";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contatos" };

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; novo?: string }>;
}) {
  const { tipo, novo } = await searchParams;
  const [contacts, deals, visits] = await Promise.all([listContacts(), listDeals(), listVisits()]);

  // Contato é "rural" se tem interesse em fazenda/sítio/chácara ou negociação/visita
  // em propriedade rural; "imóveis" pelo mesmo critério urbano. Sem nenhum sinal,
  // fica em imóveis. Pode estar nos dois.
  const linked = new Map<string, { urbano: boolean; rural: boolean }>();
  const mark = (contactId: string | undefined, type: string | undefined) => {
    if (!contactId || !type) return;
    const cur = linked.get(contactId) ?? { urbano: false, rural: false };
    if (isRuralType(type)) cur.rural = true;
    else cur.urbano = true;
    linked.set(contactId, cur);
  };
  for (const d of deals) mark(d.contact?.id, d.property?.type);
  for (const v of visits) mark(v.contact?.id, v.property?.type);
  const segments: Record<string, { urbano: boolean; rural: boolean }> = {};
  for (const c of contacts) {
    const l = linked.get(c.id) ?? { urbano: false, rural: false };
    const rural = l.rural || c.interestTypes.some(isRuralType);
    const urbano = l.urbano || c.interestTypes.some((t) => !isRuralType(t));
    segments[c.id] = { rural, urbano: urbano || !rural };
  }

  const meta = buildMeta(deals, visits);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Agenda inteligente
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Contatos
          </h1>
        </div>
        <p className="text-xs text-subtle">
          Sincronizado com Google Contacts &amp; Apple Contacts
        </p>
      </div>
      <ContactsClient
        initial={contacts}
        segments={segments}
        meta={meta}
        initialTab={tipo === "imoveis" || tipo === "rurais" ? tipo : "todos"}
        openNew={!!novo}
      />
    </div>
  );
}

/** Dados de relacionamento usados pelos filtros (etapa, visitas, imóveis) */
function buildMeta(deals: DealFull[], visits: VisitFull[]) {
  const now = Date.now();
  const meta: Record<string, ContactMeta> = {};
  const metaOf = (id: string) =>
    (meta[id] ??= { stages: [], dealValue: 0, visitsDone: 0, visitsUpcoming: 0, properties: [] });
  const addProperty = (m: ContactMeta, p: { id: string; code: string; title: string } | null) => {
    if (p && !m.properties.some((x) => x.id === p.id))
      m.properties.push({ id: p.id, code: p.code, title: p.title });
  };
  for (const d of deals) {
    if (!d.contact) continue;
    const m = metaOf(d.contact.id);
    if (!m.stages.includes(d.deal.stage)) m.stages.push(d.deal.stage);
    m.dealValue = Math.max(m.dealValue, d.deal.value ?? 0);
    addProperty(m, d.property);
  }
  for (const v of visits) {
    if (!v.contact) continue;
    const m = metaOf(v.contact.id);
    if (v.visit.status === "realizada") m.visitsDone += 1;
    else if (v.visit.status !== "cancelada" && new Date(v.visit.scheduledAt).getTime() >= now)
      m.visitsUpcoming += 1;
    addProperty(m, v.property);
  }
  return meta;
}
