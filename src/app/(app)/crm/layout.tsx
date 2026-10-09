import { AppShell } from "@/components/crm/app-shell";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "CRM — ImobManager", template: "%s · ImobManager" },
};

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/crm");
  return (
    <AppShell mode="crm" user={user}>
      {children}
    </AppShell>
  );
}
