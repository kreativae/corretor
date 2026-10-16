import { AdminBar } from "@/components/site/admin-bar";
import { SiteTheme } from "@/components/theme-provider";
import { getSiteEditor } from "@/lib/auth";
import { getSiteContent } from "@/lib/site-content";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { isAdmin, isSuperadmin } from "@/lib/roles";
import { getAccount } from "@/lib/account";
import { SuspendedScreen } from "@/components/suspended-screen";

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
  const [editor, account] = await Promise.all([getSiteEditor().catch(() => null), getAccount()]);
  // Conta suspensa com o site fora do ar (a gerência continua vendo)
  if (account.status === "suspenso" && account.suspendSite && !isSuperadmin(editor)) {
    return (
      <SiteTheme>
        <SuspendedScreen site />
      </SiteTheme>
    );
  }
  const mode = editor ? (await getSiteContent().catch(() => null))?.header.adminBar : undefined;
  return (
    <SiteTheme>
      {editor && <AdminBar name={editor.name} admin={isAdmin(editor)} hidden={mode === "oculta"} />}
      {/* Conteúdo começa abaixo da faixa do relógio (o header fixo cobre essa faixa) */}
      <div className="pt-[var(--site-safe,env(safe-area-inset-top))]">{children}</div>
    </SiteTheme>
  );
}
