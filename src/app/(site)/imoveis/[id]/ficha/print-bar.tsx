"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrintBar() {
  const router = useRouter();
  return (
    <div className="no-print fixed inset-x-0 bottom-6 z-50 flex justify-center gap-2">
      <button
        onClick={() => router.back()}
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
