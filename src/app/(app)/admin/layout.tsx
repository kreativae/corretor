import { AppShell } from "@/components/crm/app-shell";
import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin Master — ImobManager", template: "%s · Admin" },
};

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
