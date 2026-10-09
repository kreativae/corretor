"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * A ficha costuma abrir em nova aba (sem histórico). "Voltar" então fecha a
 * aba; se o navegador não permitir, vai para a página do imóvel.
 */
export function PrintBar({ backHref }: { backHref: string }) {
  const router = useRouter();

  function goBack() {
    const sameOriginReferrer =
      document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (window.history.length > 1 && sameOriginReferrer) {
      router.back();
      return;
    }
    window.close();
    // Se a aba não pôde ser fechada, segue para o imóvel
    setTimeout(() => router.push(backHref), 150);
  }

  return (
    <div className="no-print fixed inset-x-0 bottom-6 z-50 flex justify-center gap-2">
      <button
        onClick={goBack}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white shadow-xl transition-transform hover:scale-[1.03]"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </button>
      <button
        onClick={() => window.print()}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-neutral-950 shadow-xl transition-transform hover:scale-[1.03]"
      >
        <Printer className="size-4" />
        Imprimir / Salvar PDF
      </button>
    </div>
  );
}
