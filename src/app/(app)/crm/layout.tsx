import { AppShell } from "@/components/crm/app-shell";
import { requireUser } from "@/lib/auth";
import { getFeatures } from "@/lib/features";
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
  const [user, features] = await Promise.all([requireUser("/crm"), getFeatures()]);
  return (
    <AppShell mode="crm" user={user} features={features}>
      {children}
    </AppShell>
  );
}
