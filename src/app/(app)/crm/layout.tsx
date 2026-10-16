import { AppShell } from "@/components/crm/app-shell";
import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/account";
import { isSuperadmin } from "@/lib/roles";
import { SuspendedScreen } from "@/components/suspended-screen";
import { getFeatures, getStatCards } from "@/lib/features";
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
  const [user, features, statCards, account] = await Promise.all([
    requireUser("/crm"),
    getFeatures(),
    getStatCards(),
    getAccount(),
  ]);
  if (account.status === "suspenso" && !isSuperadmin(user)) return <SuspendedScreen message={account.suspendedMessage} />;
  return (
    <AppShell mode="crm" user={user} features={features} modules={account.modules} statCards={statCards}>
      {children}
    </AppShell>
  );
}
