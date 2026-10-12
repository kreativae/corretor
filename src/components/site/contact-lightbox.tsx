import { HashLightbox } from "@/components/site/hash-lightbox";
import { LeadForm } from "@/components/site/lead-form";
import type { SiteContent } from "@/lib/site-content";
import { MessageCircle } from "lucide-react";

/** "Fale com a gente" em janela: abre pelos links "#fale-conosco" (menu, rodapé, botões). */
export function ContactLightbox({ cta, phone }: { cta: SiteContent["cta"]; phone: string }) {
  const whatsapp = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(cta.whatsappMessage)}`
    : "";
  return (
    <HashLightbox
      hash="fale-conosco"
      label={cta.title}
      aside={
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">
            A gente busca pra você
          </p>
          <h2 className="mt-3 text-balance font-display text-2xl font-semibold tracking-[-0.02em] md:text-4xl">
            {cta.title}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-subtle">{cta.body}</p>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-5 text-sm font-medium transition-colors hover:bg-soft"
            >
              <MessageCircle className="size-4" />
              {cta.secondary}
            </a>
          )}
        </>
      }
    >
      <div className="p-2 md:p-0">
        <LeadForm />
      </div>
    </HashLightbox>
  );
}
