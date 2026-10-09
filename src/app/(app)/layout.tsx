import { AppTheme } from "@/components/theme-provider";
import type { ReactNode } from "react";

/** Sistema (CRM, Admin e login) — light mode por padrão, alterável pelo usuário. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppTheme>{children}</AppTheme>;
}
