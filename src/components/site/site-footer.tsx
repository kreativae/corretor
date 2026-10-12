import { Mark } from "@/components/brand";
import type { SiteContent } from "@/lib/site-content";
import { KreativCredit } from "@/components/kreativ-credit";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function SiteFooter({
  orgName,
  phone,
  footer,
  email,
  instagram,
}: {
  orgName: string;
  phone: string;
  footer: SiteContent["footer"];
  email?: string;
  instagram?: string;
}) {
  const igHandle = instagram?.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/@]/g, "");
  const year = new Date().getFullYear();
  // Nome da marca sem o "Imóveis" (ex.: CARLOS AMÂNCIO)
  const brandName = orgName.replace(/\s+(im[óo]veis|imobili[áa]ria)$/i, "");

  const phoneLabel =
    footer.phone.trim() ||
    (phone
      ? `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, phone.length - 4)}-${phone.slice(-4)}`
      : "");
  const phoneDigits = (footer.phone.trim() || phone).replace(/\D/g, "");
  const mail = footer.email.trim() || email || "";
  const bigName = footer.bigName.trim() || brandName;

  return (
    <footer id="contato" className="border-t border-hairline">
      <div className="container-x grid gap-10 py-16 sm:grid-cols-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:gap-x-16 md:py-24">
        <div className="sm:col-span-2 md:col-span-1">
          <Mark className="size-12" />
          {footer.tagline && (
            <p className="mt-6 max-w-xs font-display text-2xl font-medium leading-snug tracking-tight">
              {footer.tagline}
            </p>
          )}
          {footer.buttonLabel && (
            <Link href="/login" className="mt-6 inline-flex">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3.5 py-2 text-xs font-medium text-subtle transition-colors hover:border-hairline-strong hover:text-ink">
                {footer.buttonLabel}
                <ArrowUpRight className="size-3.5" />
              </span>
            </Link>
          )}
        </div>

        <div>
          <p className="flex items-center font-mono text-[11px] uppercase tracking-[0.2em] text-subtle md:h-12">
            {footer.navTitle}
          </p>
          <ul className="mt-5 space-y-3 text-sm md:mt-6">
            {footer.links
              .filter((l) => l.label.trim() && /^(\/|#|https?:|mailto:|tel:)/.test(l.href.trim()))
              .map((l, i) => (
                <li key={i}>
                  <Link
                    href={l.href}
                    {...(/^https?:/.test(l.href) ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="text-subtle transition-colors hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
          </ul>
        </div>

        <div>
          <p className="flex items-center font-mono text-[11px] uppercase tracking-[0.2em] text-subtle md:h-12">
            {footer.contactTitle}
          </p>
          <ul className="mt-5 space-y-3 text-sm text-subtle md:mt-6">
            {phoneLabel && (
              <li className="font-mono tabular">
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-ink"
                >
                  {phoneLabel}
                </a>
              </li>
            )}
            {mail && (
              <li>
                <a href={`mailto:${mail}`} className="transition-colors hover:text-ink">
                  {mail}
                </a>
              </li>
            )}
            {igHandle && (
              <li>
                <a
                  href={`https://instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-ink"
                >
                  @{igHandle}
                </a>
              </li>
            )}
            {footer.address && <li className="whitespace-pre-line">{footer.address}</li>}
          </ul>
        </div>
      </div>

      {footer.showBigName && (
        <div className="container-x overflow-hidden pb-8">
          <p
            aria-hidden
            className="text-outline select-none whitespace-nowrap text-center font-brand text-[10vw] font-extrabold uppercase leading-[0.9] tracking-tight md:text-[8.5vw]"
          >
            {bigName}
          </p>
        </div>
      )}

      <div className="border-t border-hairline">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-[11px] text-subtle md:flex-row">
          <p>
            © {year} {orgName}
            {footer.creci && ` — ${footer.creci}`}
          </p>
          {footer.coords && <p className="font-mono uppercase tracking-[0.18em]">{footer.coords}</p>}
          <KreativCredit />
        </div>
      </div>
    </footer>
  );
}
