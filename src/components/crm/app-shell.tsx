"use client";

import { Mark, Wordmark } from "@/components/brand";
import { KreativCredit } from "@/components/kreativ-credit";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Kbd } from "@/components/ui";
import { CommandPalette } from "@/components/crm/command-palette";
import { HeaderActions } from "@/components/crm/header-actions";
import { cn, initials } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  Columns3,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Plug,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
  Tractor,
  Handshake,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const CRM_NAV = [
  { href: "/crm", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/crm/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/crm/propriedades", label: "Propriedades rurais", icon: Tractor },
  { href: "/crm/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/crm/fechados", label: "Negócios fechados", icon: Handshake, feature: "closedDeals" as const },
  { href: "/crm/contatos", label: "Contatos", icon: Users },
  { href: "/crm/agenda", label: "Agenda", icon: CalendarDays },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Visão geral", icon: ShieldCheck, exact: true },
  { href: "/admin/equipe", label: "Equipe & acessos", icon: Users },
  { href: "/admin/site", label: "Conteúdo do site", icon: Palette },
  { href: "/admin/configuracoes", label: "Configurações", icon: Plug },
];

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "corretor";
  creci: string | null;
};

export function AppShell({
  children,
  mode = "crm",
  user,
  features,
}: {
  children: ReactNode;
  mode?: "crm" | "admin";
  user: ShellUser;
  /** Módulos opcionais ligados em Configurações */
  features?: { closedDeals: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const nav =
    mode === "crm"
      ? CRM_NAV.filter((i) => !("feature" in i && i.feature) || features?.[i.feature])
      : ADMIN_NAV;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/crm">
          <Wordmark sub={mode === "crm" ? "CRM OPERACIONAL" : "ADMIN MASTER"} />
        </Link>
        <button
          className="rounded-full p-1.5 text-subtle hover:bg-soft lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="size-4.5" />
        </button>
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-soft text-ink"
                  : "text-subtle hover:bg-soft/60 hover:text-ink",
              )}
            >
              <item.icon
                className={cn(
                  "size-4.5 transition-colors",
                  active ? "text-accent" : "text-subtle group-hover:text-ink",
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-hairline px-3 py-3">
        {user.role === "admin" && (
          <Link
            href={mode === "crm" ? "/admin" : "/crm"}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-subtle transition-colors hover:bg-soft/60 hover:text-ink"
          >
            {mode === "crm" ? (
              <ShieldCheck className="size-4.5" />
            ) : (
              <LayoutDashboard className="size-4.5" />
            )}
            {mode === "crm" ? "Administração" : "Voltar ao CRM"}
          </Link>
        )}
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-subtle transition-colors hover:bg-soft/60 hover:text-ink"
        >
          <Globe className="size-4.5" />
          Ver site público
        </Link>
      </div>

      <div className="border-t border-hairline p-3">
        <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-on-accent">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <p className="truncate text-[11px] text-subtle">
                {user.role === "admin" ? "Administrador" : "Corretor"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={logout}
              disabled={loggingOut}
              aria-label="Sair"
              title="Sair da plataforma"
              className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-subtle transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <KreativCredit className="justify-center px-4 pb-4 text-center text-[10.5px] text-subtle" />
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      {/* Barra lateral sempre no azul-marinho da marca (tokens do tema escuro) */}
      <aside className="dark fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-hairline bg-canvas text-ink lg:block">
        {sidebar}
      </aside>

      {/* Sidebar mobile */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "visible" : "invisible",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "dark absolute inset-y-0 left-0 w-72 border-r border-hairline bg-canvas text-ink transition-transform duration-300 ease-expo",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </aside>
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-hairline bg-canvas/85 px-4 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              className="shrink-0 rounded-full border border-hairline p-2 text-subtle lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-4" />
            </button>
            <Link href="/crm" aria-label="Início do CRM" className="shrink-0 lg:hidden">
              <Mark className="size-7" />
            </Link>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-hairline bg-soft/60 px-3.5 text-xs text-subtle transition-colors hover:border-hairline-strong sm:w-72 sm:flex-none"
            >
              <Search className="size-3.5" />
              <span className="flex-1 truncate text-left">
                Buscar imóveis, contatos…
              </span>
              <span className="hidden gap-1 sm:flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {mode === "crm" && <HeaderActions />}
          </div>
        </header>
        <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
