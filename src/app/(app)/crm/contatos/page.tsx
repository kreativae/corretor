import { ContactsClient } from "@/components/crm/contacts-client";
import { listContacts, listDeals, listVisits } from "@/lib/queries";
import { isRuralType } from "@/lib/rural";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contatos" };

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
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
        initialTab={tipo === "imoveis" || tipo === "rurais" ? tipo : "todos"}
      />
    </div>
  );
}
