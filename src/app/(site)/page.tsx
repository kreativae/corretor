import { HomeSearch } from "@/components/site/home-search";
import { LeadForm } from "@/components/site/lead-form";
import { isRuralType } from "@/lib/rural";
import { PropertyCard } from "@/components/site/property-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { listDeals, listPublishedProperties, getWhiteLabel } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { searchHref } from "@/lib/site-search";
import { TYPE_LABELS } from "@/lib/labels";
import { parseYouTubeUrl, plural } from "@/lib/utils";
import {
  ArrowRight,
  ArrowUpRight,
  Building,
  Building2,
  Home,
  KeyRound,
  LandPlot,
  MessageCircle,
  Sofa,
  Tractor,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [wl, published, deals, content] = await Promise.all([
    getWhiteLabel(),
    listPublishedProperties(),
    listDeals(),
    getSiteContent(),
  ]);

  const urban = published.filter((p) => !isRuralType(p.type));
  const rural = published.filter((p) => isRuralType(p.type));
  const neighborhoods = [...new Set(published.map((p) => p.neighborhood).filter(Boolean))];
  const cities = [...new Set(published.map((p) => p.city).filter(Boolean))];
  const featured = urban.slice(0, 6);
  const closed = deals.filter((d) => d.deal.stage === "fechado").length;
  const vgv = published
    .filter((p) => p.purpose === "venda")
    .reduce((acc, p) => acc + p.price, 0);

  // resolve tokens auto:* dos indicadores do hero
  const autoValues: Record<string, number> = {
    "auto:properties": published.length,
    "auto:neighborhoods": neighborhoods.length,
    "auto:vgv": vgv,
    "auto:closed": closed,
  };
  const heroStats = content.hero.stats.map((s) => {
    const isAuto = s.value.startsWith("auto:");
    const raw = isAuto ? autoValues[s.value] ?? 0 : parseFloat(s.value.replace(/[^\d.]/g, "")) || 0;
    const suffix = isAuto ? "" : s.value.replace(/[\d.,\s]/g, "");
    return { n: raw, label: s.label, suffix, format: s.value === "auto:vgv" ? ("brl" as const) : undefined };
  });

  const heroYouTubeId = parseYouTubeUrl(content.hero.videoUrl);

  const count = (fn: (p: (typeof published)[number]) => boolean) => published.filter(fn).length;
  const urbanTypes = URBAN_ORDER.filter((t) => urban.some((p) => p.type === t));

  // Atalhos por categoria (só os que têm imóveis)
  const categories: { label: string; href: string; n: number; icon: LucideIcon }[] = [
    ...urbanTypes.map((t) => ({
      label: TYPE_PLURAL[t] ?? TYPE_LABELS[t],
      href: searchHref({ tipo: t }),
      n: count((p) => p.type === t),
      icon: TYPE_ICONS[t] ?? Home,
    })),
    {
      label: "Para alugar",
      href: searchHref({ finalidade: "aluguel" }),
      n: count((p) => !isRuralType(p.type) && p.purpose === "aluguel"),
      icon: KeyRound,
    },
    {
      label: "Propriedades rurais",
      href: searchHref({ categoria: "rurais" }),
      n: rural.length,
      icon: Tractor,
    },
  ].filter((c) => c.n > 0);

  // Atalhos rápidos (filtros comuns) — só aparecem se trouxerem resultado
  const quick = [
    { label: "Até R$ 500 mil", href: searchHref({ finalidade: "venda", precoMax: "500000" }), n: count((p) => !isRuralType(p.type) && p.purpose === "venda" && p.price <= 500000) },
    { label: "3+ quartos", href: searchHref({ quartos: 3 }), n: count((p) => !isRuralType(p.type) && p.bedrooms >= 3) },
    { label: "Com piscina", href: searchHref({ caracteristica: "Piscina" }), n: count((p) => !isRuralType(p.type) && p.features.includes("Piscina")) },
    { label: "Pet friendly", href: searchHref({ caracteristica: "Pet friendly" }), n: count((p) => !isRuralType(p.type) && p.features.includes("Pet friendly")) },
    { label: "Aluguel até R$ 5 mil", href: searchHref({ finalidade: "aluguel", precoMax: "5000" }), n: count((p) => !isRuralType(p.type) && p.purpose === "aluguel" && p.price <= 5000) },
  ].filter((q) => q.n > 0);

  // Bairros com mais imóveis, com a foto de um deles
  const byHood = new Map<string, { n: number; cover: string | null; city: string }>();
  for (const p of urban) {
    if (!p.neighborhood) continue;
    const cur = byHood.get(p.neighborhood) ?? { n: 0, cover: null, city: p.city };
    byHood.set(p.neighborhood, { n: cur.n + 1, cover: cur.cover ?? p.cover, city: cur.city });
  }
  const hoods = [...byHood.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);

  const whatsapp = `https://wa.me/${wl.phone}?text=${encodeURIComponent(content.cta.whatsappMessage)}`;

  return (
    <div className="bg-canvas">
      <SiteHeader overHero orgName={wl.orgName} hasRural={rural.length > 0} />

      {/* ───────────── HERO + BUSCA ───────────── */}
      {/* Sempre escuro (vídeo + overlay); a busca é o protagonista */}
      <section className="dark relative overflow-hidden">
        <div className="absolute inset-0">
          {heroYouTubeId ? (
            <div className="absolute left-1/2 top-1/2 aspect-video w-[max(100vw,177.78vh)] -translate-x-1/2 -translate-y-1/2 overflow-hidden">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${heroYouTubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${heroYouTubeId}&rel=0&modestbranding=1&playsinline=1&disablekb=1&iv_load_policy=3&fs=0`}
                title="Vídeo de fundo"
                aria-hidden
                tabIndex={-1}
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                className="pointer-events-none h-full w-full"
              />
            </div>
          ) : (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={content.hero.posterUrl}
              className="h-full w-full object-cover"
            >
              <source src={content.hero.videoUrl} type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#11112a]/80 via-[#11112a]/50 to-[#11112a]/90" />
        </div>

        <div className="container-x relative z-10 flex min-h-[640px] flex-col justify-center pb-10 pt-28 text-white md:min-h-[78svh] md:pb-16 md:pt-32">
          <div className="mx-auto w-full max-w-5xl">
            <p
              data-reveal
              className="mb-4 inline-flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/75 md:text-[11px]"
            >
              <span className="size-1.5 rounded-full bg-accent" />
              {wl.orgName} — {content.hero.eyebrow}
            </p>
            <h1
              data-words
              data-delay="0.1"
              className="max-w-3xl text-balance font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl md:text-7xl"
            >
              {content.hero.title}
            </h1>
            <p data-reveal data-delay="0.25" className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 md:mt-5 md:text-base">
              {content.hero.subtitle}
            </p>

            <div data-reveal data-delay="0.35" className="mt-7 md:mt-9">
              <HomeSearch
                urbanTypes={urbanTypes}
                places={[...neighborhoods, ...cities.filter((c) => !neighborhoods.includes(c))]}
                neighborhoods={neighborhoods}
                cities={cities}
                hasRural={rural.length > 0}
                hasRent={urban.some((p) => p.purpose === "aluguel")}
                buttonLabel={content.hero.ctaPrimary}
              />
            </div>

            {quick.length > 0 && (
              <div data-reveal data-delay="0.45" className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
                {quick.map((q) => (
                  <Link
                    key={q.label}
                    href={q.href}
                    className="shrink-0 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur-sm transition-colors hover:border-white/50 hover:text-white"
                  >
                    {q.label}
                  </Link>
                ))}
              </div>
            )}

            <div data-reveal data-delay="0.5" className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/15 pt-5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8 md:mt-10">
              {heroStats.map((s, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <p className="font-mono text-lg font-medium tabular md:text-xl">
                    <span data-counter={s.n} data-format={s.format ?? "int"}>
                      0
                    </span>
                    {s.suffix}
                  </p>
                  <p className="text-xs text-white/60">{s.label}</p>
                </div>
              ))}
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="col-span-2 mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline sm:ml-auto sm:mt-0"
              >
                <MessageCircle className="size-3.5" />
                {content.hero.ctaSecondary}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── CATEGORIAS ───────────── */}
      {categories.length > 0 && (
        <section className="container-x pt-10 md:pt-16">
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] sm:px-0">
            {categories.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="group flex w-36 shrink-0 flex-col gap-4 rounded-2xl border border-hairline bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline-strong sm:w-auto"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-soft text-ink transition-colors group-hover:bg-accent group-hover:text-on-accent">
                  <c.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium leading-tight">{c.label}</span>
                  <span className="mt-1 block font-mono text-[11px] text-subtle">
                    {c.n} {plural(c.n, "opção", "opções")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── DESTAQUES ───────────── */}
      {featured.length > 0 && (
        <section id="destaques" className="container-x scroll-mt-20 py-12 md:py-20">
          <SectionHead eyebrow={content.collection.eyebrow} title={content.collection.title}>
            <Link
              href="/imoveis"
              className="group inline-flex items-center gap-2 text-sm font-medium text-subtle transition-colors hover:text-ink"
            >
              {content.collection.linkLabel}
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </SectionHead>
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {featured.map((p, i) => (
              <div key={p.id} data-reveal data-delay={`${(i % 3) * 0.06}`} className="w-[84%] shrink-0 snap-center sm:w-auto">
                <PropertyCard property={p} />
              </div>
            ))}
          </div>
          <Link
            href="/imoveis"
            className="mt-8 flex h-12 items-center justify-center gap-2 rounded-full border border-hairline-strong text-sm font-medium transition-colors hover:bg-soft sm:mx-auto sm:w-fit sm:px-8"
          >
            Ver todos os {urban.length} imóveis
            <ArrowRight className="size-4" />
          </Link>
        </section>
      )}

      {/* ───────────── BAIRROS ───────────── */}
      {hoods.length > 1 && (
        <section className="border-t border-hairline bg-soft/50">
          <div className="container-x py-12 md:py-20">
            <SectionHead eyebrow="Por região" title="Buscar por bairro" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {hoods.map(([name, h]) => (
                <Link
                  key={name}
                  href={searchHref({ bairro: name })}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-soft"
                >
                  {h.cover ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={h.cover}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-expo group-hover:scale-[1.06]"
                    />
                  ) : (
                    <div className="grid-bg absolute inset-0 opacity-60" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5 text-white md:p-4">
                    <p className="font-display text-base font-semibold leading-tight tracking-tight md:text-lg">{name}</p>
                    <p className="mt-0.5 text-[11px] text-white/75">
                      {h.n} {plural(h.n, "imóvel", "imóveis")}
                      {cities.length > 1 && ` · ${h.city}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────── RURAIS ───────────── */}
      {rural.length > 0 && (
        <section className="container-x py-12 md:py-20">
          <SectionHead eyebrow="No campo" title="Propriedades rurais">
            <Link
              href={searchHref({ categoria: "rurais" })}
              className="group inline-flex items-center gap-2 text-sm font-medium text-subtle transition-colors hover:text-ink"
            >
              Ver {rural.length} {plural(rural.length, "propriedade", "propriedades")}
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </SectionHead>
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {rural.slice(0, 3).map((p) => (
              <div key={p.id} className="w-[84%] shrink-0 snap-center sm:w-auto">
                <PropertyCard property={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── NÃO ENCONTROU? ───────────── */}
      <section id="fale-conosco" className="container-x scroll-mt-24 pb-14 pt-2 md:pb-24">
        <div className="grid gap-8 rounded-3xl border border-hairline bg-card p-5 md:grid-cols-[0.85fr_1.15fr] md:gap-12 md:p-12">
          <div data-reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">
              A gente busca pra você
            </p>
            <h2 className="mt-3 text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              {content.cta.title}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-subtle">{content.cta.body}</p>
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-hairline-strong px-5 text-sm font-medium transition-colors hover:bg-soft"
            >
              <MessageCircle className="size-4" />
              {content.cta.secondary}
            </a>
          </div>
          <div data-reveal data-delay="0.1">
            <LeadForm />
          </div>
        </div>
      </section>

      <SiteFooter
        orgName={wl.orgName}
        phone={wl.phone}
        footer={content.footer}
        email={wl.email}
        instagram={wl.instagram}
      />
    </div>
  );
}

const URBAN_ORDER = ["apartamento", "casa", "cobertura", "estudio", "terreno"];
const TYPE_PLURAL: Record<string, string> = {
  apartamento: "Apartamentos",
  casa: "Casas",
  cobertura: "Coberturas",
  estudio: "Estúdios",
  terreno: "Terrenos",
};
const TYPE_ICONS: Record<string, LucideIcon> = {
  apartamento: Building2,
  casa: Home,
  cobertura: Building,
  estudio: Sofa,
  terreno: LandPlot,
};

function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 md:mb-10">
      <div>
        <p data-reveal className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-balance font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl md:text-5xl">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
