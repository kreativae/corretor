import { PauseCircle } from "lucide-react";

/** Conta suspensa pela gerência: substitui o painel (e o site, se marcado) */
export function SuspendedScreen({ message, site = false }: { message?: string; site?: boolean }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 py-16 text-ink">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-soft text-subtle">
          <PauseCircle className="size-7" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          {site ? "Site temporariamente indisponível" : "Acesso suspenso"}
        </h1>
        <p className="mt-3 whitespace-pre-line text-sm text-subtle">
          {message ||
            (site
              ? "Voltamos em breve."
              : "O acesso a este sistema está suspenso no momento. Entre em contato com o suporte para reativar.")}
        </p>
      </div>
    </main>
  );
}
