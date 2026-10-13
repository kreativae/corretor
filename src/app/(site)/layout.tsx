import { AdminBar } from "@/components/site/admin-bar";
import { SiteTheme } from "@/components/theme-provider";
import { getSiteEditor } from "@/lib/auth";
import { getSiteContent } from "@/lib/site-content";
import type { ReactNode } from "react";

/** Vitrine pública — dark mode por padrão, alterável pelo visitante. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  // Logado no painel: barra de edição no topo (atalhos para o CRM)
  const editor = await getSiteEditor().catch(() => null);
  const mode = editor ? (await getSiteContent().catch(() => null))?.header.adminBar : undefined;
  return (
    <SiteTheme>
      {editor && <AdminBar name={editor.name} admin={editor.role === "admin"} hidden={mode === "oculta"} />}
      {children}
    </SiteTheme>
  );
}
