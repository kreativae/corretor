import { EmailSettings } from "@/components/admin/email-settings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-mail" };

export default function EmailAdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">Governança · Comunicação</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">E-mail</h1>
        </div>
        <p className="max-w-sm text-right text-xs leading-relaxed text-subtle">
          Conta de envio pelo Resend e caixa de e-mail dos usuários: o que cada parte precisa e se está pronta.
        </p>
      </div>
      <EmailSettings />
    </div>
  );
}
