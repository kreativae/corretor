import { SiteTheme } from "@/components/theme-provider";
import type { ReactNode } from "react";

/** Vitrine pública — dark mode por padrão, alterável pelo visitante. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteTheme>{children}</SiteTheme>;
}
