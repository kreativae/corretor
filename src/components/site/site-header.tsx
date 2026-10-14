"use client";

import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui";
import type { SiteContent } from "@/lib/site-content";
import { lockScroll } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";
import { ArrowUpRight, LogIn, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Só links internos, âncoras ou externos seguros */
const safeHref = (h: string) => /^(\/|#|https?:|mailto:|tel:)/.test(h.trim());
const isExternal = (h: string) => /^https?:/.test(h);

export function SiteHeader({
  orgName,
  menu,
  hasRural = false,
  overHero = false,
}: {
  orgName: string;
  /** Menu editável em Conteúdo do site › Menu do topo */
  menu: SiteContent["header"];
  /** Exibe o link "Rurais" só quando há propriedades rurais publicadas */
  hasRural?: boolean;
  /** Header transparente sobre o hero escuro: usa o tema escuro até rolar */
  overHero?: boolean;
}) {
  const links = menu.links.filter(
    (l) =>
      l.label.trim() &&
      safeHref(l.href) &&
      (hasRural || !l.href.includes("categoria=rurais")),
  );
  const ext = (h: string) => (isExternal(h) ? { target: "_blank", rel: "noreferrer" } : {});
  const [scrolled, setScrolled] = useState(false);
  // Qualquer rolagem: a faixa do relógio (celular) já fica desfocada
  const [moved, setMoved] = useState(false);
  const [open, setOpen] = useState(false);

  // Menu aberto: trava a rolagem do site por trás (inclusive o Lenis)
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const fn = () => {
      setScrolled(window.scrollY > 24);
      setMoved(window.scrollY > 2);
    };
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <>
      {/* Faixa do relógio/bateria (só existe no celular): desfoca o que passa por trás */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[41] h-[var(--header-safe,env(safe-area-inset-top))] transition-all duration-300",
          moved ? "bg-canvas/70 backdrop-blur-xl" : "bg-transparent",
        )}
      />
      <header
        className={cn(
          "fixed inset-x-0 top-[var(--adminbar,0px)] z-40 pt-[var(--header-safe,env(safe-area-inset-top))] text-ink transition-all duration-500 ease-expo",
          overHero && !scrolled && "dark",
          scrolled
            ? "border-b border-hairline bg-canvas/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="container-x flex h-16 items-center justify-between md:h-20">
          <Link href="/" aria-label={orgName}>
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l, i) => (
              <Link
                key={i}
                href={l.href}
                {...ext(l.href)}
                className="rounded-full px-4 py-2 text-sm text-subtle transition-colors duration-300 hover:bg-soft hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle className="hidden sm:inline-flex" />
            {menu.loginLabel && (
              <Link href="/login" className="hidden sm:block">
                <Button variant="outline" size="sm" className="h-9 px-4">
                  {menu.loginLabel}
                  <LogIn className="size-3.5" />
                </Button>
              </Link>
            )}
            {menu.ctaLabel && safeHref(menu.ctaHref) && (
              <Link href={menu.ctaHref} {...ext(menu.ctaHref)} className="hidden sm:block">
                <Button variant="accent" size="sm" className="h-9 px-4">
                  {menu.ctaLabel}
                  <ArrowUpRight className="size-3.5" />
                </Button>
              </Link>
            )}
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-ink lg:hidden"
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile fullscreen (data-lenis-prevent: o Lenis não rola o site por trás) */}
      <div
        data-lenis-prevent
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-canvas pt-[env(safe-area-inset-top)] transition-all duration-500 ease-expo lg:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <div className="container-x flex h-16 items-center justify-between">
          <Wordmark />
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="inline-flex size-9 items-center justify-center rounded-full border border-hairline"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="container-x mt-10 flex flex-col gap-1">
          {links.map((l, i) => (
            <Link
              key={i}
              href={l.href}
              {...ext(l.href)}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-baseline gap-4 border-b border-hairline py-5 transition-all duration-500",
                open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
              )}
              style={{ transitionDelay: `${80 + i * 60}ms` }}
            >
              <span className="font-mono text-xs text-subtle">0{i + 1}</span>
              <span className="font-display text-3xl font-semibold tracking-tight">
                {l.label}
              </span>
            </Link>
          ))}
        </nav>
        <div className="container-x mt-auto flex flex-col gap-3 pb-10">
          {menu.loginLabel && (
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" size="lg" className="w-full">
                {menu.loginLabel}
                <LogIn className="size-4" />
              </Button>
            </Link>
          )}
          {menu.ctaLabel && safeHref(menu.ctaHref) && (
            <Link href={menu.ctaHref} {...ext(menu.ctaHref)} onClick={() => setOpen(false)}>
              <Button variant="accent" size="lg" className="w-full">
                {menu.ctaLabel}
                <ArrowUpRight className="size-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
