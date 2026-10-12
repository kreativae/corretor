import { HashLightbox } from "@/components/site/hash-lightbox";
import { VisitForm } from "@/components/site/visit-form";
import type { SiteContent } from "@/lib/site-content";
import { Sparkles } from "lucide-react";

/** Visita guiada em janela: abre pelos links "#agendar" da página do imóvel. */
export function VisitLightbox({
  propertyId,
  propertyCode,
  propertyTitle,
  eyebrow,
  title,
  bullets,
  texts,
}: {
  propertyId: string;
  propertyCode: string;
  propertyTitle: string;
  eyebrow: string;
  title: string;
  bullets: string[];
  texts: SiteContent["visit"];
}) {
  const list = bullets.filter(Boolean);
  return (
    <HashLightbox
      hash="agendar"
      label={title}
      aside={
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">{eyebrow}</p>
          <h2 className="mt-3 text-balance font-display text-2xl font-semibold tracking-[-0.02em] md:text-4xl">
            {title}
          </h2>
          <p className="mt-3 truncate text-sm text-subtle">
            <span className="font-mono text-xs">{propertyCode}</span> · {propertyTitle}
          </p>
          {list.length > 0 && (
            <ul className="mt-6 hidden space-y-3.5 sm:block md:mt-8">
              {list.map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-subtle">
                  <Sparkles className="size-4 shrink-0 text-accent" />
                  {t}
                </li>
              ))}
            </ul>
          )}
        </>
      }
    >
      <VisitForm
        propertyId={propertyId}
        propertyCode={propertyCode}
        texts={texts}
        className="border-0 bg-transparent p-2 md:p-0"
      />
    </HashLightbox>
  );
}
