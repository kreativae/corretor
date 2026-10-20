"use client";

import { Field, Input, Select, Switch } from "@/components/ui";
import {
  pickForBlock,
  SORT_LABELS,
  SOURCE_LABELS,
  type Columns,
  type DisplaySort,
  type DisplaySource,
  type HomeBlock,
  type HomeSectionId,
  type SiteDisplay,
} from "@/lib/site-display";
import { cn, formatBRL } from "@/lib/utils";
import { ArrowDown, ArrowUp, Building2, Eye, EyeOff, Home, ImageIcon, LandPlot, MapPin, Star, Tractor } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type DisplayItem = {
  id: string;
  code: string;
  title: string;
  kind: "urbano" | "terreno" | "rural";
  featured: boolean;
  published: boolean;
  /** Disponível ou reservado (vendido/alugado/inativo não aparecem no site) */
  available: boolean;
  price: number;
  area: number;
  purpose: string;
  neighborhood: string;
  city: string;
  createdAt: string;
  cover: string | null;
};

const SECTION_META: Record<HomeSectionId, { label: string; icon: typeof Home }> = {
  imoveis: { label: "Imóveis (destaques)", icon: Building2 },
  bairros: { label: "Buscar por bairro", icon: MapPin },
  terrenos: { label: "Terrenos", icon: LandPlot },
  rurais: { label: "Propriedades rurais", icon: Tractor },
};

const KIND_OF: Record<"imoveis" | "terrenos" | "rurais", DisplayItem["kind"]> = {
  imoveis: "urbano",
  terrenos: "terreno",
  rurais: "rural",
};

const card = "rounded-2xl border border-hairline bg-card p-6 card-elev";
const h2 = "mb-1 font-display text-base font-semibold tracking-tight";

function ColumnsPicker({ value, onChange }: { value: Columns; onChange: (c: Columns) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1">
      {([2, 3, 4] as const).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex h-9 items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors",
            value === n ? "bg-card text-ink shadow-sm" : "text-subtle hover:text-ink",
          )}
          aria-pressed={value === n}
        >
          <span className="flex gap-0.5">
            {Array.from({ length: n }).map((_, i) => (
              <span key={i} className={cn("h-3 w-1.5 rounded-sm", value === n ? "bg-accent" : "bg-hairline-strong")} />
            ))}
          </span>
          {n}
        </button>
      ))}
    </div>
  );
}

/**
 * Conteúdo do site › Exibição: regras de cada seção da home e da listagem, com a prévia de
 * quais imóveis entram (e a estrela de destaque, que salva na hora).
 */
