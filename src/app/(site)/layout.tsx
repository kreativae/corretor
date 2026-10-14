import { AdminBar } from "@/components/site/admin-bar";
import { SiteTheme } from "@/components/theme-provider";
import { getSiteEditor } from "@/lib/auth";
import { getSiteContent } from "@/lib/site-content";
import type { Viewport } from "next";
import type { ReactNode } from "react";

/**
 * O site ocupa a tela toda no celular (inclusive a faixa do relógio): o header
 * fixo cobre essa faixa, então a página não aparece passando por trás dela.
 */
export const viewport: Viewport = {
  themeColor: "#11112a",
  viewportFit: "cover",
};

/** Vitrine pública — dark mode por padrão, alterável pelo visitante. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  // Logado no painel: barra de edição no topo (atalhos para o CRM)
  const editor = await getSiteEditor().catch(() => null);
  const mode = editor ? (await getSiteContent().catch(() => null))?.header.adminBar : undefined;
  return (
    <SiteTheme>
      {editor && <AdminBar name={editor.name} admin={editor.role === "admin"} hidden={mode === "oculta"} />}
      {/* Conteúdo começa abaixo da faixa do relógio (o header fixo cobre essa faixa) */}
      <div className="pt-[var(--site-safe,env(safe-area-inset-top))]">{children}</div>
    </SiteTheme>
  );
}
