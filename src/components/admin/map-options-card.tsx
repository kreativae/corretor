"use client";

import { Switch } from "@/components/ui";
import type { MapOptions } from "@/lib/map-options";
import { cn } from "@/lib/utils";
import { ChevronDown, LocateFixed, Map as MapIcon, Navigation } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const OPTIONS: { key: keyof MapOptions; label: string; description: string; icon: typeof MapIcon }[] = [
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

  async function toggle(key: keyof MapOptions, v: boolean) {
    const prev = opts;
    const next = { ...opts, [key]: v };
    setOpts(next);
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "mapOptions", value: next }),
      });
      if (!res.ok) throw new Error();
      const label = OPTIONS.find((o) => o.key === key)?.label;
      toast.success(`"${label}" ${v ? "visível" : "oculto"} no mapa.`);
      router.refresh();
    } catch {
      setOpts(prev);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(null);
    }
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
              ? "Botões sobre o mapa de satélite das propriedades rurais (página aberta pelo QR code da ficha)."
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
          <div className="border-t border-hairline p-6">
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
