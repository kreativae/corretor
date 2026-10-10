import { AppShell } from "@/components/crm/app-shell";
import { requireUser } from "@/lib/auth";
import { getFeatures } from "@/lib/features";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "CRM — ImobManager", template: "%s · ImobManager" },
};

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const [user, features] = await Promise.all([requireUser("/crm"), getFeatures()]);
  return (
    <AppShell mode="crm" user={user} features={features}>
      {children}
    </AppShell>
  );
}
