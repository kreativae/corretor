import { Mark } from "@/components/brand";
import type { SiteContent } from "@/lib/site-content";
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
  const first = orgName.split(" ")[0];

  return (
    <footer id="contato" className="border-t border-hairline">
      <div className="container-x grid gap-14 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:py-24">
        <div>
          <Mark className="size-10" />
          <p className="mt-6 max-w-xs font-display text-2xl font-medium leading-snug tracking-tight">
            {footer.tagline}
          </p>
          <Link href="/login" className="mt-6 inline-flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3.5 py-2 text-xs font-medium text-subtle transition-colors hover:border-hairline-strong hover:text-ink">
              Área do corretor
              <ArrowUpRight className="size-3.5" />
            </span>
          </Link>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
            Navegação
          </p>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              { href: "/imoveis", label: "Todos os imóveis" },
              { href: "/#colecao", label: "Coleção" },
              { href: "/#experiencia", label: "Experiência" },
              { href: "/login", label: "Acessar plataforma" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-subtle transition-colors hover:text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
            Contato
          </p>
          <ul className="mt-5 space-y-3 text-sm text-subtle">
            <li className="font-mono tabular">
              +{phone.slice(0, 2)} ({phone.slice(2, 4)}) {phone.slice(4, 9)}-
              {phone.slice(9)}
            </li>
            <li>{email || footer.email}</li>
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
            <li className="whitespace-pre-line">{footer.address}</li>
          </ul>
        </div>
      </div>

      <div className="container-x overflow-hidden pb-8">
        <p
          aria-hidden
          className="text-outline select-none text-center font-display text-[18vw] font-bold leading-[0.85] tracking-tight md:text-[13vw]"
        >
          {first.toUpperCase()}®
        </p>
      </div>

      <div className="border-t border-hairline">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-[11px] text-subtle md:flex-row">
          <p>
            © {year} {orgName} — {footer.creci}
          </p>
          <p className="font-mono uppercase tracking-[0.18em]">{footer.coords}</p>
          <p>
            Plataforma <span className="text-ink">ImobManager</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
