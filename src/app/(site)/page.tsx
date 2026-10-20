import { HeroSearchProvider, HeroTitle, HomeSearch } from "@/components/site/home-search";
import { APTIDAO_LABELS, kindOf, normalizeRural } from "@/lib/rural";
import { LAND_TYPES } from "@/lib/land";
import { PropertyCard } from "@/components/site/property-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { listDeals, listPublishedProperties, getWhiteLabel } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { searchHref } from "@/lib/site-search";
import { cn, parseYouTubeUrl, plural, siteImage } from "@/lib/utils";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  MessageCircle,
  Tractor,
  LandPlot,
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

  const urban = published.filter((p) => kindOf(p.type) === "urbano");
  const rural = published.filter((p) => kindOf(p.type) === "rural");
  const lands = published.filter((p) => kindOf(p.type) === "terreno");
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

  // Dois cards de categoria (só os que têm imóveis); foto padrão = capa de um publicado
  const cat = content.categories;
  const categories = [
    {
      key: "urbano",
      title: cat.urbanTitle,
      text: cat.urbanText,
      href: "/imoveis",
      n: urban.length,
      image: siteImage(cat.urbanImage) || coverOf(urban.find((p) => p.cover)),
      overlay: "from-[#F47525]/95 via-[#F47525]/75 to-[#F47525]/35",
      icon: Building2,
    },
    {
      key: "rural",
      title: cat.ruralTitle,
      text: cat.ruralText,
      href: searchHref({ categoria: "rurais" }),
      n: rural.length,
      image: siteImage(cat.ruralImage) || coverOf(rural.find((p) => p.cover)),
      overlay: "from-[#2B2B5D]/95 via-[#2B2B5D]/75 to-[#2B2B5D]/35",
      icon: Tractor,
    },
    {
      key: "terreno",
      title: cat.landTitle,
      text: cat.landText,
      href: searchHref({ categoria: "terrenos" }),
      n: lands.length,
      image: siteImage(cat.landImage) || coverOf(lands.find((p) => p.cover)),
      overlay: "from-[#1E5E46]/95 via-[#1E5E46]/75 to-[#1E5E46]/35",
      icon: LandPlot,
    },
  ].filter((c) => c.n > 0);

  // Atalhos rápidos por aba da busca — só os que trazem resultado
  const venda = urban.filter((p) => p.purpose === "venda");
  const aluguel = urban.filter((p) => p.purpose === "aluguel");
  type P = (typeof published)[number];
  const chips = (list: P[], defs: { label: string; href: string; test: (p: P) => boolean }[]) =>
    defs
      .map((d) => ({ label: d.label, href: d.href, n: list.filter(d.test).length }))
      .filter((d) => d.n > 0);
  const has = (f: string) => (p: P) => p.features.includes(f);
  const feat = (label: string, f: string, fin: "venda" | "aluguel") => ({
    label,
    href: searchHref({ finalidade: fin, caracteristica: f }),
    test: has(f),
  });
  const ru = (p: P) => normalizeRural(p.rural);
  const quick = {
    venda: chips(venda, [
      { label: "Casas", href: searchHref({ finalidade: "venda", tipo: "casa" }), test: (p) => p.type === "casa" },
      { label: "Apartamentos", href: searchHref({ finalidade: "venda", tipo: "apartamento" }), test: (p) => p.type === "apartamento" },
      { label: "Até R$ 500 mil", href: searchHref({ finalidade: "venda", precoMax: "500000" }), test: (p) => p.price <= 500000 },
      { label: "R$ 500 mil a 1 mi", href: searchHref({ finalidade: "venda", precoMin: "500000", precoMax: "1000000" }), test: (p) => p.price >= 500000 && p.price <= 1000000 },
      { label: "3+ quartos", href: searchHref({ finalidade: "venda", quartos: 3 }), test: (p) => p.bedrooms >= 3 },
      { label: "Com suíte", href: searchHref({ finalidade: "venda", suites: 1 }), test: (p) => p.suites >= 1 },
      { label: "2+ vagas", href: searchHref({ finalidade: "venda", vagas: 2 }), test: (p) => p.garage >= 2 },
      feat("Com piscina", "Piscina", "venda"),
      feat("Churrasqueira", "Churrasqueira", "venda"),
      feat("Varanda gourmet", "Varanda gourmet", "venda"),
      feat("Portaria 24h", "Portaria 24h", "venda"),
      feat("Pet friendly", "Pet friendly", "venda"),
    ]),
    aluguel: chips(aluguel, [
      { label: "Até R$ 2 mil", href: searchHref({ finalidade: "aluguel", precoMax: "2000" }), test: (p) => p.price <= 2000 },
      { label: "Até R$ 3 mil", href: searchHref({ finalidade: "aluguel", precoMax: "3000" }), test: (p) => p.price <= 3000 },
      { label: "Até R$ 5 mil", href: searchHref({ finalidade: "aluguel", precoMax: "5000" }), test: (p) => p.price <= 5000 },
      { label: "Apartamentos", href: searchHref({ finalidade: "aluguel", tipo: "apartamento" }), test: (p) => p.type === "apartamento" },
      { label: "Casas", href: searchHref({ finalidade: "aluguel", tipo: "casa" }), test: (p) => p.type === "casa" },
      { label: "Estúdios", href: searchHref({ finalidade: "aluguel", tipo: "estudio" }), test: (p) => p.type === "estudio" },
      { label: "2+ quartos", href: searchHref({ finalidade: "aluguel", quartos: 2 }), test: (p) => p.bedrooms >= 2 },
      { label: "Com vaga", href: searchHref({ finalidade: "aluguel", vagas: 1 }), test: (p) => p.garage >= 1 },
      feat("Pet friendly", "Pet friendly", "aluguel"),
      feat("Ar-condicionado", "Ar-condicionado", "aluguel"),
      feat("Portaria 24h", "Portaria 24h", "aluguel"),
      feat("Com piscina", "Piscina", "aluguel"),
    ]),
    terrenos: chips(lands, [
      ...LAND_TYPES.map((t) => ({
        label: { terreno: "Lotes", lote_condominio: "Em condomínio", terreno_comercial: "Comerciais", area: "Áreas / glebas" }[t],
        href: searchHref({ categoria: "terrenos", tipo: t }),
        test: (p: P) => p.type === t,
      })),
      { label: "Até R$ 300 mil", href: searchHref({ categoria: "terrenos", precoMax: "300000" }), test: (p) => p.price <= 300000 },
      { label: "Até 400 m²", href: searchHref({ categoria: "terrenos", areaMax: "400" }), test: (p) => p.area <= 400 },
      { label: "Acima de 1.000 m²", href: searchHref({ categoria: "terrenos", areaMin: "1000" }), test: (p) => p.area >= 1000 },
    ]),
    rurais: chips(rural, [
      { label: "Fazendas", href: searchHref({ categoria: "rurais", tipo: "fazenda" }), test: (p) => p.type === "fazenda" },
      { label: "Sítios", href: searchHref({ categoria: "rurais", tipo: "sitio" }), test: (p) => p.type === "sitio" },
      { label: "Chácaras", href: searchHref({ categoria: "rurais", tipo: "chacara" }), test: (p) => p.type === "chacara" },
      ...Object.entries(APTIDAO_LABELS).map(([id, label]) => ({
        label,
        href: searchHref({ categoria: "rurais", aptidao: id }),
        test: (p: P) => ru(p).aptidao === id,
      })),
      { label: "Até 10 alq", href: searchHref({ categoria: "rurais", areaMax: "10" }), test: (p) => (ru(p).totalAlq ?? 0) <= 10 },
      { label: "Acima de 100 alq", href: searchHref({ categoria: "rurais", areaMin: "100" }), test: (p) => (ru(p).totalAlq ?? 0) >= 100 },
      ...["Rio", "Nascentes", "Represa / açude", "Poço artesiano"].map((a) => ({
        label: a === "Represa / açude" ? "Represa / açude" : `Com ${a.toLowerCase()}`,
        href: searchHref({ categoria: "rurais", agua: a }),
        test: (p: P) => ru(p).agua.includes(a),
      })),
      { label: "Energia trifásica", href: searchHref({ categoria: "rurais", energia: "trifasica" }), test: (p) => ru(p).energia === "trifasica" },
      { label: "Asfalto até a porteira", href: searchHref({ categoria: "rurais", acesso: "asfalto" }), test: (p) => ru(p).acesso === "asfalto" },
      ...["Casa sede", "Curral", "Barracão"].map((b) => ({
        label: b,
        href: searchHref({ categoria: "rurais", benfeitoria: b }),
        test: (p: P) => ru(p).benfeitorias.includes(b),
      })),
      { label: "Com mapa (KMZ)", href: searchHref({ categoria: "rurais", kmz: "1" }), test: (p) => !!ru(p).kmzUrl },
    ]),
  };

  // Bairros com mais imóveis, com a foto de um deles
  const byHood = new Map<string, { n: number; cover: string | null; city: string }>();
  for (const p of urban) {
    if (!p.neighborhood) continue;
    const cur = byHood.get(p.neighborhood) ?? { n: 0, cover: null, city: p.city };
    byHood.set(p.neighborhood, { n: cur.n + 1, cover: cur.cover ?? coverOf(p), city: cur.city });
  }
  const hoods = [...byHood.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);

  const whatsapp = `https://wa.me/${wl.phone}?text=${encodeURIComponent(content.cta.whatsappMessage)}`;

  return (
    <div className="bg-canvas">
      <SiteHeader overHero orgName={wl.orgName} menu={content.header} hasRural={rural.length > 0} hasLand={lands.length > 0} />

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
          <HeroSearchProvider>
          <div className="mx-auto w-full max-w-5xl">
            <p
              data-reveal
              className="mb-4 inline-flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/75 md:text-[11px]"
            >
              <span className="size-1.5 rounded-full bg-accent" />
              {wl.orgName} — {content.hero.eyebrow}
            </p>
            <HeroTitle
              title={content.hero.title}
              titleRural={content.hero.titleRural}
              titleLand={content.hero.titleLand}
              className="max-w-3xl text-balance font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl md:text-7xl"
            />
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
                hasLand={lands.length > 0}
                landTypes={LAND_TYPES.filter((t) => lands.some((p) => p.type === t))}
                hasRent={urban.some((p) => p.purpose === "aluguel")}
                buttonLabel={content.hero.ctaPrimary}
                quick={quick}
              />
            </div>

            <div
              data-reveal
              data-delay="0.5"
              className={cn(
                "mt-8 grid-cols-2 gap-x-4 gap-y-3 border-t border-white/15 pt-5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8 md:mt-10",
                content.hero.statsOnMobile ? "grid" : "hidden",
              )}
            >
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
          </HeroSearchProvider>
        </div>
      </section>

      {/* ───────────── CATEGORIAS ───────────── */}
      {categories.length > 0 && (
        <section className="container-x pt-10 md:pt-16">
          <div
            className={cn(
              "grid gap-3 md:gap-5",
              categories.length > 1 && "sm:grid-cols-2",
              categories.length > 2 && "lg:grid-cols-3",
            )}
          >
            {categories.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className="group relative isolate flex min-h-72 flex-col justify-end overflow-hidden rounded-3xl bg-[#2B2B5D] p-5 pt-20 text-white sm:aspect-[4/3] sm:min-h-0 md:p-8 lg:aspect-[16/10]"
              >
                {c.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-700 ease-expo group-hover:scale-[1.06]"
                  />
                )}
                {/* Overlay nas cores da marca: laranja (imóveis) e marinho (rurais) */}
                <div className={cn("absolute inset-0 -z-10 bg-gradient-to-t", c.overlay)} />
                <span className="absolute left-5 top-5 flex size-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm md:left-8 md:top-8 md:size-12">
                  <c.icon className="size-5 md:size-6" />
                </span>
                <span className="absolute right-5 top-5 rounded-full bg-white/15 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm md:right-8 md:top-8">
                  {c.n} {plural(c.n, "opção", "opções")}
                </span>
                <h2 className="font-display text-2xl font-semibold tracking-tight md:text-4xl">{c.title}</h2>
                {c.text && (
                  <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/85 md:text-[15px]">
                    {c.text}
                  </p>
                )}
                <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#2B2B5D] transition-transform duration-300 group-hover:translate-x-1 md:mt-5">
                  Ver {c.title.toLowerCase()}
                  <ArrowRight className="size-4" />
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

      {/* ───────────── TERRENOS ───────────── */}
      {lands.length > 0 && (
        <section className="container-x py-12 md:py-20">
          <SectionHead eyebrow="Para construir" title={cat.landTitle || "Terrenos"}>
            <Link
              href={searchHref({ categoria: "terrenos" })}
              className="group inline-flex items-center gap-2 text-sm font-medium text-subtle transition-colors hover:text-ink"
            >
              Ver {lands.length} {plural(lands.length, "terreno", "terrenos")}
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </SectionHead>
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {lands.slice(0, 3).map((p) => (
              <div key={p.id} className="w-[84%] shrink-0 snap-center sm:w-auto">
                <PropertyCard property={p} />
              </div>
            ))}
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

      <SiteFooter
        orgName={wl.orgName}
        phone={wl.phone}
        footer={content.footer}
        cta={content.cta}
        email={wl.email}
        instagram={wl.instagram}
      />
    </div>
  );
}

/** Capa de um imóvel já com a marca d'água do modo dele */
function coverOf(p?: { cover: string | null; wm: string }) {
  return p?.cover ? siteImage(p.cover, p.wm) : "";
}

const URBAN_ORDER = ["apartamento", "casa", "cobertura", "estudio"];
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
