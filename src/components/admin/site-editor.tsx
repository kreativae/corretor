"use client";

import { Button, Field, Input, Textarea } from "@/components/ui";
import type { WhiteLabel } from "@/lib/queries";
import type { SiteContent } from "@/lib/site-content";
import { cn, parseYouTubeUrl } from "@/lib/utils";
import {
  ExternalLink,
  Image as ImageIcon,
  LayoutTemplate,
  ListChecks,
  Megaphone,
  PanelBottom,
  RotateCcw,
  Save,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type TabId =
  | "seo"
  | "hero"
  | "collection"
  | "experience"
  | "process"
  | "cta"
  | "pages"
  | "footer";

const TABS: { id: TabId; label: string; icon: typeof Search }[] = [
  { id: "seo", label: "SEO & meta", icon: Search },
  { id: "hero", label: "Hero", icon: LayoutTemplate },
  { id: "collection", label: "Coleção", icon: Sparkles },
  { id: "experience", label: "Experiência", icon: ImageIcon },
  { id: "process", label: "Processo", icon: ListChecks },
  { id: "cta", label: "Chamada final", icon: Megaphone },
  { id: "pages", label: "Listagem & imóvel", icon: LayoutTemplate },
  { id: "footer", label: "Rodapé", icon: PanelBottom },
];

export function SiteEditor({
  initial,
  whiteLabel,
}: {
  initial: SiteContent;
  whiteLabel: WhiteLabel;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("hero");
  const [c, setC] = useState<SiteContent>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const heroYouTubeId = parseYouTubeUrl(c.hero.videoUrl);

  function patch<K extends keyof SiteContent>(
    section: K,
    value: Partial<SiteContent[K]>,
  ) {
    setC((prev) => ({ ...prev, [section]: { ...prev[section], ...value } }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error();
      toast.success("Conteúdo publicado no site.");
      setDirty(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o conteúdo.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      const res = await fetch("/api/site-content", { method: "DELETE" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setC(data.content);
      setDirty(false);
      toast.success("Conteúdo restaurado para o padrão.");
      router.refresh();
    } catch {
      toast.error("Erro ao restaurar o padrão.");
    } finally {
      setSaving(false);
    }
  }

  const card = "rounded-2xl border border-hairline bg-card p-6 card-elev";

  return (
    <div className="pb-24">
      {/* Abas */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200",
              tab === t.id
                ? "border-transparent bg-ink text-canvas"
                : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {/* ─────── SEO ─────── */}
        {tab === "seo" && (
          <section className={card}>
            <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
              SEO & metadados
            </h2>
            <div className="space-y-4">
              <Field label="Título da página (title tag)" hint="Ideal até 60 caracteres">
                <Input
                  value={c.seo.title}
                  onChange={(e) => patch("seo", { title: e.target.value })}
                />
              </Field>
              <Field label="Meta descrição" hint="Ideal até 160 caracteres">
                <Textarea
                  rows={3}
                  value={c.seo.description}
                  onChange={(e) => patch("seo", { description: e.target.value })}
                />
              </Field>
              <div className="rounded-xl border border-hairline bg-soft p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                  Pré-visualização no Google
                </p>
                <p className="mt-3 truncate text-[13px] text-sky-600 dark:text-sky-400">
                  {c.seo.title}
                </p>
                <p className="font-mono text-[11px] text-emerald-600 dark:text-emerald-500">
                  https://{whiteLabel.domain}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-subtle">
                  {c.seo.description}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ─────── HERO ─────── */}
        {tab === "hero" && (
          <>
            <section className={card}>
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
                Seção hero (topo da home)
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Linha de apoio (eyebrow)" className="sm:col-span-2">
                  <Input
                    value={c.hero.eyebrow}
                    onChange={(e) => patch("hero", { eyebrow: e.target.value })}
                  />
                </Field>
                <Field label="Título principal" className="sm:col-span-2">
                  <Input
                    value={c.hero.title}
                    onChange={(e) => patch("hero", { title: e.target.value })}
                    className="font-display text-base"
                  />
                </Field>
                <Field label="Subtítulo" className="sm:col-span-2">
                  <Textarea
                    rows={3}
                    value={c.hero.subtitle}
                    onChange={(e) => patch("hero", { subtitle: e.target.value })}
                  />
                </Field>
                <Field label="Botão primário">
                  <Input
                    value={c.hero.ctaPrimary}
                    onChange={(e) => patch("hero", { ctaPrimary: e.target.value })}
                  />
                </Field>
                <Field label="Botão secundário">
                  <Input
                    value={c.hero.ctaSecondary}
                    onChange={(e) => patch("hero", { ctaSecondary: e.target.value })}
                  />
                </Field>
                <Field
                  label="Vídeo de fundo"
                  hint="Cole um link do YouTube (watch, youtu.be, shorts) ou a URL direta de um .mp4"
                  className="sm:col-span-2"
                >
                  <Input
                    value={c.hero.videoUrl}
                    onChange={(e) => patch("hero", { videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="font-mono text-xs"
                  />
                </Field>
                <Field
                  label="Imagem de poster (URL)"
                  hint={
                    heroYouTubeId
                      ? "Não usada quando o vídeo é do YouTube"
                      : "Exibida antes do vídeo carregar (.mp4)"
                  }
                  className="sm:col-span-2"
                >
                  <Input
                    value={c.hero.posterUrl}
                    onChange={(e) => patch("hero", { posterUrl: e.target.value })}
                    className="font-mono text-xs"
                  />
                </Field>
              </div>
              {heroYouTubeId ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                      Vídeo do YouTube detectado · ID {heroYouTubeId}
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-medium text-red-500">
                      <span className="size-1.5 rounded-full bg-red-500" />
                      YouTube
                    </span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${heroYouTubeId}/hqdefault.jpg`}
                    alt="Prévia do vídeo do YouTube"
                    className="mt-3 aspect-[21/9] w-full rounded-xl border border-hairline object-cover"
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-subtle">
                    O vídeo entra em loop sem som, em modo tela cheia por trás do
                    texto — igual a um .mp4 nativo.
                  </p>
                </div>
              ) : (
                c.hero.posterUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.hero.posterUrl}
                    alt="Prévia do hero"
                    className="mt-4 aspect-[21/9] w-full rounded-xl object-cover"
                  />
                )
              )}
            </section>

            <section className={card}>
              <h2 className="mb-1 font-display text-base font-semibold tracking-tight">
                Indicadores do hero
              </h2>
              <p className="mb-5 text-xs text-subtle">
                Use <code className="font-mono">auto:properties</code>,{" "}
                <code className="font-mono">auto:neighborhoods</code> ou{" "}
                <code className="font-mono">auto:vgv</code> para números
                calculados automaticamente pela base.
              </p>
              <div className="space-y-3">
                {c.hero.stats.map((s, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <Input
                      value={s.value}
                      onChange={(e) => {
                        const stats = [...c.hero.stats];
                        stats[i] = { ...s, value: e.target.value };
                        patch("hero", { stats });
                      }}
                      className="font-mono text-xs"
                      placeholder="340 ou auto:vgv"
                    />
                    <Input
                      value={s.label}
                      onChange={(e) => {
                        const stats = [...c.hero.stats];
                        stats[i] = { ...s, label: e.target.value };
                        patch("hero", { stats });
                      }}
                      placeholder="Rótulo exibido"
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ─────── COLEÇÃO ─────── */}
        {tab === "collection" && (
          <section className={card}>
            <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
              Seção de coleção
            </h2>
            <div className="space-y-4">
              <Field label="Linha de apoio">
                <Input
                  value={c.collection.eyebrow}
                  onChange={(e) => patch("collection", { eyebrow: e.target.value })}
                />
              </Field>
              <Field label="Título">
                <Input
                  value={c.collection.title}
                  onChange={(e) => patch("collection", { title: e.target.value })}
                />
              </Field>
              <Field label="Texto do link">
                <Input
                  value={c.collection.linkLabel}
                  onChange={(e) => patch("collection", { linkLabel: e.target.value })}
                />
              </Field>
            </div>
          </section>
        )}

        {/* ─────── EXPERIÊNCIA ─────── */}
        {tab === "experience" && (
          <>
            <section className={card}>
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
                Seção experiência
              </h2>
              <div className="space-y-4">
                <Field label="Linha de apoio">
                  <Input
                    value={c.experience.eyebrow}
                    onChange={(e) => patch("experience", { eyebrow: e.target.value })}
                  />
                </Field>
                <Field label="Título">
                  <Input
                    value={c.experience.title}
                    onChange={(e) => patch("experience", { title: e.target.value })}
                  />
                </Field>
                <Field label="Texto de apoio">
                  <Textarea
                    rows={4}
                    value={c.experience.body}
                    onChange={(e) => patch("experience", { body: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Imagem vertical (URL)">
                    <Input
                      value={c.experience.imageA}
                      onChange={(e) => patch("experience", { imageA: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Field label="Imagem horizontal (URL)">
                    <Input
                      value={c.experience.imageB}
                      onChange={(e) => patch("experience", { imageB: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className={card}>
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
                Números da seção
              </h2>
              <div className="space-y-3">
                {c.experience.stats.map((s, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <Input
                      value={s.value}
                      onChange={(e) => {
                        const stats = [...c.experience.stats];
                        stats[i] = { ...s, value: e.target.value };
                        patch("experience", { stats });
                      }}
                      className="font-mono text-xs"
                    />
                    <Input
                      value={s.label}
                      onChange={(e) => {
                        const stats = [...c.experience.stats];
                        stats[i] = { ...s, label: e.target.value };
                        patch("experience", { stats });
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ─────── PROCESSO ─────── */}
        {tab === "process" && (
          <section className={card}>
            <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
              Seção processo
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Linha de apoio">
                <Input
                  value={c.process.eyebrow}
                  onChange={(e) => patch("process", { eyebrow: e.target.value })}
                />
              </Field>
              <Field label="Título">
                <Input
                  value={c.process.title}
                  onChange={(e) => patch("process", { title: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-6 space-y-4">
              {c.process.steps.map((s, i) => (
                <div key={i} className="rounded-xl border border-hairline p-4">
                  <div className="grid gap-3 sm:grid-cols-[90px_1fr]">
                    <Field label="Nº">
                      <Input
                        value={s.n}
                        onChange={(e) => {
                          const steps = [...c.process.steps];
                          steps[i] = { ...s, n: e.target.value };
                          patch("process", { steps });
                        }}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Título do passo">
                      <Input
                        value={s.title}
                        onChange={(e) => {
                          const steps = [...c.process.steps];
                          steps[i] = { ...s, title: e.target.value };
                          patch("process", { steps });
                        }}
                      />
                    </Field>
                  </div>
                  <Field label="Descrição" className="mt-3">
                    <Textarea
                      rows={2}
                      value={s.body}
                      onChange={(e) => {
                        const steps = [...c.process.steps];
                        steps[i] = { ...s, body: e.target.value };
                        patch("process", { steps });
                      }}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─────── CTA ─────── */}
        {tab === "cta" && (
          <section className={card}>
            <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
              Chamada final (antes do rodapé)
            </h2>
            <div className="space-y-4">
              <Field label="Título">
                <Input
                  value={c.cta.title}
                  onChange={(e) => patch("cta", { title: e.target.value })}
                />
              </Field>
              <Field label="Texto de apoio">
                <Textarea
                  rows={3}
                  value={c.cta.body}
                  onChange={(e) => patch("cta", { body: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Botão primário">
                  <Input
                    value={c.cta.primary}
                    onChange={(e) => patch("cta", { primary: e.target.value })}
                  />
                </Field>
                <Field label="Botão WhatsApp">
                  <Input
                    value={c.cta.secondary}
                    onChange={(e) => patch("cta", { secondary: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label="Mensagem pré-preenchida do WhatsApp"
                hint="Enviada quando o visitante clica no botão"
              >
                <Textarea
                  rows={2}
                  value={c.cta.whatsappMessage}
                  onChange={(e) => patch("cta", { whatsappMessage: e.target.value })}
                />
              </Field>
            </div>
          </section>
        )}

        {/* ─────── PÁGINAS ─────── */}
        {tab === "pages" && (
          <>
            <section className={card}>
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
                Página de listagem
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Linha de apoio">
                  <Input
                    value={c.listing.eyebrow}
                    onChange={(e) => patch("listing", { eyebrow: e.target.value })}
                  />
                </Field>
                <Field label="Título">
                  <Input
                    value={c.listing.title}
                    onChange={(e) => patch("listing", { title: e.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className={card}>
              <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
                Página do imóvel
              </h2>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Linha de apoio (agendamento)">
                    <Input
                      value={c.detail.visitEyebrow}
                      onChange={(e) => patch("detail", { visitEyebrow: e.target.value })}
                    />
                  </Field>
                  <Field label="Título do agendamento">
                    <Input
                      value={c.detail.visitTitle}
                      onChange={(e) => patch("detail", { visitTitle: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Benefícios da visita" hint="Um por linha">
                  <Textarea
                    rows={4}
                    value={c.detail.visitBullets.join("\n")}
                    onChange={(e) =>
                      patch("detail", {
                        visitBullets: e.target.value.split("\n"),
                      })
                    }
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome do corretor exibido">
                    <Input
                      value={c.detail.brokerName}
                      onChange={(e) => patch("detail", { brokerName: e.target.value })}
                    />
                  </Field>
                  <Field label="Cargo / CRECI">
                    <Input
                      value={c.detail.brokerRole}
                      onChange={(e) => patch("detail", { brokerRole: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ─────── RODAPÉ ─────── */}
        {tab === "footer" && (
          <section className={card}>
            <h2 className="mb-5 font-display text-base font-semibold tracking-tight">
              Rodapé
            </h2>
            <div className="space-y-4">
              <Field label="Frase de marca">
                <Input
                  value={c.footer.tagline}
                  onChange={(e) => patch("footer", { tagline: e.target.value })}
                />
              </Field>
              <Field label="Endereço" hint="Quebras de linha são preservadas">
                <Textarea
                  rows={3}
                  value={c.footer.address}
                  onChange={(e) => patch("footer", { address: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="E-mail de contato">
                  <Input
                    value={c.footer.email}
                    onChange={(e) => patch("footer", { email: e.target.value })}
                  />
                </Field>
                <Field label="Registro CRECI">
                  <Input
                    value={c.footer.creci}
                    onChange={(e) => patch("footer", { creci: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Coordenadas / assinatura">
                <Input
                  value={c.footer.coords}
                  onChange={(e) => patch("footer", { coords: e.target.value })}
                  className="font-mono text-xs"
                />
              </Field>
            </div>
          </section>
        )}
      </div>

      {/* Barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-canvas/85 backdrop-blur-xl lg:pl-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 md:px-8">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
            <span
              className={cn(
                "size-1.5 rounded-full",
                dirty ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
            {dirty ? "alterações não publicadas" : "tudo publicado"}
          </p>
          <div className="flex gap-2">
            <a href="/" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm" className="h-10">
                <ExternalLink className="size-4" />
                <span className="hidden sm:inline">Ver site</span>
              </Button>
            </a>
            <Button variant="outline" onClick={reset} disabled={saving}>
              <RotateCcw className="size-4" />
              <span className="hidden sm:inline">Restaurar padrão</span>
            </Button>
            <Button variant="accent" loading={saving} onClick={save}>
              <Save className="size-4" />
              Publicar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
