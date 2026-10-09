import { Mark } from "@/components/brand";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <Mark className="size-12" />
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-subtle">
          404 — fora do mapa
        </p>
        <h1 className="mt-4 max-w-md text-balance font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Este endereço não consta no nosso mapa.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-subtle">
          A página pode ter sido movida, renomeada ou nunca existiu. O portfólio,
          por sua vez, continua impecável.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-canvas transition-opacity hover:opacity-85"
        >
          <ArrowLeft className="size-4" />
          Voltar ao início
        </Link>
        <Link
          href="/imoveis"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-6 text-sm font-medium transition-colors hover:bg-soft"
        >
          <Search className="size-4" />
          Explorar imóveis
        </Link>
      </div>
    </div>
  );
}
