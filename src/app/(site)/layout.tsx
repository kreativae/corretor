import { AdminBar } from "@/components/site/admin-bar";
import { SiteTheme } from "@/components/theme-provider";
import { getSiteEditor } from "@/lib/auth";
import type { ReactNode } from "react";

/** Vitrine pública — dark mode por padrão, alterável pelo visitante. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  // Logado no painel: barra de edição no topo (atalhos para o CRM)
  const editor = await getSiteEditor().catch(() => null);
  return (
    <SiteTheme>
      {editor && <AdminBar name={editor.name} admin={editor.role === "admin"} />}
      {children}
    </SiteTheme>
  );
}
