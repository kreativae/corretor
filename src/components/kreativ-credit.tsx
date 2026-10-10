import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

/** Crédito de desenvolvimento (rodapé do site e barra lateral do CRM). */
export function KreativCredit({ className, short }: { className?: string; short?: boolean }) {
  return (
    <p className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {short ? (
        "Desenvolvido por"
      ) : (
        <>
          Desenvolvido com muito carinho
          <Heart className="size-3 fill-red-500 text-red-500" aria-label="amor" />
          por
        </>
      )}
      <a
        href="https://www.kreativ.ae/"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-ink transition-colors hover:text-accent"
      >
        kreativ.ae
      </a>
    </p>
  );
}
