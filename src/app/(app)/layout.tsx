import { BuildInfo } from "@/components/build-info";
import { AppTheme } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";
import type { ReactNode } from "react";

/** Sistema (CRM, Admin e login) — light mode por padrão, alterável pelo usuário. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <AppTheme>
      {children}
      {user && <BuildInfo />}
    </AppTheme>
  );
}