export function DisplayEditor({
  value,
  onChange,
  items: initialItems,
  views,
  cities,
  collectionTitle,
}: {
  value: SiteDisplay;
  onChange: (d: SiteDisplay) => void;
  items: DisplayItem[];
  views: Record<string, number>;
  cities: string[];
  /** Título da seção de imóveis quando o campo fica vazio (aba Destaques) */
  collectionTitle: string;
}) {
  const [items, setItems] = useState(initialItems);
  const set = (patch: Partial<SiteDisplay>) => onChange({ ...value, ...patch });
  const setBlock = (k: "imoveis" | "terrenos" | "rurais", patch: Partial<HomeBlock>) => set({ [k]: { ...value[k], ...patch } });
  const move = (i: number, d: -1 | 1) => {
    const order = [...value.order];
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    set({ order });
  };
  // Semente fixa na prévia: "aleatória" não fica pulando a cada clique
  const [seed] = useState(() => Date.now());

  async function patchItem(it: DisplayItem, patch: { featured?: boolean; published?: boolean }) {
    setItems((list) => list.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`/api/properties/${it.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      toast.success(
        "featured" in patch
          ? patch.featured
            ? `${it.code} em destaque`
            : `${it.code} saiu dos destaques`
          : patch.published
            ? `${it.code} publicado no site`
            : `${it.code} fora do site`,
      );
    } catch {
      setItems((list) => list.map((x) => (x.id === it.id ? it : x)));
      toast.error("Não foi possível salvar.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Ordem das seções */}
      <section className={card}>
        <h2 className={h2}>Ordem das seções da home</h2>
        <p className="mb-4 text-xs text-subtle">Depois da busca e dos cards de categoria. Use as setas para trocar a ordem.</p>
        <ol className="space-y-1.5">
          {value.order.map((id, i) => {
            const M = SECTION_META[id];
            const shown = id === "bairros" ? value.bairros.show : value[id].show;
            return (
              <li key={id} className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2">
                <span className="font-mono text-[11px] text-subtle">{i + 1}</span>
                <M.icon className="size-4 text-subtle" />
                <span className={cn("flex-1 text-sm font-medium", !shown && "text-subtle line-through")}>{M.label}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-full text-subtle hover:bg-soft disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.order.length - 1} className="grid size-8 place-items-center rounded-full text-subtle hover:bg-soft disabled:opacity-30" aria-label="Descer">
                  <ArrowDown className="size-4" />
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Seções de imóveis */}
      {(["imoveis", "terrenos", "rurais"] as const).map((k) => {
        const b = value[k];
        const M = SECTION_META[k];
        const pool = items.filter((x) => x.kind === KIND_OF[k]);
        const live = pool.filter((x) => x.published && x.available);
        const preview = pickForBlock(
          live.map((x) => ({ ...x })),
          b,
          views,
          seed,
        );
        const inHome = new Set(preview.map((x) => x.id));
        const featuredCount = live.filter((x) => x.featured).length;
        return (
          <section key={k} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={cn(h2, "flex items-center gap-2")}>
                  <M.icon className="size-4 text-subtle" /> {M.label}
                </h2>
                <p className="text-xs text-subtle">
                  {live.length} no site · {featuredCount} em destaque · {preview.length} na home
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={b.show} onChange={(v) => setBlock(k, { show: v })} />
                Mostrar na home
              </label>
            </div>

            {b.show && (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Linha de apoio">
                    <Input value={b.eyebrow} onChange={(e) => setBlock(k, { eyebrow: e.target.value })} placeholder={k === "imoveis" ? "Igual à aba Destaques" : ""} />
                  </Field>
                  <Field label="Título">
                    <Input
                      value={b.title}
                      onChange={(e) => setBlock(k, { title: e.target.value })}
                      placeholder={k === "imoveis" ? collectionTitle : k === "terrenos" ? "Título do card Terrenos" : "Propriedades rurais"}
                    />
                  </Field>
                  <Field label="Quantos aparecem">
                    <Input type="number" min={1} max={24} value={b.count} onChange={(e) => setBlock(k, { count: Number(e.target.value) || 1 })} />
                  </Field>
                  <Field label="Colunas no computador" hint="No celular, os cards deslizam para o lado">
                    <ColumnsPicker value={b.columns} onChange={(columns) => setBlock(k, { columns })} />
                  </Field>
                  <Field label="Quais entram">
                    <Select value={b.source} onChange={(e) => setBlock(k, { source: e.target.value as DisplaySource })}>
                      {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Ordenação">
                    <Select value={b.sort} onChange={(e) => setBlock(k, { sort: e.target.value as DisplaySort })}>
                      {Object.entries(SORT_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Máximo por bairro" hint="0 = sem limite. Ex.: 1 mostra um imóvel de cada região">
                    <Input type="number" min={0} max={24} value={b.perHood} onChange={(e) => setBlock(k, { perHood: Math.max(0, Number(e.target.value) || 0) })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Finalidade">
                      <Select value={b.purpose} onChange={(e) => setBlock(k, { purpose: e.target.value as HomeBlock["purpose"] })}>
                        <option value="all">Venda e aluguel</option>
                        <option value="venda">Só venda</option>
                        <option value="aluguel">Só aluguel</option>
                      </Select>
                    </Field>
                    <Field label="Cidade">
                      <Select value={b.city} onChange={(e) => setBlock(k, { city: e.target.value })}>
                        <option value="">Todas</option>
                        {cities.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
                {b.source === "featured" && featuredCount === 0 && (
                  <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    Nenhum marcado como destaque: a seção some da home. Marque a estrela abaixo.
                  </p>
                )}
              </>
            )}

            {pool.length > 0 && (
              <details className="group mt-5 rounded-xl border border-hairline" open={k === "imoveis"}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                  Destaques e quem vai para a home
                  <span className="text-xs font-normal text-subtle group-open:hidden">mostrar {pool.length}</span>
                </summary>
                <ul className="max-h-[420px] divide-y divide-hairline overflow-auto border-t border-hairline" data-lenis-prevent>
                  {[...pool]
                    .sort((a, c) => Number(inHome.has(c.id)) - Number(inHome.has(a.id)) || Number(c.featured) - Number(a.featured))
                    .map((it) => {
                      const pos = preview.findIndex((x) => x.id === it.id);
                      return (
                        <li key={it.id} className={cn("flex items-center gap-3 px-3 py-2", !(it.published && it.available) && "opacity-60")}>
                          <button
                            type="button"
                            onClick={() => patchItem(it, { featured: !it.featured })}
                            aria-pressed={it.featured}
                            title={it.featured ? "Tirar dos destaques" : "Marcar como destaque"}
                            className={cn("grid size-8 shrink-0 place-items-center rounded-full", it.featured ? "text-accent hover:bg-accent/10" : "text-subtle/60 hover:bg-soft hover:text-ink")}
                          >
                            <Star className={cn("size-4", it.featured && "fill-current")} />
                          </button>
                          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-soft">
                            {it.cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.cover} alt="" className="size-full object-cover" loading="lazy" />
                            ) : (
                              <ImageIcon className="absolute inset-0 m-auto size-4 text-subtle" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{it.title}</span>
                            <span className="block truncate font-mono text-[10.5px] text-subtle">
                              {it.code} · {it.neighborhood} · {formatBRL(it.price)}
                            </span>
                          </span>
                          {pos >= 0 ? (
                            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">
                              Home · {pos + 1}º
                            </span>
                          ) : !(it.published && it.available) ? (
                            <span className="shrink-0 text-[10.5px] text-subtle">{it.published ? "indisponível" : "fora do site"}</span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => patchItem(it, { published: !it.published })}
                            title={it.published ? "Tirar do site" : "Publicar no site"}
                            className="grid size-8 shrink-0 place-items-center rounded-full text-subtle hover:bg-soft hover:text-ink"
                          >
                            {it.published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      {/* Bairros */}
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={cn(h2, "flex items-center gap-2")}>
              <MapPin className="size-4 text-subtle" /> Buscar por bairro
            </h2>
            <p className="text-xs text-subtle">Cards com a foto de um imóvel do bairro, do que tem mais imóveis para o que tem menos.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={value.bairros.show} onChange={(v) => set({ bairros: { ...value.bairros, show: v } })} />
            Mostrar na home
          </label>
        </div>
        {value.bairros.show && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Linha de apoio">
              <Input value={value.bairros.eyebrow} onChange={(e) => set({ bairros: { ...value.bairros, eyebrow: e.target.value } })} />
            </Field>
            <Field label="Título">
              <Input value={value.bairros.title} onChange={(e) => set({ bairros: { ...value.bairros, title: e.target.value } })} />
            </Field>
            <Field label="Quantos bairros">
              <Input type="number" min={1} max={24} value={value.bairros.count} onChange={(e) => set({ bairros: { ...value.bairros, count: Number(e.target.value) || 1 } })} />
            </Field>
            <Field label="Colunas no computador">
              <ColumnsPicker value={value.bairros.columns} onChange={(columns) => set({ bairros: { ...value.bairros, columns } })} />
            </Field>
            <Field label="Mínimo de imóveis no bairro" hint="Bairro com menos que isso não aparece">
              <Input type="number" min={1} max={50} value={value.bairros.minPerHood} onChange={(e) => set({ bairros: { ...value.bairros, minPerHood: Number(e.target.value) || 1 } })} />
            </Field>
            <Field label="Contam">
              <Select value={value.bairros.include} onChange={(e) => set({ bairros: { ...value.bairros, include: e.target.value as "urbano" | "todos" } })}>
                <option value="urbano">Só imóveis (casas, apartamentos…)</option>
                <option value="todos">Todos, com terrenos e rurais</option>
              </Select>
            </Field>
          </div>
        )}
      </section>

      {/* Listagem */}
      <section className={card}>
        <h2 className={h2}>Página “Todos os imóveis”</h2>
        <p className="mb-5 text-xs text-subtle">Vale para as abas Imóveis, Terrenos e Rurais. O visitante ainda pode trocar a ordem e filtrar.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colunas no computador">
            <ColumnsPicker value={value.listing.columns} onChange={(columns) => set({ listing: { ...value.listing, columns } })} />
          </Field>
          <Field label="Ordem inicial">
            <Select value={value.listing.sort} onChange={(e) => set({ listing: { ...value.listing, sort: e.target.value as SiteDisplay["listing"]["sort"] } })}>
              <option value="recent">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="area_desc">Maior área</option>
            </Select>
          </Field>
          <Field label="Quantos por vez" hint='0 = todos. Com número, aparece o botão "Ver mais"'>
            <Input type="number" min={0} max={120} value={value.listing.perPage} onChange={(e) => set({ listing: { ...value.listing, perPage: Math.max(0, Number(e.target.value) || 0) } })} />
          </Field>
          <label className="flex items-center justify-between gap-3 self-end rounded-xl bg-soft px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Destaques no topo</span>
              <span className="block text-[11px] text-subtle">Enquanto a ordem for a inicial</span>
            </span>
            <Switch checked={value.listing.featuredFirst} onChange={(v) => set({ listing: { ...value.listing, featuredFirst: v } })} />
          </label>
        </div>
      </section>
    </div>
  );
}
