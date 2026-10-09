import { ContactsClient } from "@/components/crm/contacts-client";
import { listContacts } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contatos" };

export default async function ContatosPage() {
  const contacts = await listContacts();
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
      <ContactsClient initial={contacts} />
    </div>
  );
}
