import { EmailInbox } from "@/components/crm/email-inbox";
import { emailConfigured } from "@/lib/notify";
import { mailAddress, mailDomain } from "@/lib/mail";
import { mailUser } from "@/lib/mail-access";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-mail" };

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  const [{ para }, user, domain, configured] = await Promise.all([
    searchParams,
    mailUser(),
    mailDomain(),
    emailConfigured(),
  ]);
  return (
    <div className="mx-auto max-w-6xl">
      <EmailInbox
        address={mailAddress(user?.mailbox, domain)}
        admin={!!user?.admin}
        configured={configured}
        initialTo={para?.slice(0, 200)}
      />
    </div>
  );
}
