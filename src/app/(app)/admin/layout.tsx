import { AppShell } from "@/components/crm/app-shell";
import { requireAdmin } from "@/lib/auth";
import { brandShortName, getWhiteLabel } from "@/lib/queries";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const wl = await getWhiteLabel();
  return { title: { default: `Administração — ${brandShortName(wl)}`, template: "%s · Admin" } };
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdmin("/admin");
  return (
    <AppShell mode="admin" user={user}>
      {children}
    </AppShell>
  );
}
