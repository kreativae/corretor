"use client";

import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ArrowUpRight, LogIn, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/imoveis", label: "Imóveis" },
  { href: "/imoveis?categoria=rurais", label: "Rurais" },
  { href: "/#colecao", label: "Coleção" },
  { href: "/#experiencia", label: "Experiência" },
  { href: "/#contato", label: "Contato" },
];

export function SiteHeader({ orgName }: { orgName: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-500 ease-expo",
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
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-2 text-sm text-subtle transition-colors duration-300 hover:bg-soft hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link href="/login" className="hidden sm:block">
              <Button variant="outline" size="sm" className="h-9 px-4">
                Acessar sistema
                <LogIn className="size-3.5" />
              </Button>
            </Link>
            <Link href="/imoveis" className="hidden sm:block">
              <Button variant="accent" size="sm" className="h-9 px-4">
                Agendar visita
                <ArrowUpRight className="size-3.5" />
              </Button>
            </Link>
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

      {/* Menu mobile fullscreen */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-canvas transition-all duration-500 ease-expo lg:hidden",
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
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
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
          <Link href="/login" onClick={() => setOpen(false)}>
            <Button variant="outline" size="lg" className="w-full">
              Acessar sistema
              <LogIn className="size-4" />
            </Button>
          </Link>
          <Link href="/imoveis" onClick={() => setOpen(false)}>
            <Button variant="accent" size="lg" className="w-full">
              Agendar visita
              <ArrowUpRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
