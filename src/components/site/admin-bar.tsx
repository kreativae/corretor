"use client";

import { Monogram } from "@/components/monogram";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  Palette,
  Pencil,
  Plus,
  Tractor,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const H = 40;

const item =
  "inline-flex h-full shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:px-3";

/**
 * Barra de edição no topo do site (como a do WordPress): aparece só para quem
 * está logado no painel e traz atalhos ligados à página aberta.
 */
export function AdminBar({ name, admin }: { name: string; admin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  // /imoveis/<código>[/ficha|/contato|/mapa] → atalhos do anúncio
  const m = pathname.match(/^\/imoveis\/([^/]+)/);
  const code = m ? m[1] : null;

  return (
    <>
      {/* Empurra o header fixo e o conteúdo para baixo da barra */}
      <style>{`@media screen{:root{--adminbar:${H}px}body{padding-top:${H}px}}`}</style>
      <div
        className="fixed inset-x-0 top-0 z-[45] flex items-stretch bg-[#1d1d42] text-white shadow-[0_1px_0_rgba(255,255,255,0.06)] print:hidden"
        style={{ height: H }}
        role="navigation"
        aria-label="Barra de edição"
      >
        <Link href="/crm" className={cn(item, "gap-2 pl-3 sm:pl-4")} title="Abrir o painel">
          <Monogram className="size-5" color="#fff" />
          <span className="hidden sm:inline">Painel</span>
        </Link>

        <div ref={menu} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={cn(item, open && "bg-white/10 text-white")}
          >
            <Plus className="size-4" />
            Novo
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="absolute left-0 top-full min-w-56 overflow-hidden rounded-b-xl bg-[#1d1d42] py-1.5 shadow-2xl shadow-black/40">
              {[
                { href: "/crm/imoveis/novo", label: "Imóvel", icon: Building2 },
                { href: "/crm/propriedades/nova", label: "Propriedade rural", icon: Tractor },
                { href: "/crm/parceiros", label: "Parceiro", icon: Briefcase },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <l.icon className="size-4 text-white/50" />
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {code ? (
          <>
            <Link href={`/crm/abrir/${code}?to=editar`} className={cn(item, "text-white")}>
              <Pencil className="size-4 text-[#F47525]" />
              Editar anúncio
            </Link>
            <Link href={`/crm/abrir/${code}`} className={cn(item, "hidden md:inline-flex")}>
              <ExternalLink className="size-4" />
              Ver no CRM
            </Link>
          </>
        ) : pathname === "/imoveis" ? (
          <Link href="/crm/imoveis" className={item}>
            <Building2 className="size-4" />
            <span className="hidden sm:inline">Gerenciar imóveis</span>
          </Link>
        ) : null}

        {admin && !code && (
          <Link href="/admin/site" className={item}>
            <Palette className="size-4" />
            <span className="hidden sm:inline">{pathname === "/" ? "Editar página inicial" : "Conteúdo do site"}</span>
          </Link>
        )}

        <Link href="/crm" className={cn(item, "ml-auto pr-3 sm:pr-4")} title="Ir para o painel">
          <LayoutDashboard className="size-4 sm:hidden" />
          <span className="hidden max-w-40 truncate sm:inline">Olá, {name.split(" ")[0]}</span>
        </Link>
      </div>
    </>
  );
}
