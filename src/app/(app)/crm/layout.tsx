import { AppShell } from "@/components/crm/app-shell";
import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/account";
import { isSuperadmin } from "@/lib/roles";
import { SuspendedScreen } from "@/components/suspended-screen";
import { getFeatures, getStatCards } from "@/lib/features";
import { getEmailConfig } from "@/lib/notify";
import { brandShortName, getWhiteLabel } from "@/lib/queries";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const wl = await getWhiteLabel();
  const name = brandShortName(wl);
  return { title: { default: `CRM — ${name}`, template: `%s · ${name}` } };
}

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const [user, features, statCards, account, emailCfg] = await Promise.all([
    requireUser("/crm"),
    getFeatures(),
    getStatCards(),
    getAccount(),
    getEmailConfig(),
  ]);
  // Menu E-mail só com o módulo liberado e a caixa ligada em Administração › E-mail
  const modules = { ...account.modules, email: account.modules.email && emailCfg.mailboxEnabled };
  if (account.status === "suspenso" && !isSuperadmin(user)) return <SuspendedScreen message={account.suspendedMessage} />;
  return (
    <AppShell mode="crm" user={user} features={features} modules={modules} statCards={statCards}>
      {children}
    </AppShell>
  );
}
