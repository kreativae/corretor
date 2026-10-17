import { EmailSettings } from "@/components/admin/email-settings";
import { NotificationsCard } from "@/components/admin/notifications-card";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { emailConfigured, getNotifySettings } from "@/lib/notify";
import { getWhiteLabel } from "@/lib/queries";
import { and, asc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-mail" };

export default async function EmailAdminPage() {
  const [notify, wl, configured, team] = await Promise.all([
    getNotifySettings(),
    getWhiteLabel(),
    emailConfigured(),
    (await getDb())
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.active, true), ne(users.role, "superadmin")))
      .orderBy(asc(users.name)),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">Governança · Comunicação</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">E-mail</h1>
        </div>
        <p className="max-w-sm text-right text-xs leading-relaxed text-subtle">
          Conta de envio pelo Resend, quem recebe os avisos de novos leads e caixa de e-mail dos usuários.
        </p>
      </div>
      <NotificationsCard
        initialEmails={notify.leadEmails}
        initialEnabled={notify.enabled}
        initialNotifyResponsible={notify.notifyResponsible}
        fallbackEmail={wl.email}
        team={team.filter((m) => !!m.email)}
        configured={configured}
        defaultOpen
      />
      <EmailSettings />
    </div>
  );
}
