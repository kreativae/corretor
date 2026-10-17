import { EmailInbox } from "@/components/crm/email-inbox";
import { emailConfigured } from "@/lib/notify";
import { mailAddress, mailDomain } from "@/lib/mail";
import { mailboxEnabled, mailUser } from "@/lib/mail-access";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-mail" };

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  const [{ para }, user, domain, configured, enabled] = await Promise.all([
    searchParams,
    mailUser(),
    mailDomain(),
    emailConfigured(),
    mailboxEnabled(),
  ]);
  if (!enabled) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-card p-8 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">E-mail desativado</h1>
        <p className="mt-2 text-sm text-subtle">
          A caixa de e-mail dos usuários está desligada.{" "}
          {user?.admin ? (
            <Link href="/admin/email" className="font-medium text-ink underline underline-offset-2">
              Ative em Administração › E-mail
            </Link>
          ) : (
            "Fale com um administrador."
          )}
        </p>
      </div>
    );
  }
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
