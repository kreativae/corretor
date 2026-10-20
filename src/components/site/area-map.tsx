"use client";

import "leaflet/dist/leaflet.css";
import type { AreaMode } from "@/lib/map-options";
import type { MapTiles } from "@/lib/map-provider";
import { cn } from "@/lib/utils";
import { ChevronDown, Map as MapIcon, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Mapa com o círculo da região (nunca o ponto exato do imóvel). */
function RegionMap({ center, radiusKm, zoom, tiles, className }: { center: [number, number]; radiusKm: number; zoom: number; tiles: MapTiles; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !el.current) return;
      // Posição antes do círculo: o Leaflet precisa do mapa já posicionado para desenhá-lo
      map = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, 14);
      L.tileLayer(dark ? tiles.dark : tiles.light, { maxZoom: 18, attribution: tiles.attribution }).addTo(map);
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const color = accent ? `rgb(${accent.split(/\s+/).join(",")})` : "#f47525";
      const circle = L.circle(center, { radius: radiusKm * 1000, color, weight: 2, fillColor: color, fillOpacity: 0.15 }).addTo(map);
      // Zoom escolhido em Configurações › Mapa; 0 = enquadrar o círculo
      const frame = () => {
        if (!map) return;
        // A janela (lightbox) e a sanfona ainda estão abrindo quando o mapa nasce:
        // sem medir de novo, o Leaflet usa o tamanho antigo e o círculo sai do centro
        map.invalidateSize();
        if (zoom) map.setView(center, zoom);
        else map.fitBounds(circle.getBounds(), { padding: [24, 24] });
      };
      frame();
      ro = new ResizeObserver(frame);
      ro.observe(el.current);
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
    };
  }, [center, radiusKm, zoom, tiles, dark]);

  return <div ref={el} className={cn("z-0 h-72 w-full overflow-hidden rounded-xl md:h-80", className)} />;
}

const radiusLabel = (km: number) => (km < 1 ? `${km * 1000} m` : `${String(km).replace(".", ",")} km`);

/**
 * Seção Localização do anúncio: bairro e cidade + região aproximada num círculo, conforme
 * Configurações › Mapa (janela, sanfona, sempre visível ou desligado). Sem link para o Google Maps.
 */
export function AreaLocation({
  neighborhood,
  place,
  center,
  radiusKm,
  zoom,
  tiles,
  mode,
}: {
  neighborhood: string;
  place: string;
  center: [number, number] | null;
  radiusKm: number;
  zoom: number;
  tiles: MapTiles;
  mode: AreaMode;
}) {
  const [open, setOpen] = useState(false);
  const hasMap = mode !== "off" && !!center;
  const note = `Região aproximada, num raio de ${radiusLabel(radiusKm)}. O endereço exato é informado pelo corretor.`;

  useEffect(() => {
    if (!open || mode !== "lightbox") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, mode]);

  return (
    <div className="grid-bg relative mt-5 overflow-hidden rounded-2xl border border-hairline p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{neighborhood}</p>
          <p className="mt-1 text-sm text-subtle">{place}</p>
        </div>
        {hasMap && mode !== "always" && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-canvas px-4 py-2 text-xs font-medium transition-colors hover:bg-card"
          >
            <MapIcon className="size-3.5" />
            Ver região no mapa
            {mode === "accordion" && <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />}
          </button>
        )}
      </div>

      {hasMap && mode === "always" && (
        <div className="mt-5">
          <RegionMap center={center} radiusKm={radiusKm} zoom={zoom} tiles={tiles} />
          <p className="mt-2 text-[11px] text-subtle">{note}</p>
        </div>
      )}
      {hasMap && mode === "accordion" && open && (
        <div className="mt-5">
          <RegionMap center={center} radiusKm={radiusKm} zoom={zoom} tiles={tiles} />
          <p className="mt-2 text-[11px] text-subtle">{note}</p>
        </div>
      )}
      {hasMap &&
        mode === "lightbox" &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`Região de ${neighborhood}`}
          >
            <div className="w-full max-w-3xl rounded-2xl border border-hairline bg-card p-4 shadow-2xl md:p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{neighborhood}</p>
                  <p className="text-xs text-subtle">{place}</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1.5 text-subtle hover:bg-soft hover:text-ink">
                  <X className="size-4" />
                </button>
              </div>
              <RegionMap center={center} radiusKm={radiusKm} zoom={zoom} tiles={tiles} className="h-[60vh] md:h-[60vh]" />
              <p className="mt-2 text-[11px] text-subtle">{note}</p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
