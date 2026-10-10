import { LeadForm } from "@/components/site/lead-form";
import { isRuralType } from "@/lib/rural";
import { PropertyCard } from "@/components/site/property-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { listDeals, listPublishedProperties, getWhiteLabel } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { parseYouTubeUrl } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [wl, published, deals, content] = await Promise.all([
    getWhiteLabel(),
    listPublishedProperties(),
    listDeals(),
    getSiteContent(),
  ]);

  const neighborhoods = [...new Set(published.map((p) => p.neighborhood))];
  const featured = published.slice(0, 5);
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

  const marqueeItems = neighborhoods.length
    ? neighborhoods
    : ["Jardins", "Higienópolis", "Pinheiros", "Itaim Bibi", "Moema"];

  const heroYouTubeId = parseYouTubeUrl(content.hero.videoUrl);

  return (
    <div className="bg-canvas">
      <SiteHeader overHero orgName={wl.orgName} hasRural={published.some((x) => isRuralType(x.type))} />

      {/* ───────────── HERO ───────────── */}
      {/* Hero sempre escuro, independente do tema (vídeo + overlay + texto branco) */}
      <section className="dark relative flex h-[100svh] min-h-[640px] flex-col overflow-hidden">
        <div className="absolute inset-0">
          {heroYouTubeId ? (
            /* Vídeo do YouTube — embed em modo capa (cover), mudo e em loop.
               Escala 16:9 além do viewport para cobrir qualquer proporção. */
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
              className="h-full w-full scale-105 object-cover"
              data-parallax="6"
            >
              <source src={content.hero.videoUrl} type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-[#0a0a0a]" />
          <div className="absolute inset-0 bg-black/20" />
        </div>

        <div className="container-x relative z-10 flex flex-1 flex-col justify-end pb-10 text-white md:pb-14">
          <p
            data-reveal
            className="mb-6 inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.24em] text-white/80"
          >
            <span className="size-1.5 rounded-full bg-accent" />
            {wl.orgName} — {content.hero.eyebrow}
          </p>

          <h1
            data-words
            data-delay="0.15"
            className="max-w-5xl text-balance font-display text-[13vw] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-7xl md:text-8xl lg:text-[7.5rem]"
          >
            {content.hero.title}
          </h1>

          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p
              data-reveal
              data-delay="0.35"
              className="max-w-md text-[15px] leading-relaxed text-white/75"
            >
              {content.hero.subtitle}
            </p>
            <div
              data-reveal
              data-delay="0.45"
              className="flex flex-wrap items-center gap-3"
            >
              <Link
                href="/imoveis"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition-all duration-300 ease-expo hover:scale-[1.03] active:scale-[0.98]"
              >
                {content.hero.ctaPrimary}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href="#colecao"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-6 text-sm font-medium text-white backdrop-blur-sm transition-colors duration-300 hover:border-white/60"
              >
                {content.hero.ctaSecondary}
              </a>
            </div>
          </div>

          {/* Stats */}
          <div
            data-reveal
            data-delay="0.55"
            className="mt-12 grid grid-cols-2 gap-6 border-t border-white/15 pt-6 md:grid-cols-4"
          >
            {heroStats.map((s, i) => (
              <div key={i}>
                <p className="font-mono text-2xl font-medium tabular md:text-3xl">
                  <span data-counter={s.n} data-format={s.format ?? "int"}>
                    0
                  </span>
                  {s.suffix}
                </p>
                <p className="mt-1 text-xs text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-10 right-6 z-10 hidden md:right-10 lg:block">
          <div className="flex size-12 animate-bounce items-center justify-center rounded-full border border-white/20 text-white/70 [animation-duration:2.4s]">
            <ArrowDown className="size-4" />
          </div>
        </div>
      </section>

      {/* ───────────── MARQUEE ───────────── */}
      <section className="overflow-hidden border-b border-hairline py-5">
        <div className="animate-marquee flex w-max items-center gap-10">
          {[...marqueeItems, ...marqueeItems].map((n, i) => (
            <span
              key={i}
              className="flex items-center gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[0.28em] text-subtle"
            >
              {n}
              <span className="size-1 rounded-full bg-accent" />
            </span>
          ))}
        </div>
      </section>

      {/* ───────────── COLEÇÃO ───────────── */}
      <section id="colecao" className="container-x py-20 md:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p
              data-reveal
              className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle"
            >
              {content.collection.eyebrow}
            </p>
            <h2
              data-words
              className="mt-3 max-w-xl font-display text-4xl font-semibold tracking-[-0.02em] md:text-6xl"
            >
              {content.collection.title}
            </h2>
          </div>
          <Link
            data-reveal
            href="/imoveis"
            className="group inline-flex items-center gap-2 text-sm font-medium text-subtle transition-colors hover:text-ink"
          >
            {content.collection.linkLabel}
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => (
            <div
              key={p.id}
              data-reveal
              data-delay={`${(i % 3) * 0.08}`}
              className={i === 0 ? "sm:col-span-2" : ""}
            >
              <PropertyCard property={p} featured={i === 0} />
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── EXPERIÊNCIA ───────────── */}
      <section id="experiencia" className="border-t border-hairline bg-soft/60">
        <div className="container-x grid gap-14 py-20 md:py-32 lg:grid-cols-2 lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p
              data-reveal
              className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle"
            >
              {content.experience.eyebrow}
            </p>
            <h2
              data-words
              className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl"
            >
              {content.experience.title}
            </h2>
            <p
              data-reveal
              className="mt-6 max-w-md text-[15px] leading-relaxed text-subtle"
            >
              {content.experience.body}
            </p>

            <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
              {content.experience.stats.map((s, i) => (
                <div key={i} className="bg-card p-6">
                  <p className="font-mono text-3xl font-medium tabular">
                    <span
                      data-counter={parseFloat(s.value.replace(/[^\d.]/g, "")) || 0}
                      data-format="int"
                    >
                      0
                    </span>
                    {s.value.replace(/[\d.,\s]/g, "")}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-subtle">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div data-clip className="overflow-hidden rounded-2xl">
              <div className="relative aspect-[4/5] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.experience.imageA}
                  alt="Ambiente do portfólio"
                  loading="lazy"
                  data-parallax="7"
                  className="absolute inset-0 h-[116%] w-full object-cover"
                />
              </div>
            </div>
            <div data-clip className="overflow-hidden rounded-2xl">
              <div className="relative aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.experience.imageB}
                  alt="Fachada do portfólio"
                  loading="lazy"
                  data-parallax="7"
                  className="absolute inset-0 h-[116%] w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── COMO FUNCIONA ───────────── */}
      <section className="container-x py-20 md:py-32">
        <p
          data-reveal
          className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle"
        >
          {content.process.eyebrow}
        </p>
        <h2
          data-words
          className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-[-0.02em] md:text-6xl"
        >
          {content.process.title}
        </h2>

        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {content.process.steps.map((s, i) => (
            <div
              key={i}
              data-reveal
              data-delay={`${i * 0.1}`}
              className="border-t border-hairline-strong pt-6"
            >
              <p className="font-mono text-xs text-subtle">{s.n}</p>
              <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-subtle">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── FALE COM A GENTE ───────────── */}
      <section id="fale-conosco" className="container-x scroll-mt-24 pb-20 md:pb-28">
        <div className="grid gap-10 rounded-3xl border border-hairline bg-card p-6 md:grid-cols-[0.8fr_1.2fr] md:p-12">
          <div data-reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle">
              Fale com a gente
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Conte o que você procura.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-subtle">
              Imóvel na cidade ou propriedade rural: deixe seu contato e um corretor
              retorna pelo WhatsApp.
            </p>
          </div>
          <div data-reveal data-delay="0.1">
            <LeadForm />
          </div>
        </div>
      </section>

      {/* ───────────── CTA FINAL ───────────── */}
      <section className="container-x pb-20 md:pb-32">
        <div
          data-reveal
          className="relative overflow-hidden rounded-3xl border border-hairline bg-soft px-8 py-16 text-center md:py-24"
        >
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <h2
              data-words
              className="mx-auto max-w-3xl text-balance font-display text-4xl font-semibold tracking-[-0.02em] md:text-6xl"
            >
              {content.cta.title}
            </h2>
            <p
              data-reveal
              className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-subtle"
            >
              {content.cta.body}
            </p>
            <div
              data-reveal
              data-delay="0.1"
              className="mt-9 flex flex-wrap items-center justify-center gap-3"
            >
              <Link
                href="/imoveis"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-sm font-medium text-on-accent transition-all duration-300 ease-expo hover:scale-[1.03] active:scale-[0.98]"
              >
                {content.cta.primary}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href={`https://wa.me/${wl.phone}?text=${encodeURIComponent(content.cta.whatsappMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-hairline-strong px-7 text-sm font-medium transition-colors duration-300 hover:bg-card"
              >
                {content.cta.secondary}
              </a>
            </div>
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
