"use client";

import "leaflet/dist/leaflet.css";
import { ALQUEIRE_M2, formatAlq } from "@/lib/rural";
import { Loader2, Navigation } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Geo = GeoJSON.FeatureCollection;

/** Área geodésica aproximada de um anel (lng/lat) em m² — fórmula esférica. */
function ringArea(coords: number[][]) {
  const R = 6_378_137;
  let total = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % coords.length];
    total +=
      ((lng2 - lng1) * Math.PI) / 180 *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  return Math.abs((total * R * R) / 2);
}

function polygonsArea(geo: Geo) {
  let m2 = 0;
  const add = (g: GeoJSON.Geometry | null) => {
    if (!g) return;
    if (g.type === "Polygon") {
      m2 += ringArea(g.coordinates[0]);
      for (const hole of g.coordinates.slice(1)) m2 -= ringArea(hole);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) add({ type: "Polygon", coordinates: poly });
    } else if (g.type === "GeometryCollection") {
      g.geometries.forEach(add);
    }
  };
  geo.features.forEach((f) => add(f.geometry));
  return m2;
}

/** Decodifica texto respeitando BOM (UTF-8 / UTF-16). */
function decodeText(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

/** Corrige variações comuns de KML gerado por CAR, SIGEF, QGIS etc. */
function normalizeKml(text: string) {
  return (
    text
      .replace(/^\uFEFF/, "")
      // <kml:Placemark> → <Placemark>
      .replace(/<(\/?)kml:/g, "<$1")
      // "lng, lat, alt" → "lng,lat,alt" dentro de <coordinates>
      .replace(/<coordinates>([\s\S]*?)<\/coordinates>/g, (_m, c: string) =>
        `<coordinates>${c.replace(/,\s+/g, ",")}</coordinates>`,
      )
  );
}

/** Plano B: transforma cada <coordinates> em polígono (fechado) ou linha. */
function rawCoordinates(dom: Document): Geo {
  const features: GeoJSON.Feature[] = [];
  for (const el of Array.from(dom.getElementsByTagName("coordinates"))) {
    const pts = (el.textContent ?? "")
      .trim()
      .split(/\s+/)
      .map((t) => t.split(",").map(Number))
      .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map((c) => [c[0], c[1]]);
    if (pts.length === 1) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: pts[0] } });
    } else if (pts.length >= 4 && pts[0][0] === pts.at(-1)![0] && pts[0][1] === pts.at(-1)![1]) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } });
    } else if (pts.length >= 2) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts } });
    }
  }
  return { type: "FeatureCollection", features };
}

async function parseKml(text: string): Promise<Geo> {
  const dom = new DOMParser().parseFromString(normalizeKml(text), "text/xml");
  if (dom.getElementsByTagName("parsererror").length) throw new Error("KML inválido");
  const { kml } = await import("@tmcw/togeojson");
  const geo = kml(dom) as Geo;
  geo.features = geo.features.filter((f) => f.geometry);
  return geo.features.length ? geo : rawCoordinates(dom);
}

/** Lê .kmz (zip, com um ou vários KML) ou .kml e devolve GeoJSON. */
export async function loadKmz(url: string): Promise<Geo> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(bytes);
    const kmls = Object.values(zip.files).filter(
      (f) => !f.dir && f.name.toLowerCase().endsWith(".kml"),
    );
    if (!kmls.length) throw new Error("KMZ sem arquivo KML");
    const all: GeoJSON.Feature[] = [];
    for (const f of kmls) {
      try {
        all.push(...(await parseKml(decodeText(await f.async("uint8array")))).features);
      } catch (e) {
        console.warn(`[kmz] ${f.name}:`, e);
      }
    }
    return { type: "FeatureCollection", features: all };
  }
  return parseKml(decodeText(bytes));
}

/** Mapa de satélite com o perímetro do KMZ. */
export function KmzMap({ url, className }: { url: string; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [info, setInfo] = useState<{ alq: number; center: [number, number] } | null>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [L, geo] = await Promise.all([import("leaflet").then((m) => m.default), loadKmz(url)]);
        if (cancelled || !el.current) return;
        map = L.map(el.current, { zoomControl: true, attributionControl: true });
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Imagens © Esri" },
        ).addTo(map);
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 },
        ).addTo(map);
        const layer = L.geoJSON(geo, {
          style: { color: "#facc15", weight: 3, fillColor: "#facc15", fillOpacity: 0.12 },
          pointToLayer: (_f, latlng) =>
            L.circleMarker(latlng, { radius: 6, color: "#fff", weight: 2, fillColor: "#ef4444", fillOpacity: 1 }),
        }).addTo(map);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [32, 32] });
          const c = bounds.getCenter();
          setInfo({ alq: polygonsArea(geo) / ALQUEIRE_M2, center: [c.lat, c.lng] });
          setState("ready");
        } else {
          map.setView([-23.3, -51.2], 9);
          setState("empty");
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [url]);

  return (
    <div className={className}>
      <div className="relative size-full">
        <div ref={el} className="size-full bg-neutral-900" />
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-neutral-900 text-sm text-white/70">
            <Loader2 className="size-4 animate-spin" />
            Carregando perímetro…
          </div>
        )}
        {state === "empty" && (
          <div className="absolute inset-x-4 top-4 z-[500] rounded-xl bg-black/75 px-4 py-3 text-center text-sm text-white backdrop-blur">
            O arquivo foi lido, mas não contém um perímetro reconhecível (polígono, linha ou
            ponto). Confira no Google Earth se ele mostra a área e exporte novamente como KMZ.
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 px-6 text-center text-sm text-white/70">
            Não foi possível exibir o mapa aqui. Baixe o arquivo KMZ para abrir no Google Earth.
          </div>
        )}
        {info && (
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] flex flex-wrap items-end justify-between gap-2">
            {info.alq > 0.01 && (
              <span className="rounded-full bg-black/70 px-3 py-1.5 font-mono text-xs text-white backdrop-blur">
                Perímetro: ≈ {formatAlq(info.alq)} alq
              </span>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${info.center[0]},${info.center[1]}`}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-neutral-900 shadow-lg"
            >
              <Navigation className="size-3.5" />
              Como chegar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
