"use client";

import { Button, Field, Input, Select, Switch } from "@/components/ui";
import { AREA_MODES, AREA_RADII, AREA_ZOOMS, type AreaMode, type MapOptions, zoomLabel } from "@/lib/map-options";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, Loader2, LocateFixed, Map as MapIcon, Navigation, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ToggleKey = "locate" | "directions";

const OPTIONS: { key: ToggleKey; label: string; description: string; icon: typeof MapIcon }[] = [
  {
    key: "locate",
    label: "Minha localização",
    description: "Mostra onde o visitante está no mapa e a distância até a propriedade.",
    icon: LocateFixed,
  },
  {
    key: "directions",
    label: "Como chegar",
    description: "Abre a rota até a propriedade no Google Maps.",
    icon: Navigation,
  },
];

/** Botões do mapa público da propriedade rural (página aberta pelo QR da ficha). */
export function MapOptionsCard({ initial }: { initial: MapOptions }) {
  const router = useRouter();
  const [opts, setOpts] = useState(initial);
  const [saving, setSaving] = useState<keyof MapOptions | null>(null);
  // Recolhido (sanfona); abre ao clicar no cabeçalho
  const [open, setOpen] = useState(false);
  const active = OPTIONS.filter((o) => opts[o.key]).map((o) => o.label);

  async function save(key: keyof MapOptions, next: MapOptions, message: string) {
    const prev = opts;
    setOpts(next);
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "mapOptions", value: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(message);
      router.refresh();
    } catch {
      setOpts(prev);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(null);
    }
  }

  function toggle(key: ToggleKey, v: boolean) {
    const label = OPTIONS.find((o) => o.key === key)?.label;
    void save(key, { ...opts, [key]: v }, `"${label}" ${v ? "visível" : "oculto"} no mapa.`);
  }

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-6 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <MapIcon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold tracking-tight">Mapa</span>
          <span className="mt-1 block max-w-xl text-xs text-subtle">
            {open
              ? "Estilo do mapa, API da CARTO, localização no anúncio e botões do mapa das propriedades rurais."
              : `${active.length ? `Visíveis: ${active.join(", ")}` : "Botões ocultos"} — clique para gerenciar`}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-subtle transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-expo",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="space-y-6 border-t border-hairline p-6">
            {open && <MapProviderSection />}
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">Localização no anúncio do site</p>
            <div className="space-y-4 rounded-xl border border-hairline p-4">
              <p className="text-xs text-subtle">
                Mostra a região do imóvel num círculo aproximado, sem o endereço exato e sem link para o Google Maps.
                O círculo fica em volta do endereço cadastrado (coordenadas ou rua, bairro e cidade); sem rua, usa o centro do bairro. O ponto exato não aparece.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {AREA_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={saving !== null}
                    aria-pressed={opts.areaMode === m.id}
                    onClick={() => void save("areaMode", { ...opts, areaMode: m.id as AreaMode }, `Localização: ${m.label.toLowerCase()}.`)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      opts.areaMode === m.id ? "border-accent bg-accent/10" : "border-hairline hover:bg-soft",
                    )}
                  >
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="mt-0.5 block text-xs text-subtle">{m.hint}</span>
                  </button>
                ))}
              </div>
              {opts.areaMode !== "off" && (
                <Field label="Raio do círculo">
                  <Select
                    value={String(opts.areaRadiusKm)}
                    disabled={saving !== null}
                    onChange={(e) => {
                      const km = Number(e.target.value);
                      void save("areaRadiusKm", { ...opts, areaRadiusKm: km }, `Raio da região: ${km < 1 ? `${km * 1000} m` : `${km} km`}.`);
                    }}
                    className="max-w-[12rem]"
                  >
                    {AREA_RADII.map((km) => (
                      <option key={km} value={km}>{km < 1 ? `${km * 1000} m` : `${km} km`}</option>
                    ))}
                  </Select>
                </Field>
              )}
              {opts.areaMode !== "off" && (
                <Field label="Zoom do mapa" hint="Quanto o mapa abre aproximado. O visitante ainda pode usar + e −.">
                  <Select
                    value={String(opts.areaZoom)}
                    disabled={saving !== null}
                    onChange={(e) => {
                      const z = Number(e.target.value);
                      void save("areaZoom", { ...opts, areaZoom: z }, `Zoom do mapa: ${zoomLabel(z).toLowerCase()}.`);
                    }}
                    className="max-w-[18rem]"
                  >
                    {AREA_ZOOMS.map((z) => (
                      <option key={z} value={z}>{zoomLabel(z)}</option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">Mapa das propriedades rurais (QR code)</p>
            <div className="divide-y divide-hairline rounded-xl border border-hairline">
              {OPTIONS.map((o) => (
                <div key={o.key} className="flex items-center gap-4 p-4">
                  <o.icon className="size-4 shrink-0 text-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{o.label}</p>
                    <p className="mt-0.5 text-xs text-subtle">{o.description}</p>
                  </div>
                  <Switch
                    checked={opts[o.key]}
                    disabled={saving !== null}
                    onChange={(v) => toggle(o.key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type ProviderCfg = {
  style: "auto" | "voyager" | "positron" | "dark-matter" | "custom";
  customTiles: string;
  customAttribution: string;
  basemapKey: string;
  cartoApiUrl: string;
  cartoToken: string;
  hasToken: boolean;
};

const STYLE_OPTIONS: { id: ProviderCfg["style"]; label: string }[] = [
  { id: "auto", label: "Automático (Voyager no claro, Dark Matter no escuro)" },
  { id: "voyager", label: "CARTO Voyager (colorido)" },
  { id: "positron", label: "CARTO Positron (claro)" },
  { id: "dark-matter", label: "CARTO Dark Matter (escuro)" },
  { id: "custom", label: "Personalizado (URL de blocos)" },
];

/** Mapa base e API da CARTO — usados no Valor do m² */
function MapProviderSection() {
  const [cfg, setCfg] = useState<ProviderCfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/map-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d))
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof ProviderCfg>(k: K, v: ProviderCfg[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function save(silent = false) {
    if (!cfg) return false;
    setSaving(true);
    try {
      const res = await fetch("/api/map-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCfg(d);
      if (!silent) toast.success("Configurações do mapa salvas.");
      return true;
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      if (!(await save(true))) return;
      const res = await fetch("/api/map-config/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(`CARTO funcionando: Goiânia em ${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}.`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Falha no teste.");
    } finally {
      setTesting(false);
    }
  }

  if (!cfg) {
    return (
      <div className="flex justify-center py-6 text-subtle">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">Mapa base e CARTO (Valor do m²)</p>
      <Field label="Estilo do mapa">
        <Select value={cfg.style} onChange={(e) => set("style", e.target.value as ProviderCfg["style"])}>
          {STYLE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {cfg.style === "custom" && (
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <Field label="URL de blocos" hint="Com {z}, {x} e {y}. Ex.: estilo personalizado da CARTO ou de outro provedor.">
            <Input
              value={cfg.customTiles}
              onChange={(e) => set("customTiles", e.target.value)}
              placeholder="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Créditos do mapa">
            <Input value={cfg.customAttribution} onChange={(e) => set("customAttribution", e.target.value)} placeholder="© OpenStreetMap © CARTO" />
          </Field>
        </div>
      )}
      {cfg.style !== "custom" && (
        <Field
          label="Chave dos mapas base da CARTO"
          hint="Gratuita em carto.com/basemaps/apikey. Sem ela, o mapa usa o OpenStreetMap (a CARTO mostra “API KEY REQUIRED”)."
        >
          <Input
            value={cfg.basemapKey}
            onChange={(e) => set("basemapKey", e.target.value)}
            placeholder="Cole aqui a chave dos basemaps"
            className="font-mono text-xs"
            autoComplete="off"
          />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Endereço da API da CARTO" hint="Região da conta, em Developers › API Base URL.">
          <Input
            value={cfg.cartoApiUrl}
            onChange={(e) => set("cartoApiUrl", e.target.value)}
            placeholder="https://gcp-us-east1.api.carto.com"
            className="font-mono text-xs"
          />
        </Field>
        <Field label="Token de acesso (API Access Token)" hint="Usado para localizar bairros e municípios no mapa.">
          <Input
            value={cfg.cartoToken}
            onChange={(e) => set("cartoToken", e.target.value)}
            placeholder="eyJhbGciOi…"
            className="font-mono text-xs"
            autoComplete="off"
          />
        </Field>
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-soft px-3 py-2.5 text-xs text-subtle">
        {cfg.hasToken ? (
          <>
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            Localização pela CARTO, com o OpenStreetMap como reserva. Para remover o token, digite um hífen (-) e salve.
          </>
        ) : (
          <>
            <MapIcon className="mt-0.5 size-3.5 shrink-0" />
            Sem token, os bairros são localizados pelo OpenStreetMap (gratuito).
          </>
        )}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={test} disabled={testing || saving || (!cfg.hasToken && !cfg.cartoToken)}>
          {testing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Testar CARTO
        </Button>
        <Button variant="accent" size="sm" onClick={() => save()} loading={saving}>
          <Save className="size-4" />
          Salvar mapa
        </Button>
      </div>
    </div>
  );
}
