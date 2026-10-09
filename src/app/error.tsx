"use client";

import { Mark } from "@/components/brand";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <Mark className="size-12" />
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-subtle">
          Erro inesperado
        </p>
        <h1 className="mt-4 max-w-md text-balance font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Algo tropeçou por aqui.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-subtle">
          Nossa equipe já foi notificada. Você pode tentar novamente — na
          maioria das vezes resolve.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-subtle/60">
            ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-canvas transition-opacity hover:opacity-85"
        >
          <RotateCcw className="size-4" />
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-6 text-sm font-medium transition-colors hover:bg-soft"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
