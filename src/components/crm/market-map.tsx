"use client";

import "leaflet/dist/leaflet.css";
import { Badge, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { TYPE_LABELS } from "@/lib/labels";
import {
  aggregate,
  binOf,
  geoKey,
  median,
  MIN_SAMPLES,
  regionQuery,
  SOURCE_LABELS,
  UNIT_SUFFIX,
  unitValue,
  type MarketSample,
  type MarketUnit,
  type Region,
} from "@/lib/market";
import { ALQUEIRE_M2, formatAlq, isRuralType } from "@/lib/rural";
import { cn, formatBRL, formatDate, formatNumber } from "@/lib/utils";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, Loader2, MapPin, Plus, Tractor, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** Escala sequencial (um tom, claro → escuro = mais barato → mais caro) */
const RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];

const PERIODS = [
  { id: "12", label: "Últimos 12 meses", months: 12 },
  { id: "24", label: "Últimos 24 meses", months: 24 },
  { id: "60", label: "Últimos 5 anos", months: 60 },
  { id: "all", label: "Todo o período", months: 0 },
] as const;

const URBAN_TYPES = Object.keys(TYPE_LABELS).filter((t) => !isRuralType(t));
const RURAL_TYPES = Object.keys(TYPE_LABELS).filter((t) => isRuralType(t));

type Placed = Region & { geo: string; pos: [number, number] | null; bin: number };

const money = (v: number) => formatBRL(Math.round(v));

function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="text-subtle">—</span>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 font-mono tabular">
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  );
}

function LowBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
      title={`Menos de ${MIN_SAMPLES} amostras: use só como indício`}
    >
      <AlertTriangle className="size-3" />
      poucas amostras
    </span>
  );
}

export function MarketMap({
  samples,
  geo: initialGeo,
  now,
}: {
  samples: MarketSample[];
  geo: Record<string, [number, number] | null>;
  now: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"urbano" | "rural">("urbano");
  const [purpose, setPurpose] = useState<"venda" | "aluguel">("venda");
  const [type, setType] = useState("todos");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("24");
  const [ruralUnit, setRuralUnit] = useState<"alq" | "ha">("alq");
  const [selected, setSelected] = useState<string | null>(null);
  const [geo, setGeo] = useState(initialGeo);
  const [locating, setLocating] = useState(0);

  const rural = mode === "rural";
  const unit: MarketUnit = rural ? ruralUnit : "m2";
  const suffix = UNIT_SUFFIX[unit];

  const base = useMemo(
    () => samples.filter((s) => s.rural === rural && s.purpose === purpose && (type === "todos" || s.type === type)),
    [samples, rural, purpose, type],
  );
  const inPeriod = useMemo(() => {
    const months = PERIODS.find((p) => p.id === period)?.months ?? 0;
    if (!months) return base;
    return base.filter((s) => now - Date.parse(s.date) <= months * 30.44 * 86_400_000);
  }, [base, period, now]);

  const regions: Placed[] = useMemo(() => {
    const list = aggregate(inPeriod, { rural, unit, now, history: base });
    const total = list.length;
    return list.map((r, i) => {
      const g = geoKey(r.samples[0], rural);
      const pos: [number, number] | null = r.lat != null && r.lng != null ? [r.lat, r.lng] : (geo[g] ?? null);
      return { ...r, geo: g, pos, bin: binOf(total - 1 - i, total, RAMP.length) };
    });
  }, [inPeriod, base, rural, unit, now, geo]);

  const current = regions.find((r) => r.key === selected) ?? null;
  const overall = useMemo(() => median(inPeriod.map((s) => unitValue(s.price, s.area, unit))), [inPeriod, unit]);

  // Legenda: faixa de valores de cada tom
  const legend = RAMP.map((color, b) => {
    const inBin = regions.filter((r) => r.bin === b).map((r) => r.median);
    return { color, min: inBin.length ? Math.min(...inBin) : null, max: inBin.length ? Math.max(...inBin) : null };
  }).filter((l) => l.min != null);

  /* ── Localiza no mapa as regiões ainda sem coordenadas (uma por segundo) ── */
  const missing = regions.filter((r) => !r.pos && !(r.geo in geo));
  const missingKey = missing.map((r) => r.geo).join(",");
  useEffect(() => {
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      for (const r of missing) {
        if (cancelled) return;
        setLocating(missing.length);
        const res = await fetch("/api/market/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: r.geo, q: regionQuery(r.samples[0], rural) }),
        }).catch(() => null);
        if (!res?.ok) break;
        const d = (await res.json()) as { lat: number | null; lng: number | null };
        if (cancelled) return;
        setGeo((g) => ({ ...g, [r.geo]: d.lat != null && d.lng != null ? [d.lat, d.lng] : null }));
        await new Promise((ok) => setTimeout(ok, 1100));
      }
      if (!cancelled) setLocating(0);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, rural]);

  /* ── Mapa (Leaflet) ── */
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: import("leaflet").Map; L: typeof import("leaflet"); layer: import("leaflet").LayerGroup } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const fitted = useRef("");

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !el.current) return;
      map = L.map(el.current, { zoomControl: true, scrollWheelZoom: false }).setView([-15.8, -47.9], 4);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap © CARTO",
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      mapRef.current = { map, L, layer };
      setMapReady(true);
    })();
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady) return;
    const { L, map, layer } = m;
    layer.clearLayers();
    const placed = regions.filter((r) => r.pos);
    // Os maiores por baixo, para os pequenos continuarem clicáveis
    for (const r of [...placed].sort((a, b) => b.n - a.n)) {
      const low = r.n < MIN_SAMPLES;
      const isSel = r.key === selected;
      const marker = L.circleMarker(r.pos as [number, number], {
        radius: 9 + Math.min(r.n, 12) * 0.9,
        color: isSel ? "#0f172a" : "#ffffff",
        weight: isSel ? 3 : 2,
        dashArray: low && !isSel ? "3 3" : undefined,
        fillColor: RAMP[r.bin],
        fillOpacity: low ? 0.55 : 0.9,
      });
      marker.bindTooltip(`<strong>${r.name}</strong><br/>${money(r.median)}${suffix} · ${r.n} ${r.n === 1 ? "amostra" : "amostras"}`, {
        direction: "top",
        offset: [0, -6],
      });
      marker.on("click", () => setSelected(r.key));
      marker.addTo(layer);
    }
    const fitKey = `${mode}|${purpose}|${type}|${period}|${placed.map((r) => r.key).join(",")}`;
    if (placed.length && fitted.current !== fitKey) {
      fitted.current = fitKey;
      const b = L.latLngBounds(placed.map((r) => r.pos as [number, number]));
      map.fitBounds(b.pad(0.25), { maxZoom: rural ? 9 : 14 });
    }
  }, [regions, selected, mapReady, suffix, mode, purpose, type, period, rural]);

  function focus(r: Placed) {
    setSelected(r.key);
    if (r.pos && mapRef.current) mapRef.current.map.flyTo(r.pos, Math.max(mapRef.current.map.getZoom(), rural ? 9 : 13), { duration: 0.6 });
  }

  /* ── Amostras de mercado ── */
  const manual = samples.filter((s) => s.source === "amostra");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const commonCity = useMemo(() => {
    const c = new Map<string, { city: string; state: string; n: number }>();
    for (const s of samples) {
      const k = `${s.city}|${s.state}`;
      const cur = c.get(k) ?? { city: s.city, state: s.state, n: 0 };
      cur.n++;
      c.set(k, cur);
    }
    return [...c.values()].sort((a, b) => b.n - a.n)[0] ?? { city: "", state: "" };
  }, [samples]);
  const emptyForm = () => ({
    type: rural ? "fazenda" : "apartamento",
    purpose,
    price: "",
    area: "",
    neighborhood: "",
    city: commonCity.city,
    state: commonCity.state,
    date: new Date(now).toISOString().slice(0, 10),
    source: "",
    notes: "",
  });
  const [form, setForm] = useState(emptyForm);
  const formRural = isRuralType(form.type);
  const neighborhoods = useMemo(() => [...new Set(samples.filter((s) => !s.rural).map((s) => s.neighborhood.trim()).filter(Boolean))].sort(), [samples]);
  const cities = useMemo(() => [...new Set(samples.map((s) => s.city.trim()).filter(Boolean))].sort(), [samples]);

  async function saveSample() {
    const area = Number(form.area.replace(",", "."));
    const price = Number(form.price.replace(/\D/g, ""));
    if (!price || !area) return toast.error("Informe valor e área.");
    if (!formRural && !form.neighborhood.trim()) return toast.error("Informe o bairro.");
    setSaving(true);
    try {
      const res = await fetch("/api/market/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price, area: formRural ? Math.round(area * ALQUEIRE_M2) : Math.round(area) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error);
      toast.success("Amostra registrada.");
      setAdding(false);
      setForm(emptyForm());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSample(id: string) {
    if (!confirm("Excluir esta amostra?")) return;
    const res = await fetch(`/api/market/samples/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Não foi possível excluir.");
    toast.success("Amostra excluída.");
    router.refresh();
  }

  const placedCount = regions.filter((r) => r.pos).length;

  return (
    <div className="mt-6 space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-hairline p-1">
          {(
            [
              { id: "urbano", label: "Imóveis", icon: Building2 },
              { id: "rural", label: "Rurais", icon: Tractor },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setType("todos");
                setSelected(null);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                mode === t.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <Select value={purpose} onChange={(e) => setPurpose(e.target.value as "venda" | "aluguel")} className="w-auto" aria-label="Finalidade">
          <option value="venda">Venda</option>
          <option value="aluguel">Aluguel</option>
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto" aria-label="Tipo">
          <option value="todos">Todos os tipos</option>
          {(rural ? RURAL_TYPES : URBAN_TYPES).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="w-auto" aria-label="Período">
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
        {rural && (
          <div className="inline-flex rounded-full border border-hairline p-1 text-xs">
            {(["alq", "ha"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setRuralUnit(u)}
                className={cn("rounded-full px-3 py-1 font-medium", ruralUnit === u ? "bg-ink text-canvas" : "text-subtle hover:text-ink")}
              >
                R${UNIT_SUFFIX[u]}
              </button>
            ))}
          </div>
        )}
        <Button variant="accent" size="sm" className="ml-auto" onClick={() => {
          setForm(emptyForm());
          setAdding(true);
        }}>
          <Plus className="size-4" />
          Nova amostra
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: rural ? `Mediana R$${suffix}` : "Mediana R$/m²", value: inPeriod.length ? money(overall) : "—" },
          { label: rural ? "Municípios" : "Bairros", value: formatNumber(regions.length) },
          { label: "Amostras", value: formatNumber(inPeriod.length) },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border border-hairline bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">{t.label}</p>
            <p className="mt-1.5 font-mono text-lg font-medium tabular sm:text-2xl">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_380px]">
        {/* Mapa */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-card">
          <div className="relative">
            <div ref={el} className="z-0 h-[380px] w-full sm:h-[520px]" />
            {!inPeriod.length && (
              <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-card/70 p-6 text-center text-sm text-subtle">
                Nenhuma amostra com esses filtros.
              </div>
            )}
            {locating > 0 && (
              <div className="absolute left-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-xs shadow">
                <Loader2 className="size-3.5 animate-spin" /> Localizando regiões no mapa…
              </div>
            )}
          </div>
          {legend.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline px-4 py-3 text-[11px] text-subtle">
              <span className="font-mono uppercase tracking-[0.14em]">Mediana {suffix}</span>
              {legend.map((l) => (
                <span key={l.color} className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-full" style={{ background: l.color }} />
                  <span className="font-mono tabular text-ink">
                    {l.min === l.max ? money(l.min as number) : `${money(l.min as number)} – ${money(l.max as number)}`}
                  </span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full border border-dashed border-subtle" />
                menos de {MIN_SAMPLES} amostras
              </span>
            </div>
          )}
        </div>

        {/* Detalhe + ranking */}
        <div className="min-w-0 space-y-4">
          {current && (
            <div className="rounded-2xl border border-hairline bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold">{current.name}</p>
                  <p className="text-xs text-subtle">
                    {rural ? current.state : `${current.city}${current.state ? ` — ${current.state}` : ""}`}
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-full p-1.5 text-subtle hover:bg-soft hover:text-ink" aria-label="Fechar">
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-3 font-mono text-3xl font-medium tabular tracking-tight">
                {money(current.median)}
                <span className="ml-1 text-sm text-subtle">{suffix}</span>
              </p>
              <p className="text-xs text-subtle">mediana</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4 text-xs">
                <div>
                  <dt className="text-subtle">Faixa</dt>
                  <dd className="mt-0.5 font-mono tabular">
                    {current.min === current.max ? money(current.min) : `${money(current.min)} – ${money(current.max)}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Amostras</dt>
                  <dd className="mt-0.5 font-mono tabular">{current.n}</dd>
                </div>
                <div>
                  <dt className="text-subtle">12 meses</dt>
                  <dd className="mt-0.5">
                    <Change value={current.change} />
                  </dd>
                </div>
              </dl>
              {current.n < MIN_SAMPLES && (
                <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  Só {current.n} {current.n === 1 ? "amostra" : "amostras"}: use como indício, não como referência de preço.
                </p>
              )}
              <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto" data-lenis-prevent>
                {current.samples.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-lg bg-soft/60 px-2.5 py-2 text-xs">
                    <Badge className="shrink-0 border border-hairline">{SOURCE_LABELS[s.source]}</Badge>
                    <span className="min-w-0 flex-1 truncate">
                      {s.href ? (
                        <Link href={s.href} className="font-mono underline-offset-2 hover:underline">
                          {s.label}
                        </Link>
                      ) : (
                        s.label
                      )}
                      <span className="text-subtle">
                        {" "}
                        · {TYPE_LABELS[s.type] ?? s.type} · {s.rural ? `${formatAlq(s.area / ALQUEIRE_M2)} alq` : `${formatNumber(s.area)} m²`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono tabular">{money(s.value)}</span>
                      <span className="block text-[10px] text-subtle">{formatDate(s.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-hairline bg-card">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">
                Ranking · {rural ? "municípios" : "bairros"}
              </p>
              {placedCount < regions.length && !locating && (
                <span className="text-[11px] text-subtle" title="O endereço não foi encontrado no mapa">
                  {regions.length - placedCount} fora do mapa
                </span>
              )}
            </div>
            <div className="max-h-[440px] overflow-y-auto" data-lenis-prevent>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                    <th className="py-2 pl-4 pr-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">{rural ? "Município" : "Bairro"}</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">R${suffix}</th>
                    <th className="py-2 pl-2 pr-4 text-right font-medium">12m</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((r, i) => (
                    <tr
                      key={r.key}
                      onClick={() => focus(r)}
                      className={cn(
                        "cursor-pointer border-t border-hairline/60 transition-colors hover:bg-soft/60",
                        r.key === selected && "bg-soft",
                      )}
                    >
                      <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-subtle">{i + 1}</td>
                      <td className="w-full max-w-0 px-2 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: RAMP[r.bin] }} />
                          <span className="truncate font-medium">{r.name}</span>
                          {!r.pos && !locating && <MapPin className="size-3 shrink-0 text-subtle opacity-50" aria-label="Fora do mapa" />}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
                          {r.n} {r.n === 1 ? "amostra" : "amostras"}
                          {r.n < MIN_SAMPLES && <LowBadge />}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs tabular">
                        {money(r.median)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-right text-xs">
                        <Change value={r.change} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!regions.length && <p className="px-4 py-10 text-center text-sm text-subtle">Nenhuma região com esses filtros.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Amostras registradas */}
      <section className="rounded-2xl border border-hairline bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-4">
          <div>
            <p className="font-display text-base font-semibold">Amostras de mercado</p>
            <p className="text-xs text-subtle">
              Anúncios de outros portais, vendas de colegas, avaliações. Quanto mais amostras, mais confiável o mapa.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            setForm(emptyForm());
            setAdding(true);
          }}>
            <Plus className="size-4" />
            Nova amostra
          </Button>
        </div>
        {manual.length ? (
          <ul className="divide-y divide-hairline">
            {manual.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{s.rural ? s.city : s.neighborhood}</span>
                  <span className="text-subtle">
                    {" "}
                    · {TYPE_LABELS[s.type] ?? s.type} · {s.purpose === "aluguel" ? "Aluguel" : "Venda"} ·{" "}
                    {s.rural ? `${formatAlq(s.area / ALQUEIRE_M2)} alq` : `${formatNumber(s.area)} m²`}
                  </span>
                  <span className="block text-xs text-subtle">
                    {s.label} · {formatDate(s.date)}
                  </span>
                </span>
                <span className="text-right font-mono text-xs tabular">
                  {money(s.price)}
                  <span className="block text-subtle">
                    {money(s.price / (s.rural ? s.area / ALQUEIRE_M2 : s.area))}
                    {s.rural ? "/alq" : "/m²"}
                  </span>
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeSample(s.id)} aria-label="Excluir amostra">
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-subtle">
            Nenhuma amostra registrada ainda. O mapa usa os imóveis da carteira e os negócios fechados.
          </p>
        )}
      </section>

      <Modal open={adding} onClose={() => !saving && setAdding(false)} title="Nova amostra de mercado" wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveSample();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <optgroup label="Imóveis">
                {URBAN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Rurais">
                {RURAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <Field label="Finalidade">
            <Select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value as "venda" | "aluguel" })}>
              <option value="venda">Venda</option>
              <option value="aluguel">Aluguel</option>
            </Select>
          </Field>
          <Field label={form.purpose === "aluguel" ? "Aluguel mensal (R$)" : "Valor (R$)"}>
            <Input
              inputMode="numeric"
              value={form.price ? Number(form.price.replace(/\D/g, "")).toLocaleString("pt-BR") : ""}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
              placeholder="850.000"
              className="font-mono tabular"
            />
          </Field>
          <Field label={formRural ? "Área (alqueires)" : "Área (m²)"}>
            <Input
              inputMode="decimal"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value.replace(/[^\d.,]/g, "") })}
              placeholder={formRural ? "12,5" : "120"}
              className="font-mono tabular"
            />
          </Field>
          {!formRural && (
            <Field label="Bairro" className="sm:col-span-2">
              <Input list="mm-bairros" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Ex.: Setor Bueno" />
              <datalist id="mm-bairros">
                {neighborhoods.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
          )}
          <div className="grid grid-cols-[1fr_80px] gap-3 sm:col-span-2">
            <Field label="Cidade">
              <Input list="mm-cidades" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <datalist id="mm-cidades">
                {cities.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="UF">
              <Input value={form.state} maxLength={2} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <Field label="Data">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Origem">
            <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Anúncio, venda de colega, avaliação…" />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {(() => {
            const a = Number(form.area.replace(",", "."));
            const p = Number(form.price);
            if (!a || !p) return null;
            return (
              <p className="rounded-xl bg-soft px-3 py-2 text-xs text-subtle sm:col-span-2">
                Equivale a <strong className="font-mono text-ink">{money(p / a)}</strong>
                {formRural ? " por alqueire" : " por m²"}
              </p>
            );
          })()}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" loading={saving}>
              Salvar amostra
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
